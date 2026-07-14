import { describe, it, expect } from "vitest";
import { buildForkContext, assembleText } from "./fork.js";
import type { ChatMessage, TokenStep } from "./index.js";

function step(index: number, token: string): TokenStep {
  return {
    index,
    token,
    logprob: Math.log(0.5),
    probability: 0.5,
    alternatives: [],
    entropy: 0,
  };
}

const messages: ChatMessage[] = [
  { role: "system", content: "Be concise." },
  { role: "user", content: "Capital of Italy?" },
];

const steps: TokenStep[] = [
  step(0, "The"),
  step(1, " capital"),
  step(2, " of"),
  step(3, " Italy"),
  step(4, " is"),
  step(5, " Milano"),
];

describe("buildForkContext", () => {
  it("keeps tokens before the fork point and injects the alternative", () => {
    const ctx = buildForkContext(messages, steps, 5, " Roma");
    expect(ctx.prefix).toBe("The capital of Italy is Roma");
  });
  it("appends the forced prefix as an assistant message", () => {
    const ctx = buildForkContext(messages, steps, 5, " Roma");
    const last = ctx.messages[ctx.messages.length - 1];
    expect(last.role).toBe("assistant");
    expect(last.content).toBe(ctx.prefix);
  });
  it("preserves prior user/system messages", () => {
    const ctx = buildForkContext(messages, steps, 2, "X");
    expect(ctx.messages[0]).toEqual({ role: "system", content: "Be concise." });
    expect(ctx.messages[1]).toEqual({ role: "user", content: "Capital of Italy?" });
  });
  it("replaces the system prompt when newSystemPrompt is provided", () => {
    const ctx = buildForkContext(messages, steps, 5, " Roma", "Be verbose.");
    const sys = ctx.messages.find((m) => m.role === "system");
    expect(sys?.content).toBe("Be verbose.");
  });
  it("prepends a system prompt if none existed and one is requested", () => {
    const noSystem: ChatMessage[] = [{ role: "user", content: "Hi" }];
    const ctx = buildForkContext(noSystem, [step(0, "H")], 0, "X", "Be nice.");
    expect(ctx.messages[0]).toEqual({ role: "system", content: "Be nice." });
  });
  it("preserves the original system prompt when newSystemPrompt is undefined", () => {
    const ctx = buildForkContext(messages, steps, 5, " Roma");
    expect(ctx.messages.find((m) => m.role === "system")).toEqual({
      role: "system",
      content: "Be concise.",
    });
  });
  it("drops the system prompt when newSystemPrompt is an empty string", () => {
    const ctx = buildForkContext(messages, steps, 5, " Roma", "");
    expect(ctx.messages.find((m) => m.role === "system")).toBeUndefined();
  });
  it("throws on out-of-range fork index", () => {
    expect(() => buildForkContext(messages, steps, -1, "X")).toThrow();
    expect(() => buildForkContext(messages, steps, steps.length, "X")).toThrow();
  });
  it("forking at index 0 injects only the alternative", () => {
    const ctx = buildForkContext(messages, steps, 0, "Rome");
    expect(ctx.prefix).toBe("Rome");
  });
});

describe("assembleText", () => {
  it("joins token strings in order", () => {
    expect(assembleText(steps)).toBe("The capital of Italy is Milano");
  });
  it("returns empty string for no steps", () => {
    expect(assembleText([])).toBe("");
  });
});
