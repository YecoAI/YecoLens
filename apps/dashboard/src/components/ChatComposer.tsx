import { useStore } from "../store/useStore";

interface Props {
  onGenerate: () => void;
  onPause: () => void;
}

export function ChatComposer({ onGenerate, onPause }: Props) {
  const models = useStore((s) => s.models);
  const selectedModelId = useStore((s) => s.selectedModelId);
  const systemPrompt = useStore((s) => s.systemPrompt);
  const userMessage = useStore((s) => s.userMessage);
  const temperature = useStore((s) => s.temperature);
  const topLogprobs = useStore((s) => s.topLogprobs);
  const entropyBreakpoint = useStore((s) => s.entropyBreakpoint);
  const setSystemPrompt = useStore((s) => s.setSystemPrompt);
  const setUserMessage = useStore((s) => s.setUserMessage);
  const setTemperature = useStore((s) => s.setTemperature);
  const setTopLogprobs = useStore((s) => s.setTopLogprobs);
  const setEntropyBreakpoint = useStore((s) => s.setEntropyBreakpoint);
  const traces = useStore((s) => s.traces);
  const activeTraceId = useStore((s) => s.activeTraceId);
  const trace = activeTraceId ? traces[activeTraceId] : null;
  const isRunning = trace?.status === "running";

  const selectedModel = models.find((m) => m.id === selectedModelId);
  const canGenerate = Boolean(selectedModel) && userMessage.trim().length > 0 && !isRunning;

  return (
    <div className="composer">
      <input
        className="composer__textarea"
        style={{ minHeight: "auto", maxHeight: "none" }}
        placeholder="system prompt (optional)…"
        value={systemPrompt}
        onChange={(e) => setSystemPrompt(e.target.value)}
      />
      <div className="composer__row">
        <textarea
          className="composer__textarea"
          placeholder={`message ${selectedModel ? `→ ${selectedModel.name}` : "— select a model first"}…`}
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canGenerate) onGenerate();
          }}
          rows={3}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            className="btn btn--primary"
            disabled={!canGenerate}
            onClick={onGenerate}
          >
            ▶ Run
          </button>
          {isRunning && (
            <button className="btn btn--danger" onClick={onPause}>
              ⏸ Pause
            </button>
          )}
        </div>
      </div>
      <div className="composer__meta">
        <label className="composer__field">
          temp
          <input
            className="composer__input"
            type="number"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value) || 0)}
          />
        </label>
        <label className="composer__field">
          top_logprobs
          <input
            className="composer__input"
            type="number"
            min={1}
            max={20}
            step={1}
            value={topLogprobs}
            onChange={(e) => setTopLogprobs(parseInt(e.target.value, 10) || 10)}
          />
        </label>
        <label className="composer__field">
          entropy breakpoint
          <input
            className="composer__input"
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={entropyBreakpoint}
            onChange={(e) => setEntropyBreakpoint(parseFloat(e.target.value) || 0)}
            title="0 disables auto-pause on entropy spikes"
          />
        </label>
        <span className="dim" style={{ marginLeft: "auto" }}>
          ⌘+Enter to run
        </span>
      </div>
    </div>
  );
}
