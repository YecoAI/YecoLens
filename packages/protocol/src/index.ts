export interface TokenAlt {
  token: string;
  logprob: number;
  probability: number;
}

export interface TokenStep {
  index: number;
  token: string;
  logprob: number;
  probability: number;
  alternatives: TokenAlt[];
  entropy: number;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: "ollama" | "openai";
  sizeBytes?: number;
  details?: string;
}

export interface ServerStatus {
  connected: boolean;
  ollamaReachable: boolean;
  ollamaUrl?: string;
  openaiConfigured: boolean;
  openaiReachable?: boolean;
  openaiBaseUrl?: string;
  version: string;
}

export interface Trace {
  id: string;
  model: string;
  provider: "ollama" | "openai" | "sdk";
  /** For SDK-originated traces, the underlying provider to use for generation */
  sdkProvider?: "ollama" | "openai";
  messages: ChatMessage[];
  steps: TokenStep[];
  status: "running" | "paused" | "ended" | "forked" | "error";
  durationMs?: number;
  error?: string;
}

export type WireRole = "client" | "server";

export type WireMessage = ClientMessage | ServerMessage;

export interface GenerateRequest {
  type: "generate";
  provider: "ollama" | "openai";
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  topLogprobs?: number;
  entropyBreakpoint?: number;
}

export interface PauseRequest {
  type: "pause";
  traceId: string;
}

export interface ResumeRequest {
  type: "resume";
  traceId: string;
}

export interface ForkRequest {
  type: "fork";
  traceId: string;
  atIndex: number;
  altTokenIndex: number;
  newSystemPrompt?: string;
}

export interface SubscribeRequest {
  type: "subscribe";
  traceId?: string;
}

export type ClientMessage =
  | GenerateRequest
  | PauseRequest
  | ResumeRequest
  | ForkRequest
  | SubscribeRequest;

export interface TraceStartEvent {
  type: "trace.start";
  traceId: string;
  model: string;
  provider: "ollama" | "openai" | "sdk";
  messages: ChatMessage[];
  forked?: boolean;
  parentTraceId?: string;
}

export interface TraceTokenEvent {
  type: "trace.token";
  traceId: string;
  step: TokenStep;
}

export interface TraceBreakpointEvent {
  type: "trace.breakpoint";
  traceId: string;
  atIndex: number;
  entropy: number;
  reason: "entropy" | "manual" | "fork";
}

export interface TraceEndEvent {
  type: "trace.end";
  traceId: string;
  durationMs: number;
  text: string;
}

export interface TraceForkedEvent {
  type: "trace.forked";
  traceId: string;
  childTraceId: string;
  atIndex: number;
}

export interface TraceErrorEvent {
  type: "trace.error";
  traceId: string;
  error: string;
}

export interface ModelsListEvent {
  type: "models.list";
  models: ModelInfo[];
}

export interface StatusEvent {
  type: "status";
  status: ServerStatus;
}

export type ServerMessage =
  | TraceStartEvent
  | TraceTokenEvent
  | TraceBreakpointEvent
  | TraceEndEvent
  | TraceForkedEvent
  | TraceErrorEvent
  | ModelsListEvent
  | StatusEvent;

/** Current wire-protocol version. Bump when messages change shape. */
export const PROTOCOL_VERSION = 1;

export function parseMessage(raw: unknown): WireMessage | null {
  if (typeof raw !== "object" || raw === null) return null;
  const msg = raw as Record<string, unknown>;
  if (typeof msg.type !== "string") return null;
  // Future: gate on msg.v when breaking changes land.
  return msg as unknown as WireMessage;
}

export function encodeMessage(msg: WireMessage): string {
  return JSON.stringify(msg);
}

export {
  logprobToProbability,
  normalizeLogprobs,
  shannonEntropyBits,
  normalizedEntropy,
  computeStepEntropy,
} from "./entropy.js";

export { buildForkContext, assembleText, type ForkContext } from "./fork.js";
