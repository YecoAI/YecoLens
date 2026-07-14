export interface ServerConfig {
  port: number;
  host: string;
  ollamaUrl: string;
  openaiUrl: string;
  openaiApiKey: string | undefined;
  dashboardDir: string;
  defaultTopLogprobs: number;
  defaultEntropyBreakpoint: number;
  version: string;
  openBrowser: boolean;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

export function loadConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  const pkgVersion = "1.0.0";
  return {
    port: envInt("YECO_LENS_PORT", overrides.port ?? 7531),
    host: process.env.YECO_LENS_HOST ?? overrides.host ?? "127.0.0.1",
    ollamaUrl: process.env.OLLAMA_URL ?? overrides.ollamaUrl ?? "http://127.0.0.1:11434",
    openaiUrl: process.env.OPENAI_BASE_URL ?? overrides.openaiUrl ?? "https://api.openai.com",
    openaiApiKey: process.env.OPENAI_API_KEY ?? overrides.openaiApiKey,
    dashboardDir:
      process.env.YECO_LENS_DASHBOARD_DIR ?? overrides.dashboardDir ?? defaultDashboardDir(),
    defaultTopLogprobs: envInt("YECO_LENS_TOP_LOGPROBS", overrides.defaultTopLogprobs ?? 10),
    defaultEntropyBreakpoint: envInt("YECO_LENS_ENTROPY_BREAKPOINT", overrides.defaultEntropyBreakpoint ?? 0),
    version: pkgVersion,
    openBrowser: envBool("YECO_LENS_OPEN_BROWSER", overrides.openBrowser ?? false),
  };
}

function defaultDashboardDir(): string {
  return new URL("../../apps/dashboard/dist/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
}
