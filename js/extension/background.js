"use strict";

const API =
  typeof browser !== "undefined" && browser.runtime
    ? browser
    : typeof chrome !== "undefined" && chrome.runtime
      ? chrome
      : null;

const CONTEXT_MENU_ID = "eshaaltab-save";

const INBOX_QUEUE_KEY = "inboxQueue";

const MAX_QUEUED_SAVES = 200;

function uuid() {
  return self.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random();
}

async function flashBadge(text, color) {
  if (!API?.action) return;
  try {
    await API.action.setBadgeBackgroundColor({ color });
    await API.action.setBadgeText({ text });
  } catch {}
}

async function clearBadge() {
  if (!API?.action) return;
  try {
    await API.action.setBadgeText({ text: "" });
  } catch {}
}

let writeChain = Promise.resolve();
function serialize(fn) {
  writeChain = writeChain.then(fn, fn);
  return writeChain;
}

async function saveUrl(url, title) {
  return serialize(() => doSaveUrl(url, title));
}

async function doSaveUrl(url, title) {
  await clearBadge();

  if (!url || !/^https?:\/\//i.test(url)) {
    flashBadge("!", "#f59e0b");
    return;
  }

  const cleanUrl = url.trim().slice(0, 2000);
  const bag = await API.storage.local.get(INBOX_QUEUE_KEY);
  const queue = Array.isArray(bag[INBOX_QUEUE_KEY]) ? bag[INBOX_QUEUE_KEY] : [];

  if (queue.some((e) => e && e.url === cleanUrl)) {
    flashBadge("\u2713", "#10b981");
    return;
  }

  queue.push({
    id: uuid(),
    title: String(title || cleanUrl)
      .trim()
      .slice(0, 300),
    url: cleanUrl,
    ts: Date.now(),
  });

  try {
    await API.storage.local.set({
      [INBOX_QUEUE_KEY]: queue.slice(-MAX_QUEUED_SAVES),
    });
  } catch (e) {
    flashBadge("!", "#f59e0b");
    return;
  }
  flashBadge("\u2713", "#10b981");
}

async function saveActiveTab() {
  try {
    const [tab] = await API.tabs.query({ active: true, currentWindow: true });
    if (tab) await saveUrl(tab.url, tab.title);
  } catch {}
}

async function registerMenu() {
  if (!API?.contextMenus) return;
  try {
    await API.contextMenus.removeAll();
  } catch (e) {
    console.warn("contextMenu removeAll:", e);
  }
  try {
    API.contextMenus.create(
      {
        id: CONTEXT_MENU_ID,
        title: "Save to EshaalTab",
        contexts: ["page", "link"],
      },
      () => {
        const err = API.runtime && API.runtime.lastError;
        if (err && !/duplicate id/i.test(err.message || ""))
          console.warn("contextMenu create:", err.message);
      },
    );
  } catch (e) {
    console.warn("contextMenu create:", e);
  }
}

const UPDATE_PENDING_KEY = "updatePending";
const UPDATE_FLUSH_GRACE_MS = 400;

API?.runtime?.onUpdateAvailable?.addListener(async () => {
  try {
    await API.storage.local.set({ [UPDATE_PENDING_KEY]: Date.now() });
    await new Promise((resolve) => setTimeout(resolve, UPDATE_FLUSH_GRACE_MS));
  } catch {}
  try {
    API.runtime.reload();
  } catch {}
});

API?.runtime?.onInstalled.addListener((details) => {
  registerMenu();

  if (details?.reason === "update") {
  }
});
API?.runtime?.onStartup?.addListener(registerMenu);

API?.contextMenus?.onClicked.addListener((info, tab) => {
  const url = info.linkUrl || info.pageUrl || tab?.url;
  saveUrl(url, info.linkUrl ? info.linkText : tab?.title);
});

API?.commands?.onCommand.addListener((command) => {
  if (command === "save-current-tab") saveActiveTab();
});
