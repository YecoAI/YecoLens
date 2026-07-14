import {
  computeStepEntropy,
  buildForkContext,
  assembleText,
  type ChatMessage,
  type TokenStep,
} from "@yecoai-org/protocol";
import { streamOllamaChat } from "./providers/ollama.js";
import { streamOpenAIChat } from "./providers/openai.js";
import { getProviderConfig } from "./provider-config.js";
import type { ServerConfig } from "./config.js";
import { TraceStore } from "./trace-store.js";

export interface GenerateParams {
  provider: "ollama" | "openai" | "sdk";
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  topLogprobs?: number;
  entropyBreakpoint?: number;
  traceId?: string;
  forked?: boolean;
  parentTraceId?: string;
  /** For SDK-originated traces, which actual provider to use for generation */
  sdkProvider?: "ollama" | "openai";
}

export interface GenerationHandle {
  traceId: string;
  abort: () => void;
  done: Promise<void>;
}

export class InferenceEngine {
  private active = new Map<string, AbortController>();

  constructor(
    private config: ServerConfig,
    private store: TraceStore
  ) {}

  start(params: GenerateParams): GenerationHandle {
    const traceId = params.traceId ?? TraceStore.createId();
    const topLogprobs = params.topLogprobs ?? this.config.defaultTopLogprobs;
    const entropyBreakpoint = params.entropyBreakpoint ?? this.config.defaultEntropyBreakpoint;

    this.store.start(traceId, params.model, params.provider, params.messages, params.sdkProvider);
    if (params.forked) {
      if (params.parentTraceId) {
        this.store.forked(params.parentTraceId, traceId, 0);
      }
    }

    const controller = new AbortController();
    this.active.set(traceId, controller);

    const done = this.run(
      traceId,
      params,
      topLogprobs,
      entropyBreakpoint,
      controller
    )
      .catch((err) => {
        if (controller.signal.aborted) {
          return;
        }
        this.store.error(traceId, err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        this.active.delete(traceId);
      });

    return {
      traceId,
      abort: () => controller.abort(),
      done,
    };
  }

  private async run(
    traceId: string,
    params: GenerateParams,
    topLogprobs: number,
    entropyBreakpoint: number,
    controller: AbortController
  ): Promise<void> {
    const startedAt = Date.now();
    let stepIndex = 0;

    const signal = controller.signal;
    const openaiCfg = getProviderConfig().getOpenAI();
    const effectiveProvider = params.provider === "sdk" ? (params.sdkProvider ?? "openai") : params.provider;
    const source =
      effectiveProvider === "ollama"
        ? streamOllamaChat({ baseUrl: this.config.ollamaUrl, signal }, params.model, params.messages, {
            temperature: params.temperature,
            topLogprobs,
          })
        : streamOpenAIChat(
            { baseUrl: openaiCfg.baseUrl, apiKey: openaiCfg.apiKey, signal },
            params.model,
            params.messages,
            { temperature: params.temperature, topLogprobs }
          );

    for await (const raw of source) {
      if (signal.aborted) return;

      const { probability, entropy, alternatives } = computeStepEntropy(raw.logprob, raw.alternatives);
      const step: TokenStep = {
        index: stepIndex,
        token: raw.token,
        logprob: raw.logprob,
        probability,
        alternatives,
        entropy,
      };

      this.store.addStep(traceId, step);
      stepIndex++;

      if (entropyBreakpoint > 0 && entropy >= entropyBreakpoint) {
        this.store.breakpoint(traceId, step.index, entropy, "entropy");
        controller.abort();
        return;
      }
    }

    if (signal.aborted) return;

    const trace = this.store.get(traceId);
    const text = trace ? assembleText(trace.steps) : "";
    this.store.end(traceId, Date.now() - startedAt, text);
  }

  fork(params: {
    parentTraceId: string;
    atIndex: number;
    altTokenIndex: number;
    newSystemPrompt?: string;
    temperature?: number;
    topLogprobs?: number;
    entropyBreakpoint?: number;
  }): GenerationHandle | null {
    const parent = this.store.get(params.parentTraceId);
    if (!parent) return null;

    const step = parent.steps[params.atIndex];
    if (!step) return null;
    const alt = step.alternatives[params.altTokenIndex];
    if (!alt) return null;

    this.abort(params.parentTraceId);

    const { messages } = buildForkContext(
      parent.messages,
      parent.steps,
      params.atIndex,
      alt.token,
      params.newSystemPrompt
    );

    const child = this.start({
      provider: parent.provider,
      sdkProvider: parent.sdkProvider,
      model: parent.model,
      messages,
      temperature: params.temperature,
      topLogprobs: params.topLogprobs,
      entropyBreakpoint: params.entropyBreakpoint,
      forked: true,
      parentTraceId: parent.id,
    });

    return child;
  }

  abort(traceId: string): void {
    const controller = this.active.get(traceId);
    if (controller) controller.abort();
  }
}
