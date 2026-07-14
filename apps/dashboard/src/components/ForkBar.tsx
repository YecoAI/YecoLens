import { useStore } from "../store/useStore";
import type { TraceState } from "../store/useStore";

interface Props {
  trace: TraceState;
  onFork: (atIndex: number, altTokenIndex: number, newSystemPrompt?: string) => void;
  onResume: () => void;
}

export function ForkBar({ trace, onFork, onResume }: Props) {
  const forkSelectedStep = useStore((s) => s.forkSelectedStep);
  const forkSelectedAlt = useStore((s) => s.forkSelectedAlt);
  const forkNewSystemPrompt = useStore((s) => s.forkNewSystemPrompt);
  const selectForkAlt = useStore((s) => s.selectForkAlt);
  const setForkNewSystemPrompt = useStore((s) => s.setForkNewSystemPrompt);

  const stepIndex =
    forkSelectedStep ??
    (trace.status === "paused" ? trace.breakpointAt ?? null : null);

  if (stepIndex === null) return null;
  const step = trace.steps[stepIndex];
  if (!step) return null;

  const isPaused = trace.status === "paused";

  return (
    <div className="forkbar">
      <div className="forkbar__row">
        <span className="forkbar__label">
          {isPaused ? "⚡ breakpoint paused" : "fork point"} @ t{stepIndex}
        </span>
        <span className="dim" style={{ fontSize: 11 }}>
          entropy {step.entropy.toFixed(2)} · chosen{" "}
          <span className="green">"{step.token}"</span> ({Math.round(step.probability * 100)}%)
        </span>
      </div>

      {step.alternatives.length > 0 ? (
        <>
          <div className="forkbar__row">
            <span className="forkbar__label">inject alternative:</span>
            <div className="forkbar__chips">
              {step.alternatives.map((alt, i) => (
                <span
                  key={i}
                  className={`chip ${forkSelectedAlt === i ? "chip--active" : ""}`}
                  onClick={() => selectForkAlt(i)}
                  title={`${alt.token} — ${Math.round(alt.probability * 100)}%`}
                >
                  {alt.token} · {Math.round(alt.probability * 100)}%
                </span>
              ))}
            </div>
          </div>

          <div className="forkbar__row">
            <span className="forkbar__label">system prompt (optional):</span>
            <textarea
              className="forkbar__prompt"
              placeholder="Leave blank to keep the original system prompt…"
              value={forkNewSystemPrompt}
              onChange={(e) => setForkNewSystemPrompt(e.target.value)}
              rows={2}
            />
          </div>

          <div className="forkbar__row">
            <button
              className="btn btn--primary"
              disabled={forkSelectedAlt === null}
              onClick={() =>
                forkSelectedAlt !== null &&
                onFork(
                  stepIndex,
                  forkSelectedAlt,
                  forkNewSystemPrompt.trim() === "" ? undefined : forkNewSystemPrompt
                )
              }
            >
              ⏏ Fork &amp; Hot-Reload
            </button>
            {isPaused && (
              <button className="btn" onClick={onResume}>
                ▶ Resume
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="forkbar__row">
          <span className="dim" style={{ fontSize: 11 }}>
            no alternatives at this step — cannot fork here.
          </span>
          {isPaused && (
            <button className="btn" onClick={onResume}>
              ▶ Resume
            </button>
          )}
        </div>
      )}
    </div>
  );
}
