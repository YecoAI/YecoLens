import { useState } from "react";
import { useStore } from "../store/useStore";
import { setOpenAIConfig } from "../api/config";

interface Props {
  ollamaReachable: boolean;
  openaiConfigured: boolean;
  openaiReachable?: boolean;
  openaiBaseUrl?: string;
}

const PRESETS: { label: string; url: string }[] = [
  { label: "OpenAI", url: "https://api.openai.com" },
  { label: "Groq", url: "https://api.groq.com/openai" },
  { label: "Together", url: "https://api.together.xyz/v1" },
  { label: "vLLM", url: "http://127.0.0.1:8000" },
  { label: "LM Studio", url: "http://127.0.0.1:1234/v1" },
];

export function OnboardingScreen({
  ollamaReachable,
  openaiConfigured,
  openaiReachable,
  openaiBaseUrl,
}: Props) {
  const [baseUrl, setBaseUrl] = useState(openaiBaseUrl ?? "https://api.openai.com");
  const [key, setKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ollamaUrl = useStore((s) => s.status?.ollamaUrl ?? "http://127.0.0.1:11434");

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await setOpenAIConfig({ baseUrl: baseUrl.trim(), apiKey: key.trim() });
      setKey("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="onboarding">
      <div className="onboarding__card">
        <div className="onboarding__logo">🕵️</div>
        <h1 className="onboarding__title">Yeco-Lens</h1>
        <p className="onboarding__subtitle">
          X-ray vision for your LLM. To begin, point Yeco-Lens at a real model —
          a local Ollama instance, OpenAI, or any OpenAI-compatible API. Nothing
          here is simulated.
        </p>

        <div className="onboarding__step">
          <span className="amber">● Option A — Local (free, recommended)</span>
          <br />
          Install Ollama, then pull a model and leave it running:
          <code className="onboarding__code">ollama run qwen2.5</code>
          Yeco-Lens auto-detects Ollama at{" "}
          <span className="green">{ollamaUrl}</span> — status:{" "}
          <span className={ollamaReachable ? "green" : "red"}>
            {ollamaReachable ? "detected" : "not detected"}
          </span>
          <br />
          <span className="dim" style={{ fontSize: 11 }}>
            other tested models: llama3.2, phi3, mistral
          </span>
        </div>

        <div className="onboarding__step">
          <span className="amber">● Option B — OpenAI / OpenAI-compatible</span>
          <br />
          Works with OpenAI, Groq, Together, vLLM, LM Studio, and any provider
          that speaks the OpenAI Chat Completions API. Config is applied live —
          no restart needed.
          <div className="forkbar__chips" style={{ margin: "8px 0" }}>
            {PRESETS.map((p) => (
              <span
                key={p.label}
                className={`chip ${baseUrl === p.url ? "chip--active" : ""}`}
                onClick={() => setBaseUrl(p.url)}
                title={p.url}
              >
                {p.label}
              </span>
            ))}
          </div>
          <label className="dim" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>
            base URL
          </label>
          <input
            className="onboarding__input"
            type="text"
            placeholder="https://api.openai.com"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          <label className="dim" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>
            api key {openaiConfigured && <span className="green">(already set — leave blank to keep)</span>}
          </label>
          <input
            className="onboarding__input"
            type="password"
            placeholder={openaiConfigured ? "•••• (unchanged)" : "sk-… / gsk_… / your key"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            spellCheck={false}
            autoComplete="off"
          />
          {error && (
            <div className="red" style={{ fontSize: 11, marginTop: 4 }}>
              ⚠ {error}
            </div>
          )}
          {openaiConfigured && (
            <div className="dim" style={{ fontSize: 11, marginTop: 4 }}>
              status:{" "}
              <span className={openaiReachable ? "green" : "red"}>
                {openaiReachable ? "endpoint reachable" : "configured but not reachable"}
              </span>
            </div>
          )}
          <button
            className="btn btn--primary"
            style={{ marginTop: 8 }}
            disabled={submitting || (key.trim().length === 0 && !openaiConfigured)}
            onClick={submit}
          >
            {submitting ? "connecting…" : openaiConfigured ? "↻ Update endpoint" : "Connect"}
          </button>
        </div>

        <div className="onboarding__step" style={{ marginTop: 16 }}>
          <span className="dim">Once a model is available, this panel is replaced by the live dashboard.</span>
        </div>
      </div>
    </div>
  );
}
