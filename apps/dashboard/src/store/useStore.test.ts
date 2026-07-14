import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "./useStore";
import type { ServerMessage, TokenStep } from "@yeco-ai/protocol";

function step(index: number, token: string, entropy = 0.1, probability = 0.9): TokenStep {
  return {
    index,
    token,
    logprob: Math.log(probability),
    probability,
    alternatives: [],
    entropy,
  };
}

describe("dashboard store", () => {
  beforeEach(() => {
    useStore.setState({
      connected: false,
      status: null,
      models: [],
      selectedModelId: null,
      traces: {},
      activeTraceId: null,
    });
  });

  function dispatch(msg: ServerMessage) {
    useStore.getState().onServerMessage(msg);
  }

  it("stores server status", () => {
    dispatch({
      type: "status",
      status: {
        connected: true,
        ollamaReachable: true,
        ollamaUrl: "http://x:11434",
        openaiConfigured: false,
        version: "1.0.0",
      },
    });
    expect(useStore.getState().connected).toBe(true);
    expect(useStore.getState().status?.ollamaReachable).toBe(true);
  });

  it("stores model list and auto-selects the first", () => {
    dispatch({ type: "models.list", models: [{ id: "qwen2.5", name: "qwen2.5", provider: "ollama" }] });
    expect(useStore.getState().models).toHaveLength(1);
    expect(useStore.getState().selectedModelId).toBe("qwen2.5");
  });

  it("starts a trace and appends tokens", () => {
    dispatch({ type: "trace.start", traceId: "t1", model: "qwen2.5", provider: "ollama", messages: [{ role: "user", content: "hi" }] });
    dispatch({ type: "trace.token", traceId: "t1", step: step(0, "Hello") });
    dispatch({ type: "trace.token", traceId: "t1", step: step(1, " world") });

    const trace = useStore.getState().traces["t1"];
    expect(trace.steps).toHaveLength(2);
    expect(trace.steps[0].token).toBe("Hello");
    expect(trace.status).toBe("running");
  });

  it("pauses on breakpoint", () => {
    dispatch({ type: "trace.start", traceId: "t1", model: "m", provider: "ollama", messages: [] });
    dispatch({ type: "trace.breakpoint", traceId: "t1", atIndex: 3, entropy: 0.9, reason: "entropy" });
    const trace = useStore.getState().traces["t1"];
    expect(trace.status).toBe("paused");
    expect(trace.breakpointAt).toBe(3);
    expect(trace.breakpointEntropy).toBeCloseTo(0.9);
  });

  it("ends a trace with text + duration", () => {
    dispatch({ type: "trace.start", traceId: "t1", model: "m", provider: "ollama", messages: [] });
    dispatch({ type: "trace.token", traceId: "t1", step: step(0, "Hi") });
    dispatch({ type: "trace.end", traceId: "t1", durationMs: 42, text: "Hi" });
    const trace = useStore.getState().traces["t1"];
    expect(trace.status).toBe("ended");
    expect(trace.text).toBe("Hi");
    expect(trace.durationMs).toBe(42);
  });

  it("records errors", () => {
    dispatch({ type: "trace.start", traceId: "t1", model: "m", provider: "ollama", messages: [] });
    dispatch({ type: "trace.error", traceId: "t1", error: "boom" });
    const trace = useStore.getState().traces["t1"];
    expect(trace.status).toBe("error");
    expect(trace.error).toBe("boom");
  });
});
