/**
 * Integration test: full lifecycle
 *   server start → WS connect → generate → breakpoint → fork → resume
 *
 * Uses a real Fastify server on a random port and a WebSocket client.
 * Provider responses are mocked via global.fetch so no real LLM is needed.
 * All tests use the "ollama" provider since mocks return Ollama NDJSON format.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createServer, type YecoLensServer } from "./index.js";
import { initProviderConfig } from "./provider-config.js";
import type { ServerMessage, WireMessage } from "@yeco-ai/protocol";
import WebSocket from "ws";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function wsWait(ws: WebSocket, event: "open" | "message" | "close"): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), 5000);
    ws.once(event, (data: unknown) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}

/**
 * Collect messages from a WS. Attach BEFORE connecting to avoid race conditions.
 * waitFor(n) resolves when at least n messages have been collected.
 * waitForMore(afterCount, atLeast) resolves when at least (afterCount + atLeast)
 *   messages have been collected, returning only the new messages after afterCount.
 */
function messageCollector(ws: WebSocket): {
  msgs: ServerMessage[];
  waitFor(n: number, ms?: number): Promise<ServerMessage[]>;
  waitForMore(afterCount: number, atLeast: number, ms?: number): Promise<ServerMessage[]>;
} {
  const msgs: ServerMessage[] = [];
  ws.on("message", (raw: WebSocket.Data) => {
    msgs.push(JSON.parse(raw.toString()) as ServerMessage);
  });
  return {
    msgs,
    waitFor(n: number, ms = 15000) {
      return new Promise((resolve, reject) => {
        if (msgs.length >= n) { resolve(msgs.slice(0, n)); return; }
        const timer = setTimeout(() => reject(new Error(`timeout: got ${msgs.length}/${n}`)), ms);
        const check = () => { if (msgs.length >= n) { clearTimeout(timer); resolve(msgs.slice(0, n)); } };
        ws.on("message", () => check());
      });
    },
    waitForMore(afterCount: number, atLeast: number, ms = 15000) {
      return new Promise((resolve, reject) => {
        if (msgs.length >= afterCount + atLeast) { resolve(msgs.slice(afterCount)); return; }
        const timer = setTimeout(() => reject(new Error(`timeout: got ${msgs.length}, need ${afterCount + atLeast}`)), ms);
        const check = () => { if (msgs.length >= afterCount + atLeast) { clearTimeout(timer); resolve(msgs.slice(afterCount)); } };
        ws.on("message", () => check());
      });
    },
  };
}

/** Build a fake Ollama NDJSON body for tokens */
function makeOllamaBody(tokens: { token: string; logprob: number; alts: { token: string; logprob: number }[] }[]): string {
  const lines = tokens.map((t) => ({
    model: "test-model",
    logprobs: {
      content: [
        {
          token: t.token,
          logprob: t.logprob,
          top_logprobs: [{ token: t.token, logprob: t.logprob }, ...t.alts],
        },
      ],
    },
  }));
  lines.push({ model: "test-model", done: true });
  return lines.map((o) => JSON.stringify(o)).join("\n");
}

/* ------------------------------------------------------------------ */
/*  Tests                                                             */
/* ------------------------------------------------------------------ */

let server: YecoLensServer | undefined;

beforeEach(() => {
  vi.restoreAllMocks();
  initProviderConfig({ baseUrl: "https://api.openai.com" });
});

afterEach(async () => {
  if (server) {
    await server.close();
    server = undefined;
  }
  vi.restoreAllMocks();
});

