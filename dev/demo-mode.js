/* demo-mode.js — SCREENSHOT ONLY. Never referenced by index.html, never packaged.
   `dev/` is excluded from both the CI allow-list (.github/workflows/deploy.yml)
   and build-zip.bat, so this file cannot reach the Web Store package.

   Purpose: put EshaalTab into a clean, full, presentable state for store
   screenshots, then put it back exactly as it was.

   USAGE
     1. Open the new tab page, then DevTools (F12) -> Console.
     2. Paste this whole file in, press Enter.
     3. EshaalTabDemo.enable()     // snapshots your real data first
     4. Take screenshots.
     5. EshaalTabDemo.disable()    // restores your real data

   SAFETY
     - enable() writes a full snapshot of `data` and `settings` BEFORE touching
       anything, and refuses to overwrite an existing snapshot, so running it
       twice can never destroy the original.
     - Wallpaper media (wpmedia: keys) is never written, deleted or pruned.
     - No permissions are requested, no production code path is modified on
       disk, and nothing here persists once you reload without pasting it.
*/
'use strict';

window.EshaalTabDemo = (function () {
  const BACKUP_KEY = 'et_demo_backup';
  const hasExt = (typeof HAS_EXT !== 'undefined' && HAS_EXT && typeof EXT !== 'undefined' && EXT.storage);

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2));

  async function readBackup() {
    if (hasExt) return (await EXT.storage.local.get(BACKUP_KEY))[BACKUP_KEY] || null;
    try { return JSON.parse(localStorage.getItem(BACKUP_KEY) || 'null'); } catch { return null; }
  }
  async function writeBackup(payload) {
    if (hasExt) await EXT.storage.local.set({ [BACKUP_KEY]: payload });
    else localStorage.setItem(BACKUP_KEY, JSON.stringify(payload));
  }
  async function clearBackup() {
    if (hasExt) await EXT.storage.local.remove(BACKUP_KEY);
    else localStorage.removeItem(BACKUP_KEY);
  }

  /* Deliberately generic, safe, real-looking content. No names, no employers,
     no internal URLs, no tokens in query strings -- reviewers look at these. */
  function demoBoards() {
    const link = (title, url, tags, pinned) => {
      const b = { id: uid(), title, url, tags: tags || [] };
      if (pinned) b.pinnedToHome = true;
      return b;
    };
    return [
      {
        id: uid(), name: 'Daily', color: '#6366f1', col: 0, order: 0,
        bookmarks: [
          link('Gmail', 'https://mail.google.com', ['mail'], true),
          link('Calendar', 'https://calendar.google.com', ['planning'], true),
          link('Google Drive', 'https://drive.google.com', ['files'], true),
          link('YouTube', 'https://youtube.com', ['media']),
          link('Google Maps', 'https://maps.google.com', ['travel'])
        ]
      },
      {
        id: uid(), name: 'Build', color: '#0ea5e9', col: 0, order: 1,
        bookmarks: [
          link('GitHub', 'https://github.com', ['code'], true),
          link('Stack Overflow', 'https://stackoverflow.com', ['code']),
          link('MDN Web Docs', 'https://developer.mozilla.org', ['docs'], true),
          link('Can I Use', 'https://caniuse.com', ['docs']),
          link('Chrome for Developers', 'https://developer.chrome.com', ['docs'])
        ]
      },
      {
        id: uid(), name: 'Design', color: '#ec4899', col: 1, order: 2,
        bookmarks: [
          link('Figma', 'https://figma.com', ['design']),
          link('Google Fonts', 'https://fonts.google.com', ['type']),
          link('Coolors', 'https://coolors.co', ['colour']),
          link('Unsplash', 'https://unsplash.com', ['photos'])
        ]
      },
      {
        id: uid(), name: 'Reading', color: '#10b981', col: 1, order: 3,
        bookmarks: [
          link('Hacker News', 'https://news.ycombinator.com', ['news']),
          link('Wikipedia', 'https://wikipedia.org', ['reference']),
          link('arXiv', 'https://arxiv.org', ['papers']),
          link('Project Gutenberg', 'https://gutenberg.org', ['books'])
        ]
      },
      {
        id: uid(), name: 'Inbox', color: '#f59e0b', col: 2, order: 4,
        bookmarks: [
          link('CSS nesting is now baseline', 'https://developer.chrome.com', ['read-later']),
          link('A guide to container queries', 'https://developer.mozilla.org', ['read-later'])
        ]
      }
    ];
  }

  const DEMO_NOTES = [
    'Weekly plan',
    '',
    '- Ship the new board drag-and-drop',
    '- Review the colour contrast pass',
    '- Write release notes for 2.1',
    '',
    'Ideas',
    '- Group boards by project',
    '- Keyboard shortcut for "open all links"'
  ].join('\n');

  function demoTodos() {
    return [
      { id: uid(), text: 'Review pull requests', done: false, pinned: true },
      { id: uid(), text: 'Draft the release notes', done: false },
      { id: uid(), text: 'Reply to design feedback 14:30', done: false },
      { id: uid(), text: 'Update the changelog', done: true },
      { id: uid(), text: 'Back up bookmarks', done: true }
    ];
  }

  function demoSettings(base) {
    /* Balanced, neutral, and deliberately NOT a pastel preset: screenshots want
       a theme where the accent reads clearly at thumbnail size. */
    return Object.assign({}, base, {
      preset: '',
      mode: 'dark',
      modeLocked: false,
      accentColor: '#6366f1',
      solidSeed: '#111827',
      backgroundType: 'solid',
      backgroundValue: '#111827',
      accentOverride: undefined,
      displayName: '',
      weatherCity: '',
      widgets: { clock: true, navSearch: true, weather: false, todo: true, workspace: true },
      hidePinnedOnHome: false,
      activeTab: 'home',
      searchEngine: 'default',
      remoteFavicons: false,
      cornerRadius: 'default',
      fontFamily: 'default'
    });
  }

  /* Ctrl+K normally pulls open tabs and history from the browser. For a filled
     palette screenshot you can either open a few clean tabs yourself (most
     honest -- the results are then genuinely real), or switch on these sample
     rows. They are patched in memory only and vanish on reload. */
  let patched = null;
  const SAMPLE_TABS = [
    { title: 'Chrome for Developers', url: 'https://developer.chrome.com/docs/extensions', tabId: 1, windowId: 1 },
    { title: 'MDN Web Docs — CSS', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS', tabId: 2, windowId: 1 }
  ];
  const SAMPLE_HISTORY = [
    { title: 'Manifest V3 migration guide', url: 'https://developer.chrome.com/docs/extensions/develop' },
    { title: 'Designing accessible colour palettes', url: 'https://www.w3.org/WAI/WCAG22/quickref' }
  ];

  function patchSearch(term) {
    if (typeof BrowserSearch === 'undefined' || patched) return;
    patched = { tabs: BrowserSearch.tabs, history: BrowserSearch.history };
    const match = (rows, t) => !t ? [] : rows.filter(r =>
      r.title.toLowerCase().includes(t.toLowerCase()) || r.url.toLowerCase().includes(t.toLowerCase()));
    BrowserSearch.tabs = async (t) => match(SAMPLE_TABS, t);
    BrowserSearch.history = async (t) => match(SAMPLE_HISTORY, t);
    console.info('[demo] Ctrl+K sample tabs/history ON. Try searching "dev" or "css".');
  }
  function unpatchSearch() {
    if (!patched) return;
    BrowserSearch.tabs = patched.tabs;
    BrowserSearch.history = patched.history;
    patched = null;
    console.info('[demo] Ctrl+K sample tabs/history OFF.');
  }

  async function repaint() {
    SettingsRenderer.applyPresetShell();
    SettingsRenderer.applyTheme();
    SettingsRenderer.applyCursor();
    WidgetsRenderer.applyWidgetVisibility();
    BoardRenderer.renderBoards();
    HomeRenderer.renderPinned();
    if (typeof HomeRenderer.render === 'function') HomeRenderer.render();
    TodoWidget.render();
    ViewController.show('home');
  }

  async function enable(opts) {
    const options = opts || {};
    if (await readBackup()) {
      console.warn('[demo] A snapshot already exists — demo mode looks enabled. ' +
                   'Run EshaalTabDemo.disable() first. Refusing to overwrite your real data.');
      return false;
    }

    const data = StorageManager.getData();
    const settings = StorageManager.getSettings();
    await writeBackup({ data: JSON.parse(JSON.stringify(data)), settings: JSON.parse(JSON.stringify(settings)), at: Date.now() });

    data.boards = demoBoards();
    data.notes = DEMO_NOTES;
    data.todos = demoTodos();
    data.tags = ['mail', 'planning', 'files', 'media', 'travel', 'code', 'docs', 'design', 'type', 'colour', 'photos', 'news', 'reference', 'papers', 'books', 'read-later'];
    data.pinsMigrated = true;

    Object.assign(settings, demoSettings(settings));
    delete settings.accentOverride;

    StorageManager.saveImmediate();
    await repaint();
    if (options.sampleSearch !== false) patchSearch();

    console.info('[demo] Demo state ON. Snapshot saved. Run EshaalTabDemo.disable() when finished.');
    return true;
  }

  async function disable() {
    const backup = await readBackup();
    if (!backup) { console.warn('[demo] No snapshot found — nothing to restore.'); return false; }

    const data = StorageManager.getData();
    const settings = StorageManager.getSettings();
    Object.keys(data).forEach(k => delete data[k]);
    Object.assign(data, backup.data);
    Object.keys(settings).forEach(k => delete settings[k]);
    Object.assign(settings, backup.settings);

    StorageManager.saveImmediate();
    await clearBackup();
    unpatchSearch();
    await repaint();
    console.info('[demo] Your real data has been restored.');
    return true;
  }

  async function status() {
    const b = await readBackup();
    return { demoActive: !!b, snapshotTakenAt: b ? new Date(b.at).toLocaleString() : null, sampleSearchPatched: !!patched };
  }

  return { enable, disable, status, patchSearch, unpatchSearch };
})();

console.info('EshaalTabDemo ready — run EshaalTabDemo.enable() to build the screenshot state.');
