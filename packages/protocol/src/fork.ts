import type { ChatMessage, TokenStep } from "./index.js";

export interface ForkContext {
  messages: ChatMessage[];
  prefix: string;
}

export function buildForkContext(
  originalMessages: ChatMessage[],
  steps: TokenStep[],
  atIndex: number,
  altToken: string,
  newSystemPrompt?: string
): ForkContext {
  if (atIndex < 0 || atIndex >= steps.length) {
    throw new Error(
      `fork index ${atIndex} out of range (trace has ${steps.length} steps)`
    );
  }

  const keptTokens = steps.slice(0, atIndex).map((s) => s.token);
  const prefix = [...keptTokens, altToken].join("");

  const messages: ChatMessage[] = [];
  let sawSystem = false;
  for (const m of originalMessages) {
    if (m.role === "system") {
      sawSystem = true;
      if (newSystemPrompt === undefined) {
        messages.push(m);
      } else if (newSystemPrompt !== "") {
        messages.push({ role: "system", content: newSystemPrompt });
      }
    } else {
      messages.push(m);
    }
  }
  if (newSystemPrompt && newSystemPrompt !== "" && !sawSystem) {
    messages.unshift({ role: "system", content: newSystemPrompt });
  }

  messages.push({ role: "assistant", content: prefix });
  return { messages, prefix };
}

export function assembleText(steps: TokenStep[]): string {
  return steps.map((s) => s.token).join("");
}
