import { describe, it, expect, vi, beforeEach } from "vitest";
import { WSHub } from "./ws.js";
import { TraceStore } from "./trace-store.js";
import { InferenceEngine } from "./inference.js";
import { loadConfig } from "./config.js";
import { initProviderConfig } from "./provider-config.js";
import type { ServerMessage } from "@yeco-ai/protocol";

class FakeWS {
  readyState = 1;
  sent: string[] = [];
  handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  OPEN = 1;
  send(data: string) {
    this.sent.push(data);
  }
  on(event: string, fn: (...args: unknown[]) => void) {
    (this.handlers[event] ??= []).push(fn);
  }
  emit(event: string, ...args: unknown[]) {
    for (const fn of this.handlers[event] ?? []) fn(...args);
  }
  close() {
    this.readyState = 3;
    this.emit("close");
  }
}

function makeHub() {
  const config = loadConfig({ openaiApiKey: undefined, port: 0 });
  const store = new TraceStore();
  const engine = new InferenceEngine(config, store);
  const hub = new WSHub({
    config,
    store,
    engine,
    probeOllama: async () => ({ reachable: true, url: "http://127.0.0.1:11434", models: [] }),
    probeOpenAI: async () => ({ reachable: false, models: [] }),
  });
  return { config, store, engine, hub };
}

function parseSent(ws: FakeWS): ServerMessage[] {
  return ws.sent.map((s) => JSON.parse(s) as ServerMessage);
}

describe("WSHub", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    initProviderConfig({ baseUrl: "https://api.openai.com" });
  });

  it("sends status and models.list on connect", async () => {
    const { hub } = makeHub();
    await hub.refreshModels();
    const ws = new FakeWS();
    hub.addClient(ws as unknown as import("ws").WebSocket);

    const msgs = parseSent(ws);
    expect(msgs.find((m) => m.type === "status")).toBeDefined();
    expect(msgs.find((m) => m.type === "models.list")).toBeDefined();
  });

  it("broadcasts trace.start / trace.token / trace.end for a generation", async () => {
    const { hub } = makeHub();
    const ws = new FakeWS();
    hub.addClient(ws as unknown as import("ws").WebSocket);

    const ndjson = [
      {
        model: "qwen2.5",
        logprobs: {
          content: [
            {
              token: "Hello",
              logprob: Math.log(0.9),
              top_logprobs: [{ token: "Hello", logprob: Math.log(0.9) }, { token: "Hi", logprob: Math.log(0.1) }],
            },
          ],
        },
      },
      { model: "qwen2.5", done: true },
    ].map((o) => JSON.stringify(o)).join("\n");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(ndjson));
          c.close();
        },
      }),
      text: async () => "",
    } as unknown as Response);

    ws.emit("message", JSON.stringify({
      type: "generate",
      provider: "ollama",
      model: "qwen2.5",
      messages: [{ role: "user", content: "hi" }],
    }));

    await new Promise((r) => setTimeout(r, 50));

    const msgs = parseSent(ws);
    const starts = msgs.filter((m) => m.type === "trace.start");
    const tokens = msgs.filter((m) => m.type === "trace.token");
    const ends = msgs.filter((m) => m.type === "trace.end");

    expect(starts.length).toBeGreaterThanOrEqual(1);
    expect(tokens.length).toBe(1);
    expect(tokens[0]).toMatchObject({ type: "trace.token" });
    if (tokens[0].type === "trace.token") {
      expect(tokens[0].step.token).toBe("Hello");
      expect(tokens[0].step.alternatives.map((a) => a.token)).toEqual(["Hi"]);
      expect(tokens[0].step.entropy).toBeGreaterThanOrEqual(0);
      expect(tokens[0].step.entropy).toBeLessThanOrEqual(1);
    }
    expect(ends.length).toBe(1);
    if (ends[0].type === "trace.end") {
      expect(ends[0].text).toBe("Hello");
    }
  });

  it("emits a breakpoint when entropy exceeds threshold", async () => {
    const { hub } = makeHub();
    const ws = new FakeWS();
    hub.addClient(ws as unknown as import("ws").WebSocket);

    const ndjson = [
      {
        model: "qwen2.5",
        logprobs: {
          content: [
            {
              token: "A",
              logprob: Math.log(1 / 3),
              top_logprobs: [
                { token: "A", logprob: Math.log(1 / 3) },
                { token: "B", logprob: Math.log(1 / 3) },
                { token: "C", logprob: Math.log(1 / 3) },
              ],
            },
          ],
        },
      },
      { model: "qwen2.5", done: true },
    ].map((o) => JSON.stringify(o)).join("\n");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode(ndjson));
          c.close();
        },
      }),
      text: async () => "",
    } as unknown as Response);

    ws.emit("message", JSON.stringify({
      type: "generate",
      provider: "ollama",
      model: "qwen2.5",
      messages: [{ role: "user", content: "?" }],
      entropyBreakpoint: 0.5,
    }));

    await new Promise((r) => setTimeout(r, 50));

    const msgs = parseSent(ws);
    const bp = msgs.find((m) => m.type === "trace.breakpoint");
    expect(bp).toBeDefined();
    if (bp && bp.type === "trace.breakpoint") {
      expect(bp.reason).toBe("entropy");
      expect(bp.entropy).toBeCloseTo(1, 5);
    }
  });

  it("surfaces OpenAI models + reachable status after config is set", async () => {
    const config = loadConfig({ port: 0 });
    const store = new TraceStore();
    const engine = new InferenceEngine(config, store);
    const hub = new WSHub({
      config,
      store,
      engine,
      probeOllama: async () => ({ reachable: false, models: [] }),
      probeOpenAI: async () => ({
        reachable: true,
        models: [{ id: "llama-3.1-8b-instant", name: "llama-3.1-8b-instant", provider: "openai" }],
      }),
    });

    initProviderConfig({ baseUrl: "https://api.groq.com/openai", apiKey: "gsk_test" });

    await hub.refreshModels();
    const st = hub.status();
    expect(st.openaiConfigured).toBe(true);
    expect(st.openaiReachable).toBe(true);
    expect(st.openaiBaseUrl).toBe("https://api.groq.com/openai");
  });

  it("reports openaiReachable=false when the probe fails", async () => {
    const config = loadConfig({ port: 0 });
    const store = new TraceStore();
    const engine = new InferenceEngine(config, store);
    const hub = new WSHub({
      config,
      store,
      engine,
      probeOllama: async () => ({ reachable: false, models: [] }),
      probeOpenAI: async () => ({ reachable: false, models: [] }),
    });
    initProviderConfig({ baseUrl: "https://api.openai.com", apiKey: "sk-test" });

    await hub.refreshModels();
    expect(hub.status().openaiConfigured).toBe(true);
    expect(hub.status().openaiReachable).toBe(false);
  });
});
