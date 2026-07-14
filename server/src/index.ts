import { loadConfig, type ServerConfig } from "./config.js";
import { TraceStore } from "./trace-store.js";
import { InferenceEngine } from "./inference.js";
import { WSHub } from "./ws.js";
import { startServer, type ServerHandle } from "./http.js";
import { initProviderConfig } from "./provider-config.js";

export { loadConfig, type ServerConfig } from "./config.js";
export { TraceStore } from "./trace-store.js";
export { InferenceEngine } from "./inference.js";
export { WSHub } from "./ws.js";
export { startServer, type ServerHandle } from "./http.js";
export { initProviderConfig, getProviderConfig } from "./provider-config.js";
export * from "./providers/ollama.js";
export * from "./providers/openai.js";

export interface YecoLensServer {
  config: ServerConfig;
  hub: WSHub;
  handle: ServerHandle;
  close: () => Promise<void>;
}

export async function createServer(configOverrides?: Partial<ServerConfig>): Promise<YecoLensServer> {
  const config = loadConfig(configOverrides);
  initProviderConfig({ baseUrl: config.openaiUrl, apiKey: config.openaiApiKey });

  const store = new TraceStore();
  const engine = new InferenceEngine(config, store);
  const hub = new WSHub({ config, store, engine });
  const handle = await startServer(config, hub);

  void hub.refreshModels();

  return {
    config,
    hub,
    handle,
    close: async () => {
      await handle.close();
    },
  };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  createServer()
    .then(({ config, handle }) => {
      console.log(`\n  Yeco-Lens server running\n  → ${handle.url}\n  → ${handle.wsUrl}\n`);
      console.log(`  Ollama: ${config.ollamaUrl}`);
      console.log(`  OpenAI: ${config.openaiApiKey ? "configured" : "not configured"}\n`);
      console.log("  Press Ctrl+C to stop.\n");
    })
    .catch((err) => {
      console.error("Failed to start Yeco-Lens server:", err);
      process.exit(1);
    });
}