describe("integration: full lifecycle", () => {
  vi.setConfig({ testTimeout: 15000 });

  it("generate → tokens → breakpoint → fork → child tokens", async () => {
    // Generation 1: two tokens, second triggers entropy breakpoint
    const body1 = makeOllamaBody([
      { token: "Hello", logprob: Math.log(0.95), alts: [{ token: "Hi", logprob: Math.log(0.05) }] },
      {
        token: " Milan",
        logprob: Math.log(0.33),
        alts: [
          { token: " Rome", logprob: Math.log(0.33) },
          { token: " Naples", logprob: Math.log(0.34) },
        ],
      },
    ]);

    // Generation 2 (fork child): one token with low entropy
    const body2 = makeOllamaBody([
      { token: " Rome", logprob: Math.log(0.95), alts: [{ token: "Roma", logprob: Math.log(0.05) }] },
    ]);

    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/tags")) {
        return new Response(JSON.stringify({ models: [{ name: "test-model" }] }), { status: 200 });
      }

      if (url.includes("/api/chat")) {
        callCount++;
        const body = callCount === 1 ? body1 : body2;
        return new Response(body, {
          status: 200,
          headers: { "content-type": "application/x-ndjson" },
        });
      }

      return new Response("{}", { status: 404 });
    });

    server = await createServer({ port: 0, openBrowser: false });

    const ws = new WebSocket(server.handle.wsUrl);
    const col = messageCollector(ws);
    await wsWait(ws, "open");

    // Initial messages: status + models.list
    const initial = await col.waitFor(2);
    expect(initial.find((m) => m.type === "status")).toBeDefined();
    expect(initial.find((m) => m.type === "models.list")).toBeDefined();

    // Send generate with entropy breakpoint
    const generateMsg: WireMessage = {
      type: "generate",
      provider: "ollama",
      model: "test-model",
      messages: [{ role: "user", content: "Hello" }],
      entropyBreakpoint: 0.8,
    };
    ws.send(JSON.stringify(generateMsg));

    // Expected new messages: trace.start, trace.token, trace.token, trace.breakpoint = 4
    const genMsgs = await col.waitForMore(2, 4);

    const starts = genMsgs.filter((m) => m.type === "trace.start");
    const tokens = genMsgs.filter((m) => m.type === "trace.token");
    const bps = genMsgs.filter((m) => m.type === "trace.breakpoint");

    expect(starts).toHaveLength(1);
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({ type: "trace.token", step: { token: "Hello" } });
    expect(tokens[1]).toMatchObject({ type: "trace.token", step: { token: " Milan" } });

    if (tokens[1].type === "trace.token") {
      expect(tokens[1].step.entropy).toBeCloseTo(1.0, 1);
    }

    expect(bps).toHaveLength(1);
    const bp = bps[0];
    if (bp.type === "trace.breakpoint") {
      expect(bp.reason).toBe("entropy");
      expect(bp.entropy).toBeCloseTo(1.0, 1);
      expect(bp.atIndex).toBe(1);

      // Fork from breakpoint
      const forkMsg: WireMessage = {
        type: "fork",
        traceId: bp.traceId,
        atIndex: bp.atIndex,
        altTokenIndex: 0, // pick " Rome"
      };
      ws.send(JSON.stringify(forkMsg));

      // Expected new messages: trace.forked, trace.start, trace.token, trace.end = 4
      const forkMsgs = await col.waitForMore(6, 4);

      const forkeds = forkMsgs.filter((m) => m.type === "trace.forked");
      const childStarts = forkMsgs.filter((m) => m.type === "trace.start");
      const childTokens = forkMsgs.filter((m) => m.type === "trace.token");
      const childEnds = forkMsgs.filter((m) => m.type === "trace.end");

      expect(forkeds).toHaveLength(1);
      if (forkeds[0].type === "trace.forked") {
        // traceId in forked event is the parent trace
        expect(forkeds[0].traceId).toBe(bp.traceId);
      }

      expect(childStarts).toHaveLength(1);
      expect(childTokens).toHaveLength(1);
      if (childTokens[0].type === "trace.token") {
        expect(childTokens[0].step.token).toBe(" Rome");
        expect(childTokens[0].step.entropy).toBeLessThan(0.5);
      }

      expect(childEnds).toHaveLength(1);
      if (childEnds[0].type === "trace.end") {
        expect(childEnds[0].text).toBe(" Rome");
      }
    }

    ws.close();
  });

  it("fork preserves original provider through WS lifecycle", async () => {
    const body = makeOllamaBody([
      { token: "A", logprob: Math.log(0.5), alts: [{ token: "B", logprob: Math.log(0.5) }] },
    ]);

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/tags")) {
        return new Response(JSON.stringify({ models: [{ name: "test-model" }] }), { status: 200 });
      }
      if (url.includes("/api/chat")) {
        return new Response(body, {
          status: 200,
          headers: { "content-type": "application/x-ndjson" },
        });
      }
      return new Response("{}", { status: 404 });
    });

    server = await createServer({ port: 0, openBrowser: false });
    const ws = new WebSocket(server.handle.wsUrl);
    const col = messageCollector(ws);
    await wsWait(ws, "open");

    // Drain initial messages
    await col.waitFor(2);

    // Generate with ollama provider
    ws.send(JSON.stringify({
      type: "generate",
      provider: "ollama",
      model: "test-model",
      messages: [{ role: "user", content: "Test" }],
    }));

    // Expected: trace.start + trace.token + trace.end = 3
    const genMsgs = await col.waitForMore(2, 3);
    const start = genMsgs.find((m) => m.type === "trace.start");
    expect(start).toBeDefined();
    if (start && start.type === "trace.start") {
      expect(start.provider).toBe("ollama");
      const traceId = start.traceId;

      const token = genMsgs.find((m) => m.type === "trace.token");
      if (token && token.type === "trace.token") {
        ws.send(JSON.stringify({
          type: "fork",
          traceId,
          atIndex: token.step.index,
          altTokenIndex: 0,
        }));

        // Expected: trace.forked + trace.start + trace.token + trace.end = 4
        const forkMsgs = await col.waitForMore(5, 4);
        const childStart = forkMsgs.find((m) => m.type === "trace.start");
        expect(childStart).toBeDefined();
        if (childStart && childStart.type === "trace.start") {
          expect(childStart.provider).toBe("ollama");
        }
      }
    }

    ws.close();
  });

  it("pause → resume → generates new tokens", async () => {
    const body1 = makeOllamaBody([
      { token: "First", logprob: Math.log(0.9), alts: [{ token: "X", logprob: Math.log(0.1) }] },
    ]);

    const body2 = makeOllamaBody([
      { token: "Resumed", logprob: Math.log(0.9), alts: [{ token: "Y", logprob: Math.log(0.1) }] },
    ]);

    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/tags")) {
        return new Response(JSON.stringify({ models: [{ name: "test-model" }] }), { status: 200 });
      }
      if (url.includes("/api/chat")) {
        callCount++;
        const body = callCount === 1 ? body1 : body2;
        return new Response(body, { status: 200, headers: { "content-type": "application/x-ndjson" } });
      }
      return new Response("{}", { status: 404 });
    });

    server = await createServer({ port: 0, openBrowser: false });
    const ws = new WebSocket(server.handle.wsUrl);
    const col = messageCollector(ws);
    await wsWait(ws, "open");
    await col.waitFor(2);

    // Generate — mock returns instantly, so it completes before we can pause
    ws.send(JSON.stringify({
      type: "generate",
      provider: "ollama",
      model: "test-model",
      messages: [{ role: "user", content: "Test" }],
    }));

    // Expected: trace.start + trace.token + trace.end = 3
    const genMsgs = await col.waitForMore(2, 3);
    expect(callCount).toBe(1);

    const start = genMsgs.find((m) => m.type === "trace.start");
    expect(start).toBeDefined();
    if (start && start.type === "trace.start") {
      const traceId = start.traceId;

      // Resume — starts a fresh generation with the same messages
      ws.send(JSON.stringify({ type: "resume", traceId }));

      // Expected: trace.start + trace.token + trace.end = 3 new messages
      const resumeMsgs = await col.waitForMore(5, 3);
      expect(callCount).toBe(2);

      const resumeStart = resumeMsgs.find((m) => m.type === "trace.start");
      const resumeToken = resumeMsgs.find((m) => m.type === "trace.token");
      const resumeEnd = resumeMsgs.find((m) => m.type === "trace.end");

      expect(resumeStart).toBeDefined();
      if (resumeToken && resumeToken.type === "trace.token") {
        expect(resumeToken.step.token).toBe("Resumed");
      }
      expect(resumeEnd).toBeDefined();
    }

    ws.close();
  });
});
