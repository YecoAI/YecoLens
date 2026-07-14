import { useState } from "react";
import type { TokenStep } from "@yeco-ai/protocol";

interface Props {
  step: TokenStep;
  isSpike: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onFork: (altIndex: number) => void;
}

function heatClass(probability: number): string {
  if (probability < 0.4) return "token--low";
  if (probability < 0.7) return "token--mid";
  return "token--high";
}

function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export function TokenBadge({ step, isSpike, isSelected, onSelect, onFork }: Props) {
  const [open, setOpen] = useState(false);

  const classes = ["token", heatClass(step.probability)];
  if (isSpike) classes.push("token--spike");
  if (isSelected) classes.push("token--selected");

  return (
    <span
      className={classes.join(" ")}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((o) => !o);
        onSelect();
      }}
    >
      {step.token}
      <span className="token__prob">{pct(step.probability)}</span>
      {open && step.alternatives.length > 0 && (
        <div className="altpop" onClick={(e) => e.stopPropagation()}>
          <div className="altpop__title">
            alternatives · entropy {step.entropy.toFixed(2)}
          </div>
          <div className="altrow">
            <span className="altrow__token">{step.token}</span>
            <span className="altrow__bar">
              <span className="altrow__fill altrow__fill--chosen" style={{ width: pct(step.probability) }} />
            </span>
            <span className="altrow__pct">{pct(step.probability)}</span>
            <span className="dim" style={{ fontSize: 10 }}>chosen</span>
          </div>
          {step.alternatives.map((alt, i) => (
            <div className="altrow" key={i} onClick={() => { setOpen(false); onFork(i); }}>
              <span className="altrow__token">{alt.token}</span>
              <span className="altrow__bar">
                <span className="altrow__fill" style={{ width: pct(alt.probability) }} />
              </span>
              <span className="altrow__pct">{pct(alt.probability)}</span>
              <span className="altrow__fork">fork▸</span>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}
