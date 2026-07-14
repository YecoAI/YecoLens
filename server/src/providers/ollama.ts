import type { ChatMessage, ModelInfo } from "@yecoai-org/protocol";

interface OllamaChatChunk {
  model: string;
  created_at: string;
  message?: { role: string; content: string };
  done?: boolean;
  prompt_logprobs?: null;
  logprobs?: OllamaLogprobs | null;
  error?: string;
}

interface OllamaLogprobs {
  content: OllamaLogprobEntry[] | null;
}

interface OllamaLogprobEntry {
  token: string;
  logprob: number;
  top_logprobs: { token: string; logprob: number }[];
}

interface OllamaTagsResponse {
  models: {
    name: string;
    model?: string;
    size?: number;
    details?: { family?: string; parameter_size?: string; quantization_level?: string };
  }[];
}

export interface OllamaProviderOptions {
  baseUrl: string;
  signal?: AbortSignal;
}

export async function* streamOllamaChat(
  opts: OllamaProviderOptions,
  model: string,
  messages: ChatMessage[],
  options: { temperature?: number; topLogprobs?: number }
): AsyncGenerator<{ token: string; logprob: number; alternatives: { token: string; logprob: number }[] }> {
  const url = `${opts.baseUrl.replace(/\/$/, "")}/api/chat`;
  const body = {
    model,
    messages,
    stream: true,
    options: {
      temperature: options.temperature ?? 0.7,
    },
    logprobs: true,
    top_logprobs: options.topLogprobs ?? 10,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama /api/chat failed (${res.status}): ${text || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;

        let chunk: OllamaChatChunk;
        try {
          chunk = JSON.parse(line);
        } catch {
          continue;
        }
        if (chunk.error) throw new Error(`Ollama error: ${chunk.error}`);

        const entry = chunk.logprobs?.content?.[0];
        if (entry) {
          yield {
            token: entry.token,
            logprob: entry.logprob,
            alternatives: (entry.top_logprobs ?? [])
              .filter((t) => t.token !== entry.token)
              .map((t) => ({ token: t.token, logprob: t.logprob })),
          };
        } else if (chunk.message?.content) {
          yield { token: chunk.message.content, logprob: 0, alternatives: [] };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function listOllamaModels(baseUrl: string): Promise<{
  reachable: boolean;
  url?: string;
  models: ModelInfo[];
}> {
  const url = `${baseUrl.replace(/\/$/, "")}/api/tags`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return { reachable: false, models: [] };
    const data = (await res.json()) as OllamaTagsResponse;
    const models: ModelInfo[] = (data.models ?? []).map((m) => ({
      id: m.name,
      name: m.name,
      provider: "ollama" as const,
      sizeBytes: m.size,
      details: [m.details?.family, m.details?.parameter_size, m.details?.quantization_level]
        .filter(Boolean)
        .join(" · "),
    }));
    return { reachable: true, url: baseUrl, models };
  } catch {
    return { reachable: false, models: [] };
  }
}
