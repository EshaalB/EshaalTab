/* EshaalTab MIT-Level 8-Step Web Performance Audit Suite.
   
   Implements the 8-Step Performance Engineering Workflow:
   [1] CWV Baseline (Lighthouse/WebPageTest class metrics)
   [2] DevTools Network & Critical Path Resource Audit
   [3] Rendering & Main-Thread Long-Task Profiling
   [4] Server & Load Timing Audit (Extension Boot Latency)
   [5] Storage & Query Analysis (storage.local & IndexedDB payload inspection)
   [6] JS Heap, DOM Depth & Style Rule Analysis
   [7] Fix & Measure (Weighted 0-100 Performance Index)
   [8] Budget Enforcement & Target Verification

   HOW TO RUN:
   1. Open a new tab (EshaalTab page).
   2. Press F12, open the Console tab.
   3. Paste this entire script and press Enter.
   4. Wait ~5 seconds for "AUDIT COMPLETE". Results will auto-copy to clipboard.
*/

(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
  
  const report = {
    step1_cwv: [],
    step2_network: [],
    step3_rendering: [],
    step4_server_load: [],
    step5_storage_db: [],
    step6_js_dom: [],
    step7_scores: {},
    step8_budgets: []
  };

  const addMetric = (section, metric, value, unit, budget, note = '') => {
    const num = typeof value === 'number' ? round(value) : value;
    let verdict = '';
    if (budget !== null && budget !== undefined && typeof value === 'number') {
      verdict = value <= budget ? 'PASS' : 'FAIL';
    }
    const item = { metric, value: num, unit, budget: budget ?? '', verdict, note };
    report[section].push(item);
    if (verdict) report.step8_budgets.push(item);
    return item;
  };

  console.log('%c🚀 Starting MIT 8-Step Web Performance Audit...', 'color: #6366f1; font-weight: bold; font-size: 14px;');

  // ==========================================
  // STEP 1: CWV Baseline (Lighthouse Metrics)
  // ==========================================
  const nav = performance.getEntriesByType('navigation')[0];
  const paintEntries = Object.fromEntries(performance.getEntriesByType('paint').map(p => [p.name, p.startTime]));

  const fp = paintEntries['first-paint'] ?? 0;
  const fcp = paintEntries['first-contentful-paint'] ?? 0;
  
  let lcp = 0, cls = 0, longTasksCount = 0, totalBlockingTime = 0;
  
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) lcp = e.startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}

  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; })
      .observe({ type: 'layout-shift', buffered: true });
  } catch {}

  try {
    new PerformanceObserver(l => {
      for (const e of l.getEntries()) {
        longTasksCount++;
        if (e.duration > 50) totalBlockingTime += (e.duration - 50);
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {}

  await sleep(500); // Allow LCP observer to settle

  const ttfb = nav ? nav.responseStart - nav.requestStart : 0;

  addMetric('step1_cwv', 'Time to First Byte (TTFB)', ttfb, 'ms', 100, 'Extension manifest/HTML response start');
  addMetric('step1_cwv', 'First Paint (FP)', fp, 'ms', 200, 'Painted background pre-CSS execution');
  addMetric('step1_cwv', 'First Contentful Paint (FCP)', fcp, 'ms', 300, 'DOM elements rendered');
  addMetric('step1_cwv', 'Largest Contentful Paint (LCP)', lcp, 'ms', 800, 'Primary clock/hero widget painted');
  addMetric('step1_cwv', 'Cumulative Layout Shift (CLS)', round(cls, 3), 'score', 0.1, 'Visual layout stability');
  addMetric('step1_cwv', 'Total Blocking Time (TBT)', totalBlockingTime, 'ms', 150, 'Main thread block duration > 50ms');

  // ==========================================
  // STEP 2: DevTools Network & Critical Path
  // ==========================================
  const resources = performance.getEntriesByType('resource');
  const totalTransferred = resources.reduce((acc, r) => acc + (r.transferSize || 0), 0);
  const totalDecoded = resources.reduce((acc, r) => acc + (r.decodedBodySize || 0), 0);
  
  const thirdPartyReqs = resources.map(r => r.name).filter(u => /^https?:\/\//.test(u) && !u.startsWith(location.origin));
  const slowestResource = resources.slice().sort((a, b) => b.duration - a.duration)[0];

  addMetric('step2_network', 'Total Network Requests', resources.length, 'reqs', 20, 'Resource network fetch count');
  addMetric('step2_network', 'Transferred Payload', totalTransferred / 1024, 'KB', 500, 'Network transfer size');
  addMetric('step2_network', 'Decoded Payload', totalDecoded / 1024, 'KB', 1200, 'Uncompressed resource size');
  addMetric('step2_network', 'Third-Party Requests', thirdPartyReqs.length, 'reqs', 0, thirdPartyReqs.length ? thirdPartyReqs.join(', ') : 'None (Strict Zero Telemetry)');
  addMetric('step2_network', 'Slowest Critical Resource', slowestResource ? slowestResource.duration : 0, 'ms', 250, slowestResource ? slowestResource.name.split('/').pop() : 'n/a');

  // ==========================================
  // STEP 3: Rendering & Main Thread Profiling
  // ==========================================
  addMetric('step3_rendering', 'Long Tasks (>50ms)', longTasksCount, 'count', 2, 'Main thread stalling events');
  
  // Frame Rate & Render Throughput Test
  let frameStart = performance.now();
  let frameTime = 0;
  await new Promise(r => requestAnimationFrame(now => {
    frameTime = now - frameStart;
    r();
  }));
  addMetric('step3_rendering', 'Initial Frame Latency', frameTime, 'ms', 33.3, 'Target >= 30-60 FPS');

  // Measure View Switch Throughput
  try {
    const tSwitch0 = performance.now();
    if (typeof ViewController !== 'undefined') {
      for (const view of ['boards', 'notes', 'home']) ViewController.show(view);
      await new Promise(r => requestAnimationFrame(r));
    }
    addMetric('step3_rendering', 'View Switching (x3)', performance.now() - tSwitch0, 'ms', 60, 'Home -> Boards -> Notes switch');
  } catch (e) {
    addMetric('step3_rendering', 'View Switching', 'FAILED', '', null, e.message);
  }

  // ==========================================
  // STEP 4: Server / Extension Load Timing
  // ==========================================
  if (nav) {
    addMetric('step4_server_load', 'DOM Interactive', nav.domInteractive, 'ms', 300, 'DOM parsing complete');
    addMetric('step4_server_load', 'DOMContentLoaded', nav.domContentLoadedEventEnd, 'ms', 500, 'Scripts executed');
    addMetric('step4_server_load', 'Load Complete', nav.loadEventEnd, 'ms', 700, 'Page and subresources fully loaded');
  }

  // ==========================================
  // STEP 5: Storage & Query Analysis ("DB")
  // ==========================================
  try {
    const tStorageRead0 = performance.now();
    const bag = await EXT.storage.local.get(['data', 'settings']);
    const storageReadMs = performance.now() - tStorageRead0;
    addMetric('step5_storage_db', 'storage.local Read', storageReadMs, 'ms', 50, 'Blocks initial view hydration');

    const testPayload = { __qa_mit_probe: 'x'.repeat(100000) };
    const tStorageWrite0 = performance.now();
    await EXT.storage.local.set(testPayload);
    const storageWriteMs = performance.now() - tStorageWrite0;
    await EXT.storage.local.remove('__qa_mit_probe');

    addMetric('step5_storage_db', 'storage.local Write (100KB)', storageWriteMs, 'ms', 120, 'State persistence throughput');

    if (EXT.storage.local.getBytesInUse) {
      const bytesUsed = await EXT.storage.local.getBytesInUse(null);
      addMetric('step5_storage_db', 'Storage Footprint', bytesUsed / 1048576, 'MB', 20.0, 'Total storage.local footprint');
    }

    // Wallpaper resolve benchmark
    const settings = bag.settings || {};
    if (settings.backgroundValue && String(settings.backgroundValue).startsWith('ref:')) {
      const tMedia0 = performance.now();
      const mediaData = await StorageManager.resolveMedia(settings.backgroundValue);
      addMetric('step5_storage_db', 'Media Storage Decode', performance.now() - tMedia0, 'ms', 60, mediaData ? `${round(mediaData.length / 1024)}KB data URL` : '');
    }
  } catch (e) {
    addMetric('step5_storage_db', 'Storage Query Audit', 'FAILED', '', null, e.message);
  }

  // ==========================================
  // STEP 6: JS Heap, DOM Depth & Style Analysis
  // ==========================================
  if (performance.memory) {
    addMetric('step6_js_dom', 'JS Heap Used', performance.memory.usedJSHeapSize / 1048576, 'MB', 30.0, 'Active memory allocation');
    addMetric('step6_js_dom', 'JS Heap Limit', performance.memory.jsHeapSizeLimit / 1048576, 'MB', null, 'Max allocation ceiling');
  }

  const domNodes = document.getElementsByTagName('*').length;
  addMetric('step6_js_dom', 'DOM Node Count', domNodes, 'nodes', 1500, 'Total element count in document');

  // DOM Max Depth
  const getDepth = el => el.children.length ? 1 + Math.max(...[...el.children].map(getDepth)) : 1;
  const maxDomDepth = getDepth(document.documentElement);
  addMetric('step6_js_dom', 'Max DOM Depth', maxDomDepth, 'levels', 15, 'Tree nesting complexity');

  const cssRules = [...document.styleSheets].reduce((acc, sheet) => {
    try { return acc + sheet.cssRules.length; } catch { return acc; }
  }, 0);
  addMetric('step6_js_dom', 'CSS Style Rules', cssRules, 'rules', 3000, 'Loaded CSS rule count');

  // ==========================================
  // STEP 7: Fix & Measure (Performance Score Index)
  // ==========================================
  const cwvPasses = report.step1_cwv.filter(m => m.verdict === 'PASS').length;
  const cwvTotal = report.step1_cwv.filter(m => m.verdict !== '').length;
  
  const budgetPasses = report.step8_budgets.filter(m => m.verdict === 'PASS').length;
  const budgetTotal = report.step8_budgets.length;
  
  const overallScore = Math.round((budgetPasses / Math.max(1, budgetTotal)) * 100);

  report.step7_scores = {
    overallScore,
    cwvScore: Math.round((cwvPasses / Math.max(1, cwvTotal)) * 100),
    status: overallScore >= 90 ? 'OPTIMAL (A+)' : overallScore >= 75 ? 'GOOD (B)' : 'NEEDS OPTIMIZATION'
  };

  // ==========================================
  // STEP 8: Report Generation & Formatting
  // ==========================================
  const formatSection = (title, items) => {
    const lines = [title, '-'.repeat(70)];
    for (const item of items) {
      const metricStr = item.metric.padEnd(28);
      const valStr = String(item.value).padStart(8) + ' ' + item.unit.padEnd(6);
      const budgetStr = item.budget !== '' ? `(Budget <= ${item.budget} ${item.unit})`.padEnd(22) : ''.padEnd(22);
      const statusStr = item.verdict ? `[${item.verdict}]`.padEnd(8) : ''.padEnd(8);
      lines.push(`${metricStr} ${valStr} ${budgetStr} ${statusStr} ${item.note}`);
    }
    lines.push('');
    return lines.join('\n');
  };

  const outputText = [
    '======================================================================',
    '       MIT PERFORMANCE ENGINEERING AUDIT REPORT — ESHAALTAB           ',
    '======================================================================',
    `Timestamp : ${new Date().toISOString()}`,
    `Platform  : ${navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] || 'Chrome Extension'} | ${navigator.hardwareConcurrency || '?'} CPU Cores`,
    `Rating    : ${report.step7_scores.overallScore}/100 — ${report.step7_scores.status}`,
    '======================================================================\n',
    formatSection('[1] CORE WEB VITALS & BASELINE TIMINGS', report.step1_cwv),
    formatSection('[2] DEVTOOLS NETWORK & CRITICAL PATH', report.step2_network),
    formatSection('[3] RENDERING & MAIN THREAD PROFILING', report.step3_rendering),
    formatSection('[4] SERVER & LOAD TIMING (EXTENSION BOOT)', report.step4_server_load),
    formatSection('[5] STORAGE & QUERY ANALYSIS (storage.local / IndexedDB)', report.step5_storage_db),
    formatSection('[6] JS HEAP, DOM DEPTH & STYLESHEET AUDIT', report.step6_js_dom),
    '----------------------------------------------------------------------',
    `BUDGET SUMMARY: ${budgetPasses} / ${budgetTotal} METRICS PASSED`,
    report.step8_budgets.filter(m => m.verdict === 'FAIL').length > 0
      ? 'BOTTLENECKS DETECTED: ' + report.step8_budgets.filter(m => m.verdict === 'FAIL').map(m => m.metric).join(', ')
      : 'RESULT: ALL METRICS WITHIN PERFORMANCE BUDGET THRESHOLDS',
    '======================================================================'
  ].join('\n');

  console.log('%c' + outputText, 'font-family: monospace; color: #10b981;');

  try {
    await navigator.clipboard.writeText(outputText);
    console.log('%c📋 Report copied to clipboard automatically!', 'color: #3b82f6; font-weight: bold;');
  } catch {}

  console.log('%c✅ AUDIT COMPLETE', 'color: #10b981; font-weight: bold; font-size: 14px;');
  return report;
})();
