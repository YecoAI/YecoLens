import type { Trace, TokenStep, ChatMessage } from "@yecoai-org/protocol";

export type TraceListener = (event: TraceStoreEvent) => void;

export type TraceStoreEvent =
  | { type: "start"; trace: Trace }
  | { type: "token"; traceId: string; step: TokenStep }
  | { type: "breakpoint"; traceId: string; atIndex: number; entropy: number; reason: "entropy" | "manual" | "fork" }
  | { type: "end"; traceId: string; durationMs: number; text: string }
  | { type: "forked"; traceId: string; childTraceId: string; atIndex: number }
  | { type: "error"; traceId: string; error: string };

export class TraceStore {
  private traces = new Map<string, Trace>();
  private listeners = new Set<TraceListener>();

  static createId(): string {
    return Math.random().toString(16).slice(2, 8);
  }

  subscribe(fn: TraceListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(event: TraceStoreEvent): void {
    for (const fn of this.listeners) fn(event);
  }

  start(traceId: string, model: string, provider: Trace["provider"], messages: ChatMessage[], sdkProvider?: "ollama" | "openai"): Trace {
    const trace: Trace = {
      id: traceId,
      model,
      provider,
      sdkProvider,
      messages,
      steps: [],
      status: "running",
    };
    this.traces.set(traceId, trace);
    this.emit({ type: "start", trace });
    return trace;
  }

  addStep(traceId: string, step: TokenStep): Trace | undefined {
    const trace = this.traces.get(traceId);
    if (!trace) return undefined;
    trace.steps.push(step);
    this.emit({ type: "token", traceId, step });
    return trace;
  }

  breakpoint(traceId: string, atIndex: number, entropy: number, reason: "entropy" | "manual" | "fork"): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;
    trace.status = "paused";
    this.emit({ type: "breakpoint", traceId, atIndex, entropy, reason });
  }

  end(traceId: string, durationMs: number, text: string): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;
    trace.status = "ended";
    trace.durationMs = durationMs;
    this.emit({ type: "end", traceId, durationMs, text });
  }

  error(traceId: string, error: string): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;
    trace.status = "error";
    trace.error = error;
    this.emit({ type: "error", traceId, error });
  }

  forked(traceId: string, childTraceId: string, atIndex: number): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;
    trace.status = "forked";
    this.emit({ type: "forked", traceId, childTraceId, atIndex });
  }

  get(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

}
