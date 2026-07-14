# Self-Hosting Yeco-Lens

Yeco-Lens is designed to run locally, but you can self-host it for a team or CI
environment just as easily.

## Quick local run

```bash
npx @yecoai-org/yeco-lens
```

That's it. The server binds `127.0.0.1:7531` and opens the dashboard in your
browser.

## From source

```bash
git clone https://github.com/YecoAI/yeco-lens.git
cd yeco-lens
npm install --include=dev
npm run build          # builds protocol, server, dashboard, cli
node cli/dist/index.js
```

## Configuration

All settings come from environment variables (no config file needed):

| Variable | Default | Purpose |
|---|---|---|
| `YECO_LENS_PORT` | `7531` | HTTP + WebSocket port |
| `YECO_LENS_HOST` | `127.0.0.1` | Bind interface (use `0.0.0.0` for LAN access) |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama native API URL |
| `OPENAI_API_KEY` | — | OpenAI key (optional; enables OpenAI provider) |
| `OPENAI_BASE_URL` | `https://api.openai.com` | Override for Azure / compatible providers |
| `YECO_LENS_TOP_LOGPROBS` | `10` | Default alternatives per token |
| `YECO_LENS_ENTROPY_BREAKPOINT` | `0` (off) | Auto-pause threshold `[0,1]` |
| `YECO_LENS_DASHBOARD_DIR` | `../apps/dashboard/dist` | Path to built dashboard assets |
| `YECO_LENS_OPEN_BROWSER` | `false` | Auto-open browser on boot |

### CLI flags

```bash
npx @yecoai-org/yeco-lens --no-browser      # don't open a browser
npx @yecoai-org/yeco-lens -n                # shorthand
npx @yecoai-org/yeco-lens --port=8080       # custom port
```

## Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/` | GET | Dashboard SPA (static) |
| `/healthz` | GET | Liveness probe → `{"ok":true,"version":"1.0.3"}` |
| `/api/status` | GET | Server + provider status JSON |
| `/ws` | WS | The Yeco-Lens wire protocol (see `docs/protocol.md`) |

## Team / LAN deployment

To share one Yeco-Lens instance across a LAN:

```bash
YECO_LENS_HOST=0.0.0.0 npx @yecoai-org/yeco-lens --no-browser
```

Then anyone on the network opens `http://<your-ip>:7531`. Note: Yeco-Lens has
no authentication — only expose it on trusted networks. Auth/multi-tenancy is
on the roadmap.

## Using a remote Ollama

```bash
OLLAMA_URL=http://gpu-box:11434 npx @yecoai-org/yeco-lens
```

## Using Azure OpenAI

```bash
OPENAI_API_KEY=<your-key> \
OPENAI_BASE_URL=https://<your-resource>.openai.azure.com \
npx @yecoai-org/yeco-lens
```

## Running as a service

A simple systemd unit (Linux):

```ini
[Unit]
Description=Yeco-Lens dashboard
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/yeco-lens
Environment=OLLAMA_URL=http://127.0.0.1:11434
Environment=YECO_LENS_HOST=0.0.0.0
ExecStart=/usr/bin/node /opt/yeco-lens/cli/dist/index.js --no-browser
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## Security notes

- The OpenAI API key is read from the environment and sent **only** to OpenAI.
  It is never logged.
- All inference is local-first: prompts and generations stay between your
  machine, your model (Ollama/OpenAI), and the Yeco-Lens server.
- There is no telemetry or phone-home. Yeco-Lens doesn't call any YecoAI
  server.
