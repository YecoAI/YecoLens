import { describe, it, expect } from "vitest";
import {
  logprobToProbability,
  normalizeLogprobs,
  shannonEntropyBits,
  normalizedEntropy,
  computeStepEntropy,
} from "./entropy.js";

describe("logprobToProbability", () => {
  it("ln(1) = 0 → probability 1", () => {
    expect(logprobToProbability(0)).toBeCloseTo(1, 10);
  });
  it("ln(0.5) → probability 0.5", () => {
    expect(logprobToProbability(Math.log(0.5))).toBeCloseTo(0.5, 10);
  });
  it("-Infinity → 0", () => {
    expect(logprobToProbability(-Infinity)).toBe(0);
  });
});

describe("normalizeLogprobs", () => {
  it("sums to 1 for a normal distribution", () => {
    const probs = normalizeLogprobs([Math.log(0.5), Math.log(0.3), Math.log(0.2)]);
    const sum = probs.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(probs[0]).toBeCloseTo(0.5, 6);
  });
  it("returns uniform when all logprobs are -Infinity", () => {
    const probs = normalizeLogprobs([-Infinity, -Infinity, -Infinity]);
    expect(probs).toHaveLength(3);
    for (const p of probs) expect(p).toBeCloseTo(1 / 3, 6);
  });
  it("handles a single entry", () => {
    expect(normalizeLogprobs([Math.log(0.7)])).toEqual([1]);
  });
});

describe("shannonEntropyBits", () => {
  it("is 0 for a certain distribution", () => {
    expect(shannonEntropyBits([1])).toBeCloseTo(0, 10);
  });
  it("is log2(N) for a uniform distribution", () => {
    const n = 4;
    const uniform = Array(n).fill(1 / n);
    expect(shannonEntropyBits(uniform)).toBeCloseTo(Math.log2(n), 10);
  });
  it("is 1 bit for a fair coin", () => {
    expect(shannonEntropyBits([0.5, 0.5])).toBeCloseTo(1, 10);
  });
});

describe("normalizedEntropy", () => {
  it("is 0 when there is only one candidate", () => {
    expect(normalizedEntropy([1])).toBe(0);
  });
  it("is 1 for a uniform distribution", () => {
    expect(normalizedEntropy([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(1, 10);
    expect(normalizedEntropy([0.5, 0.5])).toBeCloseTo(1, 10);
  });
  it("is between 0 and 1 for a skewed distribution", () => {
    const e = normalizedEntropy([0.9, 0.1]);
    expect(e).toBeGreaterThan(0);
    expect(e).toBeLessThan(1);
    expect(e).toBeLessThan(0.5);
  });
  it("increases as the distribution flattens", () => {
    const skewed = normalizedEntropy([0.9, 0.1]);
    const flat = normalizedEntropy([0.6, 0.4]);
    expect(flat).toBeGreaterThan(skewed);
  });
});

describe("computeStepEntropy", () => {
  it("returns normalized probabilities and an entropy in [0,1]", () => {
    const result = computeStepEntropy(Math.log(0.62), [
      { token: "Roma", logprob: Math.log(0.28) },
      { token: "Torino", logprob: Math.log(0.10) },
    ]);
    expect(result.probability).toBeCloseTo(0.62, 2);
    expect(result.entropy).toBeGreaterThan(0);
    expect(result.entropy).toBeLessThan(1);
    const altSum = result.alternatives.reduce((a, b) => a + b.probability, 0);
    expect(result.probability + altSum).toBeCloseTo(1, 6);
  });
  it("preserves token strings and ordering", () => {
    const result = computeStepEntropy(Math.log(0.62), [
      { token: "Roma", logprob: Math.log(0.28) },
      { token: "Torino", logprob: Math.log(0.10) },
    ]);
    expect(result.alternatives.map((a) => a.token)).toEqual(["Roma", "Torino"]);
  });
  it("entropy is 0 when there are no alternatives", () => {
    const result = computeStepEntropy(Math.log(1), []);
    expect(result.entropy).toBe(0);
    expect(result.probability).toBe(1);
    expect(result.alternatives).toEqual([]);
  });
});
