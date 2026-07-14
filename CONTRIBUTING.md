# Contributing to Yeco-Lens

Thanks for your interest in making Yeco-Lens better! This project thrives on community contributions.

## 🧭 Ways to contribute

- **Bug reports** — open an issue with a minimal repro.
- **Feature requests** — check the [roadmap](./README.md#-roadmap) and open issues first.
- **Provider adapters** — new inference providers (vLLM, Anthropic, Mistral, etc.).
- **Dashboard polish** — the Terminal DevTools UI always welcomes refinement.
- **Docs & examples** — clearer quickstarts, more language examples.
- **`good first issue`** — see [issues labeled `good first issue`](https://github.com/YecoAI/yeco-lens/labels/good%20first%20issue).

## 🛠️ Development setup

```bash
git clone https://github.com/YecoAI/yeco-lens.git
cd yeco-lens
npm install --include=dev
npm test            # run all TypeScript + dashboard tests
npm run build       # build every workspace
npm run lint        # tsc --noEmit across workspaces
```

Python SDK:

```bash
cd sdk/python
pip install -e ".[test]"
pytest
```

### Architecture primer

- **`packages/protocol`** is the source of truth — every message on the wire is defined here, plus the pure entropy/fork logic. Changing the protocol means updating both the TS and Python mirrors.
- **`server`** is the broker: it performs real inference (Ollama/OpenAI), computes entropy, handles fork, and fans events out over WebSocket.
- **`apps/dashboard`** is a local React SPA served as static assets by the server.
- **`cli`** is the `npx` entry point.
- **`sdk/python`** speaks the same protocol as the dashboard.

### The "no fake data" rule

Yeco-Lens never ships simulated model output in the product. Tests use fixtures (captured provider response shapes) — that's engineering hygiene and is fine. But the running product must only ever show real logprobs from real models. If you add a demo mode, it must be clearly labeled and off by default.

## 📝 Pull request checklist

- [ ] Tests pass (`npm test` and/or `pytest`).
- [ ] `npm run lint` is clean.
- [ ] If you changed the protocol, you updated both TS (`packages/protocol`) and Python (`sdk/python/src/yeco_lens/protocol.py`).
- [ ] If you added a feature, you added a test.
- [ ] If you changed user-facing behavior, you updated the README.
- [ ] Commits are focused and have clear messages.

## 🧪 Testing notes

- Provider tests (`server/src/providers/*.test.ts`) mock `fetch` with captured NDJSON/SSE fixtures — no network. This is a test fixture, not a product simulation.
- The WebSocket hub test (`server/src/ws.test.ts`) drives the real `TraceStore` + `InferenceEngine` with a mocked Ollama fetch.
- Dashboard store tests reduce `ServerMessage`s into state and assert on the result.

## 🏷️ Commit conventions

We don't enforce a strict format, but we love conventional commits:

```
feat(server): add vLLM provider
fix(dashboard): correct entropy sparkline on empty series
docs: clarify fork context rebuilding
```

## 🐛 Reporting security issues

Please **do not** open a public issue for security vulnerabilities. Email `security@yeco.ai` instead.

## 💬 Questions?

Open a [Discussion](https://github.com/YecoAI/yeco-lens/discussions) or join the conversation on issues. We're friendly and respond fast.

— The YecoAI team
