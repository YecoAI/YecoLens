# Yeco-Lens Benchmark Report

**Model:** `gpt-5.4-mini` via `https://api.llm7.io/v1`
**Date:** 2026-07-12 18:07:54 UTC
**Total time:** 35.0s
**Prompts:** 20

> ⚠️ **Note:** LLM7's proxy strips `logprobs` from all upstream responses.
> This benchmark uses **synthetic entropy** (heuristic-based) to exercise
> the full Yeco-Lens pipeline. Results demonstrate tool mechanics; entropy values
> are approximations. For production metrics, use a provider that exposes raw logprobs
> (OpenAI direct, Ollama native `/api/chat`, Groq, Together AI, vLLM).

## 1. Generation Overview

| ID | Category | Tokens | Time(ms) | Toks/s | Mean Ent | Max Ent | Spk≥0.7 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| f01 | factual | 55 | 674 | 81.6 | 0.648 | 0.990 | 23 |
| f02 | factual | 265 | 316 | 838.6 | 0.627 | 0.990 | 96 |
| f03 | factual | 147 | 301 | 488.4 | 0.625 | 0.990 | 50 |
| f04 | factual | 180 | 711 | 253.2 | 0.683 | 0.990 | 83 |
| f05 | factual | 261 | 377 | 692.3 | 0.634 | 0.990 | 96 |
| f06 | factual | 167 | 441 | 378.7 | 0.654 | 0.990 | 66 |
| f07 | factual | 317 | 281 | 1128.1 | 0.625 | 0.990 | 118 |
| c01 | creative | 57 | 350 | 162.9 | 0.653 | 0.990 | 23 |
| c02 | creative | 275 | 279 | 985.7 | 0.647 | 0.990 | 114 |
| c03 | creative | 261 | 276 | 945.7 | 0.639 | 0.990 | 106 |
| c04 | creative | 267 | 326 | 819.0 | 0.656 | 0.990 | 123 |
| c05 | creative | 143 | 321 | 445.5 | 0.647 | 0.990 | 59 |
| r01 | reasoning | 271 | 636 | 426.1 | 0.648 | 0.990 | 116 |
| r02 | reasoning | 108 | 934 | 115.6 | 0.795 | 0.990 | 79 |
| r03 | reasoning | 119 | 302 | 394.0 | 0.638 | 0.990 | 45 |
| r04 | reasoning | 57 | 261 | 218.4 | 0.665 | 0.990 | 26 |
| j01 | json | 3 | 238 | 12.6 | 0.908 | 0.990 | 3 |
| j02 | code | 211 | 257 | 821.0 | 0.673 | 0.990 | 97 |
| j03 | json | 107 | 281 | 380.8 | 0.701 | 0.990 | 52 |
| j04 | code | 289 | 404 | 715.3 | 0.656 | 0.990 | 128 |

## 2. Sample Model Outputs

- **f01** (factual): `The capital of France is Paris. It is a major European city known for landmarks like the Eiffel Tower, the Louvre, and i`
- **f02** (factual): `There are **8 planets** in our solar system:  1. **Mercury** — The smallest planet and closest to the Sun; very hot by d`
- **f03** (factual): `**Romeo and Juliet** was written by **William Shakespeare**.  ### Brief biography William Shakespeare (1564–1616) was an`
- **f04** (factual): `The chemical symbol for gold is **Au**.  ### Periodic table properties of gold - **Atomic number:** 79 - **Element type:`
- **f05** (factual): `World War II ended in **1945**.  Key events of that year included:  - **February:** The **Yalta Conference** brought tog`

## 3. Aggregate Statistics

### Summary Table

| Metric | Value |
| --- | --- |
| Generations completed | 20/20 |
| Generations with errors | 0 |
| Total tokens generated | 3560 |
| Mean tokens per generation | 178.0 |
| Mean generation time (ms) | 398 |
| Mean throughput (tokens/s) | 515.2 |
| Mean Shannon entropy (normalized) | 0.6711 |
| Max entropy observed | 0.9900 |
| Mean token probability | 0.4631 |
| Total entropy spikes ≥ 0.5 | 2711 (76.2% of tokens) |
| Total entropy spikes ≥ 0.7 | 1503 (42.2% of tokens) |
| Total entropy spikes ≥ 0.9 | 439 |
| Total low-confidence tokens (<0.3 prob) | 540 |
| Logprobs source | synthetic (100% tokens) |

## 4. Per-Category Analysis

| Category | N | Mean Ent | Max Ent | Mean Prob | Spikes≥0.7 | Low Conf | Mean Toks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| code | 2 | 0.665 | 0.990 | 0.468 | 225 | 77 | 250.0 |
| creative | 5 | 0.648 | 0.990 | 0.481 | 425 | 159 | 200.6 |
| factual | 7 | 0.642 | 0.990 | 0.486 | 532 | 184 | 198.9 |
| json | 2 | 0.804 | 0.990 | 0.357 | 55 | 26 | 55.0 |
| reasoning | 4 | 0.686 | 0.990 | 0.451 | 266 | 94 | 138.8 |

## 5. Entropy Breakpoint Tests

| Threshold | Triggered | Not Triggered | Trigger Rate |
| ≥0.5 | 0 | 0 | 0% |
| ≥0.7 | 6 | 0 | 100% |
| ≥0.9 | 0 | 0 | 0% |

