# Yeco-Lens Wire Protocol

Every participant in Yeco-Lens speaks one JSON-over-WebSocket protocol. This
document is the canonical reference; the TypeScript types in
[`packages/protocol/src/index.ts`](../packages/protocol/src/index.ts) and the
Python mirror in [`sdk/python/src/yeco_lens/protocol.py`](../sdk/python/src/yeco_lens/protocol.py)
are the source of truth.

## Roles

| Role | Who |
|---|---|
| **server** | The Yeco-Lens backend (`@yeco-ai/server`) |
| **client** | Anything connecting to the server — the dashboard UI, or a Python/TS SDK |

```
┌─────────────────────┐    SDK→Server     ┌────────┐  Server→UI   ┌──────────┐
│  AI app (Python SDK)│ ─────────────────▶ │ Server │ ───────────▶ │ Dashboard │
└─────────────────────┘                    └────────┘              └──────────┘
                                                ▲                          │
                                                └────── UI→Server ─────────┘
```

## Core data types

### `TokenStep`
One emitted token plus the candidates the model considered at that position.
```json
{
  "index": 0,
  "token": "Milano",
  "logprob": -0.478,
  "probability": 0.62,
  "alternatives": [
    { "token": "Roma", "logprob": -1.273, "probability": 0.28 },
    { "token": "Torino", "logprob": -2.303, "probability": 0.10 }
  ],
  "entropy": 0.34
}
```
- `logprob` is the natural log of the probability (`ln p`).
- `probability` is normalized across the returned alternatives so they sum to 1.
- `entropy` is normalized Shannon entropy in `[0,1]` (0 = certain, 1 = maximally confused).

### `ChatMessage`
```json
{ "role": "user", "content": "Capital of Italy?" }
```
`role` is `"system" | "user" | "assistant"`.

### `ModelInfo`
```json
{ "id": "qwen2.5:7b", "name": "qwen2.5:7b", "provider": "ollama", "sizeBytes": 4400000000, "details": "qwen2 · 7B · Q4_K_M" }
```

## Client → Server messages

### `generate`
Start a real generation (standalone explorer mode).
```json
{
  "type": "generate",
  "provider": "ollama",
  "model": "qwen2.5",
  "messages": [{ "role": "user", "content": "hi" }],
  "temperature": 0.7,
  "topLogprobs": 10,
  "entropyBreakpoint": 0.7
}
```

### `pause`
Abort the in-flight stream for a trace.
```json
{ "type": "pause", "traceId": "7f3a9c" }
```

### `resume`
Re-issue the original request for a paused trace.
```json
{ "type": "resume", "traceId": "7f3a9c" }
```

### `fork`
Fork & Hot-Reload: rebuild context at `atIndex`, inject the chosen alternative,
optionally replace the system prompt, and re-stream.
```json
{
  "type": "fork",
  "traceId": "7f3a9c",
  "atIndex": 5,
  "altTokenIndex": 0,
  "newSystemPrompt": "Be verbose."
}
```
`altTokenIndex` indexes into `steps[atIndex].alternatives`. The server then
starts a **new** trace (the child) and emits `trace.start` + `trace.forked`.

### `subscribe`
(Optional) request a specific trace's stream. Currently the server broadcasts
to all connected clients; this is an ack-only no-op reserved for future use.

## Server → Client messages

| `type` | When | Key fields |
|---|---|---|
| `status` | On connect + whenever provider availability changes | `status: ServerStatus` |
| `models.list` | After Ollama probe / config change | `models: ModelInfo[]` |
| `trace.start` | A generation begins | `traceId`, `model`, `provider`, `messages` |
| `trace.token` | Each token step arrives | `traceId`, `step: TokenStep` |
| `trace.entropy` | (optional) running entropy series | `traceId`, `series: number[]` |
| `trace.breakpoint` | Entropy crossed threshold (or manual pause) | `traceId`, `atIndex`, `entropy`, `reason` |
| `trace.end` | Generation completed | `traceId`, `durationMs`, `text` |
| `trace.forked` | A fork spawned a child trace | `traceId` (parent), `childTraceId`, `atIndex` |
| `trace.error` | Generation failed | `traceId`, `error` |

## Entropy math

Normalized Shannon entropy over the returned top-k alternatives:

```
H = -Σ p_i · log2(p_i)        # Shannon entropy in bits
H_norm = H / log2(N)          # normalized to [0,1], N = #candidates
```

Normalization by `log2(N)` makes the threshold comparable across providers and
top-k sizes: `0.7` means "70% of the way to maximally confused", regardless of
whether `top_logprobs` was 5 or 20.

## Fork context rebuilding

No chat API exposes "resume a forward pass from token N with a different
choice". Yeco-Lens rebuilds the context honestly:

1. Take the parent trace's original `messages`.
2. Join tokens `[0..atIndex)` into an assistant prefix string.
3. Append the chosen alternative token.
4. Optionally replace the system message with `newSystemPrompt`.
5. Send the resulting message list as a fresh `generate`-equivalent request.

The model then continues from the forced prefix. This works with any chat API.

See [`packages/protocol/src/fork.ts`](../packages/protocol/src/fork.ts).
