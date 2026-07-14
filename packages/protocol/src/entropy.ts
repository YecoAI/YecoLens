import type { TokenAlt } from "./index.js";

export function logprobToProbability(logprob: number): number {
  return Math.exp(logprob);
}

export function normalizeLogprobs(logprobs: number[]): number[] {
  const probs = logprobs.map(logprobToProbability);
  const sum = probs.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    const uniform = 1 / probs.length;
    return probs.map(() => uniform);
  }
  return probs.map((p) => p / sum);
}

export function shannonEntropyBits(probabilities: number[]): number {
  let h = 0;
  for (const p of probabilities) {
    if (p > 0) {
      h -= p * Math.log2(p);
    }
  }
  return h;
}

export function normalizedEntropy(probabilities: number[]): number {
  if (probabilities.length <= 1) return 0;
  const h = shannonEntropyBits(probabilities);
  const hMax = Math.log2(probabilities.length);
  if (hMax <= 0) return 0;
  return h / hMax;
}

export function computeStepEntropy(
  emittedLogprob: number,
  alternatives: { token: string; logprob: number }[]
): { probability: number; entropy: number; alternatives: TokenAlt[] } {
  const allLogprobs = [emittedLogprob, ...alternatives.map((a) => a.logprob)];
  const probs = normalizeLogprobs(allLogprobs);

  const probability = probs[0];
  const entropy = normalizedEntropy(probs);

  const normalizedAlts: TokenAlt[] = alternatives.map((a, i) => ({
    token: a.token,
    logprob: a.logprob,
    probability: probs[i + 1],
  }));

  return { probability, entropy, alternatives: normalizedAlts };
}
