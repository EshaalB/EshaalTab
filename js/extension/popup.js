/* Toolbar popup: one-click save of the active tab into a chosen board, with tags. */
'use strict';

var $ = window.$ || (id => document.getElementById(id));

function collectBoards(d) {
  if (!d) return [];
  if (Array.isArray(d.boards)) return d.boards.filter(b => (b.type || 'links') === 'links');
  if (Array.isArray(d.pages)) {
    const out = [];
    d.pages.forEach(p => (p.boards || []).forEach(b => { if ((b.type || 'links') === 'links') out.push(b); }));
    return out;
  }
  return [];
}

const hexToRgb = (hex) => {
  let c = String(hex || '#6366f1').replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const n = parseInt(c.slice(0, 6), 16);
  return isNaN(n) ? { r: 99, g: 102, b: 241 } : { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const contrastText = (color) => {
  const { r, g, b } = hexToRgb(color);
  const lin = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return (L + 0.05) / 0.05265 >= 1.05 / (L + 0.05) ? '#14151a' : '#ffffff';
};

function applyPopupTheme(settings) {
  if (!settings) return;
  const root = document.documentElement.style;
  const raw = String(settings.accentColor || '');
  const accent = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw) ? raw
               : (/^#[0-9a-f]{8}$/i.test(raw) ? raw.slice(0, 7) : '#6366f1');
  const light = settings.mode === 'light' ||
    (settings.mode === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Same reason as the new tab: without this the board <select> popup opens
  // white-on-white whenever the user is in dark mode.
  document.documentElement.style.colorScheme = light ? 'light' : 'dark';

  root.setProperty('--accent-color', accent);
  root.setProperty('--accent-contrast', contrastText(accent));
  root.setProperty('--bg', light ? '#f8fafc' : '#0d1117');
  root.setProperty('--text', light ? '#0d1117' : '#ffffff');
  root.setProperty('--text-dim', light ? 'rgba(13,17,23,0.55)' : 'rgba(255,255,255,0.5)');
  root.setProperty('--line', light ? 'rgba(13,17,23,0.12)' : 'rgba(255,255,255,0.1)');
  root.setProperty('--field', light ? 'rgba(13,17,23,0.05)' : 'rgba(255,255,255,0.08)');
  root.setProperty('--field-line', light ? 'rgba(13,17,23,0.14)' : 'rgba(255,255,255,0.16)');
  if (settings.cornerRadius && settings.cornerRadius !== 'default') {
    root.setProperty('--radius', settings.cornerRadius === '9999px' ? '999px' : settings.cornerRadius);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const tabTitleEl = $('tabTitle');
  const tabUrlEl = $('tabUrl');
  const tabFaviconEl = $('tabFavicon');
  const boardSelectContainer = $('boardSelectContainer');
  const tagInput = $('tagInput');
  const saveBtn = $('saveBtn');
  const successMsg = $('successMsg');

  let activeTab = null;

  const manualFields = $('manualFields');
  const manualTitle = $('manualTitle');
  const manualUrl = $('manualUrl');
  const enableManual = (why, prefillTitle, prefillUrl) => {
    manualFields.style.display = 'block';
    tabTitleEl.textContent = why;
    tabUrlEl.textContent = 'Enter the page details below';
    if (prefillTitle) manualTitle.value = prefillTitle;
    if (prefillUrl && /^https?:\/\//i.test(prefillUrl)) manualUrl.value = prefillUrl;
  };

  if (HAS_EXT && EXT.tabs) {
    try {
      const [tab] = await EXT.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        enableManual('No active tab found');
      } else if (!/^https?:\/\//i.test(tab.url || '')) {
        enableManual('This page can’t be saved automatically', tab.title || '', '');
      } else {
        activeTab = tab;
        tabTitleEl.textContent = tab.title || tab.url;
        tabUrlEl.textContent = tab.url || '';

        if (tab.favIconUrl) {
          tabFaviconEl.src = tab.favIconUrl;
          tabFaviconEl.addEventListener('error', () => { tabFaviconEl.style.opacity = 0.3; }, { once: true });
        } else {
          const { src, fallbacks } = faviconSrcSet(tab.url || '');
          tabFaviconEl.src = src;
          tabFaviconEl.setAttribute('data-fav', '');
          tabFaviconEl.setAttribute('data-fav-fallbacks', fallbacks.join('|'));
          wireFavicons(tabFaviconEl);
        }
      }
    } catch (e) {
      enableManual('Couldn’t read the current tab');
    }
  } else {
    enableManual('Tab access unavailable');
  }

  let localData = null, localSettings = null;
  if (HAS_EXT && EXT.storage) {
    const raw = await EXT.storage.local.get(['data', 'settings']);
    localData = raw.data;
    localSettings = raw.settings;
  } else {
    try { localData = JSON.parse(localStorage.getItem('markmez_data')); } catch {}
    try { localSettings = JSON.parse(localStorage.getItem('markmez_settings')); } catch {}
  }
  applyPopupTheme(localSettings);

  if (!localData || typeof localData !== 'object') localData = { boards: [] };

  const boards = collectBoards(localData);
  const options = boards.length
    ? boards.map(b => ({ value: b.id, label: b.name }))
    : [{ value: 'new', label: 'Create Inbox Board' }];

  if (boardSelectContainer) {
    boardSelectContainer.innerHTML = CustomSelect.render({
      id: 'boardSelect',
      value: options[0].value,
      options
    });
    CustomSelect.init(boardSelectContainer);
  }

  const errorMsg = $('errorMsg');
  const fail = (msg) => {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Bookmark';
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  };

  saveBtn.addEventListener('click', async () => {
    const manual = manualFields.style.display !== 'none';
    let title, url;

    if (manual) {
      title = manualTitle.value.trim();
      url = manualUrl.value.trim();
      if (!url) { fail('Enter a URL to save.'); return; }
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      if (!/^https?:\/\/[^\s.]+\.[^\s]+/i.test(url)) { fail('That doesn’t look like a valid URL.'); return; }
      if (!title) title = url;
    } else {
      if (!activeTab || !activeTab.url) { fail('No active tab to save.'); return; }
      if (!/^https?:\/\//i.test(activeTab.url)) { fail('Only http(s) pages can be saved.'); return; }
      title = activeTab.title || activeTab.url;
      url = activeTab.url;
    }

    errorMsg.style.display = 'none';
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    const boardSelect = $('boardSelect');
    const boardId = boardSelect ? boardSelect.value : 'new';
    const rawTags = tagInput.value.trim();
    const tags = rawTags ? rawTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
    const newBookmark = {
      id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
      title,
      url,
      tags
    };

    try {
      let target = null;
      if (Array.isArray(localData.boards)) {
        target = boardId === 'new'
          ? localData.boards.find(b => b.name === 'Inbox')
          : localData.boards.find(b => b.id === boardId);
        if (!target) {
          target = {
            id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
            name: 'Inbox', color: '#6366f1', col: 0,
            order: localData.boards.length,
            bookmarks: []
          };
          localData.boards.push(target);
        }
      } else if (Array.isArray(localData.pages)) {
        for (const p of localData.pages) {
          const f = (p.boards || []).find(b => b.id === boardId);
          if (f) { target = f; break; }
        }
        if (!target && localData.pages[0]) {
          target = { id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), type: 'links', name: 'Inbox', color: '#6366f1', bookmarks: [] };
          localData.pages[0].boards.push(target);
        }
      } else {
        localData.boards = [];
        target = { id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), name: 'Inbox', color: '#6366f1', col: null, order: 0, bookmarks: [] };
        localData.boards.push(target);
      }

      if (!target) { fail('Could not find a board to save into.'); return; }

      if (!Array.isArray(target.bookmarks)) target.bookmarks = [];
      target.bookmarks.push(newBookmark);
      if (HAS_EXT && EXT.storage) {
        await EXT.storage.local.set({ data: localData, writer: 'popup-' + newBookmark.id });
      } else {
        localStorage.setItem('markmez_data', JSON.stringify(localData));
      }
    } catch (e) {
      fail('Could not save. Your storage may be full.');
      return;
    }

    saveBtn.style.display = 'none';
    successMsg.style.display = 'block';
    setTimeout(() => window.close(), 1200);
  });
});
