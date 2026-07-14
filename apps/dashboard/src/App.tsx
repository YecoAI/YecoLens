import { useEffect, useRef } from "react";
import { useStore, useActiveTrace } from "./store/useStore";
import { YecoWSClient, defaultWsUrl } from "./api/ws";
import { TokenWaterfall } from "./components/TokenWaterfall";
import { EntropyChart } from "./components/EntropyChart";
import { ForkBar } from "./components/ForkBar";
import { ModelPicker } from "./components/ModelPicker";
import { TraceList } from "./components/TraceList";
import { StatusBar } from "./components/StatusBar";
import { ChatComposer } from "./components/ChatComposer";
import { OnboardingScreen } from "./components/OnboardingScreen";
import type { ChatMessage, ClientMessage } from "@yeco-ai/protocol";

export function App() {
  const wsRef = useRef<YecoWSClient | null>(null);

  const onServerMessage = useStore((s) => s.onServerMessage);
  const setConnected = useStore((s) => s.setConnected);
  const sendRef = useRef<(msg: ClientMessage) => void>(() => {});

  const models = useStore((s) => s.models);
  const status = useStore((s) => s.status);

  const selectedModelId = useStore((s) => s.selectedModelId);
  const systemPrompt = useStore((s) => s.systemPrompt);
  const userMessage = useStore((s) => s.userMessage);
  const temperature = useStore((s) => s.temperature);
  const topLogprobs = useStore((s) => s.topLogprobs);
  const entropyBreakpoint = useStore((s) => s.entropyBreakpoint);

  const forkSelectedStep = useStore((s) => s.forkSelectedStep);
  const selectForkStep = useStore((s) => s.selectForkStep);

  const activeTrace = useActiveTrace();

  useEffect(() => {
    const ws = new YecoWSClient(defaultWsUrl(), (msg) => {
      if (msg.type === "status") setConnected(true);
      onServerMessage(msg);
    });
    ws.connect();
    wsRef.current = ws;
    sendRef.current = (m) => ws.send(m);

    return () => {
      ws.close();
    };
  }, [onServerMessage, setConnected]);

  function send(msg: ClientMessage) {
    sendRef.current(msg);
  }

  function handleGenerate() {
    const model = models.find((m) => m.id === selectedModelId);
    if (!model) return;
    const messages: ChatMessage[] = [];
    if (systemPrompt.trim()) messages.push({ role: "system", content: systemPrompt.trim() });
    messages.push({ role: "user", content: userMessage.trim() });
    send({
      type: "generate",
      provider: model.provider,
      model: model.id,
      messages,
      temperature,
      topLogprobs,
      entropyBreakpoint: entropyBreakpoint > 0 ? entropyBreakpoint : undefined,
    });
  }

  function handlePause() {
    if (activeTrace) send({ type: "pause", traceId: activeTrace.id });
  }

  function handleResume() {
    if (activeTrace) send({ type: "resume", traceId: activeTrace.id });
  }

  function handleFork(atIndex: number, altTokenIndex: number, newSystemPrompt?: string) {
    if (!activeTrace) return;
    send({
      type: "fork",
      traceId: activeTrace.id,
      atIndex,
      altTokenIndex,
      newSystemPrompt,
    });
  }

  const noModels = models.length === 0;
  const showOnboarding = noModels && status !== null;

  const entropySeries = activeTrace ? activeTrace.steps.map((s) => s.entropy) : [];

  return (
    <div className="app">
      <div className="app__main">
        <aside className="app__sidebar scroll">
          <ModelPicker />
          <TraceList />
        </aside>

        <main className="app__content">
          {showOnboarding ? (
            <OnboardingScreen
              ollamaReachable={status?.ollamaReachable ?? false}
              openaiConfigured={status?.openaiConfigured ?? false}
              openaiReachable={status?.openaiReachable}
              openaiBaseUrl={status?.openaiBaseUrl}
            />
          ) : (
            <>
              <div className="panel" style={{ flex: "1 1 auto", borderRadius: 0, border: "none", borderBottom: "1px solid var(--border)" }}>
                <div className="panel__header">
                  <span className="panel__header-title">▌ probability waterfall</span>
                  <span className="panel__header-spacer" />
                  {activeTrace && (
                    <span className="dim" style={{ fontSize: 11 }}>
                      {activeTrace.provider} · {activeTrace.model}
                    </span>
                  )}
                </div>
                {activeTrace ? (
                  <TokenWaterfall
                    trace={activeTrace}
                    forkSelectedStep={forkSelectedStep}
                    onSelectStep={selectForkStep}
                    onFork={handleFork}
                  />
                ) : (
                  <div className="panel__body empty">
                    send a prompt to watch your model think — token by token.
                  </div>
                )}
              </div>

              <div className="panel" style={{ flex: "0 0 auto", borderRadius: 0, border: "none", borderBottom: "1px solid var(--border)" }}>
                <div className="panel__header">
                  <span className="panel__header-title">entropy sentry</span>
                  <span className="panel__header-spacer" />
                  <span className="dim" style={{ fontSize: 11 }}>
                    {activeTrace ? `${activeTrace.steps.length} steps` : "—"}
                  </span>
                </div>
                <EntropyChart series={entropySeries} threshold={entropyBreakpoint} />
              </div>

              {activeTrace && (activeTrace.status === "paused" || forkSelectedStep !== null) && (
                <ForkBar trace={activeTrace} onFork={handleFork} onResume={handleResume} />
              )}

              <ChatComposer onGenerate={handleGenerate} onPause={handlePause} />
            </>
          )}
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
