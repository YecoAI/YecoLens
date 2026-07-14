# Changelog

All notable changes to Yeco-Lens are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-07-12

### Added
- **`yeco_lens.auto()` — one-line auto-interception.** Add a single line at the
  top of your script and every OpenAI/Ollama streaming call is transparently
  traced to the dashboard. Your existing code stays 100% unchanged. Also
  available as the `auto_intercept()` context manager and `unpatch()`.
- **Probability Waterfall** — live token-by-token rendering with per-token
  probability and click-to-reveal competing alternatives.
- **Entropy Sentry** — normalized Shannon entropy sparkline with configurable
  auto-pause breakpoints.
- **Fork & Hot-Reload** — pause on any token, pick an alternative, edit the
  system prompt, and re-stream a real generation from the fork point.
- **Standalone Explorer** — `npx yeco-lens` auto-detects Ollama on `:11434`
  and lists real local models; falls back to a real onboarding screen (no fake
  data) when no model is available.
- **Real providers** — Ollama native `/api/chat` (with `logprobs` +
  `top_logprobs`) and OpenAI `/v1/chat/completions`.
- **Python SDK** (`pip install yeco-lens`) — `YecoLens.trace()` context manager
  with `openai_chat()` and `ollama_chat()` adapters; silently no-ops when the
  dashboard isn't running. Plus the `auto()` one-liner that patches OpenAI/Ollama
  globally with zero code changes.
- **Shared wire protocol** (`@yeco-ai/protocol`) — one JSON-over-WebSocket
  protocol used by both the dashboard and the SDK.
- **Terminal DevTools UI** — dense, monospace, dark instrument-panel aesthetic.
- **CI** — lint + test on every PR; build verification.
- **Examples** — OpenAI, Ollama, and standalone quickstarts.
- **Docs** — README, CONTRIBUTING, protocol reference, self-hosting guide.

[1.0.0]: https://github.com/YecoAI/yeco-lens/releases/tag/v1.0.0
