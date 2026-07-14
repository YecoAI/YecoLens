import { useMemo } from "react";

interface Props {
  series: number[];
  threshold: number;
}

const WIDTH = 600;
const HEIGHT = 80;
const PAD = 4;

export function EntropyChart({ series, threshold }: Props) {
  const { linePath, areaPath, spikes, stats } = useMemo(() => {
    if (series.length === 0) {
      return { linePath: "", areaPath: "", spikes: [] as number[], stats: null };
    }
    const n = series.length;
    const stepX = n > 1 ? (WIDTH - PAD * 2) / (n - 1) : 0;
    const y = (v: number) => HEIGHT - PAD - v * (HEIGHT - PAD * 2);

    const points = series.map((v, i) => [PAD + i * stepX, y(v)] as const);

    const linePath = points
      .map(([x, yi], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yi.toFixed(1)}`)
      .join(" ");

    const areaPath =
      `M${PAD},${(HEIGHT - PAD).toFixed(1)} ` +
      points.map(([x, yi]) => `L${x.toFixed(1)},${yi.toFixed(1)}`).join(" ") +
      ` L${(PAD + (n - 1) * stepX).toFixed(1)},${(HEIGHT - PAD).toFixed(1)} Z`;

    const spikes = series
      .map((v, i) => (v >= threshold ? i : -1))
      .filter((i) => i >= 0);

    const min = Math.min(...series);
    const max = Math.max(...series);
    const mean = series.reduce((a, b) => a + b, 0) / n;
    const stats = { min, max, mean };

    return { linePath, areaPath, spikes, stats };
  }, [series, threshold]);

  const thresholdY = HEIGHT - PAD - threshold * (HEIGHT - PAD * 2);

  if (!stats) {
    return (
      <div className="entropy">
        <div className="dim" style={{ fontSize: 12 }}>entropy series will appear here.</div>
      </div>
    );
  }

  return (
    <div className="entropy">
      <div className="entropy__stats">
        <span>min <span className="entropy__stat-val">{stats.min.toFixed(2)}</span></span>
        <span>max <span className="entropy__stat-val">{stats.max.toFixed(2)}</span></span>
        <span>mean <span className="entropy__stat-val">{stats.mean.toFixed(2)}</span></span>
        <span>spikes <span className="entropy__stat-val red">{spikes.length}</span></span>
        <span>threshold <span className="entropy__stat-val">{threshold.toFixed(2)}</span></span>
      </div>
      <svg className="entropy__svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="entropy-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--amber)" />
            <stop offset="100%" stopColor="var(--amber)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {threshold > 0 && (
          <line
            className="entropy__threshold"
            x1={PAD}
            y1={thresholdY}
            x2={WIDTH - PAD}
            y2={thresholdY}
          />
        )}
        <path className="entropy__area" d={areaPath} />
        <path className="entropy__line" d={linePath} />
        {spikes.map((i) => {
          const stepX = series.length > 1 ? (WIDTH - PAD * 2) / (series.length - 1) : 0;
          const x = PAD + i * stepX;
          const yi = HEIGHT - PAD - series[i] * (HEIGHT - PAD * 2);
          return <circle key={i} className="entropy__spike" cx={x} cy={yi} r={2.5} />;
        })}
      </svg>
    </div>
  );
}
