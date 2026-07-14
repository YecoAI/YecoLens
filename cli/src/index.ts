#!/usr/bin/env node
import { createServer } from "@yeco-ai/server";
import { listOllamaModels } from "@yeco-ai/server";
import { loadConfig } from "@yeco-ai/server";

const BANNER = `
  ██    ██  █████  ██      ██    ██ ███████     ██╗     ██████╗ ██╗  ██╗██╗   ██╗███████╗███████╗
  ██    ██ ██   ██ ██      ██    ██ ██          ██║     ██╔══██╗╚██╗██╔╝██║   ██║██╔════╝██╔════╝
  ██    ██ ███████ ██      ██    ██ █████       ██║     ██████╔╝ ╚███╔╝ ██║   ██║███████╗███████╗
   ██  ██  ██   ██ ██      ██    ██ ██          ██║     ██╔══██╗ ██╔██╗ ██║   ██║╚════██║╚════██║
    ████   ██   ██ ███████  ██████  ███████     ███████╗██████╔╝██╔╝ ██╗╚██████╔╝███████║███████║
                                                                 v1.0.0
`;

function openBrowser(url: string): void {
  const { platform } = process;
  const cmd =
    platform === "win32" ? `start "" "${url}"` :
    platform === "darwin" ? `open "${url}"` :
    `xdg-open "${url}"`;
  try {
    import("node:child_process").then(({ exec }) => exec(cmd));
  } catch {
  }
}

export function parseArgs(args: string[]): { noBrowser: boolean; port?: number } {
  const noBrowser = args.includes("--no-browser") || args.includes("-n");
  const portArg = args.find((a) => a.startsWith("--port="));
  const port = portArg ? parseInt(portArg.split("=")[1], 10) : undefined;
  return { noBrowser, port };
}

async function main() {
  const { noBrowser, port } = parseArgs(process.argv.slice(2));

  process.stdout.write(BANNER);
  process.stdout.write("\n  X-ray vision for your LLM. Watching every token's confidence.\n\n");

  const config = loadConfig({
    port,
    openBrowser: !noBrowser,
  });

  const ollamaProbe = listOllamaModels(config.ollamaUrl).then((r) => {
    if (r.reachable) {
      const count = r.models.length;
      const names = r.models.slice(0, 3).map((m) => m.name).join(", ");
      const more = count > 3 ? ` (+${count - 3} more)` : "";
      process.stdout.write(`  ✓ Ollama detected at ${config.ollamaUrl}\n`);
      process.stdout.write(`    ${count} model${count === 1 ? "" : "s"} available: ${names}${more}\n\n`);
    } else {
      process.stdout.write(`  ✗ Ollama not detected at ${config.ollamaUrl}\n`);
      process.stdout.write(`    The dashboard will show onboarding. Run \`ollama run qwen2.5\` to begin.\n\n`);
    }
    return r;
  });

  if (config.openaiApiKey) {
    process.stdout.write(`  ✓ OpenAI API key configured\n\n`);
  }

  const server = await createServer({ port, openBrowser: !noBrowser });

  process.stdout.write(`  ▶ Dashboard:  ${server.handle.url}\n`);
  process.stdout.write(`  ▶ WebSocket:  ${server.handle.wsUrl}\n\n`);
  process.stdout.write(`  Press Ctrl+C to stop.\n\n`);

  if (!noBrowser) {
    openBrowser(server.handle.url);
  }

  await ollamaProbe;

  process.on("SIGINT", async () => {
    process.stdout.write("\n  Shutting down Yeco-Lens…\n");
    await server.close();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("\n  Yeco-Lens failed to start:\n");
  console.error("  ", err instanceof Error ? err.message : String(err));
  console.error("\n  Need help? https://github.com/YecoAI/yeco-lens/issues\n");
  process.exit(1);
});
