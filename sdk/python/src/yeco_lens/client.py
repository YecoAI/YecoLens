from __future__ import annotations

import json
import os
import threading
from typing import Any, Iterator, Optional

from .trace import Trace, TraceChunk


class YecoLens:

    def __init__(
        self,
        endpoint: Optional[str] = None,
        *,
        connect: bool = True,
    ):
        self._endpoint = endpoint or os.environ.get(
            "YECO_LENS_ENDPOINT", "ws://127.0.0.1:7531/ws"
        )
        self._ws: Any = None
        self._lock = threading.Lock()
        self._connected = False
        if connect:
            self._try_connect()

    def _try_connect(self) -> None:
        try:
            from websocket import create_connection  # type: ignore
        except ImportError:
            return
        try:
            self._ws = create_connection(self._endpoint, timeout=2)
            self._connected = True
        except Exception:
            self._ws = None
            self._connected = False

    @property
    def connected(self) -> bool:
        return self._connected

    def _send(self, msg: dict[str, Any]) -> None:
        if not self._connected or self._ws is None:
            return
        try:
            with self._lock:
                self._ws.send(json.dumps(msg))
        except Exception:
            self._connected = False
            self._ws = None

    def close(self) -> None:
        if self._ws is not None:
            try:
                self._ws.close()
            except Exception:
                pass
            self._ws = None
            self._connected = False

    def trace(
        self,
        model: str,
        *,
        system_prompt: Optional[str] = None,
        user_message: Optional[str] = None,
        messages: Optional[list[dict[str, str]]] = None,
        provider: str = "sdk",
    ) -> Trace:
        if messages is None:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            if user_message:
                messages.append({"role": "user", "content": user_message})
        trace_id = Trace.new_id()
        return Trace(self, trace_id, model, provider, messages)

    def openai_chat(
        self,
        client: Any,
        *,
        model: str,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        top_logprobs: int = 10,
        **kwargs: Any,
    ) -> Iterator[TraceChunk]:
        stream = client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            logprobs=True,
            top_logprobs=top_logprobs,
            temperature=temperature,
            **kwargs,
        )
        trace = self._current_trace()
        for chunk in stream:
            choice = chunk.choices[0] if chunk.choices else None
            if not choice:
                continue
            lp_content = getattr(getattr(choice, "logprobs", None), "content", None)
            if lp_content:
                entry = lp_content[0]
                alternatives = [
                    {"token": t.token, "logprob": t.logprob}
                    for t in (entry.top_logprobs or [])
                    if t.token != entry.token
                ]
                if trace:
                    yield trace.emit_step(entry.token, entry.logprob, alternatives)
                else:
                    yield TraceChunk(token=entry.token, logprob=entry.logprob, probability=1.0)
            elif choice.delta and getattr(choice.delta, "content", None):
                token = choice.delta.content
                if trace:
                    yield trace.emit_step(token, 0.0, [])
                else:
                    yield TraceChunk(token=token, logprob=0.0, probability=1.0)

    def ollama_chat(
        self,
        client: Any,
        *,
        model: str,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        top_logprobs: int = 10,
        **kwargs: Any,
    ) -> Iterator[TraceChunk]:
        stream = client.chat(
            model=model,
            messages=messages,
            stream=True,
            options={"temperature": temperature},
            logprobs=True,
            top_logprobs=top_logprobs,
            **kwargs,
        )
        trace = self._current_trace()
        for chunk in stream:
            lps = getattr(chunk, "logprobs", None)
            if lps and lps.content:
                entry = lps.content[0]
                alternatives = [
                    {"token": t.token, "logprob": t.logprob}
                    for t in (entry.top_logprobs or [])
                    if t.token != entry.token
                ]
                if trace:
                    yield trace.emit_step(entry.token, entry.logprob, alternatives)
                else:
                    yield TraceChunk(token=entry.token, logprob=entry.logprob, probability=1.0)
            elif chunk.get("message", {}).get("content"):
                token = chunk["message"]["content"]
                if trace:
                    yield trace.emit_step(token, 0.0, [])
                else:
                    yield TraceChunk(token=token, logprob=0.0, probability=1.0)

    _active_trace_local = threading.local()

    def _current_trace(self) -> Optional[Trace]:
        return getattr(YecoLens._active_trace_local, "trace", None)

    @staticmethod
    def _set_active_trace(trace: Optional[Trace]) -> None:
        YecoLens._active_trace_local.trace = trace
