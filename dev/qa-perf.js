/* EshaalTab performance benchmark.

   Lighthouse cannot audit a chrome-extension:// page, so this measures the same
   class of metrics from inside the running new tab: paint timings, layout
   stability, long tasks, storage latency, render throughput and memory.

   A new tab page is opened dozens of times a day, so the number that matters
   most is time-to-first-paint, not total load.

   HOW TO RUN
   1. Open a new tab (the EshaalTab page).
   2. F12, Console tab.
   3. Paste this whole file, press Enter.
   4. Wait for "BENCHMARK COMPLETE" (about 8 seconds), then paste the report back.

   Read-only. It writes one throwaway storage key and removes it. */

(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
  const rows = [];
  const add = (metric, value, unit, budget, note) => {
    const num = typeof value === 'number' ? round(value) : value;
    const verdict = (budget == null || typeof value !== 'number') ? '' : (value <= budget ? 'OK' : 'OVER');
    rows.push({ metric, value: num, unit, budget: budget == null ? '' : budget, verdict, note: note || '' });
  };

  // ---------- paint + navigation ----------
  const nav = performance.getEntriesByType('navigation')[0];
  const paints = Object.fromEntries(performance.getEntriesByType('paint').map(p => [p.name, p.startTime]));
  add('First Paint', paints['first-paint'] ?? 0, 'ms', 300, 'boot.js paints bg pre-CSS');
  add('First Contentful Paint', paints['first-contentful-paint'] ?? 0, 'ms', 300);
  if (nav) {
    add('DOM Interactive', nav.domInteractive, 'ms', 300);
    add('DOMContentLoaded', nav.domContentLoadedEventEnd, 'ms', 500);
    add('Load complete', nav.loadEventEnd, 'ms', 700);
    add('DOM processing', nav.domComplete - nav.domInteractive, 'ms', 400);
  }

  // ---------- largest contentful paint + layout shift ----------
  let lcp = 0, cls = 0, longTasks = 0, longTaskMs = 0;
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) lcp = e.startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  } catch { }
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
  } catch { }
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) { longTasks++; longTaskMs += e.duration; } })
      .observe({ type: 'longtask', buffered: true });
  } catch { }
  await sleep(600);
  add('Largest Contentful Paint', lcp, 'ms', 800);
  add('Cumulative Layout Shift', round(cls, 3), 'score', 0.1, 'visual stability');
  add('Long tasks (>50ms)', longTasks, 'count', 2);
  add('Long task total', longTaskMs, 'ms', 200, 'main-thread blocking');

  // ---------- payload ----------
  const res = performance.getEntriesByType('resource');
  const bytes = res.reduce((a, r) => a + (r.transferSize || 0), 0);
  const decoded = res.reduce((a, r) => a + (r.decodedBodySize || 0), 0);
  add('Requests', res.length, 'count', 25);
  add('Transferred', bytes / 1024, 'KB', 600);
  add('Decoded', decoded / 1024, 'KB', 1200);
  const thirdParty = res.map(r => r.name).filter(u => /^https?:\/\//.test(u) && !u.startsWith(location.origin));
  add('Third-party requests', thirdParty.length, 'count', 0,
    thirdParty.length ? thirdParty.map(u => new URL(u).host).filter((v, i, a) => a.indexOf(v) === i).join(', ') : 'none');
  const slowest = res.slice().sort((a, b) => b.duration - a.duration)[0];
  add('Slowest resource', slowest ? slowest.duration : 0, 'ms', 300,
    slowest ? slowest.name.split('/').pop().slice(0, 40) : '');

  // ---------- memory + DOM ----------
  if (performance.memory) {
    add('JS heap used', performance.memory.usedJSHeapSize / 1048576, 'MB', 25);
    add('JS heap limit', performance.memory.jsHeapSizeLimit / 1048576, 'MB', null);
  }
  add('DOM nodes', document.getElementsByTagName('*').length, 'count', 1500);
  add('Stylesheet rules', [...document.styleSheets].reduce((a, s) => { try { return a + s.cssRules.length; } catch { return a; } }, 0), 'count', 3000);
  add('Event listeners (approx)', typeof getEventListeners === 'function' ? 'devtools-only' : 'n/a', '', null);

  // ---------- storage latency (the real cost on every new tab) ----------
  try {
    const t0 = performance.now();
    await EXT.storage.local.get(['data', 'settings']);
    add('storage.local read', performance.now() - t0, 'ms', 50, 'blocks first render');

    const payload = { __qa_perf: { blob: 'x'.repeat(200000) } };
    const t1 = performance.now(); await EXT.storage.local.set(payload);
    add('storage.local write 200KB', performance.now() - t1, 'ms', 150);
    await EXT.storage.local.remove('__qa_perf');

    if (EXT.storage.local.getBytesInUse) {
      const used = await EXT.storage.local.getBytesInUse(null);
      add('Storage in use', used / 1048576, 'MB', null);
    }
  } catch (e) { add('storage.local read', 'FAILED', '', null, e.message); }

  // ---------- app render throughput ----------
  const bench = (label, fn, n, budget) => {
    try {
      fn(); // warm
      const t0 = performance.now();
      for (let i = 0; i < n; i++) fn();
      add(label, (performance.now() - t0) / n, 'ms', budget);
    } catch (e) { add(label, 'FAILED', '', null, e.message); }
  };
  bench('applyTheme()', () => SettingsRenderer.applyTheme(), 20, 5);
  bench('renderPinned()', () => HomeRenderer.renderPinned(), 30, 5);
  bench('updateClock(force)', () => WidgetsRenderer.updateClock(true), 30, 3);
  bench('applyWidgetVisibility()', () => WidgetsRenderer.applyWidgetVisibility(), 30, 3);
  bench('searchAll("a")', () => BookmarkManager.searchAll('a'), 30, 5);

  // renderBoards is rAF-driven, so measure the real frame cost
  try {
    const t0 = performance.now();
    BoardRenderer.renderBoards();
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    add('renderBoards() to frame', performance.now() - t0, 'ms', 100,
      `${BoardManager.getAll().length} boards / ${BoardManager.getAll().reduce((a, b) => a + (b.bookmarks || []).length, 0)} links`);
  } catch (e) { add('renderBoards()', 'FAILED', '', null, e.message); }

  // ---------- view switching (perceived responsiveness) ----------
  try {
    const t0 = performance.now();
    for (const v of ['boards', 'notes', 'home']) ViewController.show(v);
    await new Promise(r => requestAnimationFrame(r));
    add('View switch x3', performance.now() - t0, 'ms', 60);
  } catch (e) { add('View switch', 'FAILED', '', null, e.message); }

  // ---------- wallpaper cost ----------
  try {
    const s = StorageManager.getSettings();
    const wp = StorageManager.getData().wallpapers || [];
    let localCount = 0, remoteCount = 0;
    for (const w of wp) {
      if (w.type === 'video') continue;
      String(w.value).startsWith('ref:') ? localCount++ : remoteCount++;
    }
    add('Wallpapers stored locally', localCount, 'count', null);
    add('Wallpapers still remote', remoteCount, 'count', 0, 'each = 1 request per new tab');
    add('Background type', s.backgroundType || 'solid', '', null);
    if (s.backgroundType === 'image' && String(s.backgroundValue).startsWith('ref:')) {
      const t0 = performance.now();
      const src = await StorageManager.resolveMedia(s.backgroundValue);
      add('Wallpaper decode from storage', performance.now() - t0, 'ms', 60,
        src ? round(src.length / 1024) + 'KB data URL' : '');
    }
  } catch (e) { add('Wallpaper cost', 'FAILED', '', null, e.message); }

  await sleep(300);

  // ---------- report ----------
  const w = [Math.max(...rows.map(r => r.metric.length), 6), 10, 6, 7, 7];
  const line = r => [
    r.metric.padEnd(w[0]),
    String(r.value).padStart(w[1]),
    String(r.unit).padEnd(w[2]),
    String(r.budget).padStart(w[3]),
    r.verdict.padEnd(w[4]),
    r.note
  ].join(' ');

  const over = rows.filter(r => r.verdict === 'OVER');
  const out = [
    '===== ESHAALTAB PERF BENCHMARK START =====',
    `${location.protocol}  |  ${new Date().toISOString()}`,
    `${navigator.hardwareConcurrency || '?'} cores  |  ${navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] || 'n/a'}`,
    '',
    ['METRIC'.padEnd(w[0]), 'VALUE'.padStart(w[1]), 'UNIT'.padEnd(w[2]), 'BUDGET'.padStart(w[3]), 'STATUS'.padEnd(w[4]), 'NOTE'].join(' '),
    '-'.repeat(w.reduce((a, b) => a + b, 0) + 10),
    ...rows.map(line),
    '',
    over.length ? `OVER BUDGET (${over.length}): ` + over.map(r => r.metric).join(', ') : 'ALL METRICS WITHIN BUDGET',
    '===== ESHAALTAB PERF BENCHMARK END ====='
  ].join('\n');

  console.log(out);
  try { await navigator.clipboard.writeText(out); console.log('(copied to clipboard)'); } catch { }
  console.log('BENCHMARK COMPLETE');
  return out;
})();