### Breakpoint Details (threshold=0.7)

| Prompt | Token@ | Token | Entropy |
| --- | --- | --- | --- |
| f01 | 0 | `The capital of Franc` | 0.854 |
| f02 | 2 | `There are **8 planet` | 0.990 |
| f03 | 0 | `**Romeo and Juliet**` | 0.784 |
| f04 | 96 | ` chemical` | 0.773 |
| f05 | 2 | `World War II ended i` | 0.976 |
| f06 | 2 | `The **Pacific Ocean*` | 0.990 |

## 6. Fork & Hot-Reload Tests

| Total | Success | Failed | Success Rate |
| --- | --- | --- | --- |
| 5 | 5 | 0 | 100% |

### Fork Details

| Prompt | Fork@ | Orig | Alt | Child Tok | Child ms | Ent Δ | Child Text Preview |
| --- | --- | --- | --- | --- | --- | --- | --- |
| f01 | 18 | `major` | `[alt_0]` | 49 | 2502 | +0.026 | The capital of France is Paris. It is a  |
| f02 | 88 | `3.` | `[alt_0]` | 325 | 5425 | +0.023 | There are **8 planets** in our solar sys |
| f03 | 49 | ` ` | `[alt_0]` | 131 | 2903 | +0.030 | **Romeo and Juliet** was written by **Wi |
| f04 | 60 | `:**` | `[alt_0]` | 234 | 6077 | -0.036 | The chemical symbol for gold is **Au**.  |
| f05 | 87 | ` ` | `[alt_0]` | 219 | 7456 | +0.028 | World War II ended in **1945**.  Key eve |

## 7. Entropy Distribution

### Percentiles

| Percentile | Entropy |
| --- | --- |
| P10 | 0.3909 |
| P25 | 0.5076 |
| P50 | 0.6551 |
| P75 | 0.7989 |
| P90 | 0.9229 |
| P95 | 0.9900 |
| P99 | 0.9900 |

### Histogram

  0.0-0.1 │ 0
  0.1-0.2 │█ 20
  0.2-0.3 │████████ 126
  0.3-0.4 │███████████████ 237
  0.4-0.5 │██████████████████████████████ 466
  0.5-0.6 │██████████████████████████████████████ 596
  0.6-0.7 │███████████████████████████████████████ 612
  0.7-0.8 │████████████████████████████████████████ 620
  0.8-0.9 │████████████████████████████ 444
  0.9-1.0 │████████████████████████████ 439

## 8. Top 15 Highest Entropy Tokens

| Entropy | Prompt | Token | Prompt Preview |
| --- | --- | --- | --- |
| 0.9900 | r04 | `→` (synth) | What comes next in the sequence 2, 4, 8, 16? Expla |
| 0.9900 | r04 | `each` (synth) | What comes next in the sequence 2, 4, 8, 16? Expla |
| 0.9900 | r04 | `4` (synth) | What comes next in the sequence 2, 4, 8, 16? Expla |
| 0.9900 | r04 | `2` (synth) | What comes next in the sequence 2, 4, 8, 16? Expla |
| 0.9900 | r04 | `-` (synth) | What comes next in the sequence 2, 4, 8, 16? Expla |
| 0.9900 | r04 | `-` (synth) | What comes next in the sequence 2, 4, 8, 16? Expla |
| 0.9900 | r03 | `rearrange` (synth) | If you rearrange CIFAIPC, you get the name of a co |
| 0.9900 | r03 | `I,` (synth) | If you rearrange CIFAIPC, you get the name of a co |
| 0.9900 | r03 | `-` (synth) | If you rearrange CIFAIPC, you get the name of a co |
| 0.9900 | r02 | `\` (synth) | A bat and ball cost $1.10 total. The bat costs $1. |
| 0.9900 | r02 | `\` (synth) | A bat and ball cost $1.10 total. The bat costs $1. |
| 0.9900 | r02 | `[ ` (synth) | A bat and ball cost $1.10 total. The bat costs $1. |
| 0.9900 | r02 | `Let` (synth) | A bat and ball cost $1.10 total. The bat costs $1. |
| 0.9900 | r02 | `1` (synth) | A bat and ball cost $1.10 total. The bat costs $1. |
| 0.9900 | r02 | `1` (synth) | A bat and ball cost $1.10 total. The bat costs $1. |

## 10. Methodology & Caveats

This benchmark exercises the **complete Yeco-Lens pipeline**:

1. **Token streaming** with per-token entropy/probability tracking
2. **Entropy breakpoint detection** at configurable thresholds
3. **Fork & Hot-Reload**: pause generation, inject alternative token, re-stream
4. **Aggregate metrics**: entropy distributions, spike rates, per-category analysis

**Entropy source**: Synthetic (heuristic-based). LLM7's proxy does not forward
`logprobs` from upstream providers. The synthetic entropy model uses:
- Position-based decay (first tokens → higher entropy)
- Token-type heuristics (whitespace/punctuation → low entropy, content words → higher)
- Deterministic hash-based per-token variation for reproducibility

**For real entropy metrics**, use: OpenAI (direct), Ollama (native `/api/chat`),
Groq, Together AI, or vLLM — all expose raw `logprobs` in streaming responses.
