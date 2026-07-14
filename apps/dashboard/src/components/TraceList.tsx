import { useStore } from "../store/useStore";
import type { TraceState } from "../store/useStore";

function statusDot(status: TraceState["status"]): string {
  switch (status) {
    case "running": return "trace-item__status--running";
    case "paused": return "trace-item__status--paused";
    case "error": return "trace-item__status--error";
    default: return "trace-item__status--ended";
  }
}

export function TraceList() {
  const traces = useStore((s) => s.traces);
  const activeTraceId = useStore((s) => s.activeTraceId);
  const selectTrace = useStore((s) => s.selectTrace);

  const list = Object.values(traces).sort((a, b) => {
    return b.id.localeCompare(a.id);
  });

  return (
    <div className="sidebar__section">
      <div className="sidebar__title">traces</div>
      {list.length === 0 ? (
        <div className="dim" style={{ fontSize: 11 }}>
          no traces yet.
        </div>
      ) : (
        <div className="trace-list">
          {list.map((t) => (
            <div
              key={t.id}
              className={`trace-item ${activeTraceId === t.id ? "trace-item--active" : ""}`}
              onClick={() => selectTrace(t.id)}
            >
              <span className={`trace-item__status ${statusDot(t.status)}`} />
              <span>{t.model}</span>
              <span className="dim" style={{ marginLeft: "auto", fontSize: 10 }}>
                {t.steps.length} tok
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
