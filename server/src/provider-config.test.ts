import { describe, it, expect } from "vitest";
import { initProviderConfig, getProviderConfig, normalizeBaseUrl } from "./provider-config.js";

describe("normalizeBaseUrl", () => {
  it("strips trailing slashes", () => {
    expect(normalizeBaseUrl("https://api.openai.com/")).toBe("https://api.openai.com");
    expect(normalizeBaseUrl("https://api.openai.com///")).toBe("https://api.openai.com");
  });
  it("strips a trailing /v1", () => {
    expect(normalizeBaseUrl("https://api.openai.com/v1")).toBe("https://api.openai.com");
    expect(normalizeBaseUrl("https://api.together.xyz/v1/")).toBe("https://api.together.xyz");
  });
  it("is case-insensitive on the /v1 suffix", () => {
    expect(normalizeBaseUrl("https://x.com/V1")).toBe("https://x.com");
  });
  it("leaves a bare host alone", () => {
    expect(normalizeBaseUrl("http://127.0.0.1:8000")).toBe("http://127.0.0.1:8000");
  });
  it("keeps /v1 that is not a suffix", () => {
    expect(normalizeBaseUrl("https://x.com/v1foo")).toBe("https://x.com/v1foo");
  });
  it("trims whitespace", () => {
    expect(normalizeBaseUrl("  https://api.openai.com/v1  ")).toBe("https://api.openai.com");
  });
});

describe("ProviderConfigHolder", () => {
  it("reports configured=true when seeded with a key", () => {
    const h = initProviderConfig({ baseUrl: "https://api.openai.com/v1", apiKey: "sk-test" });
    expect(h.getOpenAI().configured).toBe(true);
    expect(h.getOpenAI().baseUrl).toBe("https://api.openai.com");
    expect(h.getOpenAI().apiKey).toBe("sk-test");
  });

  it("reports configured=false without a key", () => {
    const h = initProviderConfig({ baseUrl: "https://api.openai.com" });
    expect(h.getOpenAI().configured).toBe(false);
  });

  it("setOpenAI updates baseUrl and apiKey at runtime", () => {
    const h = initProviderConfig({ baseUrl: "https://api.openai.com", apiKey: "sk-old" });
    h.setOpenAI({ baseUrl: "https://api.groq.com/openai", apiKey: "gsk_new" });
    expect(h.getOpenAI().baseUrl).toBe("https://api.groq.com/openai");
    expect(h.getOpenAI().apiKey).toBe("gsk_new");
  });

  it("setOpenAI with empty apiKey clears configured", () => {
    const h = initProviderConfig({ baseUrl: "https://api.openai.com", apiKey: "sk-test" });
    h.setOpenAI({ apiKey: "" });
    expect(h.getOpenAI().configured).toBe(false);
    expect(h.getOpenAI().apiKey).toBe("");
  });

  it("sanitized() masks the key", () => {
    const h = initProviderConfig({ baseUrl: "https://api.openai.com", apiKey: "sk-1234567890abcdef" });
    const s = h.sanitized();
    expect(s.openai.keyMasked).toBe("sk-1…cdef");
    expect(s.openai.configured).toBe(true);
    expect(s.openai.baseUrl).toBe("https://api.openai.com");
  });

  it("sanitized() masks short keys as ****", () => {
    const h = initProviderConfig({ baseUrl: "https://api.openai.com", apiKey: "short" });
    expect(h.sanitized().openai.keyMasked).toBe("****");
  });

  it("sanitized() shows empty for no key", () => {
    const h = initProviderConfig({ baseUrl: "https://api.openai.com" });
    expect(h.sanitized().openai.keyMasked).toBe("");
  });

  it("getProviderConfig returns the singleton after init", () => {
    initProviderConfig({ baseUrl: "https://x.com", apiKey: "k" });
    expect(getProviderConfig()).toBe(getProviderConfig());
  });
});
