from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Iterator, Optional

from .protocol import TokenStep, TokenAlt, compute_step_entropy


@dataclass
class TraceChunk:
    token: str
    logprob: float
    probability: float
    alternatives: list[TokenAlt] = field(default_factory=list)
    entropy: float = 0.0


class Trace:

    def __init__(
        self,
        client: "YecoLens",  # type: ignore[name-defined]
        trace_id: str,
        model: str,
        provider: str,
        messages: list[dict[str, str]],
    ):
        self._client = client
        self.id = trace_id
        self.model = model
        self.provider = provider
        self.messages = messages
        self._step_index = 0
        self._started_at = time.time()
        self._text_parts: list[str] = []

    def __enter__(self) -> "Trace":
        self._client._set_active_trace(self)
        self._client._send({
            "type": "trace.start",
            "traceId": self.id,
            "model": self.model,
            "provider": self.provider,
            "messages": self.messages,
        })
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self._client._set_active_trace(None)
        text = "".join(self._text_parts)
        duration_ms = int((time.time() - self._started_at) * 1000)
        if exc_type is None:
            self._client._send({
                "type": "trace.end",
                "traceId": self.id,
                "durationMs": duration_ms,
                "text": text,
            })
        else:
            self._client._send({
                "type": "trace.error",
                "traceId": self.id,
                "error": str(exc_val) if exc_val else "unknown error",
            })

    def emit_step(
        self,
        token: str,
        logprob: float,
        alternatives: list[dict[str, Any]],
    ) -> TraceChunk:
        probability, entropy, norm_alts = compute_step_entropy(logprob, alternatives)
        step = TokenStep(
            index=self._step_index,
            token=token,
            logprob=logprob,
            probability=probability,
            alternatives=norm_alts,
            entropy=entropy,
        )
        self._client._send({
            "type": "trace.token",
            "traceId": self.id,
            "step": step.to_dict(),
        })
        self._step_index += 1
        self._text_parts.append(token)
        return TraceChunk(
            token=token,
            logprob=logprob,
            probability=probability,
            alternatives=norm_alts,
            entropy=entropy,
        )

    @staticmethod
    def new_id() -> str:
        return uuid.uuid4().hex[:12]
