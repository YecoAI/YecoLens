# Examples

| Example | What it shows |
|---|---|
| [`standalone`](./standalone/README.md) | Zero-code: `npx yeco-lens` + your Ollama/OpenAI model. |
| [`python-auto`](./python-auto/main.py) | **Simplest SDK:** add ONE line, change nothing else. |
| [`python-openai`](./python-openai/main.py) | Instrument an OpenAI streaming call in 3 lines (explicit API). |
| [`python-ollama`](./python-ollama/main.py) | Instrument a local Ollama generation. |

## Run any example

```bash
# 1. Start the dashboard in one terminal
npx yeco-lens

# 2. Run the example in another
cd python-auto      # or python-openai / python-ollama
pip install -r requirements.txt   # if present
python main.py
```

Both the example's stdout AND the Yeco-Lens dashboard receive the same live
token stream — the example keeps working exactly as before, and you get the
X-ray view for free.
