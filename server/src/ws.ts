import type { WebSocket } from "ws";
import {
  encodeMessage,
  parseMessage,
  type WireMessage,
  type ServerMessage,
  type ClientMessage,
  type ServerStatus,
  type ModelInfo,
} from "@yecoai-org/protocol";
import type { TraceStore, TraceStoreEvent } from "./trace-store.js";
import type { InferenceEngine } from "./inference.js";
import type { ServerConfig } from "./config.js";
import { getProviderConfig } from "./provider-config.js";
import { listOllamaModels } from "./providers/ollama.js";
import { listOpenAIModels, OPENAI_CATALOG } from "./providers/openai.js";

export interface WSHubDeps {
  config: ServerConfig;
  store: TraceStore;
  engine: InferenceEngine;
  probeOllama?: (url: string) => ReturnType<typeof listOllamaModels>;
  probeOpenAI?: (baseUrl: string, apiKey: string) => ReturnType<typeof listOpenAIModels>;
}

export class WSHub {
  private clients = new Set<WebSocket>();
  private ollamaModels: ModelInfo[] = [];
  private ollamaReachable = false;
  private openaiModels: ModelInfo[] = [];
  private openaiReachable = false;

  constructor(private deps: WSHubDeps) {
    this.deps.store.subscribe((evt) => this.onTraceEvent(evt));
  }

  async refreshModels(): Promise<void> {
    const ollamaProbe = this.deps.probeOllama ?? listOllamaModels;
    const ollamaResult = await ollamaProbe(this.deps.config.ollamaUrl);
    this.ollamaReachable = ollamaResult.reachable;
    this.ollamaModels = ollamaResult.models;

    const openaiCfg = getProviderConfig().getOpenAI();
    if (openaiCfg.configured) {
      const openaiProbe = this.deps.probeOpenAI ?? listOpenAIModels;
      const openaiResult = await openaiProbe(openaiCfg.baseUrl, openaiCfg.apiKey);
      this.openaiReachable = openaiResult.reachable;
      this.openaiModels = openaiResult.models.length > 0 ? openaiResult.models : OPENAI_CATALOG;
    } else {
      this.openaiReachable = false;
      this.openaiModels = [];
    }

    const models: ModelInfo[] = [...this.ollamaModels, ...this.openaiModels];
    this.broadcast({ type: "models.list", models });
    this.broadcastStatus();
  }

  status(): ServerStatus {
    const openaiCfg = getProviderConfig().getOpenAI();
    return {
      connected: true,
      ollamaReachable: this.ollamaReachable,
      ollamaUrl: this.deps.config.ollamaUrl,
      openaiConfigured: openaiCfg.configured,
      openaiReachable: this.openaiReachable,
      openaiBaseUrl: openaiCfg.baseUrl,
      version: this.deps.config.version,
    };
  }

  private broadcastStatus(): void {
    this.broadcast({ type: "status", status: this.status() });
  }

  addClient(ws: WebSocket): void {
    this.clients.add(ws);
    ws.send(encodeMessage({ type: "status", status: this.status() }));
    const models: ModelInfo[] = [...this.ollamaModels, ...this.openaiModels];
    ws.send(encodeMessage({ type: "models.list", models }));

    ws.on("message", (data: unknown) => this.onClientMessage(ws, String(data)));
    ws.on("close", () => this.clients.delete(ws));
    ws.on("error", () => this.clients.delete(ws));
  }

  private broadcast(msg: ServerMessage): void {
    const payload = encodeMessage(msg);
    for (const ws of this.clients) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
  }

  private onTraceEvent(evt: TraceStoreEvent): void {
    switch (evt.type) {
      case "start":
        this.broadcast({
          type: "trace.start",
          traceId: evt.trace.id,
          model: evt.trace.model,
          provider: evt.trace.provider,
          messages: evt.trace.messages,
        });
        break;
      case "token":
        this.broadcast({ type: "trace.token", traceId: evt.traceId, step: evt.step });
        break;
      case "breakpoint":
        this.broadcast({
          type: "trace.breakpoint",
          traceId: evt.traceId,
          atIndex: evt.atIndex,
          entropy: evt.entropy,
          reason: evt.reason,
        });
        break;
      case "end":
        this.broadcast({
          type: "trace.end",
          traceId: evt.traceId,
          durationMs: evt.durationMs,
          text: evt.text,
        });
        break;
      case "forked":
        this.broadcast({
          type: "trace.forked",
          traceId: evt.traceId,
          childTraceId: evt.childTraceId,
          atIndex: evt.atIndex,
        });
        break;
      case "error":
        this.broadcast({ type: "trace.error", traceId: evt.traceId, error: evt.error });
        break;
    }
  }

  private onClientMessage(ws: WebSocket, raw: string): void {
    let msg: WireMessage | null;
    try {
      msg = parseMessage(JSON.parse(raw));
    } catch {
      ws.send(encodeMessage({ type: "trace.error", traceId: "", error: "malformed message" }));
      return;
    }
    if (!msg) return;
    this.handleClient(ws, msg as ClientMessage);
  }

  private handleClient(_ws: WebSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case "generate": {
        this.deps.engine.start({
          provider: msg.provider,
          model: msg.model,
          messages: msg.messages,
          temperature: msg.temperature,
          topLogprobs: msg.topLogprobs,
          entropyBreakpoint: msg.entropyBreakpoint,
        });
        // trace.start is broadcast via the store subscription in onTraceEvent
        break;
      }
      case "pause":
        this.deps.engine.abort(msg.traceId);
        break;
      case "resume": {
        const trace = this.deps.store.get(msg.traceId);
        if (!trace) break;
        this.deps.engine.start({
          provider: trace.provider,
          sdkProvider: trace.sdkProvider,
          model: trace.model,
          messages: trace.messages,
        });
        break;
      }
      case "fork": {
        this.deps.engine.fork({
          parentTraceId: msg.traceId,
          atIndex: msg.atIndex,
          altTokenIndex: msg.altTokenIndex,
          newSystemPrompt: msg.newSystemPrompt,
        });
        // trace.forked is broadcast via the store subscription in onTraceEvent
        break;
      }
      case "subscribe":
        break;
    }
  }
}
