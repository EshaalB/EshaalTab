/* Toolbar popup: one-click save of the active tab into a chosen board, with tags. */
'use strict';

var $ = window.$ || (id => document.getElementById(id));

function setSafeHTML(el, html) {
  if (!el) return;
  const range = document.createRange();
  const frag = range.createContextualFragment(html || '');
  el.replaceChildren(frag);
}

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

        const { src, fallbacks } = faviconSrcSet(tab.url || '');
        const primary = tab.favIconUrl || src;
        const allFallbacks = tab.favIconUrl ? [src, ...fallbacks] : fallbacks;
        tabFaviconEl.src = primary;
        tabFaviconEl.style.display = '';
        tabFaviconEl.setAttribute('data-fav', '');
        tabFaviconEl.setAttribute('data-fav-url', tab.url || '');
        tabFaviconEl.setAttribute('data-fav-fallbacks', allFallbacks.filter(f => f !== primary).join('|'));
        wireFavicons(tabFaviconEl);
      }
    } catch (e) {
      enableManual('Couldn’t read the current tab');
    }
  } else {
    enableManual('Tab access unavailable');
  }

  let localData = null, localSettings = null, localStashes = null;
  if (HAS_EXT && EXT.storage) {
    const raw = await EXT.storage.local.get(['data', 'settings', 'tabStashes']);
    localData = raw.data;
    localSettings = raw.settings;
    localStashes = raw.tabStashes;
  } else {
    try { localData = JSON.parse(localStorage.getItem('markmez_data')); } catch {}
    try { localSettings = JSON.parse(localStorage.getItem('markmez_settings')); } catch {}
    try { localStashes = JSON.parse(localStorage.getItem('markmez_tab_stashes')); } catch {}
  }
  applyPopupTheme(localSettings);

  if (!localData || typeof localData !== 'object') localData = { boards: [] };
  if (!Array.isArray(localStashes)) {
    // Migrate stashes made by releases that kept them inside the shared data
    // object. A dedicated key prevents an older open new-tab page from
    // overwriting them when it later saves unrelated board or setting data.
    localStashes = Array.isArray(localData.tabStashes) ? localData.tabStashes : [];
    if (HAS_EXT && EXT.storage) {
      try { await EXT.storage.local.set({ tabStashes: localStashes }); } catch { }
    } else {
      try { localStorage.setItem('markmez_tab_stashes', JSON.stringify(localStashes)); } catch { }
    }
  }

  const boards = collectBoards(localData);
  const options = boards.length
    ? boards.map(b => ({ value: b.id, label: b.name }))
    : [{ value: 'new', label: 'Create Inbox Board' }];

  /* Defaulted to the first board every time, so a research session meant
     re-picking the same board on every single save. Default to wherever you
     saved last instead -- settings already round-trips through storage, so
     this is one remembered id, not a new subsystem. */
  const lastBoardId = localSettings?.lastSavedBoardId;
  const defaultValue = (lastBoardId && options.some(o => o.value === lastBoardId))
    ? lastBoardId : options[0].value;

  if (boardSelectContainer) {
    setSafeHTML(boardSelectContainer, CustomSelect.render({
      id: 'boardSelect',
      value: defaultValue,
      options
    }));
    CustomSelect.init(boardSelectContainer);
  }

  const errorMsg = $('errorMsg');
  const fail = (msg) => {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Bookmark';
    errorMsg.classList.remove('qs-info');   // a real error always overrides the dupe-notice styling
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  };

  /* Stashes live under their own persistent storage key, not as boards -- a stash
     is a "put these down for a minute" pile, not a bookmark collection, and
     putting it in Boards meant it was invisible unless you already knew to go
     looking there. Each entry stays until you delete it: Restore reopens the
     tabs without touching the entry, so restoring in one window and again in
     another both work from the same stash. */
  const MAX_STASHES = 20;
  const stashList = $('stashList');

  function fmtStamp(ts) {
    return new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function renderStashes() {
    const stashes = localStashes;
    if (!stashes.length) {
      setSafeHTML(stashList, '<div class="qs-stash-empty">Nothing stashed yet.</div>');
      return;
    }
    // Newest first.
    const ordered = [...stashes].sort((a, b) => b.ts - a.ts);
    setSafeHTML(stashList, ordered.map(s => {
      const names = (s.tabs || []).map(t => t.title || t.url).filter(Boolean);
      const preview = names.slice(0, 3).join(', ') + (names.length > 3 ? `, +${names.length - 3} more` : '');
      return `
        <div class="qs-stash-item" data-id="${escapeHtml(s.id)}">
          <div class="qs-stash-info">
            <div class="qs-stash-time">${escapeHtml(fmtStamp(s.ts))} · ${s.tabs.length} tab${s.tabs.length === 1 ? '' : 's'}</div>
            <div class="qs-stash-tabs" title="${escapeHtml(preview)}">${escapeHtml(preview)}</div>
          </div>
          <div class="qs-stash-actions">
            <button class="qs-stash-icon-btn qs-restore-btn" title="Reopen these tabs" aria-label="Reopen these tabs">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>
            </button>
            <button class="qs-stash-icon-btn qs-del-btn" title="Delete this stash" aria-label="Delete this stash">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            </button>
          </div>
        </div>`;
    }).join(''));
  }

  async function saveStashes() {
    if (HAS_EXT && EXT.storage) {
      await EXT.storage.local.set({ tabStashes: localStashes });
    } else {
      localStorage.setItem('markmez_tab_stashes', JSON.stringify(localStashes));
    }
  }

  stashList?.addEventListener('click', async (e) => {
    const item = e.target.closest('.qs-stash-item');
    if (!item) return;
    const id = item.dataset.id;
    const stashes = localStashes;
    const stash = stashes.find(s => s.id === id);
    if (!stash) return;

    if (e.target.closest('.qs-restore-btn')) {
      if (!(HAS_EXT && EXT.tabs)) { fail('Reopening tabs needs the installed extension.'); return; }
      const btn = e.target.closest('.qs-restore-btn');
      btn.disabled = true;
      try {
        for (const t of stash.tabs) {
          try { await EXT.tabs.create({ url: t.url, active: false }); } catch { }
        }
      } finally {
        btn.disabled = false;
      }
    } else if (e.target.closest('.qs-del-btn')) {
      localStashes = stashes.filter(s => s.id !== id);
      await saveStashes();
      renderStashes();
    }
  });

  const stashBtn = $('stashBtn');
  stashBtn?.addEventListener('click', async () => {
    if (!(HAS_EXT && EXT.tabs)) { fail('Tab stashing needs the installed extension.'); return; }
    stashBtn.disabled = true;
    stashBtn.textContent = 'Stashing…';
    try {
      const tabs = (await EXT.tabs.query({ currentWindow: true }))
        .filter(t => t.url && /^https?:\/\//i.test(t.url));
      if (!tabs.length) { fail('No open web pages to stash.'); return; }

      // Informational, not blocking -- stashing is "park these for later," not
      // "decide what to keep," so a duplicate isn't wrong, just worth knowing
      // about. Same normalisation the browser-bookmark importer already uses.
      const normalize = (u) => String(u || '').trim().toLowerCase().replace(/\/+$/, '');
      const savedUrls = new Set();
      (localData.boards || []).forEach(b => (b.bookmarks || []).forEach(bm => savedUrls.add(normalize(bm.url))));
      const dupeCount = tabs.filter(t => savedUrls.has(normalize(t.url))).length;

      const entry = {
        id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
        ts: Date.now(),
        tabs: tabs.map(t => ({ title: t.title || t.url, url: t.url }))
      };
      localStashes.unshift(entry);
      if (localStashes.length > MAX_STASHES) localStashes.length = MAX_STASHES;
      await saveStashes();
      renderStashes();

      // The popup is its own window, not a tab in this list, so every matched
      // tab is safe to close -- no "don't close the tab I'm on" exclusion needed.
      const ids = tabs.map(t => t.id).filter(id => id != null);
      try { if (ids.length) await EXT.tabs.remove(ids); } catch { }

      if (dupeCount > 0) {
        errorMsg.classList.add('qs-info');
        errorMsg.textContent = `Stashed ${tabs.length} tab${tabs.length === 1 ? '' : 's'} — ${dupeCount} ${dupeCount === 1 ? 'is' : 'are'} already saved as bookmark${dupeCount === 1 ? '' : 's'}.`;
        errorMsg.style.display = 'block';
      }
    } catch (e) {
      fail('Could not stash tabs.');
    } finally {
      stashBtn.disabled = false;
      stashBtn.textContent = 'Stash all tabs in this window';
    }
  });

  renderStashes();

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

    errorMsg.classList.remove('qs-info');
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
        // Re-fetch settings right before the write instead of reusing the copy
        // loaded when the popup opened -- the popup can sit open a few seconds,
        // and writing a stale blob back would clobber anything changed
        // elsewhere (another tab, the new-tab page) in the meantime.
        const fresh = (await EXT.storage.local.get('settings')).settings || localSettings || {};
        fresh.lastSavedBoardId = target.id;
        await EXT.storage.local.set({ data: localData, settings: fresh, writer: 'popup-' + newBookmark.id });
      } else {
        if (!localSettings) localSettings = {};
        localSettings.lastSavedBoardId = target.id;
        localStorage.setItem('markmez_data', JSON.stringify(localData));
        localStorage.setItem('markmez_settings', JSON.stringify(localSettings));
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
