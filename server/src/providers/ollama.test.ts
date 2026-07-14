import { describe, it, expect, vi, beforeEach } from "vitest";
import { streamOllamaChat, listOllamaModels } from "./ollama.js";

function ndjsonStream(lines: object[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const chunks = lines.map((l) => enc.encode(JSON.stringify(l) + "\n"));
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
}

function mockOk(lines: object[]) {
  return {
    ok: true,
    status: 200,
    body: ndjsonStream(lines),
    text: async () => "",
  } as unknown as Response;
}

describe("streamOllamaChat", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("yields tokens with their alternatives from logprobs", async () => {
    const chunks = [
      {
        model: "qwen2.5",
        message: { role: "assistant", content: "Milano" },
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
      {
        model: "qwen2.5",
        message: { role: "assistant", content: "." },
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
      { model: "qwen2.5", done: true },
    ];
    global.fetch = vi.fn().mockResolvedValue(mockOk(chunks));

    const gen = streamOllamaChat({ baseUrl: "http://x:11434" }, "qwen2.5", [
      { role: "user", content: "capital?" },
    ], { topLogprobs: 10 });

    const out = [];
    for await (const step of gen) out.push(step);

    expect(out).toHaveLength(2);
    expect(out[0].token).toBe("Milano");
    expect(out[0].logprob).toBeCloseTo(Math.log(0.62), 6);
    expect(out[0].alternatives.map((a) => a.token)).toEqual(["Roma", "Torino"]);
    expect(out[1].token).toBe(".");
    expect(out[1].alternatives).toEqual([]);
  });

  it("emits content tokens even when logprobs are absent (graceful)", async () => {
    const chunks = [
      { model: "qwen2.5", message: { role: "assistant", content: "Hi" } },
      { model: "qwen2.5", done: true },
    ];
    global.fetch = vi.fn().mockResolvedValue(mockOk(chunks));

    const gen = streamOllamaChat({ baseUrl: "http://x:11434" }, "qwen2.5", [], {});
    const out = [];
    for await (const step of gen) out.push(step);

    expect(out).toHaveLength(1);
    expect(out[0].token).toBe("Hi");
    expect(out[0].logprob).toBe(0);
    expect(out[0].alternatives).toEqual([]);
  });

  it("throws on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      body: null,
      text: async () => "boom",
    } as unknown as Response);
    const gen = streamOllamaChat({ baseUrl: "http://x:11434" }, "qwen2.5", [], {});
    await expect(gen.next()).rejects.toThrow(/Ollama .* failed \(500\)/);
  });

  it("throws on stream error field", async () => {
    global.fetch = vi.fn().mockResolvedValue(mockOk([{ error: "model not found" }]));
    const gen = streamOllamaChat({ baseUrl: "http://x:11434" }, "nope", [], {});
    await expect(gen.next()).rejects.toThrow("model not found");
  });
});

describe("listOllamaModels", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("parses /api/tags into ModelInfo[]", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          {
            name: "qwen2.5:7b",
            size: 4400000000,
            details: { family: "qwen2", parameter_size: "7B", quantization_level: "Q4_K_M" },
          },
          { name: "llama3.2:3b", size: 2000000000, details: { family: "llama" } },
        ],
      }),
    } as unknown as Response);

    const result = await listOllamaModels("http://x:11434");
    expect(result.reachable).toBe(true);
    expect(result.models).toHaveLength(2);
    expect(result.models[0]).toMatchObject({ id: "qwen2.5:7b", provider: "ollama", sizeBytes: 4400000000 });
    expect(result.models[0].details).toContain("qwen2");
    expect(result.models[0].details).toContain("Q4_K_M");
  });

  it("returns reachable=false on fetch failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await listOllamaModels("http://x:11434");
    expect(result.reachable).toBe(false);
    expect(result.models).toEqual([]);
  });

  it("returns reachable=false on non-ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as unknown as Response);
    const result = await listOllamaModels("http://x:11434");
    expect(result.reachable).toBe(false);
  });
});
