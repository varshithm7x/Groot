// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { AIIntelligenceDashboard } from "../src/components/settings/components/AIIntelligenceDashboard";
import { _resetSettingsCache, loadSettings, saveSettings } from "../src/utils/ai-settings";

vi.mock("../src/utils/embeddings", () => ({
  isModelLoaded: () => false,
  loadStore: () => ({ entries: new Map() }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); _resetSettingsCache(); localStorage.clear(); });

it("shows OpenRouter as the default AI provider with local key and endpoint inputs", async () => {
  _resetSettingsCache();
  localStorage.clear();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(AIIntelligenceDashboard)));
    const openRouter = [...container.querySelectorAll("button")].find(button => button.textContent?.includes("OpenRouter"));
    expect(openRouter?.textContent).toContain("Active");
    expect(container.textContent).not.toContain("DigitalOcean Inference");
    expect(container.querySelector<HTMLInputElement>('input[type="password"]')?.placeholder).toBe("sk-or-v1-...");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Inference Endpoint"]')?.placeholder).toBe("https://openrouter.ai/api/v1");
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

it("marks a selected model unavailable when OpenRouter excludes it for the key", async () => {
  vi.useFakeTimers();
  saveSettings({ ...loadSettings(), provider: "openrouter", apiKey: "test-key", modelId: "nvidia/nemotron-3-super-120b-a12b:free" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "openrouter/free" }] }), { status: 200 })));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(AIIntelligenceDashboard)));
    await act(async () => vi.advanceTimersByTimeAsync(400));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("selected model is unavailable for this key");
    expect(container.textContent).toContain("Available Free Model · Auto");
    expect(container.textContent).toContain("Unavailable for this key");
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});

it("offers a separate Gemini API key and model choice", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(React.createElement(AIIntelligenceDashboard)));
    const gemini = [...container.querySelectorAll("button")].find(button => button.textContent?.includes("Google Gemini"));
    expect(gemini).toBeTruthy();
    await act(async () => gemini?.click());
    expect(container.querySelector<HTMLInputElement>('input[type="password"]')?.placeholder).toBe("Gemini API key");
    expect(container.querySelector<HTMLInputElement>('[aria-label="Inference Endpoint"]')?.placeholder).toBe("https://generativelanguage.googleapis.com/v1beta/openai");
    expect(container.textContent).toContain("Gemini 3.8 Flash");
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
