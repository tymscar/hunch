import { type ModelCard, TypeSafeClient } from "@typesafe-ai/sdk";
import browser from "webextension-polyfill";

export type Provider = "typesafe" | "openrouter";

export interface ModelChoice {
  name: string;
  description: string;
}

export interface Settings {
  provider: Provider;
  apiKey: string;
  model: string;
}

interface ProviderInfo {
  label: string;
  /** API root passed to the SDK; omitted for TypeSafe so the SDK default applies. */
  baseURL?: string;
  /** Host permission match pattern. */
  origin: string;
  /** Bare host, used in user-facing permission messages. */
  host: string;
  /** Where to create an API key. */
  keysUrl: string;
  keyPlaceholder: string;
  /** Models offered when the account cannot be queried (OpenRouter). */
  presetModels: ModelChoice[];
  /** Whether `models.list()` works; OpenRouter rejects it. */
  canListModels: boolean;
}

export const PROVIDERS: Record<Provider, ProviderInfo> = {
  typesafe: {
    label: "TypeSafe (official)",
    baseURL: undefined,
    origin: "https://api.typesafe.ai/*",
    host: "api.typesafe.ai",
    keysUrl: "https://console.typesafe.ai/keys",
    keyPlaceholder: "apikey_…",
    presetModels: [],
    canListModels: true,
  },
  openrouter: {
    label: "OpenRouter",
    baseURL: "https://openrouter.ai/api",
    origin: "https://openrouter.ai/*",
    host: "openrouter.ai",
    keysUrl: "https://openrouter.ai/settings/keys",
    keyPlaceholder: "sk-or-…",
    presetModels: [
      { name: "jev-latest", description: "newest Jev" },
      { name: "jev-1.13", description: "" },
    ],
    canListModels: false,
  },
};

export const DEFAULT_SETTINGS: Settings = { provider: "typesafe", apiKey: "", model: "jev-latest" };

export async function loadSettings(): Promise<Settings> {
  const stored = (await browser.storage.local.get("settings")) as { settings?: Partial<Settings> };
  return { ...DEFAULT_SETTINGS, ...stored.settings };
}

export function saveSettings(s: Settings): Promise<void> {
  return browser.storage.local.set({ settings: s });
}

export const apiOrigin = (p: Provider) => ({ origins: [PROVIDERS[p].origin] });

export const hasApiAccess = (p: Provider) => browser.permissions.contains(apiOrigin(p));
export const requestApiAccess = (p: Provider) => browser.permissions.request(apiOrigin(p));

export async function listModels(apiKey: string, provider: Provider): Promise<ModelChoice[]> {
  const info = PROVIDERS[provider];
  if (!info.canListModels) return info.presetModels;
  const cards: ModelCard[] = await new TypeSafeClient({
    apiKey,
    baseURL: info.baseURL,
    dangerouslyAllowBrowser: true,
  }).models.list();
  return cards.map((m) => ({ name: m.name, description: m.description }));
}
