/* EshaalTab in-extension self test.

   Everything Claude can test over http:// runs with HAS_EXT === false, so the
   entire chrome.* surface (storage, tabs, bookmarks, history, favicons, the
   service worker) is never exercised. This script runs INSIDE the installed
   extension and reports on exactly that gap.

   HOW TO RUN
   1. Open a new tab (the EshaalTab page).
   2. Press F12, open the Console tab.
   3. Paste this whole file, press Enter.
   4. Wait for "REPORT COMPLETE", then copy everything from the START marker
      down and paste it back to Claude.

   It is read-mostly: it writes one throwaway key (__qa_probe) and removes it.
   Your boards, notes and settings are not touched. */

(async () => {
  const R = [];
  const t = (name, pass, detail) => R.push({ name, pass: pass === true, skip: pass === 'skip', detail: detail == null ? '' : String(detail) });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const noise = [];

  const _e = console.error.bind(console), _w = console.warn.bind(console);
  console.error = (...a) => { noise.push('ERROR: ' + a.map(String).join(' ')); _e(...a); };
  console.warn = (...a) => { noise.push('WARN: ' + a.map(String).join(' ')); _w(...a); };
  const onErr = e => noise.push('UNCAUGHT: ' + e.message);
  const onRej = e => noise.push('REJECTION: ' + (e.reason && e.reason.message || e.reason));
  addEventListener('error', onErr); addEventListener('unhandledrejection', onRej);

  // ---------- environment ----------
  t('running on chrome-extension://', location.protocol === 'chrome-extension:', location.protocol);
  t('EXT bridge resolved', typeof EXT !== 'undefined' && !!EXT);
  t('HAS_EXT true', typeof HAS_EXT !== 'undefined' && HAS_EXT === true);
  const V = (EXT && EXT.runtime && EXT.runtime.getManifest) ? EXT.runtime.getManifest().version : '?';
  t('manifest version readable', V !== '?', V);

  // ---------- storage.local ----------
  try {
    await EXT.storage.local.set({ __qa_probe: { n: 1, s: 'x' } });
    const got = (await EXT.storage.local.get('__qa_probe')).__qa_probe;
    t('storage.local write+read', got && got.n === 1 && got.s === 'x');
    await EXT.storage.local.remove('__qa_probe');
    t('storage.local remove', (await EXT.storage.local.get('__qa_probe')).__qa_probe === undefined);
  } catch (e) { t('storage.local write+read', false, e.message); }

  try {
    const bag = await EXT.storage.local.get(['data', 'settings']);
    t('real data present', !!bag.data, bag.data ? `${(bag.data.boards || []).length} boards` : 'none');
    t('real settings present', !!bag.settings);
    const bytes = await (EXT.storage.local.getBytesInUse ? EXT.storage.local.getBytesInUse(null) : Promise.resolve(null));
    t('local storage usage', true, bytes == null ? 'n/a' : (bytes / 1048576).toFixed(2) + ' MB');
  } catch (e) { t('real data present', false, e.message); }

  // ---------- storage.sync (8KB per item is the usual failure) ----------
  try {
    const syncBag = await EXT.storage.sync.get('settings');
    const size = new Blob([JSON.stringify(syncBag.settings || {})]).size;
    t('sync settings under 8KB quota', size < 8192, size + ' bytes');
  } catch (e) { t('storage.sync readable', false, e.message); }

  // ---------- permissions-backed APIs ----------
  for (const [label, fn] of [
    ['tabs.query', () => EXT.tabs.query({})],
    ['history.search', () => EXT.history.search({ text: '', maxResults: 1, startTime: 0 })],
    ['bookmarks.getTree', () => EXT.bookmarks.getTree()],
  ]) {
    try { const r = await fn(); t(label, Array.isArray(r), `${r.length} items`); }
    catch (e) { t(label, false, e.message); }
  }

  // ---------- favicon service ----------
  try {
    const u = extFaviconUrl('https://github.com');
    t('_favicon URL built', /^chrome-extension:\/\/.*_favicon\//.test(u), u.slice(0, 60));
    const ok = await new Promise(res => { const i = new Image(); i.onload = () => res(true); i.onerror = () => res(false); i.src = u; setTimeout(() => res(false), 3000); });
    t('_favicon actually loads', ok);
  } catch (e) { t('_favicon URL built', false, e.message); }

  // ---------- service worker ----------
  try {
    const res = await new Promise(r => { EXT.runtime.sendMessage({ __qa: 'ping' }, () => r(!EXT.runtime.lastError || EXT.runtime.lastError.message)); setTimeout(() => r('timeout'), 2000); });
    t('service worker reachable', res === true || /Receiving end does not exist/.test(res), String(res).slice(0, 60));
  } catch (e) { t('service worker reachable', false, e.message); }

  // ---------- wallpaper: the part Claude cannot see ----------
  try {
    const s = StorageManager.getSettings();
    const d = StorageManager.getData();
    t('wallpaper type', true, s.backgroundType || 'solid');
    t('wallpaper value kind', true, String(s.backgroundValue || '').slice(0, 12) || 'none');
    const wp = d.wallpapers || [];
    t('saved wallpapers <= 5', wp.length <= 5, wp.length + ' saved');

    /* A wallpaper is either an uploaded file (stored as ref: -> data URL) or a
       remote URL the user pasted. Both are valid; only an unresolved ref: or an
       empty value is a real failure. */
    let uploaded = 0, remote = 0; const broken = [];
    for (const w of wp) {
      const src = await StorageManager.resolveMedia(w.value);
      if (/^data:(image|video)\//.test(src || '')) uploaded++;
      else if (/^https?:\/\//i.test(src || '')) remote++;
      else broken.push((w.name || w.id || '?') + ' -> ' + String(src).slice(0, 24));
    }
    t('every saved wallpaper resolves', broken.length === 0,
      broken.join(' | ') || `${uploaded} uploaded, ${remote} remote URL`);
    t('remote wallpapers (each = a third-party request per new tab)', true, remote + ' of ' + wp.length);

    const media = await EXT.storage.local.get('wpmediaIndex');
    const idx = media.wpmediaIndex || [];
    t('media index matches gallery', idx.length >= wp.filter(w => String(w.value).startsWith('ref:')).length,
      `index=${idx.length} gallery=${wp.length}`);

    if (s.backgroundType === 'image' || s.backgroundType === 'video') {
      const el = document.getElementById(s.backgroundType === 'video' ? 'video-bg' : 'photo-bg');
      const cs = getComputedStyle(el);
      t('background layer active', el.classList.contains('active'), 'opacity ' + cs.opacity);
      if (s.backgroundType === 'image') t('background uses cover', cs.backgroundSize === 'cover', cs.backgroundSize);
      if (s.backgroundType === 'video') t('video is playing', !el.paused, `paused=${el.paused} muted=${el.muted} readyState=${el.readyState}`);
    } else { t('background layer active', 'skip', 'solid mode'); }
  } catch (e) { t('wallpaper checks', false, e.message); }

  // ---------- widgets / pins ----------
  try {
    const s = StorageManager.getSettings();
    t('widget flags', true, JSON.stringify(s.widgets));
    t('pins within cap', BookmarkManager.countPinned() <= 5, BookmarkManager.countPinned() + ' pinned');
    t('no legacy board pins', StorageManager.getData().boards.every(b => !('pinnedToHome' in b)));
    const pin = document.querySelector('#homePinned .dock-pin:not(.dock-pin-add)');
    t('pin opens in new tab', !pin || pin.getAttribute('target') === '_blank', pin ? pin.getAttribute('target') : 'no pins');
  } catch (e) { t('widget flags', false, e.message); }

  // ---------- contrast ----------
  try {
    const cs = getComputedStyle(document.documentElement);
    const hex = h => { h = h.trim().replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const L = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const a = cs.getPropertyValue('--accent-color'), k = cs.getPropertyValue('--accent-contrast');
    const L1 = L(hex(a)), L2 = L(hex(k));
    const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    t('accent contrast >= 4.5:1', cr >= 4.5, `${cr.toFixed(2)}:1 (${a.trim()} on ${k.trim()})`);
  } catch (e) { t('accent contrast', false, e.message); }

  await sleep(400);
  console.error = _e; console.warn = _w;
  removeEventListener('error', onErr); removeEventListener('unhandledrejection', onRej);

  const pass = R.filter(x => x.pass).length, skip = R.filter(x => x.skip).length;
  const fail = R.filter(x => !x.pass && !x.skip);
  const out = [
    '===== ESHAALTAB SELF TEST START =====',
    `version ${V}  |  ${new Date().toISOString()}`,
    `${pass} passed, ${fail.length} failed, ${skip} skipped`,
    '',
    ...R.map(x => `${x.skip ? 'SKIP' : x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.detail ? '  [' + x.detail + ']' : ''}`),
    '',
    noise.length ? 'CONSOLE NOISE:' : 'CONSOLE: clean',
    ...noise.map(n => '  ' + n),
    '===== ESHAALTAB SELF TEST END ====='
  ].join('\n');

  console.log(out);
  try { await navigator.clipboard.writeText(out); console.log('(report copied to clipboard)'); } catch { }
  console.log('REPORT COMPLETE');
  return out;
})();
