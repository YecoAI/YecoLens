import { create } from "zustand";
import type {
  ChatMessage,
  ModelInfo,
  ServerMessage,
  ServerStatus,
  TokenStep,
} from "@yecoai-org/protocol";

export interface TraceState {
  id: string;
  model: string;
  provider: "ollama" | "openai" | "sdk";
  messages: ChatMessage[];
  steps: TokenStep[];
  status: "running" | "paused" | "ended" | "forked" | "error";
  durationMs?: number;
  text?: string;
  error?: string;
  breakpointAt?: number;
  breakpointEntropy?: number;
  parentTraceId?: string;
}

interface DashboardState {
  connected: boolean;
  status: ServerStatus | null;
  models: ModelInfo[];
  selectedModelId: string | null;

  traces: Record<string, TraceState>;
  activeTraceId: string | null;

  systemPrompt: string;
  userMessage: string;
  temperature: number;
  topLogprobs: number;
  entropyBreakpoint: number;

  forkSelectedStep: number | null;
  forkSelectedAlt: number | null;
  forkNewSystemPrompt: string;

  onServerMessage: (msg: ServerMessage) => void;
  setConnected: (v: boolean) => void;
  selectModel: (id: string) => void;
  setSystemPrompt: (v: string) => void;
  setUserMessage: (v: string) => void;
  setTemperature: (v: number) => void;
  setTopLogprobs: (v: number) => void;
  setEntropyBreakpoint: (v: number) => void;
  selectTrace: (id: string) => void;
  selectForkStep: (step: number | null) => void;
  selectForkAlt: (alt: number | null) => void;
  setForkNewSystemPrompt: (v: string) => void;
}

export const useStore = create<DashboardState>((set, get) => ({
  connected: false,
  status: null,
  models: [],
  selectedModelId: null,
  traces: {},
  activeTraceId: null,
  systemPrompt: "",
  userMessage: "",
  temperature: 0.7,
  topLogprobs: 10,
  entropyBreakpoint: 0,
  forkSelectedStep: null,
  forkSelectedAlt: null,
  forkNewSystemPrompt: "",

  onServerMessage: (msg) => {
    switch (msg.type) {
      case "status":
        set({ status: msg.status, connected: true });
        break;
      case "models.list": {
        const models = msg.models;
        const current = get().selectedModelId;
        const stillExists = current && models.some((m) => m.id === current);
        set({
          models,
          selectedModelId: stillExists ? current : models[0]?.id ?? null,
        });
        break;
      }
      case "trace.start": {
        const trace: TraceState = {
          id: msg.traceId,
          model: msg.model,
          provider: msg.provider,
          messages: msg.messages,
          steps: [],
          status: "running",
        };
        set((s) => ({
          traces: { ...s.traces, [msg.traceId]: trace },
          activeTraceId: msg.traceId,
          forkSelectedStep: null,
          forkSelectedAlt: null,
        }));
        break;
      }
      case "trace.token": {
        const { traceId, step } = msg;
        set((s) => {
          const trace = s.traces[traceId];
          if (!trace) return s;
          return {
            traces: {
              ...s.traces,
              [traceId]: { ...trace, steps: [...trace.steps, step] },
            },
          };
        });
        break;
      }
      case "trace.breakpoint": {
        set((s) => {
          const trace = s.traces[msg.traceId];
          if (!trace) return s;
          return {
            traces: {
              ...s.traces,
              [msg.traceId]: {
                ...trace,
                status: "paused",
                breakpointAt: msg.atIndex,
                breakpointEntropy: msg.entropy,
              },
            },
            activeTraceId: msg.traceId,
          };
        });
        break;
      }
      case "trace.end": {
        set((s) => {
          const trace = s.traces[msg.traceId];
          if (!trace) return s;
          return {
            traces: {
              ...s.traces,
              [msg.traceId]: {
                ...trace,
                status: "ended",
                durationMs: msg.durationMs,
                text: msg.text,
              },
            },
          };
        });
        break;
      }
      case "trace.error": {
        set((s) => {
          const trace = s.traces[msg.traceId];
          if (!trace) return s;
          return {
            traces: {
              ...s.traces,
              [msg.traceId]: { ...trace, status: "error", error: msg.error },
            },
          };
        });
        break;
      }
      case "trace.forked": {
        set({ forkSelectedStep: null, forkSelectedAlt: null });
        break;
      }
    }
  },

  setConnected: (v) => set({ connected: v }),
  selectModel: (id) => set({ selectedModelId: id }),
  setSystemPrompt: (v) => set({ systemPrompt: v }),
  setUserMessage: (v) => set({ userMessage: v }),
  setTemperature: (v) => set({ temperature: v }),
  setTopLogprobs: (v) => set({ topLogprobs: v }),
  setEntropyBreakpoint: (v) => set({ entropyBreakpoint: v }),
  selectTrace: (id) => set({ activeTraceId: id, forkSelectedStep: null, forkSelectedAlt: null }),
  selectForkStep: (step) => set({ forkSelectedStep: step, forkSelectedAlt: null }),
  selectForkAlt: (alt) => set({ forkSelectedAlt: alt }),
  setForkNewSystemPrompt: (v) => set({ forkNewSystemPrompt: v }),
}));

export function useActiveTrace(): TraceState | null {
  return useStore((s) => (s.activeTraceId ? s.traces[s.activeTraceId] ?? null : null));
}
