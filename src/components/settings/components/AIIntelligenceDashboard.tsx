import React, { useEffect, useState } from "react";
import {
  AI_SETTINGS_CHANGED_EVENT,
  AI_PROVIDER_PRESETS,
  getOpenRouterAccessibleModelIds,
  getModelsForProvider,
  loadSettings,
  loadSettingsAsync,
  saveSettings,
  selectAIProvider,
  type AISettings,
} from "../../../utils/ai-settings";
import { isModelLoaded, loadStore } from "../../../utils/embeddings";
import { PreferenceCard } from "./PreferenceCard";

export function AIIntelligenceDashboard() {
  const [aiSettings, setAiSettings] = useState<AISettings>(() => loadSettings());
  const [store] = useState(() => loadStore());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [modelAccess, setModelAccess] = useState<{ ids: Set<string> | null; error: string | null; loading: boolean }>({ ids: null, error: null, loading: false });
  const indexedCount = store.entries.size;

  useEffect(() => {
    let mounted = true;
    const refresh = () => setAiSettings(loadSettings());
    window.addEventListener(AI_SETTINGS_CHANGED_EVENT, refresh);
    void loadSettingsAsync().then((settings) => { if (mounted) setAiSettings(settings); });
    return () => { mounted = false; window.removeEventListener(AI_SETTINGS_CHANGED_EVENT, refresh); };
  }, []);

  useEffect(() => {
    const key = aiSettings.apiKey.trim();
    if (aiSettings.provider !== "openrouter" || !key) {
      setModelAccess({ ids: null, error: null, loading: false });
      return;
    }
    const controller = new AbortController();
    setModelAccess({ ids: null, error: null, loading: true });
    const timer = window.setTimeout(() => {
      void getOpenRouterAccessibleModelIds(key, aiSettings.customBaseUrl.trim() || undefined, controller.signal)
        .then((ids) => setModelAccess({ ids, error: null, loading: false }))
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setModelAccess({ ids: null, error: error instanceof Error ? error.message : "Could not check model access.", loading: false });
        });
    }, 400);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [aiSettings.provider, aiSettings.apiKey, aiSettings.customBaseUrl]);

  const models = getModelsForProvider(aiSettings.provider);
  const matchedModel = models.find((m) => m.id === aiSettings.modelId);
  const isCustomModel = !matchedModel && aiSettings.provider !== "openai";
  const customModelValue = isCustomModel ? aiSettings.modelId : aiSettings.customModelId || "";

  const updateAISettings = (patch: Partial<AISettings>) => {
    const next = { ...aiSettings, ...patch };
    setAiSettings(next);
    saveSettings(next);
  };

  const activeProvider = AI_PROVIDER_PRESETS.find((p) => p.id === aiSettings.provider) || AI_PROVIDER_PRESETS[0];

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)] pb-4">
        <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
          AI & Models
        </h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Configure artificial intelligence models for note summaries, search, and assistance.
        </p>
      </div>

      {/* Connection Overview */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Active Provider</span>
            <div className="mt-1 text-base font-bold text-[var(--text-primary)]">{activeProvider.label}</div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Status</span>
            <div className="mt-1 text-xs font-bold text-[var(--text-primary)]">
              {aiSettings.apiKey ? "Key Saved" : "Key Needed"}
            </div>
          </div>
        </div>
      </div>

      {/* Provider Selector */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Provider
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {AI_PROVIDER_PRESETS.map((preset) => {
            const isSelected = aiSettings.provider === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  const next = selectAIProvider(aiSettings, preset.id);
                  setAiSettings(next);
                  saveSettings(next);
                }}
                className={`flex items-center justify-between rounded-xl border p-4 text-left transition-all duration-150 ${
                  isSelected
                    ? "border-[var(--text-primary)] bg-[var(--bg-elevated)] font-bold shadow-xs"
                    : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--border-medium)]"
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">{preset.label}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--text-muted)] font-mono">{preset.baseUrl}</div>
                </div>
                {isSelected && (
                  <span className="rounded-md bg-[var(--bg-tertiary)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-primary)] border border-[var(--border-subtle)]">
                    Active
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* API Key Credentials Card */}
      <PreferenceCard
        title="API Key"
        description={
          <>
            Saved locally on your device.{" "}
            <a
              href={activeProvider.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--text-primary)] underline"
            >
              Get {activeProvider.label} Key
            </a>
          </>
        }
      >
        <input
          type="password"
          value={aiSettings.apiKey}
          onChange={(e) => updateAISettings({
            apiKey: e.target.value,
            providerKeys: { ...aiSettings.providerKeys, [aiSettings.provider]: e.target.value },
          })}
          placeholder={activeProvider.keyPlaceholder}
          className="h-8 w-64 rounded-lg border border-[var(--border-medium)] bg-[var(--bg-tertiary)] px-3 text-xs font-mono text-[var(--text-primary)] outline-none"
        />
      </PreferenceCard>

      <PreferenceCard
        title="Inference Endpoint"
        description={`Saved locally. Leave blank to use ${activeProvider.baseUrl}.`}
      >
        <input
          type="url"
          aria-label="Inference Endpoint"
          value={aiSettings.customBaseUrl}
          onChange={(e) => updateAISettings({
            customBaseUrl: e.target.value,
            providerBaseUrls: { ...aiSettings.providerBaseUrls, [aiSettings.provider]: e.target.value },
          })}
          placeholder={activeProvider.baseUrl}
          spellCheck={false}
          className="h-8 w-full max-w-md rounded-lg border border-[var(--border-medium)] bg-[var(--bg-tertiary)] px-3 text-xs font-mono text-[var(--text-primary)] outline-none"
        />
      </PreferenceCard>

      {/* Available Models Grid */}
      <div>
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Models
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {models.map((model) => {
            const isSelected = aiSettings.modelId === model.id;
            const isUnavailable = aiSettings.provider === "openrouter" && !!modelAccess.ids && !modelAccess.ids.has(model.id);
            return (
              <div
                key={model.id}
                onClick={() => { if (!isUnavailable) updateAISettings({ modelId: model.id }); }}
                aria-disabled={isUnavailable}
                className={`rounded-xl border p-4 transition-all duration-150 ${isUnavailable ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${
                  isSelected
                    ? "border-[var(--text-primary)] bg-[var(--bg-elevated)] shadow-xs"
                    : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--border-medium)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-primary)]">{model.label}</span>
                  {isUnavailable ? (
                    <span className="text-[11px] text-[var(--text-muted)]">Unavailable for this key</span>
                  ) : isSelected ? (
                    <span className="rounded-md bg-[var(--text-primary)] px-2 py-0.5 text-[10px] font-bold text-[var(--bg-primary)]">
                      Active
                    </span>
                  ) : (
                    <span className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                      Select
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">{model.description}</p>
              </div>
            );
          })}
        </div>
        {aiSettings.provider === "openrouter" && modelAccess.loading && <p className="mt-3 text-xs text-[var(--text-muted)]">Checking models available to this key…</p>}
        {aiSettings.provider === "openrouter" && modelAccess.error && <p className="mt-3 text-xs text-[var(--text-muted)]">Could not check OpenRouter model access: {modelAccess.error}</p>}
        {aiSettings.provider === "openrouter" && modelAccess.ids && !modelAccess.ids.has(aiSettings.modelId) && <p role="alert" className="mt-3 text-xs text-[var(--text-primary)]">The selected model is unavailable for this key. Choose an available model, or check your OpenRouter provider preferences.</p>}
      </div>

      {/* Custom model for providers with OpenAI-compatible model IDs */}
      {aiSettings.provider !== "openai" && (
        <PreferenceCard
          title="Custom Model Identifier"
          description={aiSettings.provider === "gemini" ? "Use a Gemini text model ID from Google AI Studio." : "Use any OpenRouter model identifier (e.g. deepseek/deepseek-v4-flash:free)."}
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customModelValue}
              onChange={(e) => {
                const val = e.target.value;
                updateAISettings({ customModelId: val, modelId: isCustomModel ? val : aiSettings.modelId });
              }}
              placeholder={aiSettings.provider === "gemini" ? "e.g. gemini-3.8-flash" : "e.g. deepseek/deepseek-v4-flash:free"}
              className="h-8 w-64 rounded-lg border border-[var(--border-medium)] bg-[var(--bg-tertiary)] px-3 text-xs font-mono text-[var(--text-primary)] outline-none"
            />
            <button
              type="button"
              onClick={() => customModelValue.trim() && updateAISettings({ modelId: customModelValue.trim() })}
              className="h-8 rounded-lg bg-[var(--bg-tertiary)] px-3 text-xs font-bold text-[var(--text-primary)] border border-[var(--border-medium)] hover:bg-[var(--bg-hover)]"
            >
              Select
            </button>
          </div>
        </PreferenceCard>
      )}

      {/* Expandable Advanced Options Accordion */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="flex w-full items-center justify-between p-4 text-left text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
        >
          <span>Advanced AI Settings</span>
          <span>{showAdvanced ? "▲ Hide" : "▼ Show"}</span>
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-4 border-t border-[var(--border-subtle)] p-5 text-xs text-[var(--text-muted)]">
            <div className="flex items-center justify-between">
              <span>Local Vector Indexer Status</span>
              <span className="font-mono font-bold text-[var(--text-primary)]">
                {isModelLoaded() ? "Active" : "Idle"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Indexed Notes Count</span>
              <span className="font-mono font-bold text-[var(--text-primary)]">{indexedCount} notes</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
