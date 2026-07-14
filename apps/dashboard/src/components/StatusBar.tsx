import { useStore } from "../store/useStore";

export function StatusBar() {
  const connected = useStore((s) => s.connected);
  const status = useStore((s) => s.status);
  const traces = useStore((s) => s.traces);
  const activeTraceId = useStore((s) => s.activeTraceId);
  const trace = activeTraceId ? traces[activeTraceId] : null;

  const dotClass = trace
    ? trace.status === "running"
      ? "statusbar__dot--live"
      : trace.status === "paused"
        ? "statusbar__dot--paused"
        : trace.status === "error"
          ? "statusbar__dot--error"
          : ""
    : "";

  const meanEntropy =
    trace && trace.steps.length > 0
      ? trace.steps.reduce((a, s) => a + s.entropy, 0) / trace.steps.length
      : 0;

  return (
    <div className="statusbar">
      <div className="statusbar__item">
        <span className={`statusbar__dot ${connected ? "statusbar__dot--live" : ""}`} />
        {connected ? "connected" : "disconnected"}
      </div>
      {status && (
        <>
          <div className="statusbar__item">
            ollama:{" "}
            <span className={status.ollamaReachable ? "green" : "red"}>
              {status.ollamaReachable ? "online" : "offline"}
            </span>
          </div>
          <div className="statusbar__item">
            openai:{" "}
            <span className={status.openaiConfigured ? "green" : "dim"}>
              {status.openaiConfigured ? "configured" : "—"}
            </span>
          </div>
        </>
      )}
      {trace && (
        <>
          <div className="statusbar__item">
            <span className={`statusbar__dot ${dotClass}`} />
            {trace.status} · {trace.model}
          </div>
          <div className="statusbar__item">
            tokens: <span className="amber">{trace.steps.length}</span>
          </div>
          <div className="statusbar__item">
            entropy: <span className="amber">{meanEntropy.toFixed(2)}</span>
          </div>
          {trace.durationMs && (
            <div className="statusbar__item">
              {trace.durationMs}ms
            </div>
          )}
        </>
      )}
      <div className="statusbar__item" style={{ marginLeft: "auto" }}>
        yeco-lens v{status?.version ?? "—"}
      </div>
    </div>
  );
}
