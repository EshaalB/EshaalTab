/* Ctrl+K command palette. Slash commands, plus mixed search across open tabs,
   bookmarks and history with de-duplication, debounce, a token guard against
   out-of-order async results, and arrow-key navigation. */
'use strict';

const SearchRenderer = (() => {
  const overlay = $('searchOverlay');
  const input = $('searchInput');
  const resultsContainer = $('searchResults');
  const searchSideBtn = $('searchSideBtn');
  let selIndex = -1;

  function moveSel(items, dir) {
    if (!items.length) return;
    selIndex = selIndex < 0 ? (dir > 0 ? 0 : items.length - 1) : (selIndex + dir + items.length) % items.length;
    items.forEach((it, i) => it.classList.toggle('kb-active', i === selIndex));
    items[selIndex].scrollIntoView({ block: 'nearest' });
  }

  function init() {
    if (searchSideBtn) {
      searchSideBtn.addEventListener('click', open);
    }

    if (input) {
      let deb = null;
      input.addEventListener('input', () => {
        clearTimeout(deb);
        deb = setTimeout(() => performSearch(input.value), 80);
      });

      input.addEventListener('keydown', (e) => {
        const items = [...resultsContainer.querySelectorAll('.search-result-item')];
        if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(items, 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(items, -1); }
        else if (e.key === 'Enter') { e.preventDefault(); (items[selIndex] || items[0])?.click(); }
      });
    }

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });
    }

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen()) close(); else open();
      }
    });
  }

  function isOpen() {
    return overlay && (overlay.classList.contains('open') || overlay.classList.contains('active'));
  }

  function open() {
    if (!overlay) return;
    overlay.classList.add('open');
    overlay.classList.add('active');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 30);
    }
    performSearch('');
  }

  function close() {
    if (overlay) {
      overlay.classList.remove('open');
      overlay.classList.remove('active');
    }
  }

  function performSearch(query) {
    if (!resultsContainer) return;
    selIndex = -1;

    const trimmed = query.trim();

    if (trimmed.startsWith('/')) {
      const COMMANDS = [
        { cmd: '/focus', label: 'Launch Pomodoro Focus Session', desc: 'Open 3D Flip Clock timer', action: () => { close(); PomodoroMode.enter(); } },
        { cmd: '/mode', label: 'Toggle Light / Dark', desc: 'Switch between light and dark mode', action: () => {
          close();
          const s = StorageManager.getSettings();
          const next = s.mode === 'light' ? 'dark' : 'light';
          SettingsRenderer.setMode(next);
          ToastSystem.success(`${next === 'light' ? 'Light' : 'Dark'} mode`);
        }},
        { cmd: '/new', label: 'Create New Board', desc: 'Add a bookmark board', action: () => { close(); ViewController.show('boards'); showPrompt('New Board', 'Board name:', 'Bookmarks', (val) => { if (val) { BoardManager.addBoard(val); BoardRenderer.renderBoards(); } }); } },
        { cmd: '/notes', label: 'Open Notes', desc: 'Jump to your notepad', action: () => { close(); ViewController.show('notes'); } },
        { cmd: '/stash', label: 'Stash All Open Tabs', desc: 'Save this window’s tabs into a board & close them', action: async () => { close(); await TabStash.stashCurrentWindow(true); } },
        { cmd: '/wall', label: 'Change Wallpaper', desc: 'Jump to the wallpaper controls', action: () => { close(); SettingsRenderer.openSideSheet('theme', 'wallpaper'); } },
        { cmd: '/import', label: 'Import Bookmarks', desc: 'Import from Browser or Raindrop', action: () => { close(); SettingsRenderer.openSideSheet('data'); } },
        { cmd: '/widgets', label: 'Widgets & Weather', desc: 'Toggle widgets, set search engine and city', action: () => { close(); SettingsRenderer.openSideSheet('widgets'); } },
        { cmd: '/settings', label: 'Open Settings', desc: 'Theme, widgets, data and help', action: () => { close(); SettingsRenderer.openSideSheet(null); } }
      ];

      const matchCmds = COMMANDS.filter(c => c.cmd.toLowerCase().includes(trimmed.toLowerCase()) || c.label.toLowerCase().includes(trimmed.toLowerCase()));

      setSafeHTML(resultsContainer, matchCmds.map(c => `
        <div class="search-result-item command-item" data-cmd="${c.cmd}">
          <div class="sr-cmd-icon">/</div>
          <div class="sr-info">
            <div class="sr-title">${escapeHtml(c.label)}</div>
            <div class="sr-sub">${escapeHtml(c.desc)}</div>
          </div>
          <span class="sr-kbd">${c.cmd}</span>
        </div>
      `).join(''));

      resultsContainer.querySelectorAll('.command-item').forEach((el, i) => {
        el.addEventListener('click', () => matchCmds[i].action());
      });
      const items = [...resultsContainer.querySelectorAll('.search-result-item')];
      if (items.length) {
        selIndex = 0;
        items[0].classList.add('kb-active');
      }
      return;
    }

    if (trimmed === '#') {
      setSafeHTML(resultsContainer, `
        <div class="search-hint">
          Type a tag name after <strong class="cmd-chip">#</strong> to filter bookmarks by tag (e.g. <strong>#code</strong>, <strong>#docs</strong>).
        </div>
      `);
      return;
    }

    if (!trimmed) {
      setSafeHTML(resultsContainer, `
        <div class="search-hint">
          Type to search bookmarks or type <strong class="cmd-chip">/focus</strong>, <strong class="cmd-chip">/mode</strong>, <strong class="cmd-chip">/new</strong>, <strong class="cmd-chip">/notes</strong> for commands.
        </div>
      `);
      return;
    }

    const token = ++searchToken;
    renderMixed(trimmed, token);
  }

  let searchToken = 0;

  function rowHtml(it, kind) {
    const tabAttrs = kind === 'tab' ? ` data-tabid="${it.tabId}" data-winid="${it.windowId}"` : '';
    const badge = kind === 'tab'
      ? '<span class="sr-badge">Tab</span>'
      : (kind === 'history' ? '<span class="sr-badge sr-badge-dim">History</span>' : '');
    return `
      <div class="search-result-item" data-act="${kind}" data-url="${escapeHtml(safeHref(it.url))}"${tabAttrs}>
        <img class="sr-favicon" ${faviconAttr(it.url)} alt="" />
        <div class="sr-info">
          <div class="sr-title">${escapeHtml(it.title)}</div>
          <div class="sr-sub">${escapeHtml(it.subtitle || it.url)}</div>
        </div>
        ${badge}
      </div>`;
  }

  async function renderMixed(trimmed, token) {
    const [openTabs, hist] = await Promise.all([BrowserSearch.tabs(trimmed), BrowserSearch.history(trimmed)]);
    if (token !== searchToken || !isOpen()) return;

    const bookmarks = BookmarkManager.searchAll(trimmed);

    const seen = new Set([...openTabs.map(t => t.url), ...bookmarks.map(b => b.url)]);
    const history = hist.filter(h => !seen.has(h.url));

    const sections = [
      { label: 'Open Tabs', kind: 'tab', items: openTabs },
      { label: 'Bookmarks', kind: 'bookmark', items: bookmarks.map(b => ({ title: b.title, url: b.url, subtitle: `${b.boardName} • ${b.url}` })) },
      { label: 'History', kind: 'history', items: history }
    ].filter(s => s.items.length);

    if (!sections.length) {
      setSafeHTML(resultsContainer, `<div class="search-no-results">No results for "${escapeHtml(trimmed)}"</div>`);
      return;
    }

    setSafeHTML(resultsContainer, sections.map(sec =>
      `<div class="search-section-label">${sec.label}</div>` + sec.items.map(it => rowHtml(it, sec.kind)).join('')
    ).join(''));

    const items = [...resultsContainer.querySelectorAll('.search-result-item')];
    if (selIndex >= items.length) selIndex = items.length ? items.length - 1 : -1;
    if (selIndex >= 0) items[selIndex]?.classList.add('kb-active');

    wireFavicons(resultsContainer);
    resultsContainer.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        if (el.dataset.act === 'tab' && HAS_EXT && EXT.tabs) {
          const tabId = parseInt(el.dataset.tabid), winId = parseInt(el.dataset.winid);
          try {
            EXT.tabs.update(tabId, { active: true });
            if (!isNaN(winId) && EXT.windows) EXT.windows.update(winId, { focused: true });
          } catch { window.open(el.dataset.url, '_blank'); }
        } else {
          window.open(el.dataset.url, '_blank');
        }
        close();
      });
    });
  }

  return { init, open, close, isOpen };
})();
