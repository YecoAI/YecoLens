"""
Example: the SIMPLEST possible Yeco-Lens integration.

Add one line (yeco_lens.auto()) and your existing OpenAI code is automatically
intercepted — logprobs are turned on and every token streams to the dashboard.
Nothing else changes.

1. Start the dashboard in one terminal:
       npx yeco-lens

2. Set your key and run this file:
       export OPENAI_API_KEY=sk-...
       pip install yeco-lens[openai]
       python main.py

Compare this to examples/python-openai/main.py, which uses the explicit
trace() API for full control. Both produce identical dashboard output.
"""
import yeco_lens

yeco_lens.auto()  # ← the only line you add. Everything else is normal code.

from openai import OpenAI

client = OpenAI()

# Your existing call — completely unchanged.
stream = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Name the capital of Italy and one fun fact."}],
    stream=True,
)

for chunk in stream:
    content = chunk.choices[0].delta.content or ""
    print(content, end="", flush=True)

print("\n\nDone. Check the Yeco-Lens dashboard — the waterfall appeared with zero code changes.")
