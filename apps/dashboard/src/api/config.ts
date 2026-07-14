interface SanitizedConfig {
  openai: {
    baseUrl: string;
    configured: boolean;
    keyMasked: string;
  };
}

export async function setOpenAIConfig(update: {
  baseUrl?: string;
  apiKey?: string;
}): Promise<SanitizedConfig> {
  const res = await fetch("/api/config/openai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`config update failed (${res.status}): ${text}`);
  }
  return res.json();
}
