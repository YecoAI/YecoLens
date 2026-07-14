# Yeco-Lens Python SDK

Stream real LLM logprobs to the Yeco-Lens dashboard from your application.

## Install

```bash
pip install yeco-lens            # core
pip install yeco-lens[openai]    # + openai adapter deps
```

## Quickstart

### Simplest: one-line auto-interception

Add a single line at the top of your script — your existing code stays
**completely unchanged**:

```python
import yeco_lens
yeco_lens.auto()          # ← the only line you add

from openai import OpenAI
client = OpenAI()

# Your existing code, untouched:
stream = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Capital of Italy?"}],
    stream=True,
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="")
```

`auto()` monkey-patches `openai`'s `Completions.create` (and `ollama`'s
`Client.chat`) to force `logprobs` on and tee the real token stream to the
dashboard. Your app keeps working exactly as before — it just becomes
observable.

Use it as a context manager to limit the scope:

```python
with yeco_lens.auto_intercept():
    run_my_agent()   # only calls inside this block are traced
# patches auto-removed here
```

Call `yeco_lens.unpatch()` to restore the original methods manually. `auto()`
returns `{"openai": True, "ollama": False}` telling you which providers were
patched (`False` = library not installed).

### Explicit: full control with the trace API

```python
from yeco_lens import YecoLens
from openai import OpenAI

client = OpenAI()
yeco = YecoLens()  # connects to ws://127.0.0.1:7531 (or YECO_LENS_ENDPOINT)

with yeco.trace(model="gpt-4o-mini", system_prompt="Be concise."):
    for chunk in yeco.openai_chat(
        client,
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Capital of Italy?"}],
        top_logprobs=10,
    ):
        print(chunk.token, end="", flush=True)
```

Start the dashboard first (`npx yeco-lens`) in another terminal, then run your
script. Both your stdout and the dashboard receive the same live stream.

## API

### `auto(enable_openai=True, enable_ollama=True)`

The one-line auto-interception entrypoint. Patches OpenAI's `Completions.create`
and Ollama's `Client.chat` so every streaming call is transparently traced.
Returns a dict showing which providers were patched.

### `auto_intercept(enable_openai=True, enable_ollama=True)`

Context-manager form of `auto()`. Patches on enter, restores on exit.

### `unpatch()`

Restore all original methods patched by `auto()` / `patch_openai()` /
`patch_ollama()`.

### `YecoLens(endpoint=None, *, connect=True)`

- `endpoint` — WebSocket URL. Defaults to `YECO_LENS_ENDPOINT` env var, then
  `ws://127.0.0.1:7531/ws`.
- `connect` — if `False`, don't attempt a connection (useful in tests).

If the dashboard isn't running, the SDK **silently no-ops** — your application
is never blocked by observability.

### `yeco.trace(model, *, system_prompt=None, user_message=None, messages=None, provider="sdk")`

A context manager that opens a trace. Use it around any LLM call. On enter it
emits `trace.start`; on clean exit it emits `trace.end` (on exception,
`trace.error`).

You can pass either `system_prompt`/`user_message` convenience args, or a full
`messages` list.

### `yeco.openai_chat(client, *, model, messages, temperature=0.7, top_logprobs=10, **kwargs)`

Streams an OpenAI chat completion. Requires the `openai` package. Each yielded
`TraceChunk` carries:

| field | type | meaning |
|---|---|---|
| `token` | `str` | the emitted token |
| `logprob` | `float` | `ln p` of the token |
| `probability` | `float` | normalized probability `[0,1]` |
| `alternatives` | `list[TokenAlt]` | competing tokens, each with `.token`, `.logprob`, `.probability` |
| `entropy` | `float` | normalized entropy `[0,1]` |

Must be called inside a `with yeco.trace(...)` block.

### `yeco.ollama_chat(client, *, model, messages, temperature=0.7, top_logprobs=10, **kwargs)`

Same as above, for a local Ollama client (`ollama.Client()`). Uses the native
`/api/chat` endpoint with `logprobs=True`.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `YECO_LENS_ENDPOINT` | `ws://127.0.0.1:7531/ws` | Dashboard server WebSocket URL |

## Why it no-ops gracefully

Production reliability trumps observability. If the dashboard is down, the SDK
catches connection/send errors internally and marks itself disconnected; your
LLM call proceeds normally. Reconnection happens on the next `YecoLens()`
construction.

## Protocol

The SDK speaks the exact same wire protocol as the dashboard — see
[`docs/protocol.md`](./protocol.md). This means a Python-instrumented app and
the standalone explorer can both feed the same dashboard simultaneously.
