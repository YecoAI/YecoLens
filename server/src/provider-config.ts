export interface OpenAIProviderConfig {
  baseUrl: string;
  apiKey: string;
  configured: boolean;
}

class ProviderConfigHolder {
  private openai: OpenAIProviderConfig;

  constructor(seed: { baseUrl: string; apiKey?: string }) {
    this.openai = {
      baseUrl: normalizeBaseUrl(seed.baseUrl),
      apiKey: seed.apiKey ?? "",
      configured: Boolean(seed.apiKey),
    };
  }

  getOpenAI(): Readonly<OpenAIProviderConfig> {
    return { ...this.openai };
  }

  setOpenAI(update: Partial<{ baseUrl: string; apiKey: string }>): OpenAIProviderConfig {
    if (update.baseUrl !== undefined) {
      this.openai.baseUrl = normalizeBaseUrl(update.baseUrl);
    }
    if (update.apiKey !== undefined) {
      this.openai.apiKey = update.apiKey;
    }
    this.openai.configured = this.openai.apiKey.length > 0;
    return this.getOpenAI();
  }

  sanitized(): { openai: { baseUrl: string; configured: boolean; keyMasked: string } } {
    const k = this.openai.apiKey;
    const keyMasked =
      k.length === 0 ? "" : k.length <= 8 ? "****" : k.slice(0, 4) + "…" + k.slice(-4);
    return {
      openai: {
        baseUrl: this.openai.baseUrl,
        configured: this.openai.configured,
        keyMasked,
      },
    };
  }
}

export function normalizeBaseUrl(raw: string): string {
  let u = raw.trim();
  while (u.endsWith("/")) u = u.slice(0, -1);
  if (u.toLowerCase().endsWith("/v1")) u = u.slice(0, -3);
  return u;
}

let holder: ProviderConfigHolder | null = null;

export function initProviderConfig(seed: { baseUrl: string; apiKey?: string }): ProviderConfigHolder {
  holder = new ProviderConfigHolder(seed);
  return holder;
}

export function getProviderConfig(): ProviderConfigHolder {
  if (!holder) {
    holder = new ProviderConfigHolder({ baseUrl: "https://api.openai.com" });
  }
  return holder;
}
