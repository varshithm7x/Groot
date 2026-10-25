// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_SETTINGS_CHANGED_EVENT,
  DEFAULT_MODEL_ID,
  DEFAULT_PROVIDER,
  getBaseUrl,
  getProviderHeaders,
  getOpenRouterAccessibleModelIds,
  loadAIConfig,
  loadSettings,
  loadSettingsAsync,
  parseProviderError,
  saveSettings,
  selectAIProvider,
  _resetSettingsCache,
} from "../src/utils/ai-settings";
import { readData, writeData } from "../src/utils/disk-store";
import { askAI } from "../src/utils/ai-core";

describe("AI settings", () => {
  afterEach(() => vi.unstubAllGlobals());
  beforeEach(() => {
    _resetSettingsCache();
    let store: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = String(value); },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { store = {}; },
      get length() { return Object.keys(store).length; },
      key: (i: number) => Object.keys(store)[i] ?? null,
    };
    Object.defineProperty(window, "localStorage", { value: mockStorage, writable: true, configurable: true });
    Object.defineProperty(globalThis, "localStorage", { value: mockStorage, writable: true, configurable: true });
  });

  it("returns defaults when nothing is stored", () => {
    expect(loadSettings()).toMatchObject({
      apiKey: "",
      modelId: DEFAULT_MODEL_ID,
      provider: DEFAULT_PROVIDER,
    });
    expect(loadAIConfig()).toBeNull();
    expect(DEFAULT_PROVIDER).toBe("openrouter");
    expect(DEFAULT_MODEL_ID).toBe("openai/gpt-4o");
  });

  it("moves a saved DigitalOcean selection to OpenRouter without reusing its key or endpoint", async () => {
    await writeData("ai-settings.json", {
      provider: "digitalocean",
      apiKey: "old-provider-key",
      modelId: "llama-4-maverick",
      customBaseUrl: "https://old-provider.example/v1",
      providerKeys: { digitalocean: "old-provider-key", openrouter: "openrouter-key" },
      providerBaseUrls: { digitalocean: "https://old-provider.example/v1" },
    });
    const restored = await loadSettingsAsync();
    expect(restored.provider).toBe("openrouter");
    expect(restored.apiKey).toBe("openrouter-key");
    expect(restored.customBaseUrl).toBe("");
    expect(restored.modelId).toBe(DEFAULT_MODEL_ID);
    expect(loadAIConfig()).toMatchObject({ provider: "openrouter", apiKey: "openrouter-key" });
  });

  it("sends requests to the default OpenRouter endpoint", async () => {
    saveSettings({ ...loadSettings(), apiKey: "openrouter-key" });
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Done" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", request);
    expect(await askAI("System", "Question")).toBe("Done");
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][0]).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(request.mock.calls[0][1].headers.Authorization).toBe("Bearer openrouter-key");
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ model: "openai/gpt-4o", max_tokens: 600 });
  });

  it("keeps the Gemini key separate and sends chat requests to Google's endpoint", async () => {
    const openRouter = { ...loadSettings(), apiKey: "openrouter-key" };
    const gemini = { ...selectAIProvider(openRouter, "gemini"), apiKey: "gemini-key" };
    saveSettings(gemini);
    expect(gemini.modelId).toBe("gemini-3.8-flash");
    expect(gemini.apiKey).toBe("gemini-key");
    expect(selectAIProvider(gemini, "openrouter").apiKey).toBe("openrouter-key");
    expect(await readData<any>("ai-settings.json")).toMatchObject({ provider: "gemini", apiKey: "gemini-key" });

    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Gemini answer" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", request);
    const responseFormat = { type: "json_schema", json_schema: { name: "quiz" } };
    expect(await askAI("System", "Question", 600, 0.3, undefined, responseFormat)).toBe("Gemini answer");
    expect(request.mock.calls[0][0]).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
    expect(request.mock.calls[0][1].headers.Authorization).toBe("Bearer gemini-key");
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ model: "gemini-3.8-flash", response_format: responseFormat });
  });

  it("round-trips a saved key and does NOT leave plaintext in localStorage", async () => {
    saveSettings({
      apiKey: "sk-test-secret-123",
      modelId: "openai/gpt-4o",
      webGrounding: false,
      provider: "openrouter",
      customBaseUrl: "",
    });

    const loaded = loadAIConfig();
    expect(loaded?.apiKey).toBe("sk-test-secret-123");
    expect(loaded?.provider).toBe("openrouter");

    // Verify localStorage contains NO plaintext key under openonyx-ai-settings
    expect(window.localStorage.getItem("openonyx-ai-settings")).toBeNull();

    // Verify saved to disk store (.openonyx/ai-settings.json)
    const diskData = await readData<any>("ai-settings.json");
    expect(diskData?.apiKey).toBe("sk-test-secret-123");
  });

  it("broadcasts the active model and does not promote a stale custom-model draft", () => {
    const listener = vi.fn();
    window.addEventListener(AI_SETTINGS_CHANGED_EVENT, listener);
    saveSettings({
      apiKey: "sk-active",
      modelId: "nvidia/nemotron-3-super-120b-a12b:free",
      customModelId: "mistralai/mistral-small-3.2-24b-instruct",
      webGrounding: false,
      provider: "openrouter",
      customBaseUrl: "",
    });

    expect(loadAIConfig()?.modelId).toBe("nvidia/nemotron-3-super-120b-a12b:free");
    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toBeUndefined();
    window.removeEventListener(AI_SETTINGS_CHANGED_EVENT, listener);
  });

  it("migrates legacy localStorage value once to disk and deletes it from localStorage", async () => {
    // Seed legacy localStorage
    window.localStorage.setItem(
      "openonyx-ai-settings",
      JSON.stringify({
        apiKey: "sk-legacy-key-999",
        modelId: "openai/gpt-4o",
        provider: "openai",
      }),
    );

    // Call saveSettings with legacy data to simulate load/migrate
    const settings = loadSettings();
    expect(settings.apiKey).toBe("sk-legacy-key-999");

    const loadedAsync = await loadSettingsAsync();
    expect(loadedAsync.apiKey).toBe("sk-legacy-key-999");

    // Confirm legacy localStorage was deleted
    expect(window.localStorage.getItem("openonyx-ai-settings")).toBeNull();

    // Confirm stored on disk
    const diskData = await readData<any>("ai-settings.json");
    expect(diskData?.apiKey).toBe("sk-legacy-key-999");
  });

  it("uses a custom base url when set", () => {
    expect(
      getBaseUrl({
        apiKey: "x",
        modelId: "gpt-4o",
        supportsGrounding: false,
        provider: "openai",
        customBaseUrl: "https://proxy.example/v1",
      }),
    ).toBe("https://proxy.example/v1");
  });

  it("adds OpenRouter headers", () => {
    const headers = getProviderHeaders({
      apiKey: "sk-or",
      modelId: "x",
      supportsGrounding: false,
      provider: "openrouter",
      customBaseUrl: "",
    });
    expect(headers.Authorization).toBe("Bearer sk-or");
    expect(headers["X-Title"]).toBe("GROOT");
  });

  it("maps common provider status codes", async () => {
    const unauthorized = await parseProviderError(new Response("{}", { status: 401 }));
    expect(unauthorized).toMatch(/API key/i);
    const payment = await parseProviderError(new Response("{}", { status: 402 }));
    expect(payment).toMatch(/credits/i);
    const unavailable = await parseProviderError(new Response(JSON.stringify({ error: { message: "No endpoints found for this model" } }), { status: 404 }));
    expect(unavailable).toBe("No endpoints found for this model");
  });

  it("checks OpenRouter models available to the saved key", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [
      { id: "openrouter/free" },
      { id: "nvidia/nemotron-3-super-120b-a12b:free" },
    ] }), { status: 200 }));
    vi.stubGlobal("fetch", request);
    const ids = await getOpenRouterAccessibleModelIds("  local-key  ");
    expect(request.mock.calls[0][0]).toBe("https://openrouter.ai/api/v1/models/user");
    expect(request.mock.calls[0][1].headers.Authorization).toBe("Bearer local-key");
    expect(ids.has("nvidia/nemotron-3-super-120b-a12b:free")).toBe(true);
  });
});
