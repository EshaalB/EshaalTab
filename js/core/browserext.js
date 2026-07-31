/* Live browser integration; every part no-ops outside an extension. Stash open
   tabs into a board, reopen a board as tabs, and surface tabs/history in the
   command palette. */
'use strict';

const TabStash = (() => {
  const isWeb = (t) => t && t.url && /^https?:\/\//i.test(t.url);

  async function stashCurrentWindow(closeAfter = true) {
    if (!(HAS_EXT && EXT.tabs)) { ToastSystem.error('Tab stashing needs the installed extension.'); return null; }
    let tabs = [];
    try { tabs = (await EXT.tabs.query({ currentWindow: true })).filter(isWeb); } catch { }
    if (!tabs.length) { ToastSystem.info('No open web pages to stash.'); return null; }

    const stamp = new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const board = BoardManager.addBoard(`Session · ${stamp}`);
    tabs.forEach(t => BookmarkManager.add(board.id, t.title || t.url, t.url, ['session']));
    BoardRenderer.renderBoards();
    HomeRenderer.renderPinned();

    if (closeAfter) {
      const ids = tabs.filter(t => t.url !== location.href).map(t => t.id).filter(id => id != null);
      try { if (ids.length) await EXT.tabs.remove(ids); } catch { }
    }
    ToastSystem.success(`Stashed ${tabs.length} tab${tabs.length === 1 ? '' : 's'}`);
    return board;
  }

  async function openAll(board) {
    const bms = (board && board.bookmarks) || [];
    if (!bms.length) { ToastSystem.info('This board has no links.'); return; }
    if (HAS_EXT && EXT.tabs) {
      for (const bm of bms) { try { await EXT.tabs.create({ url: safeHref(bm.url), active: false }); } catch { } }
    } else {
      bms.forEach(bm => window.open(safeHref(bm.url), '_blank'));
    }
    ToastSystem.success(`Opened ${bms.length} link${bms.length === 1 ? '' : 's'}`);
  }

  return { stashCurrentWindow, openAll };
})();

const BrowserSearch = (() => {
  const isWeb = (u) => u && /^https?:\/\//i.test(u);

  async function tabs(term) {
    if (!(HAS_EXT && EXT.tabs) || !term) return [];
    const t = term.toLowerCase();
    try {
      const all = await EXT.tabs.query({});
      return all
        .filter(x => isWeb(x.url) && ((x.title || '').toLowerCase().includes(t) || x.url.toLowerCase().includes(t)))
        .slice(0, 6)
        .map(x => ({ title: x.title || x.url, url: x.url, tabId: x.id, windowId: x.windowId }));
    } catch { return []; }
  }

  async function history(term) {
    if (!(HAS_EXT && EXT.history) || !term) return [];
    try {
      const items = await EXT.history.search({ text: term, maxResults: 10, startTime: 0 });
      return items.filter(h => isWeb(h.url)).slice(0, 6).map(h => ({ title: h.title || h.url, url: h.url }));
    } catch { return []; }
  }

  return { tabs, history };
})();
