# Standalone Explorer

No code required. Yeco-Lens can drive itself — `npx @yecoai-org/yeco-lens` boots a local
dashboard that talks directly to your Ollama or OpenAI models.

## Quick start

```bash
# If you have Ollama running locally with a model pulled:
ollama run qwen2.5      # in one terminal
npx @yecoai-org/yeco-lens           # in another

# Or with OpenAI:
export OPENAI_API_KEY=sk-...
npx @yecoai-org/yeco-lens
```

Then open the printed URL (or it opens automatically), pick a model, type a
prompt, and watch:

- **Probability Waterfall** — each token with its competing candidates.
- **Entropy Sentry** — a live entropy sparkline; spikes flag confusion.
- **Fork & Hot-Reload** — pause on a spike, pick an alternative token, edit the
  system prompt, and re-stream from that point.

That's it. No SDK, no instrumentation code — just real logprobs, live.
