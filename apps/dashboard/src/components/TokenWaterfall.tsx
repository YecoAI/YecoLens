import type { TraceState } from "../store/useStore";
import { TokenBadge } from "./TokenBadge";

interface Props {
  trace: TraceState;
  forkSelectedStep: number | null;
  onSelectStep: (step: number | null) => void;
  onFork: (stepIndex: number, altIndex: number) => void;
}

export function TokenWaterfall({ trace, forkSelectedStep, onSelectStep, onFork }: Props) {
  if (trace.steps.length === 0) {
    return (
      <div className="panel__body empty">
        {trace.status === "running"
          ? "▌ streaming tokens…"
          : "no tokens yet — send a prompt to begin."}
      </div>
    );
  }

  const spikeThreshold = 0.7;

  return (
    <div
      className="panel__body waterfall scroll"
      onClick={() => onSelectStep(null)}
    >
      {trace.messages
        .filter((m) => m.role === "user")
        .map((m, i) => (
          <div key={`u-${i}`} className="dim" style={{ marginBottom: 8 }}>
            <span className="amber">› </span>
            {m.content}
          </div>
        ))}
      <div>
        {trace.steps.map((step) => (
          <TokenBadge
            key={step.index}
            step={step}
            isSpike={step.entropy >= spikeThreshold}
            isSelected={forkSelectedStep === step.index}
            onSelect={() => onSelectStep(step.index)}
            onFork={(altIndex) => onFork(step.index, altIndex)}
          />
        ))}
        {trace.status === "running" && <span className="amber">▌</span>}
      </div>
    </div>
  );
}
