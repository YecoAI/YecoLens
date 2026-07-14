"""
Example: instrument an OpenAI chat call with Yeco-Lens.

1. In one terminal, start the dashboard:
       npx @yecoai-org/yeco-lens

2. In another terminal, set your key and run this file:
       export OPENAI_API_KEY=sk-...
       pip install yeco-lens[openai]
       python main.py

Watch the dashboard light up with real token probabilities + entropy.
"""
from openai import OpenAI
from yeco_lens import YecoLens

client = OpenAI()
yeco = YecoLens()  # connects to ws://127.0.0.1:7531

print("Streaming with Yeco-Lens instrumentation…\n")

with yeco.trace(model="gpt-4o-mini", system_prompt="You are a concise geography expert."):
    for chunk in yeco.openai_chat(
        client,
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Name the capital of Italy and one fun fact."}],
        top_logprobs=10,
    ):
        print(chunk.token, end="", flush=True)
        # chunk.probability, chunk.alternatives, chunk.entropy also available

print("\n\nDone. Check the Yeco-Lens dashboard for the probability waterfall.")
yeco.close()
