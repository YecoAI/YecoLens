"""
Example: instrument a local Ollama chat call with Yeco-Lens.

1. Start Ollama and pull a model:
       ollama run qwen2.5

2. Start the dashboard:
       npx yeco-lens

3. Install + run this example:
       pip install yeco-lens ollama
       python main.py

The dashboard shows real logprobs from your local model — 100% on your machine.
"""
import ollama
from yeco_lens import YecoLens

client = ollama.Client()
yeco = YecoLens()

print("Streaming local Ollama generation with Yeco-Lens…\n")

with yeco.trace(model="qwen2.5", system_prompt="Be concise."):
    for chunk in yeco.ollama_chat(
        client,
        model="qwen2.5",
        messages=[{"role": "user", "content": "What is the capital of France?"}],
        top_logprobs=10,
    ):
        print(chunk.token, end="", flush=True)

print("\n\nDone. Check the Yeco-Lens dashboard for the probability waterfall.")
yeco.close()
