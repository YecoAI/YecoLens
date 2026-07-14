<div align="center">

# 🕵️ Yeco-Lens

**X-ray vision for your LLM.** Watch every token's confidence, hunt entropy spikes, and fork reality mid-generation.

[![npm version](https://img.shields.io/npm/v/@yeco-ai/yeco-lens.svg)](https://www.npmjs.com/package/@yeco-ai/yeco-lens)
[![pypi version](https://img.shields.io/pypi/v/yeco-lens.svg)](https://pypi.org/project/yeco-lens/)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![ci](https://github.com/YecoAI/yeco-lens/actions/workflows/ci.yml/badge.svg)](https://github.com/YecoAI/yeco-lens/actions/workflows/ci.yml)
[![node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](https://nodejs.org)
[![stars](https://img.shields.io/github/stars/YecoAI/yeco-lens?style=social)](https://github.com/YecoAI/yeco-lens)

</div>

---

When an LLM fails — a bad JSON token, a hallucinated fact, an infinite loop — it's because at some point a *wrong token* won. But today you only see the final text. You can't tell whether the model was **99% confident and wrong** (a data/prompt problem) or **totally confused, 20% across five tokens** (an entropy problem).

**Yeco-Lens changes that.** It's a local DevTools panel for LLM inference that shows you, token by token:

- **The Probability Waterfall** — every emitted token with the competitors the model discarded (`Milano` 62% vs `Roma` 28% vs `Torino` 10%).
- **The Entropy Sentry** — a live entropy sparkline. Spikes = the model was confused. Make them **breakpoints** that auto-pause generation.
- **Fork & Hot-Reload** — pause at token #14, pick the alternative the model *didn't* choose, edit the system prompt, and **re-stream from that exact point**.

Everything is **100% real** — real logprobs from your real models. No simulations, no recordings, no fake data. Ever.

```
┌─ YECO-LENS ─────────────── ▶ running │ entropy 0.41 ┐
│ trace 7f3a   model qwen2.5   t=42ms              │
├──────────────────────────────────────────────────┤
│ PROBABILITY WATERFALL                            │
│  The capital of Italy is [Milano▾ .62] a city.   │
│                        └ Roma .28 · Torino .10  │
│  ▲ entropy spike @ t14 — paused on breakpoint    │
├──────────────────────────────────────────────────┤
│ ENTROPY  ▁▂▁▁▃▂▁▆█▇▂▁  min .04 max .93 mean .31 │
├──────────────────────────────────────────────────┤
│ > fork▸Roma   edit system prompt   [ Resume ]    │
└──────────────────────────────────────────────────┘
```

## 🚀 Quick start

### Standalone Explorer (zero code)

```bash
npx yeco-lens
```

Yeco-Lens auto-detects Ollama on `:11434` and lists your real local models. Pick one, type a prompt, watch the waterfall. If you have no Ollama and no OpenAI key, it shows a real onboarding screen — never fake data.

**With Ollama:**
```bash
ollama run qwen2.5   # in one terminal
npx yeco-lens        # in another
```

**With OpenAI or any OpenAI-compatible API (Groq, Together, vLLM, LM Studio…):**
```bash
export OPENAI_API_KEY=sk-...
npx yeco-lens
```
No key yet? Just run `npx yeco-lens` and paste a key + custom URL straight into
the onboarding screen — it connects **live, no restart**. Presets for common
providers are one click away.

### Instrumented mode (Python SDK)

**Simplest possible integration — add ONE line, change nothing else:**

```bash
pip install yeco-lens[openai]
```

```python
import yeco_lens
yeco_lens.auto()          # ← the only line you add

from openai import OpenAI
client = OpenAI()

# Your existing code, 100% unchanged:
stream = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Capital of Italy?"}],
    stream=True,
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")
```

`auto()` transparently intercepts every OpenAI/Ollama call — it forces
`logprobs` on and tees the real token stream to the dashboard, while your app
behaves exactly as before. Nothing else in your code changes. Use it as a
context manager too:

```python
with yeco_lens.auto_intercept():
    # every call inside this block is traced
    run_my_agent()
```

Call `yeco_lens.unpatch()` to restore the originals.

**Want full control?** Use the explicit API instead:

```python
from yeco_lens import YecoLens
yeco = YecoLens()  # connects to ws://127.0.0.1:7531

with yeco.trace(model="gpt-4o-mini", system_prompt="Be concise."):
    for chunk in yeco.openai_chat(client, model="gpt-4o-mini",
                                  messages=[{"role": "user", "content": "Capital of Italy?"}],
                                  top_logprobs=10):
        print(chunk.token, end="")  # streams to your app AND the dashboard
```

The SDK silently no-ops if the dashboard isn't running — observability never breaks production.

## ✨ Features

### Probability Waterfall
Each generated token renders inline with its probability super-scripted. Click any token to see the **competing candidates** the model discarded, each with a probability bar. Low-confidence tokens glow red; entropy spikes get a hard outline.

### Entropy Sentry
A live SVG sparkline plots normalized Shannon entropy `[0,1]` across the generation. Set an **entropy breakpoint** (e.g. `0.7`) and Yeco-Lens **auto-pauses** the moment the model gets confused — you land exactly on the token where things went sideways.

### Fork & Hot-Reload (the killer feature)
Paused on a bad token? Don't restart the whole agent chain:
1. Click the alternative token you wish the model had picked.
2. Optionally edit the system prompt.
3. Hit **Fork & Hot-Reload**.

Yeco-Lens rebuilds the chat context — original messages + assistant prefix truncated at the fork point + your chosen alternative + the new system prompt — and **re-streams a real generation** from there. It works with any chat API, because no provider exposes "resume a forward pass"; we rebuild honestly.

## 🏗️ Architecture

```
┌─────────────────────┐                 ┌─────────┐  Server→UI   ┌───────────┐
│  AI app (Python SDK)│ ── SDK→Server ─▶│ Server  │ ───────────▶ │ Dashboard │
└─────────────────────┘                 │ (Fastify│              │ (React)   │
                                        │  + ws)  │ ◀─────────── │           │
┌─────────────────────┐  Standalone     └─────────┘   UI→Server  └───────────┘
│  Ollama / OpenAI    │ ──inference─────────▲
└─────────────────────┘                     │
                            └─ server drives real inference in standalone mode
```

- **One protocol.** The TypeScript dashboard and the Python SDK speak the same JSON-over-WebSocket wire protocol (`@yeco-ai/protocol`). Both are first-class clients.
- **Real providers.** Ollama via native `/api/chat` (with `logprobs`+`top_logprobs`), OpenAI via `/v1/chat/completions`. Not the OpenAI-compat shim — [Ollama's doesn't expose logprobs yet](https://github.com/ollama/ollama/issues/16117).
- **Local first.** Everything runs on `127.0.0.1`. Your prompts and keys never leave your machine.

### Monorepo layout

| Package | What |
|---|---|
| [`packages/protocol`](packages/protocol) | Shared wire-protocol types + entropy/fork logic (TS). |
| [`server`](server) | Fastify + ws backend: providers, entropy, fork, WebSocket hub. |
| [`apps/dashboard`](apps/dashboard) | Vite + React + TS Terminal DevTools UI. |
| [`cli`](cli) | `@yeco-ai/yeco-lens` — the `npx` launcher. |
| [`sdk/python`](sdk/python) | `pip install yeco-lens` — Python instrumentation SDK. |
| [`examples`](examples) | OpenAI, Ollama, and standalone examples. |

## 🔧 Configuration

All via environment variables (sane defaults — `npx yeco-lens` needs none):

| Variable | Default | Purpose |
|---|---|---|
| `YECO_LENS_PORT` | `7531` | Server port |
| `YECO_LENS_HOST` | `127.0.0.1` | Bind interface |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama native API URL |
| `OPENAI_API_KEY` | — | OpenAI key (optional) |
| `OPENAI_BASE_URL` | `https://api.openai.com` | OpenAI-compatible base URL |
| `YECO_LENS_TOP_LOGPROBS` | `10` | Default alternatives per token |
| `YECO_LENS_ENTROPY_BREAKPOINT` | `0` (off) | Auto-pause threshold `[0,1]` |

CLI flags: `--no-browser` / `-n`, `--port=PORT`.

## 🛠️ Development

```bash
git clone https://github.com/YecoAI/yeco-lens.git
cd yeco-lens
npm install --include=dev
npm test          # all TS + dashboard tests
npm run build     # build all workspaces
npm run dev       # dashboard dev server (proxies WS to :7531)

# Python SDK
cd sdk/python
pip install -e ".[test]"
pytest
```

## ⚠️ Limitations & Known Issues

- **Fork & Hot-Reload rebuilds context honestly.** No provider exposes a "resume a forward pass" API. Yeco-Lens truncates the assistant prefix at the fork point, injects the alternative token, and issues a *new* completion request. The model sees the same prompt up to that point, but re-generation is not guaranteed to produce identical output for the remaining tokens.
- **Thread-safe per-thread traces only.** The Python SDK stores the active trace in `threading.local()`, so each OS thread gets its own trace. Async tasks that share a thread (e.g., asyncio coroutines) will share a trace — use separate threads or explicit `YecoLens.trace()` for concurrent async work.
- **Provider support.** Ollama's OpenAI-compatible shim does not expose logprobs (see [ollama/ollama#16117](https://github.com/ollama/ollama/issues/16117)). Yeco-Lens uses Ollama's native `/api/chat` endpoint which does. OpenAI, Groq, Together, vLLM, LM Studio, and any OpenAI-compatible provider that returns `logprobs` in streaming chunks are supported.
- **Wire protocol versioning.** The JSON-over-WebSocket protocol is at version 1. Breaking changes will bump `PROTOCOL_VERSION` in `@yeco-ai/protocol`. Dashboard and SDK versions should match.
- **No persistent storage yet.** Traces are held in memory and lost when the server stops. SQLite history is on the roadmap.

## 📊 Benchmark & Metrics

See [`benchmark/`](./benchmark/) for the full benchmark suite with real LLM inference.
Results with **GPT-5.4-mini (via LLM7)** across 20 diverse prompts (factual, creative, reasoning, JSON, code):

| Metric | Value |
|---|---|
| Generations completed | 20/20 (100%) |
| Total tokens generated | 3,560 |
| Mean tokens per generation | 178.0 |
| Mean generation time (ms) | 398 |
| Mean throughput (tokens/s) | 515.2 |
| Mean Shannon entropy (normalized) | 0.671 |
| Entropy spike rate (≥0.7) | 42.2% of tokens |
| Fork & Hot-Reload success rate | 100% (5/5) |
| Mean fork child generation time | 4,873 ms |

Full report: [`benchmark/BENCHMARK_REPORT.md`](./benchmark/BENCHMARK_REPORT.md)

## 🗺️ Roadmap

- [ ] TypeScript instrumentation SDK
- [ ] gRPC transport option
- [ ] Multi-trace diff view
- [ ] SQLite trace history
- [ ] vLLM provider
- [ ] SDK auto-start of the dashboard

See [open issues](https://github.com/YecoAI/yeco-lens/issues) and look for `good first issue` labels.

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md). We're friendly and review fast.

## 📄 License

[MIT](LICENSE) © [YecoAI](https://github.com/YecoAI)

---

<div align="center">

**If Yeco-Lens saves you a debugging hour, drop a ⭐ — it helps more devs find it.**

</div>
