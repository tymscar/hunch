import browser from "webextension-polyfill";
import {
  DEFAULT_SETTINGS,
  listModels,
  loadSettings,
  type ModelChoice,
  PROVIDERS,
  type Provider,
  requestApiAccess,
  saveSettings,
} from "./shared/settings";
import {
  canRebindShortcut,
  commandShortcutFromEvent,
  openShortcutsPage,
  resetShortcut,
  runningIn,
  SHORTCUTS_PAGE,
  setShortcut,
  shortcutLabel,
} from "./shared/shortcut";

const field = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const provider = field<HTMLSelectElement>("provider");
const apiKey = field<HTMLInputElement>("apiKey");
const apiKeyLabel = field("apiKeyLabel");
const keysLink = field<HTMLAnchorElement>("keysLink");
const model = field<HTMLInputElement>("model");
const modelOptions = field("modelOptions");
const modelNote = field("modelNote");
const banner = field("nokey");
const saved = field("saved");

function showKeyBanner(hasKey: boolean) {
  banner.style.display = hasKey ? "none" : "block";
  if (!hasKey) apiKey.focus();
}

const shortcut = field<HTMLInputElement>("shortcut");
const shortcutNote = field("shortcutNote");

async function showShortcut(note = "") {
  shortcut.value = await shortcutLabel();
  shortcutNote.textContent = note;
}

async function recordShortcut(e: KeyboardEvent) {
  e.preventDefault();
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return; // wait for the real key
  const mac = (await browser.runtime.getPlatformInfo()).os === "mac";
  const combo = commandShortcutFromEvent(e, mac);
  if (!combo) return void showShortcut("Use Ctrl, Alt or Cmd together with a letter, number or function key.");
  try {
    await setShortcut(combo);
    await showShortcut("Saved");
  } catch (err) {
    await showShortcut(err instanceof Error ? err.message : "Firefox refused that shortcut.");
  }
  shortcut.blur();
}

shortcut.addEventListener("focus", () => (shortcut.value = "press keys…"));
shortcut.addEventListener("blur", () => void showShortcut(shortcutNote.textContent ?? ""));
shortcut.addEventListener("keydown", (e) => void recordShortcut(e));
field("resetShortcut").addEventListener("click", async () => {
  await resetShortcut();
  await showShortcut("Back to the default");
});

function fillProviders(selected: Provider) {
  provider.replaceChildren(
    ...(Object.keys(PROVIDERS) as Provider[]).map((p) => new Option(PROVIDERS[p].label, p, false, p === selected)),
  );
}

function applyProviderChrome(p: Provider) {
  const info = PROVIDERS[p];
  apiKeyLabel.textContent = `${info.label} API key`;
  apiKey.placeholder = info.keyPlaceholder;
  keysLink.href = info.keysUrl;
  keysLink.textContent = info.keysUrl.replace(/^https?:\/\//, "");
}

async function loadModels(p: Provider, key: string, selected: string) {
  let models: ModelChoice[] = [];
  let note = "";
  if (PROVIDERS[p].canListModels && !key) {
    note = "Save an API key to see the models you can use.";
  } else {
    try {
      models = await listModels(key, p);
    } catch (e) {
      note = `Could not list models: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  modelOptions.replaceChildren(
    ...models.map((m) => {
      const o = document.createElement("option");
      o.value = m.name;
      if (m.description) o.label = m.description;
      return o;
    }),
  );
  model.value = selected;
  modelNote.textContent = note;
}

async function load() {
  if (!canRebindShortcut) {
    shortcut.disabled = true;
    field("shortcutHint").hidden = true;
    field("resetShortcut").hidden = true;
    if (runningIn() === "chrome") {
      const shortcutsPageButton = document.createElement("button");
      shortcutsPageButton.type = "button";
      shortcutsPageButton.className = "link";
      shortcutsPageButton.textContent = SHORTCUTS_PAGE;
      shortcutsPageButton.addEventListener("click", () => void openShortcutsPage());
      shortcutNote.replaceChildren("Change it at ", shortcutsPageButton);
    } else {
      shortcutNote.textContent = "This browser does not let extensions change their shortcut.";
    }
  }
  shortcut.value = await shortcutLabel();
  const s = await loadSettings();
  fillProviders(s.provider);
  applyProviderChrome(s.provider);
  apiKey.value = s.apiKey;
  await loadModels(s.provider, s.apiKey, s.model);
  showKeyBanner(Boolean(s.apiKey));
}

provider.addEventListener("change", () => {
  const p = provider.value as Provider;
  applyProviderChrome(p);
  void loadModels(p, apiKey.value.trim(), model.value.trim() || DEFAULT_SETTINGS.model);
});

async function save() {
  const p = provider.value as Provider;
  const s = { provider: p, apiKey: apiKey.value.trim(), model: model.value.trim() || DEFAULT_SETTINGS.model };
  await requestApiAccess(p);
  await saveSettings(s);
  showKeyBanner(Boolean(s.apiKey));
  await loadModels(p, s.apiKey, s.model);
  saved.textContent = "Saved";
  setTimeout(() => (saved.textContent = ""), 1500);
}
field("save").addEventListener("click", () => void save());
void load();
