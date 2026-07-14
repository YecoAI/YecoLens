from __future__ import annotations

import math
from dataclasses import dataclass, field, asdict
from typing import Any, Optional


@dataclass
class TokenAlt:
    token: str
    logprob: float
    probability: float


@dataclass
class TokenStep:
    index: int
    token: str
    logprob: float
    probability: float
    alternatives: list[TokenAlt] = field(default_factory=list)
    entropy: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["alternatives"] = [asdict(a) if isinstance(a, TokenAlt) else a for a in self.alternatives]
        return d


def logprob_to_probability(logprob: float) -> float:
    try:
        return math.exp(logprob)
    except OverflowError:
        return 0.0


def normalize_logprobs(logprobs: list[float]) -> list[float]:
    probs = [logprob_to_probability(lp) for lp in logprobs]
    total = sum(probs)
    if total <= 0:
        n = len(probs)
        return [1.0 / n] * n if n else []
    return [p / total for p in probs]


def shannon_entropy_bits(probabilities: list[float]) -> float:
    h = 0.0
    for p in probabilities:
        if p > 0:
            h -= p * math.log2(p)
    return h


def normalized_entropy(probabilities: list[float]) -> float:
    if len(probabilities) <= 1:
        return 0.0
    h = shannon_entropy_bits(probabilities)
    h_max = math.log2(len(probabilities))
    if h_max <= 0:
        return 0.0
    return h / h_max


def compute_step_entropy(
    emitted_logprob: float,
    alternatives: list[dict[str, Any]],
) -> tuple[float, float, list[TokenAlt]]:
    all_logprobs = [emitted_logprob] + [a["logprob"] for a in alternatives]
    probs = normalize_logprobs(all_logprobs)
    probability = probs[0]
    entropy = normalized_entropy(probs)
    norm_alts = [
        TokenAlt(token=alternatives[i]["token"], logprob=alternatives[i]["logprob"], probability=probs[i + 1])
        for i in range(len(alternatives))
    ]
    return probability, entropy, norm_alts

