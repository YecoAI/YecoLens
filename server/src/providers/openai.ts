import type { ChatMessage, ModelInfo } from "@yeco-ai/protocol";
import { normalizeBaseUrl } from "../provider-config.js";

interface OpenAILogprobContent {
  token: string;
  logprob: number;
  top_logprobs: { token: string; logprob: number }[];
}

interface OpenAIChatChunk {
  choices: {
    delta?: { content?: string; role?: string };
    logprobs?: { content: OpenAILogprobContent[] | null } | null;
    finish_reason?: string | null;
  }[];
  error?: { message: string };
}

interface OpenAIModelsResponse {
  data?: { id: string; owned_by?: string }[];
  error?: { message: string };
}

export interface OpenAIProviderOptions {
  baseUrl: string;
  apiKey: string;
  signal?: AbortSignal;
}

export async function* streamOpenAIChat(
  opts: OpenAIProviderOptions,
  model: string,
  messages: ChatMessage[],
  options: { temperature?: number; topLogprobs?: number }
): AsyncGenerator<{ token: string; logprob: number; alternatives: { token: string; logprob: number }[] }> {
  const url = `${normalizeBaseUrl(opts.baseUrl)}/v1/chat/completions`;
  const body = {
    model,
    messages,
    stream: true,
    temperature: options.temperature ?? 0.7,
    logprobs: true,
    top_logprobs: options.topLogprobs ?? 10,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI-compatible API failed (${res.status}): ${text || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) >= 0) {
        const event = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const rawLine of event.split("\n")) {
          const line = rawLine.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") return;
          if (!payload) continue;

          let chunk: OpenAIChatChunk;
          try {
            chunk = JSON.parse(payload);
          } catch {
            continue;
          }
          if (chunk.error) throw new Error(`OpenAI error: ${chunk.error.message}`);

          const choice = chunk.choices?.[0];
          if (!choice) continue;

          const entry = choice.logprobs?.content?.[0];
          if (entry) {
            yield {
              token: entry.token,
              logprob: entry.logprob,
              alternatives: (entry.top_logprobs ?? [])
                .filter((t) => t.token !== entry.token)
                .map((t) => ({ token: t.token, logprob: t.logprob })),
            };
          } else if (choice.delta?.content) {
            yield { token: choice.delta.content, logprob: 0, alternatives: [] };
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function listOpenAIModels(baseUrl: string, apiKey: string): Promise<{
  reachable: boolean;
  models: ModelInfo[];
}> {
  if (!apiKey) {
    return { reachable: false, models: [] };
  }
  const url = `${normalizeBaseUrl(baseUrl)}/v1/models`;
  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { reachable: false, models: [] };
    const data = (await res.json()) as OpenAIModelsResponse;
    if (data.error) return { reachable: false, models: [] };
    const models: ModelInfo[] = (data.data ?? []).map((m) => ({
      id: m.id,
      name: m.id,
      provider: "openai" as const,
      details: m.owned_by ? `via ${m.owned_by}` : undefined,
    }));
    return { reachable: true, models };
  } catch {
    return { reachable: false, models: [] };
  }
}

export const OPENAI_CATALOG: ModelInfo[] = [
  { id: "gpt-4o", name: "gpt-4o", provider: "openai" },
  { id: "gpt-4o-mini", name: "gpt-4o-mini", provider: "openai" },
  { id: "gpt-4.1", name: "gpt-4.1", provider: "openai" },
  { id: "gpt-4.1-mini", name: "gpt-4.1-mini", provider: "openai" },
];
