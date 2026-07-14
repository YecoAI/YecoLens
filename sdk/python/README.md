# Yeco-Lens Python SDK

Instrumentation SDK that streams **real** LLM logprobs to the Yeco-Lens dashboard.

```python
from yeco_lens import YecoLens

yeco = YecoLens()  # connects to ws://127.0.0.1:7531 (or YECO_LENS_ENDPOINT)

with yeco.trace(model="gpt-4o", system_prompt="Be concise."):
    for chunk in yeco.openai_chat(client, model="gpt-4o", messages=..., top_logprobs=10):
        print(chunk.token, end="")  # streams to your app AND the dashboard
```

See the main repo README for the full guide.
