import math

from yeco_lens.protocol import (
    logprob_to_probability,
    normalize_logprobs,
    shannon_entropy_bits,
    normalized_entropy,
    compute_step_entropy,
)


def test_logprob_to_probability():
    assert abs(logprob_to_probability(0) - 1.0) < 1e-9
    assert abs(logprob_to_probability(math.log(0.5)) - 0.5) < 1e-9
    assert logprob_to_probability(-1e18) == 0.0


def test_normalize_logprobs_sums_to_one():
    probs = normalize_logprobs([math.log(0.5), math.log(0.3), math.log(0.2)])
    assert abs(sum(probs) - 1.0) < 1e-9
    assert abs(probs[0] - 0.5) < 1e-6


def test_normalize_logprobs_uniform_on_degenerate():
    probs = normalize_logprobs([-1e18, -1e18, -1e18])
    assert len(probs) == 3
    for p in probs:
        assert abs(p - 1 / 3) < 1e-6


def test_shannon_entropy_certain_is_zero():
    assert abs(shannon_entropy_bits([1.0])) < 1e-9


def test_shannon_entropy_uniform_is_log2_n():
    n = 4
    assert abs(shannon_entropy_bits([1 / n] * n) - math.log2(n)) < 1e-9


def test_normalized_entropy_uniform_is_one():
    assert abs(normalized_entropy([0.25, 0.25, 0.25, 0.25]) - 1.0) < 1e-9
    assert abs(normalized_entropy([0.5, 0.5]) - 1.0) < 1e-9


def test_normalized_entropy_single_is_zero():
    assert normalized_entropy([1.0]) == 0.0


def test_normalized_entropy_skewed_is_low():
    e = normalized_entropy([0.9, 0.1])
    assert 0 < e < 0.5


def test_compute_step_entropy():
    prob, entropy, alts = compute_step_entropy(
        math.log(0.62),
        [
            {"token": "Roma", "logprob": math.log(0.28)},
            {"token": "Torino", "logprob": math.log(0.10)},
        ],
    )
    assert abs(prob - 0.62) < 0.01
    assert 0 < entropy < 1
    assert [a.token for a in alts] == ["Roma", "Torino"]
    assert abs(prob + sum(a.probability for a in alts) - 1.0) < 1e-6


def test_compute_step_entropy_no_alternatives():
    prob, entropy, alts = compute_step_entropy(0.0, [])
    assert prob == 1.0
    assert entropy == 0.0
    assert alts == []
