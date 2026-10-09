import browser from "webextension-polyfill";
import { answer } from "./background/answer";
import { SEARCH_PORT, type Search, type SearchEvent, type TabMessage } from "./shared/protocol";
import { hasApiAccess, loadSettings, PROVIDERS, requestApiAccess } from "./shared/settings";
import { shortcutLabel } from "./shared/shortcut";

async function toggle(tabId: number | undefined) {
  if (tabId === undefined) return;
  const { provider } = await loadSettings();
  // Chrome rejects permissions.request outside the synchronous user gesture that
  // triggered this, and awaiting storage above already leaves it. Manifest host
  // permissions are granted at install, so only ask when one is actually missing.
  if (!(await hasApiAccess(provider))) await requestApiAccess(provider).catch(() => false);
  if (!(await ensureContentScript(tabId))) return unavailable(tabId);
  await sendToTab(tabId, { type: "toggle" });
}

async function ensureContentScript(tabId: number): Promise<boolean> {
  if (await hasContentScript(tabId)) return true;
  try {
    await browser.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
    await browser.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    return true;
  } catch {
    return false;
  }
}

const sendToTab = (tabId: number, msg: TabMessage) => browser.tabs.sendMessage(tabId, msg);

async function hasContentScript(tabId: number): Promise<boolean> {
  try {
    await sendToTab(tabId, { type: "ping" });
    return true;
  } catch {
    return false;
  }
}

async function unavailable(tabId: number) {
  await browser.action.setBadgeBackgroundColor({ tabId, color: "#ff5b5b" });
  await browser.action.setBadgeText({ tabId, text: "n/a" });
  await browser.action.setTitle({ tabId, title: "Hunch can't run here: the browser blocks extensions on this page" });
  setTimeout(() => void browser.action.setBadgeText({ tabId, text: "" }), 2500);
}

browser.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === "install" && !(await loadSettings()).apiKey) void browser.runtime.openOptionsPage();
});

browser.action.onClicked.addListener((tab) => void toggle(tab.id));

browser.runtime.onConnect.addListener((port) => {
  if (port.name !== SEARCH_PORT) return;
  const abort = new AbortController();
  port.onDisconnect.addListener(() => abort.abort());
  port.onMessage.addListener((msg: unknown) => void run(msg as Search));

  const emit = (e: SearchEvent) => {
    if (!abort.signal.aborted) port.postMessage(e);
  };

  async function run(req: Search) {
    try {
      const settings = await loadSettings();
      if (!settings.apiKey) {
        void browser.runtime.openOptionsPage();
        return emit({ type: "failure", message: "No API key yet. Paste one in the settings tab that just opened." });
      }
      if (!(await hasApiAccess(settings.provider)))
        return emit({
          type: "failure",
          message: `Hunch needs permission to reach ${PROVIDERS[settings.provider].host}. Press ${await shortcutLabel()} again and accept the prompt.`,
        });
      await answer(req, settings, abort.signal, emit);
    } catch (e) {
      emit({ type: "failure", message: e instanceof Error ? e.message : String(e) });
    }
  }
});
