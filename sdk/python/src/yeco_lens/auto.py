from __future__ import annotations

import functools
import threading
from contextlib import contextmanager
from typing import Any, Iterator, Optional

from .client import YecoLens

_client: Optional[YecoLens] = None
_patched: dict[str, tuple[Any, Any]] = {}
_lock = threading.Lock()


def get_client() -> YecoLens:
    global _client
    with _lock:
        if _client is None:
            _client = YecoLens()
        return _client


def patch_openai(_completions_cls: Any = None) -> bool:
    if _completions_cls is None:
        try:
            from openai.resources.chat.completions import Completions  # type: ignore
        except ImportError:
            return False
        completions_cls = Completions
    else:
        completions_cls = _completions_cls

    if "openai.Completions.create" in _patched:
        return True

    original_create = completions_cls.create

    @functools.wraps(original_create)
    def traced_create(self, *args, **kwargs):
        is_stream = kwargs.get("stream", False)
        kwargs["logprobs"] = True
        if "top_logprobs" not in kwargs or kwargs["top_logprobs"] is None:
            kwargs["top_logprobs"] = 10

        if not is_stream:
            return original_create(self, *args, **kwargs)

        result = original_create(self, *args, **kwargs)
        model = kwargs.get("model", "unknown")
        messages = kwargs.get("messages", [])
        return _tee_openai_stream(result, model, messages)

    completions_cls.create = traced_create  # type: ignore
    _patched["openai.Completions.create"] = (original_create, traced_create)
    _patched["__openai_cls__"] = (completions_cls, completions_cls)
    return True


def _tee_openai_stream(stream: Any, model: str, messages: list[dict]) -> Iterator[Any]:
    client = get_client()
    trace = client.trace(model=model, messages=messages, provider="sdk")
    trace.__enter__()
    try:
        for chunk in stream:
            choice = chunk.choices[0] if chunk.choices else None
            if choice:
                lp_content = getattr(getattr(choice, "logprobs", None), "content", None)
                if lp_content:
                    entry = lp_content[0]
                    alternatives = [
                        {"token": t.token, "logprob": t.logprob}
                        for t in (entry.top_logprobs or [])
                        if t.token != entry.token
                    ]
                    trace.emit_step(entry.token, entry.logprob, alternatives)
            yield chunk
    except Exception:
        trace.__exit__(Exception, Exception("stream error"), None)
        raise
    else:
        trace.__exit__(None, None, None)


def patch_ollama() -> bool:
    try:
        import ollama  # type: ignore
        from ollama import Client as OllamaClient  # type: ignore
    except ImportError:
        return False

    patched_any = False

    if "ollama.Client.chat" not in _patched and hasattr(OllamaClient, "chat"):
        original_chat = OllamaClient.chat

        @functools.wraps(original_chat)
        def traced_chat(self, *args, **kwargs):
            kwargs["logprobs"] = True
            if "top_logprobs" not in kwargs or kwargs["top_logprobs"] is None:
                kwargs["top_logprobs"] = 10
            is_stream = kwargs.get("stream", False)
            result = original_chat(self, *args, **kwargs)
            if not is_stream:
                return result
            model = kwargs.get("model", "unknown")
            messages = kwargs.get("messages", [])
            return _tee_ollama_stream(result, model, messages)

        OllamaClient.chat = traced_chat  # type: ignore
        _patched["ollama.Client.chat"] = (original_chat, traced_chat)
        patched_any = True

    if "ollama._client.chat" not in _patched:
        try:
            from ollama._client import Client as _PrivClient  # type: ignore
            if hasattr(_PrivClient, "chat") and "ollama.Client.chat" in _patched:
                _patched.setdefault("ollama._client.chat", (_PrivClient.chat, _PrivClient.chat))
        except ImportError:
            pass

    return patched_any


def _tee_ollama_stream(stream: Any, model: str, messages: list[dict]) -> Iterator[Any]:
    client = get_client()
    trace = client.trace(model=model, messages=messages, provider="sdk")
    trace.__enter__()
    try:
        for chunk in stream:
            lps = getattr(chunk, "logprobs", None)
            if lps and getattr(lps, "content", None):
                entry = lps.content[0]
                alternatives = [
                    {"token": t.token, "logprob": t.logprob}
                    for t in (entry.top_logprobs or [])
                    if t.token != entry.token
                ]
                trace.emit_step(entry.token, entry.logprob, alternatives)
            yield chunk
    except Exception:
        trace.__exit__(Exception, Exception("stream error"), None)
        raise
    else:
        trace.__exit__(None, None, None)


def auto(enable_openai: bool = True, enable_ollama: bool = True) -> dict[str, bool]:
    get_client()
    results = {}
    if enable_openai:
        results["openai"] = patch_openai()
    if enable_ollama:
        results["ollama"] = patch_ollama()
    return results


def unpatch() -> None:
    with _lock:
        original = _patched.get("openai.Completions.create")
        cls_entry = _patched.get("__openai_cls__")
        if original and cls_entry:
            patched_cls = cls_entry[0]
            patched_cls.create = original[0]
        ollama_entry = _patched.get("ollama.Client.chat")
        if ollama_entry:
            try:
                from ollama import Client as OllamaClient  # type: ignore
                OllamaClient.chat = ollama_entry[0]
            except ImportError:
                pass
        _patched.clear()


@contextmanager
def auto_intercept(enable_openai: bool = True, enable_ollama: bool = True):
    auto(enable_openai=enable_openai, enable_ollama=enable_ollama)
    try:
        yield
    finally:
        unpatch()
