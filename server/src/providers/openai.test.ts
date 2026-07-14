import { describe, it, expect, vi, beforeEach } from "vitest";
import { streamOpenAIChat, listOpenAIModels } from "./openai.js";

function sseStream(events: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const chunks = events.map((e) => enc.encode(e + "\n\n"));
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

function mockOk(events: string[]) {
  return {
    ok: true,
    status: 200,
    body: sseStream(events),
    text: async () => "",
  } as unknown as Response;
}

function data(obj: object): string {
  return `data: ${JSON.stringify(obj)}`;
}

describe("streamOpenAIChat", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("parses SSE chunks into token steps with alternatives", async () => {
    const events = [
      data({
        choices: [
          {
            delta: { content: "Milano" },
            logprobs: {
              content: [
                {
                  token: "Milano",
                  logprob: Math.log(0.62),
                  top_logprobs: [
                    { token: "Milano", logprob: Math.log(0.62) },
                    { token: "Roma", logprob: Math.log(0.28) },
                    { token: "Torino", logprob: Math.log(0.10) },
                  ],
                },
              ],
            },
          },
        ],
      }),
      data({
        choices: [
          {
            delta: { content: "." },
            logprobs: {
              content: [
                {
                  token: ".",
                  logprob: Math.log(0.99),
                  top_logprobs: [{ token: ".", logprob: Math.log(0.99) }],
                },
              ],
            },
          },
        ],
      }),
      "data: [DONE]",
    ];
    global.fetch = vi.fn().mockResolvedValue(mockOk(events));

    const gen = streamOpenAIChat({ baseUrl: "https://api.openai.com", apiKey: "sk-test" }, "gpt-4o", [], {});
    const out = [];
    for await (const step of gen) out.push(step);

    expect(out).toHaveLength(2);
    expect(out[0].token).toBe("Milano");
    expect(out[0].alternatives.map((a) => a.token)).toEqual(["Roma", "Torino"]);
  });

  it("handles content deltas without logprobs gracefully", async () => {
    const events = [
      data({ choices: [{ delta: { content: "Hi" } }] }),
      "data: [DONE]",
    ];
    global.fetch = vi.fn().mockResolvedValue(mockOk(events));

    const gen = streamOpenAIChat({ baseUrl: "https://api.openai.com", apiKey: "sk-test" }, "gpt-4o", [], {});
    const out = [];
    for await (const step of gen) out.push(step);

    expect(out).toHaveLength(1);
    expect(out[0].token).toBe("Hi");
    expect(out[0].logprob).toBe(0);
  });

  it("throws on error field", async () => {
    const events = [data({ error: { message: "rate limited" } })];
    global.fetch = vi.fn().mockResolvedValue(mockOk(events));
    const gen = streamOpenAIChat({ baseUrl: "https://api.openai.com", apiKey: "sk-test" }, "gpt-4o", [], {});
    await expect(gen.next()).rejects.toThrow("rate limited");
  });

  it("stops at [DONE]", async () => {
    const events = [
      data({ choices: [{ delta: { content: "A" }, logprobs: { content: [{ token: "A", logprob: 0, top_logprobs: [{ token: "A", logprob: 0 }] }] } }] }),
      "data: [DONE]",
      data({ choices: [{ delta: { content: "should-not-see" } }] }),
    ];
    global.fetch = vi.fn().mockResolvedValue(mockOk(events));
    const gen = streamOpenAIChat({ baseUrl: "https://api.openai.com", apiKey: "sk-test" }, "gpt-4o", [], {});
    const out = [];
    for await (const step of gen) out.push(step);
    expect(out).toHaveLength(1);
    expect(out[0].token).toBe("A");
  });

  it("sends authorization header and logprobs in body", async () => {
    global.fetch = vi.fn().mockResolvedValue(mockOk(["data: [DONE]"]));
    const gen = streamOpenAIChat({ baseUrl: "https://api.openai.com", apiKey: "sk-test" }, "gpt-4o", [], { topLogprobs: 5 });
    await gen.next();
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const init = call[1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body as string);
    expect(body.logprobs).toBe(true);
    expect(body.top_logprobs).toBe(5);
    expect(body.stream).toBe(true);
  });

  it("dedups a trailing /v1 in the base URL", async () => {
    global.fetch = vi.fn().mockResolvedValue(mockOk(["data: [DONE]"]));
    const gen = streamOpenAIChat({ baseUrl: "https://api.openai.com/v1/", apiKey: "sk-test" }, "gpt-4o", [], {});
    await gen.next();
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = call[0] as string;
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(url).not.toContain("/v1/v1");
  });
});

describe("listOpenAIModels", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("returns reachable + models on a successful /v1/models call", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          { id: "llama-3.1-70b-versatile", owned_by: "groq" },
          { id: "gpt-4o", owned_by: "openai" },
        ],
      }),
    } as unknown as Response);
    const result = await listOpenAIModels("https://api.groq.com/openai", "gsk_test");
    expect(result.reachable).toBe(true);
    expect(result.models).toHaveLength(2);
    expect(result.models[0]).toMatchObject({ id: "llama-3.1-70b-versatile", provider: "openai" });
    expect(result.models[0].details).toBe("via groq");
  });

  it("returns reachable=false when no key is set", async () => {
    const result = await listOpenAIModels("https://api.openai.com", "");
    expect(result.reachable).toBe(false);
    expect(result.models).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns reachable=false on fetch failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await listOpenAIModels("https://api.openai.com", "sk-test");
    expect(result.reachable).toBe(false);
  });

  it("returns reachable=false on an error field in the response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ error: { message: "invalid key" } }),
    } as unknown as Response);
    const result = await listOpenAIModels("https://api.openai.com", "sk-bad");
    expect(result.reachable).toBe(false);
  });

  it("returns reachable=false on non-ok status", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 } as unknown as Response);
    const result = await listOpenAIModels("https://api.openai.com", "sk-bad");
    expect(result.reachable).toBe(false);
  });

  it("strips a trailing /v1 when building the models URL", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [] }),
    } as unknown as Response);
    await listOpenAIModels("https://api.together.xyz/v1/", "key");
    const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toBe("https://api.together.xyz/v1/models");
    expect(url).not.toContain("/v1/v1");
  });
});
