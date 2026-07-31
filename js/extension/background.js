/* Service worker: quick-capture the current page into a pinned Inbox board from
   the keyboard shortcut or the right-click menu, confirmed by a toolbar badge flash. */
'use strict';

const API = (typeof browser !== 'undefined' && browser.runtime) ? browser
          : (typeof chrome !== 'undefined' && chrome.runtime) ? chrome : null;

const CONTEXT_MENU_ID = 'eshaaltab-save';

function uuid() {
  return (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random();
}

async function flashBadge(text, color) {
  if (!API?.action) return;
  try {
    await API.action.setBadgeBackgroundColor({ color });
    await API.action.setBadgeText({ text });
    setTimeout(() => {
      try { Promise.resolve(API.action.setBadgeText({ text: '' })).catch(() => {}); } catch { }
    }, 1600);
  } catch { }
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
  if (!url || !/^https?:\/\//i.test(url)) { flashBadge('!', '#f59e0b'); return; }

  const bag = await API.storage.local.get('data');
  const data = (bag.data && typeof bag.data === 'object') ? bag.data : {};
  const bookmark = { id: uuid(), title: (title || url).trim(), url: url.trim(), tags: [] };

  let target;
  if (Array.isArray(data.pages)) {
    for (const p of data.pages) {
      const f = (p.boards || []).find(b => b.name === 'Inbox');
      if (f) { target = f; break; }
    }
    if (!target && data.pages[0]) {
      target = { id: uuid(), type: 'links', name: 'Inbox', color: '#6366f1', bookmarks: [] };
      (data.pages[0].boards = data.pages[0].boards || []).push(target);
    }
  } else {
    if (!Array.isArray(data.boards)) data.boards = [];
    target = data.boards.find(b => b.name === 'Inbox');
    if (!target) {
      target = { id: uuid(), name: 'Inbox', color: '#6366f1', col: 0, order: data.boards.length, bookmarks: [] };
      data.boards.push(target);
    }
  }

  if (!target) { flashBadge('!', '#f59e0b'); return; }
  if (!Array.isArray(target.bookmarks)) target.bookmarks = [];

  if (!target.bookmarks.some(b => b.url === bookmark.url)) {
    bookmark.order = target.bookmarks.length;
    target.bookmarks.push(bookmark);
    await API.storage.local.set({ data, writer: 'background-' + uuid() });
  }
  flashBadge('✓', '#10b981');
}

async function saveActiveTab() {
  try {
    const [tab] = await API.tabs.query({ active: true, currentWindow: true });
    if (tab) await saveUrl(tab.url, tab.title);
  } catch { }
}

async function registerMenu() {
  if (!API?.contextMenus) return;
  try { await API.contextMenus.removeAll(); } catch (e) { console.warn('contextMenu removeAll:', e); }
  try {
    API.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Save to EshaalTab',
      contexts: ['page', 'link']
    }, () => {
      const err = API.runtime && API.runtime.lastError;
      if (err && !/duplicate id/i.test(err.message || '')) console.warn('contextMenu create:', err.message);
    });
  } catch (e) { console.warn('contextMenu create:', e); }
}

API?.runtime?.onInstalled.addListener(() => {
  console.log('EshaalTab extension installed successfully.');
  registerMenu();
});
API?.runtime?.onStartup?.addListener(registerMenu);

API?.contextMenus?.onClicked.addListener((info, tab) => {
  const url = info.linkUrl || info.pageUrl || tab?.url;
  saveUrl(url, info.linkUrl ? info.linkText : tab?.title);
});

API?.commands?.onCommand.addListener((command) => {
  if (command === 'save-current-tab') saveActiveTab();
});
