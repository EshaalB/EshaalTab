/* Home surface: toasts, pomodoro flip-clock with presets, clock/greeting,
   search bar with switchable engines and voice input, weather (coordinates and
   reading cached in storage so a new tab makes no network call), Google apps
   launcher built on first open, todo popover, notepad and clipboard snippets. */
'use strict';

const todayKey = () => new Date().toLocaleDateString('sv');

const ToastSystem = (() => {
  const MAX_TOASTS = 3;

  function show(message, type = 'info', duration = 3000) {
    const container = $('toastContainer');
    if (!container) return;

    // Anti-spam deduplication: update existing active toast if text matches
    const existing = [...container.querySelectorAll('.toast-msg')].find(
      t => t.dataset.msg === message && !t.classList.contains('is-exiting')
    );

    if (existing) {
      if (existing.__timer) clearTimeout(existing.__timer);
      existing.classList.remove('toast-pulse');
      void existing.offsetWidth; // force reflow
      existing.classList.add('toast-pulse');
      if (duration > 0) existing.__timer = setTimeout(() => dismiss(existing), duration);
      return createController(existing);
    }

    // Limit active toasts
    const activeToasts = container.querySelectorAll('.toast-msg:not(.is-exiting)');
    if (activeToasts.length >= MAX_TOASTS) {
      dismiss(activeToasts[0]);
    }

    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    toast.dataset.msg = message;

    const iconSvg = getToastIcon(type);
    setSafeHTML(toast, `
      <span class="toast-icon ${type === 'loading' ? 'is-spinning' : ''}">${iconSvg}</span>
      <span class="toast-text">${escapeHtml(message)}</span>
    `);

    container.appendChild(toast);

    if (duration > 0) {
      toast.__timer = setTimeout(() => dismiss(toast), duration);
      toast.addEventListener('mouseenter', () => {
        if (toast.__timer) clearTimeout(toast.__timer);
      });
      toast.addEventListener('mouseleave', () => {
        toast.__timer = setTimeout(() => dismiss(toast), 1500);
      });
    }

    return createController(toast);
  }

  function createController(toast) {
    return {
      dismiss: () => dismiss(toast),
      update: (newMsg, newType = 'success', newDuration = 3000) => {
        if (!toast || !toast.parentNode) return;
        toast.className = `toast-msg ${newType}`;
        toast.dataset.msg = newMsg;
        const iconEl = toast.querySelector('.toast-icon');
        const textEl = toast.querySelector('.toast-text');
        if (iconEl) {
          iconEl.className = `toast-icon ${newType === 'loading' ? 'is-spinning' : ''}`;
          setSafeHTML(iconEl, getToastIcon(newType));
        }
        if (textEl) textEl.textContent = newMsg;
        if (toast.__timer) clearTimeout(toast.__timer);
        if (newDuration > 0) {
          toast.__timer = setTimeout(() => dismiss(toast), newDuration);
        }
      }
    };
  }

  function action(message, actionLabel, onAction, type = 'info', duration = 6000) {
    const container = $('toastContainer');
    if (!container) return;

    const activeToasts = container.querySelectorAll('.toast-msg:not(.is-exiting)');
    if (activeToasts.length >= MAX_TOASTS) {
      dismiss(activeToasts[0]);
    }

    const toast = document.createElement('div');
    toast.className = `toast-msg ${type} has-action`;
    toast.dataset.msg = message;

    const iconSvg = getToastIcon(type);
    setSafeHTML(toast, `
      <span class="toast-icon">${iconSvg}</span>
      <span class="toast-text">${escapeHtml(message)}</span>
      <button class="toast-action-btn">${escapeHtml(actionLabel)}</button>
    `);

    container.appendChild(toast);

    if (duration > 0) {
      toast.__timer = setTimeout(() => dismiss(toast), duration);
    }

    const btn = toast.querySelector('.toast-action-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        onAction();
        dismiss(toast);
      });
    }

    toast.addEventListener('mouseenter', () => {
      if (toast.__timer) clearTimeout(toast.__timer);
    });

    toast.addEventListener('mouseleave', () => {
      toast.__timer = setTimeout(() => dismiss(toast), 2000);
    });

    return createController(toast);
  }

  function dismiss(toast) {
    if (!toast || toast.classList.contains('is-exiting')) return;
    toast.classList.add('is-exiting');
    if (toast.__timer) clearTimeout(toast.__timer);
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 240);
  }

  function getToastIcon(type) {
    if (type === 'success') {
      return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    }
    if (type === 'error') {
      return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    }
    if (type === 'warning') {
      return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    }
    if (type === 'info') {
      return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }
    if (type === 'loading') {
      return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>';
    }
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>';
  }

  return {
    show, action, dismiss,
    default: (msg, dur) => show(msg, 'default', dur),
    success: (msg, dur) => show(msg, 'success', dur),
    error: (msg, dur) => show(msg, 'error', dur),
    warning: (msg, dur) => show(msg, 'warning', dur),
    warn: (msg, dur) => show(msg, 'warning', dur),
    info: (msg, dur) => show(msg, 'info', dur),
    loading: (msg) => show(msg, 'loading', 0)
  };
})();

const PomodoroMode = (() => {
  const overlay = $('pomodoroOverlay');
  const closeBtn = $('pomodoroCloseBtn');
  const flipClock = $('pomoFlipClock');
  const statusText = $('pomoStatusText');
  const sessionsCount = $('pomoSessionsCount');
  const resetBtn = $('pomoResetBtn');
  const minTop = $('pomoMinTop');
  const minBottom = $('pomoMinBottom');
  const secTop = $('pomoSecTop');
  const secBottom = $('pomoSecBottom');

  let workDuration = 25 * 60;
  let timeLeft = workDuration;
  let running = false;
  let intervalId = null;

  function init() {
    if (!overlay) return;
    closeBtn?.addEventListener('click', exit);
    flipClock?.addEventListener('click', toggle);
    resetBtn?.addEventListener('click', reset);

    $$('#pomoPresetRow .et-pomo-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#pomoPresetRow .et-pomo-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $('pomoCustomInput').value = '';
        const mins = parseInt(btn.dataset.mins, 10) || 25;
        workDuration = mins * 60;
        timeLeft = workDuration;
        reset();
      });
    });

    const customInput = $('pomoCustomInput');
    if (customInput) {
      customInput.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10);
        if (val > 0 && val <= 999) {
          $$('#pomoPresetRow .et-pomo-preset-btn').forEach(b => b.classList.remove('active'));
          workDuration = val * 60;
          timeLeft = workDuration;
          reset();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (!overlay.classList.contains('open')) return;
      if (!e.key) return;                       // some IME events have no key
      if (e.key === ' ') { e.preventDefault(); toggle(); }
      if (e.key.toLowerCase() === 'r') reset();
    });

    restore();
    updateDisplay();
    updateSessions();
  }

  function persistState() {
    const d = StorageManager.getData();
    d.pomodoro = running
      ? { running: true, endsAt: Date.now() + timeLeft * 1000, workDuration }
      : { running: false, timeLeft, workDuration };
    StorageManager.save();
  }

  function restore() {
    const p = StorageManager.getData().pomodoro;
    if (!p || typeof p !== 'object') return;
    if (typeof p.workDuration === 'number' && p.workDuration > 0) {
      workDuration = p.workDuration;
      const btn = document.querySelector(`#pomoPresetRow .et-pomo-preset-btn[data-mins="${Math.round(workDuration / 60)}"]`);
      if (btn) { $$('#pomoPresetRow .et-pomo-preset-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); }
    }
    if (p.running && p.endsAt) {
      const left = Math.round((p.endsAt - Date.now()) / 1000);
      if (left > 0) { timeLeft = left; start(); return; }
      timeLeft = workDuration;
    } else if (typeof p.timeLeft === 'number' && p.timeLeft > 0) {
      timeLeft = p.timeLeft;
      if (statusText) statusText.textContent = 'Paused';
    }
  }

  function updateRunningUI() {
    if (overlay) {
      overlay.classList.toggle('is-running', running);
    }
  }

  function enter() { if (!overlay) return; overlay.classList.add('open'); updateSessions(); updateRunningUI(); }
  function exit() { if (!overlay) return; overlay.classList.remove('open'); pause(); }
  function toggle() { if (running) pause(); else start(); }
  function start() {
    running = true;
    updateRunningUI();
    if (statusText) statusText.textContent = 'Focusing';
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => { timeLeft--; updateDisplay(); if (timeLeft <= 0) complete(); }, 1000);
    updateDisplay();
    persistState();
  }
  function pause() {
    const was = running;
    running = false;
    updateRunningUI();
    if (statusText) statusText.textContent = 'Paused';
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    if (was) persistState();
  }
  function reset() {
    pause();
    timeLeft = workDuration;
    if (statusText) statusText.textContent = 'Press space to start';
    updateDisplay();
    updateRunningUI();
    persistState();
    // Reset only touches the countdown, never completed-session history, but
    // the topbar badge and in-modal count only refreshed on complete() -- so
    // a stale count from an earlier day/session could sit on screen through
    // a reset instead of re-syncing against today's real data.
    updateSessions();
    WidgetsRenderer.initFocusStats();
  }
  function complete() {
    pause();
    const today = todayKey();
    const data = StorageManager.getData();
    if (!data.focus) data.focus = {};
    data.focus[today] = (data.focus[today] || 0) + 1;
    StorageManager.save();
    updateSessions();
    WidgetsRenderer.initFocusStats();
    playChime();
    if (statusText) statusText.textContent = 'Session complete';
    timeLeft = workDuration;
    updateDisplay();
    updateRunningUI();
    ToastSystem.success('Session complete');
  }
  function updateDisplay() {
    const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
    const secs = String(timeLeft % 60).padStart(2, '0');
    if (minTop) minTop.textContent = mins;
    if (minBottom) minBottom.textContent = mins;
    if (secTop) secTop.textContent = secs;
    if (secBottom) secBottom.textContent = secs;
  }
  function updateSessions() {
    if (!sessionsCount) return;
    const today = todayKey();
    const data = StorageManager.getData();
    const count = (data.focus && data.focus[today]) || 0;
    sessionsCount.textContent = count ? `${count} session${count === 1 ? '' : 's'} today` : 'No sessions yet today';
  }
  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 800; osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.8);
    } catch { }
  }
  return { init, enter, exit };
})();

const WidgetsRenderer = (() => {
  let clockInterval = null;
  let lastClockKey = '';

  const WEATHER_TTL = 30 * 60 * 1000;
  const weatherCache = {
    read() {
      const c = StorageManager.getData().weatherCache;
      return (c && typeof c === 'object') ? c : null;
    },
    write(patch) {
      const d = StorageManager.getData();
      d.weatherCache = { ...(d.weatherCache || {}), ...patch };
      StorageManager.save();
    },

    coordsFor(city) {
      const c = weatherCache.read();
      return (c && c.city === city && c.lat != null) ? c : null;
    },
    readingFor(city, unit) {
      const c = weatherCache.coordsFor(city);
      return (c && c.data && c.unit === unit) ? c : null;
    },
    freshFor(city, unit) {
      const c = weatherCache.readingFor(city, unit);
      return (c && (Date.now() - (c.time || 0) < WEATHER_TTL)) ? c : null;
    }
  };

  function init() {
    initClock();
    initWeather();
    initFocusStats();
    initNavSearch();
    PomodoroMode.init();
    applyWidgetVisibility();
  }

  function initClock() {
    updateClock();
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(updateClock, 1000);
  }
  function updateClock(force) {
    const dateEl = $('clockDate');
    const timeEl = $('clockTime');
    const greetingEl = $('clockGreeting');
    if (!dateEl || !timeEl) return;
    const now = new Date();

    const pref = StorageManager.getSettings().use12h;
    const hour12 = pref === true ? true : (pref === false ? false : undefined);

    const nameVal = (StorageManager.getSettings().displayName || '').trim();
    const key = `${now.getHours()}:${now.getMinutes()}|${hour12}|${now.toDateString()}|${nameVal}`;
    if (!force && key === lastClockKey) return;
    lastClockKey = key;

    if (greetingEl) {
      const hrs = now.getHours();
      let iconName = 'sun';
      let greetingText = 'Good morning';
      if (hrs >= 12 && hrs < 17) {
        iconName = 'sun';
        greetingText = 'Good afternoon';
      } else if (hrs >= 17 && hrs < 22) {
        iconName = 'sunset';
        greetingText = 'Good evening';
      } else if (hrs >= 22 || hrs < 5) {
        iconName = 'moon';
        greetingText = 'Good night';
      }
      const name = (StorageManager.getSettings().displayName || '').trim();
      const fullText = name ? `${greetingText}, ${name}` : greetingText;
      setSafeHTML(greetingEl, `<span class="greeting-icon">${icon(iconName, 24)}</span><span>${escapeHtml(fullText)}</span>`);
    }

    dateEl.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(now);

    const parts = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12 }).formatToParts(now);
    let main = '', period = '';
    for (const p of parts) {
      if (p.type === 'dayPeriod') period = p.value;
      else main += p.value;
    }
    main = main.trim();
    const formattedMain = escapeHtml(main).replace(':', '<span class="clock-colon" aria-hidden="true">:</span>');
    setSafeHTML(timeEl, period
      ? `<span class="clock-digits">${formattedMain}</span><span class="clock-ampm">${escapeHtml(period)}</span>`
      : `<span class="clock-digits">${formattedMain}</span>`);
  }

  function initFocusStats() {
    const btn = $('pomoToggleBtn');
    if (!btn) return;
    const today = todayKey();
    const data = StorageManager.getData();
    const count = (data.focus && data.focus[today]) || 0;
    const countEl = $('pomoToggleCount');
    if (countEl) {
      countEl.textContent = count;
      countEl.style.display = count > 0 ? 'flex' : 'none';
    }
    btn.onclick = () => PomodoroMode.enter();
  }

  /* 'default' used to hardcode a Google search URL and call it "Default" --
     that silently overrode whatever search engine the user actually configured
     in Chrome, which is exactly what the Chrome Web Store's Single Purpose /
     search-override policy prohibits for a new-tab extension. It now routes
     through chrome.search.query() (see searchWithDefaultEngine below), which
     asks Chrome to run the query with the browser's real default engine. The
     named engines below (ChatGPT, Claude, DuckDuckGo, ...) are unaffected --
     picking one of those is an explicit user choice, not a silent override,
     so they keep their direct URLs. The url() fn here is only the last-resort
     fallback if chrome.search / browser.search is unavailable. */
  const ENGINES = {
      default:    { name: 'Default (Browser)', useSystemDefault: true, url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
      chatgpt:    { name: 'ChatGPT',    ask: true, url: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
      claude:     { name: 'Claude',     ask: true, url: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}` },
      gemini:     { name: 'Gemini',     ask: true, url: (q) => `https://gemini.google.com/app?q=${encodeURIComponent(q)}` },
      research:   { name: 'Research',   ask: true, url: (q) => `https://search.brave.com/ask?enable_research=true&q=${encodeURIComponent(q)}` },
      perplexity: { name: 'Perplexity', ask: true, url: (q) => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}` },
      duckduckgo: { name: 'DuckDuckGo', url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
    youtube:    { name: 'YouTube',    url: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` }
  };
  const hintFor = (key) => {
    const e = ENGINES[key] || ENGINES.default;
    return e.ask ? `Ask ${e.name} or type a URL…` : `Search ${e.name} or type a URL…`;
  };

  /* Asks the browser to run the query with whatever engine the user actually
     has set as their default -- chrome.search.query() on Chromium, the
     equivalent browser.search.search() on Firefox. Returns true if one of
     those APIs handled it; the caller only falls back to a hardcoded engine
     if neither exists (e.g. this build's dev/localhost preview). */
  function searchWithDefaultEngine(query) {
    try {
      if (HAS_EXT && EXT.search && typeof EXT.search.query === 'function') {
        EXT.search.query({ text: query, disposition: 'NEW_TAB' });
        return true;
      }
      if (HAS_EXT && EXT.search && typeof EXT.search.search === 'function') {
        EXT.search.search({ query, disposition: 'NEW_TAB' });
        return true;
      }
    } catch { }
    return false;
  }

  function initNavSearch() {
    const bar = $('navSearchBar');
    if (!bar) return;

    const settings = StorageManager.getSettings();
    const enabledList = settings.enabledEngines || Object.keys(ENGINES);
    const availableEngines = Object.entries(ENGINES).filter(([k]) => enabledList.includes(k));
    const renderEngines = availableEngines.length ? availableEngines : Object.entries(ENGINES);
    let currentEngineKey = ENGINES[settings.searchEngine] ? settings.searchEngine : 'default';

    setSafeHTML(bar, `
      <div class="et-search-pill" style="position:relative;">
        <button class="et-search-engine" id="nsbEngLogo" data-no-tooltip aria-haspopup="listbox" aria-expanded="false">
          <span class="et-search-engine-name">${escapeHtml((ENGINES[currentEngineKey] || ENGINES.default).name)}</span>
          <svg class="et-search-engine-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="nsb-eng-menu" id="nsbEngMenu" role="listbox">
          ${renderEngines.map(([key, eng]) => `
            <div class="et-search-opt ${key === currentEngineKey ? 'active' : ''}" data-engine="${key}" role="option" aria-selected="${key === currentEngineKey}">
              <span>${escapeHtml(eng.name)}</span>
            </div>
          `).join('')}
        </div>
        <input type="text" class="et-search-input" id="nsbInput" placeholder="${hintFor(currentEngineKey)}" autocomplete="off" spellcheck="false" />
        <button class="et-search-btn et-search-submit" id="nsbSearchBtn" title="Search">
          ${icon('search', 16)}
          <span class="search-btn-label">Search</span>
        </button>
      </div>`);

    const input = $('nsbInput');
    const logoBtn = $('nsbEngLogo');
    const menu = $('nsbEngMenu');
    const searchBtn = $('nsbSearchBtn');

    bar.addEventListener('mousedown', (e) => {
      if (input && !e.target.closest('button')) { e.preventDefault(); input.focus(); }
    });

    if (logoBtn && menu) {
      let closeTimeout = null;

      const pill = logoBtn.closest('.et-search-pill') || bar;
      const openMenu = () => {
        if (closeTimeout) clearTimeout(closeTimeout);
        menu.classList.add('open');
        if (pill) pill.classList.add('menu-open');
        logoBtn.setAttribute('aria-expanded', 'true');
        logoBtn.classList.add('active');
      };

      const closeMenu = (immediate = false) => {
        if (closeTimeout) clearTimeout(closeTimeout);
        const resetState = () => {
          menu.classList.remove('open');
          if (pill) pill.classList.remove('menu-open');
          logoBtn.setAttribute('aria-expanded', 'false');
          logoBtn.classList.remove('active');
        };
        if (immediate) {
          resetState();
        } else {
          closeTimeout = setTimeout(resetState, 200);
        }
      };

      logoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (menu.classList.contains('open')) closeMenu(true);
        else openMenu();
      });

      logoBtn.addEventListener('mouseenter', openMenu);
      menu.addEventListener('mouseenter', openMenu);

      logoBtn.addEventListener('mouseleave', () => closeMenu(false));
      menu.addEventListener('mouseleave', () => closeMenu(false));

      document.addEventListener('click', (e) => {
        if (!logoBtn.contains(e.target) && !menu.contains(e.target)) {
          closeMenu(true);
        }
      });

      menu.querySelectorAll('.et-search-opt').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const engKey = opt.dataset.engine;
          if (ENGINES[engKey]) {
            currentEngineKey = engKey;
            settings.searchEngine = engKey;
            StorageManager.save();
            logoBtn.querySelector('.et-search-engine-name').textContent = ENGINES[engKey].name;
            input.placeholder = hintFor(engKey);
            menu.querySelectorAll('.et-search-opt').forEach(o => {
              const on = o.dataset.engine === engKey;
              o.classList.toggle('active', on);
              o.setAttribute('aria-selected', on);
            });
            closeMenu(true);
            input.focus();
          }
        });
      });
    }

    const executeSearch = () => {
      const val = input ? input.value.trim() : '';
      if (!val) return;
      const isUrl = /^https?:\/\//i.test(val) || /^localhost(:[0-9]+)?/i.test(val) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\/?.*/i.test(val);

      if (isUrl) {
        const targetUrl = /^https?:\/\//i.test(val) ? val : 'https://' + val;
        if (HAS_EXT && EXT.tabs && EXT.tabs.create) EXT.tabs.create({ url: targetUrl, active: true });
        else window.open(targetUrl, '_blank');
        input.value = '';
        return;
      }

      const eng = ENGINES[currentEngineKey] || ENGINES.default;
      if (eng.useSystemDefault && searchWithDefaultEngine(val)) {
        input.value = '';
        return;
      }

      // Only reached for a named engine (ChatGPT, DuckDuckGo, ...), or as the
      // last-resort fallback if chrome.search/browser.search isn't available.
      const targetUrl = eng.url(val);
      if (HAS_EXT && EXT.tabs && EXT.tabs.create) EXT.tabs.create({ url: targetUrl, active: true });
      else window.open(targetUrl, '_blank');
      input.value = '';
    };

    if (searchBtn) searchBtn.addEventListener('click', executeSearch);

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') executeSearch();
      });
    };
  }

  function initWeather() {
    const weatherEl = $('weatherWidget');
    if (!weatherEl) return;

    weatherEl.onclick = () => {
      const s = StorageManager.getSettings();
      showPrompt('Weather Location', 'Enter city name for weather:', s.weatherCity || '', (val) => {
        if (val !== null && val.trim()) {
          s.weatherCity = val.trim();
          s.widgets.weather = true;
          StorageManager.save();
          initWeather();
          applyWidgetVisibility();
          ToastSystem.success(`Weather city set to ${val.trim()}`);
        }
      });
    };

    const settings = StorageManager.getSettings();
    if (!settings.weatherCity) {
      setSafeHTML(weatherEl, `${icon('weatherSun', 16)} <span>Set City</span>`);
      return;
    }
    const unit = settings.weatherUnit === 'f' ? 'f' : 'c';
    const fresh = weatherCache.freshFor(settings.weatherCity, unit);
    if (fresh) {
      renderWeatherData(fresh.data, fresh.name || settings.weatherCity);
      return;
    }
    fetchWeather(settings.weatherCity, unit);
  }

  async function fetchWeather(city, unit) {
    const weatherEl = $('weatherWidget');
    if (!weatherEl) return;
    const cleanCity = String(city || '').trim();
    if (!cleanCity) {
      setSafeHTML(weatherEl, `${icon('weatherSun', 16)} <span>Set City in Settings</span>`);
      return;
    }
    try {
      let coords = weatherCache.coordsFor(cleanCity);
      if (!coords) {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=1&language=en&format=json`);
        const geoData = await geoRes.json();
        if (!geoData.results || !geoData.results.length) {
          setSafeHTML(weatherEl, `${icon('weatherSun', 16)} <span>City Not Found</span>`);
          return;
        }
        const { latitude, longitude, name } = geoData.results[0];

        coords = { city: cleanCity, lat: latitude, lon: longitude, name, data: null, time: 0 };
        weatherCache.write(coords);
      }

      const unitParam = unit === 'f' ? '&temperature_unit=fahrenheit' : '';
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true${unitParam}`);
      const weatherData = await weatherRes.json();
      weatherCache.write({ data: weatherData, unit, time: Date.now() });
      renderWeatherData(weatherData, coords.name || city);
    } catch (e) {
      const stale = weatherCache.readingFor(city, unit);
      if (stale) renderWeatherData(stale.data, stale.name || city);
      else setSafeHTML(weatherEl, `${icon('weatherSun', 16)} <span>Offline</span>`);
    }
  }
  function renderWeatherData(weatherData, name) {
    const weatherEl = $('weatherWidget');
    if (!weatherEl || !weatherData.current_weather) return;
    const current = weatherData.current_weather;
    const settings = StorageManager.getSettings();
    const unitSymbol = settings.weatherUnit === 'f' ? '°F' : '°C';
    const temp = Math.round(current.temperature);
    const code = current.weathercode;
    let iconName = 'weatherSun';
    if (code >= 1 && code <= 3) iconName = 'weatherCloud';
    else if (code >= 51 && code <= 67) iconName = 'weatherRain';
    else if (code >= 71 && code <= 77) iconName = 'weatherSnow';
    else if (code >= 95) iconName = 'weatherStorm';

    setSafeHTML(weatherEl, `${icon(iconName, 16)} <span>${temp}${unitSymbol} ${escapeHtml(name)}</span>`);
  }

  function applyWidgetVisibility() {
    const s = StorageManager.getSettings();
    const w = s.widgets || {};
    const clock = $('clockWidget');
    const search = $('navSearchBar');
    const weather = $('weatherWidget');
    const pinned = $('homePinned');
    const workspace = $('workspaceBtn');
    /* The todo toggle used to read $('pomoToggleBtn'), so it hid the Pomodoro
       button while leaving the todo button on screen. That is why only the first
       widget you switched off appeared to close. */
    const todo = $('todoWidgetBtn');

    if (clock) clock.style.display = w.clock !== false ? '' : 'none';
    if (search) search.style.display = w.navSearch !== false ? '' : 'none';
    if (weather) weather.style.display = w.weather ? '' : 'none';
    if (workspace) workspace.style.display = w.workspace !== false ? '' : 'none';
    if (todo) {
      const on = w.todo !== false;
      todo.style.display = on ? '' : 'none';
      if (!on) TodoWidget.close();
    }
    if (pinned) pinned.style.display = s.hidePinnedOnHome ? 'none' : 'flex';
    document.body.classList.toggle('hide-pinned-home', !!s.hidePinnedOnHome);

    const pos = s.clockPosition || 'auto';
    document.body.classList.toggle('clock-pos-corner', pos === 'corner');
    document.body.classList.toggle('clock-pos-center', pos === 'center');

    applyClockAppearance(s);
  }

  /* Only fonts that actually render are offered. The bundled faces are Orbitron
     and Caveat; everything else resolves to a system stack that exists on every
     platform. The previous list advertised Inter/Jakarta/Outfit/Space Grotesk,
     none of which are loaded and none of which had an entry here -- they all
     silently fell back to Orbitron, and the storage whitelist then wiped the
     choice on reload. That is why "some clock fonts do nothing".

     Weight is part of the identity, not just the family: an iOS/Android lock
     screen clock is thin and wide-tracked, which is what makes it read as a
     clock rather than a heading. Orbitron 700 is the deliberately heavy one. */
  const CLOCK_FONT_STACKS = {
    default:  { stack: "'Orbitron', var(--font-app, sans-serif)", weight: 700, spacing: '0.02em' },
    thin:     { stack: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Segoe UI', sans-serif", weight: 200, spacing: '-0.02em' },
    light:    { stack: "'Roboto', 'Segoe UI', system-ui, -apple-system, sans-serif", weight: 300, spacing: '-0.01em' },
    app:      { stack: 'var(--font-app, sans-serif)', weight: 600, spacing: 'normal' },
    serif:    { stack: "'Lora', Georgia, 'Times New Roman', serif", weight: 400, spacing: 'normal' },
    mono:     { stack: "'JetBrains Mono', ui-monospace, Consolas, monospace", weight: 400, spacing: '-0.03em' },
    handwriting: { stack: "'Caveat', cursive", weight: 700, spacing: 'normal' }
  };

  /* Clock font is clock-only. Shadow opacity/blur are shared: the clock reads
     them unconditionally (its own rule works with or without a wallpaper), and
     every other legibility shadow -- greeting, date, weather, pinned-link
     labels -- reads the SAME two variables through its existing wallpaper-only
     CSS, so one pair of sliders now controls all of them instead of just the
     clock. Reading these vars is cheap, so this just runs every time widget
     visibility is recomputed rather than needing its own call site everywhere. */
  function applyClockAppearance(s) {
    const root = document.documentElement.style;
    const face = CLOCK_FONT_STACKS[s.clockFont] || CLOCK_FONT_STACKS.default;
    root.setProperty('--clock-font', face.stack);
    root.setProperty('--clock-weight', String(face.weight));
    root.setProperty('--clock-tracking', face.spacing);
    /* Empty string means "follow the accent", which is the default. Setting the
       property to a real colour is what overrides it; the CSS falls back to
       var(--accent-color) whenever this is unset. */
    const custom = /^#[0-9a-f]{6}$/i.test(s.clockColor || '') ? s.clockColor : '';
    if (custom) root.setProperty('--clock-color', custom);
    else root.removeProperty('--clock-color');
    const opacity = typeof s.wpShadowOpacity === 'number' ? s.wpShadowOpacity : 60;
    const blur = typeof s.wpShadowBlur === 'number' ? s.wpShadowBlur : 20;
    root.setProperty('--wp-shadow-opacity', String(opacity / 100));
    root.setProperty('--wp-shadow-blur', blur + 'px');
  }

  return { init, updateClock, initWeather, initFocusStats, initNavSearch, applyWidgetVisibility,
           applyClockAppearance, getEngines: () => ENGINES };
})();

const WorkspaceWidget = (() => {
  const APPS = [
    ['Account', 'https://myaccount.google.com'],
    ['Search', 'https://www.google.com'],
    ['Maps', 'https://maps.google.com'],
    ['YouTube', 'https://www.youtube.com'],
    ['News', 'https://news.google.com'],
    ['Gmail', 'https://mail.google.com'],
    ['Meet', 'https://meet.google.com'],
    ['Chat', 'https://chat.google.com'],
    ['Contacts', 'https://contacts.google.com'],
    ['Drive', 'https://drive.google.com'],
    ['Calendar', 'https://calendar.google.com'],
    ['Play', 'https://play.google.com'],
    ['Translate', 'https://translate.google.com'],
    ['Photos', 'https://photos.google.com'],
    ['Shopping', 'https://shopping.google.com'],
    ['Finance', 'https://www.google.com/finance'],
    ['Docs', 'https://docs.google.com'],
    ['Sheets', 'https://sheets.google.com'],
    ['Slides', 'https://slides.google.com'],
    ['Books', 'https://books.google.com'],
    ['Blogger', 'https://www.blogger.com'],
    ['Keep', 'https://keep.google.com'],
    ['Earth', 'https://earth.google.com'],
    ['Saved', 'https://www.google.com/save'],
    ['Arts & Culture', 'https://artsandculture.google.com'],
    ['Google Ads', 'https://ads.google.com'],
    ['Travel', 'https://www.google.com/travel'],
    ['Forms', 'https://forms.google.com'],
    ['Classroom', 'https://classroom.google.com'],
    ['Gemini', 'https://gemini.google.com'],
    ['AI Studio', 'https://aistudio.google.com'],
    ['NotebookLM', 'https://notebooklm.google.com'],
    ['Wallet', 'https://wallet.google.com'],
    ['Colab', 'https://colab.research.google.com'],
    ['Scholar', 'https://scholar.google.com'],
    ['Analytics', 'https://analytics.google.com'],
    ['Search Console', 'https://search.google.com/search-console'],
    ['Firebase', 'https://console.firebase.google.com'],
    ['Passwords', 'https://passwords.google.com'],
    ['Fonts', 'https://fonts.google.com'],
    ['Tasks', 'https://tasks.google.com'],
    ['Cloud', 'https://cloud.google.com'],
    ['YouTube Music', 'https://music.youtube.com'],
    ['Store', 'https://store.google.com']
  ];

  const APP_ICONS = {
    'Account': 'https://www.gstatic.com/images/branding/product/2x/avatar_square_blue_120dp.png',
    'Search': 'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png',
    'Maps': 'https://www.gstatic.com/images/branding/product/2x/maps_2020q4_48dp.png',
    'YouTube': 'https://www.gstatic.com/images/branding/product/2x/youtube_48dp.png',
    'News': 'https://www.gstatic.com/images/branding/product/2x/news_48dp.png',
    'Gmail': 'https://www.gstatic.com/images/branding/product/2x/gmail_2020q4_48dp.png',
    'Meet': 'https://www.gstatic.com/images/branding/product/2x/meet_2020q4_48dp.png',
    'Chat': 'https://www.gstatic.com/images/branding/product/2x/chat_2020q4_48dp.png',
    'Contacts': 'https://www.gstatic.com/images/branding/product/2x/contacts_2022_48dp.png',
    'Drive': 'https://www.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png',
    'Calendar': 'https://www.gstatic.com/images/branding/product/2x/calendar_2020q4_48dp.png',
    'Play': 'https://www.gstatic.com/images/branding/product/2x/play_prism_48dp.png',
    'Translate': 'https://www.gstatic.com/images/branding/product/2x/translate_24dp.png',
    'Photos': 'https://www.gstatic.com/images/branding/product/2x/photos_48dp.png',
    'Shopping': 'https://www.gstatic.com/images/branding/product/2x/shopping_48dp.png',
    'Finance': 'https://www.gstatic.com/images/branding/product/2x/finance_48dp.png',
    'Docs': 'https://www.gstatic.com/images/branding/product/2x/docs_2020q4_48dp.png',
    'Sheets': 'https://www.gstatic.com/images/branding/product/2x/sheets_2020q4_48dp.png',
    'Slides': 'https://www.gstatic.com/images/branding/product/2x/slides_2020q4_48dp.png',
    'Books': 'https://www.gstatic.com/images/branding/product/2x/books_48dp.png',
    'Blogger': 'https://www.gstatic.com/images/branding/product/2x/blogger_48dp.png',
    'Keep': 'https://www.gstatic.com/images/branding/product/2x/keep_2020q4_48dp.png',
    'Forms': 'https://www.gstatic.com/images/branding/product/2x/forms_2020q4_48dp.png',
    'Classroom': 'https://www.gstatic.com/images/branding/product/2x/classroom_48dp.png',
    'Gemini': 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d473d53066913e2f07f87.svg',
    'AI Studio': 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d473d53066913e2f07f87.svg',
    'NotebookLM': 'https://www.gstatic.com/images/branding/product/2x/notebooklm_48dp.png',
    'Wallet': 'https://www.gstatic.com/images/branding/product/2x/wallet_48dp.png',
    'Colab': 'https://colab.research.google.com/img/colab_favicon_256px.png',
    'Scholar': 'https://scholar.google.com/favicon.ico',
    'Analytics': 'https://www.gstatic.com/images/branding/product/2x/analytics_48dp.png',
    'Search Console': 'https://www.gstatic.com/images/branding/product/2x/search_console_48dp.png',
    'Firebase': 'https://www.gstatic.com/mobilesdk/160503_mobilesdk/logo/2x/firebase_28dp.png',
    'Passwords': 'https://www.gstatic.com/images/branding/product/2x/password_manager_48dp.png',
    'Fonts': 'https://www.gstatic.com/images/branding/product/2x/google_fonts_48dp.png',
    'Earth': 'https://www.gstatic.com/images/branding/product/2x/earth_48dp.png',
    'Saved': 'https://www.gstatic.com/images/branding/product/2x/google_save_48dp.png',
    'Arts & Culture': 'https://www.gstatic.com/images/branding/product/2x/arts_culture_48dp.png',
    'Google Ads': 'https://www.gstatic.com/images/branding/product/2x/google_ads_48dp.png',
    'Travel': 'https://www.gstatic.com/images/branding/product/2x/travel_48dp.png',
    'Tasks': 'https://www.gstatic.com/images/branding/product/2x/tasks_2021_48dp.png',
    'Cloud': 'https://www.gstatic.com/images/branding/product/2x/google_cloud_48dp.png',
    'YouTube Music': 'https://www.gstatic.com/images/branding/product/2x/youtube_music_48dp.png',
    'Store': 'https://www.gstatic.com/images/branding/product/2x/google_store_48dp.png'
  };

  let built = false;
  let activeView = 'all';
  let filterQuery = '';

  function getAppIconAttr(name, url) {
    const ext = extFaviconUrl(url);
    const chain = ext ? [ext] : [];
    if (remoteFaviconsAllowed()) {
      if (APP_ICONS[name]) chain.push(APP_ICONS[name]);
      const remote = faviconSrcSet(url);
      chain.push(remote.src, ...remote.fallbacks);
    }
    const uniq = [...new Set(chain.filter(Boolean))];
    return `src="${uniq[0] || ''}" data-fav data-fav-url="${String(url).replace(/"/g, '&quot;')}" data-fav-fallbacks="${uniq.slice(1).join('|')}"`;
  }

  function getFavorites() {
    try {
      const s = StorageManager.getSettings();
      if (Array.isArray(s.workspaceFavorites)) return s.workspaceFavorites;
    } catch { }
    return ['Search', 'Gmail', 'Drive', 'YouTube', 'Gemini', 'AI Studio', 'NotebookLM'];
  }

  function toggleFavorite(appName) {
    const favs = [...getFavorites()];
    const idx = favs.indexOf(appName);
    if (idx >= 0) {
      favs.splice(idx, 1);
    } else {
      favs.push(appName);
    }
    const settings = StorageManager.getSettings();
    settings.workspaceFavorites = favs;
    StorageManager.save();
    renderGrid();
  }

  function renderAppItem([name, url], isFav) {
    return `
      <div class="workspace-item" title="${escapeHtml(name)}">
        <button class="workspace-star-btn ${isFav ? 'is-active' : ''}" data-app="${escapeHtml(name)}" title="${isFav ? 'Remove from Starred' : 'Star app'}">★</button>
        <a href="${escapeHtml(safeHref(url))}" target="_blank" rel="noopener" class="workspace-link" style="display:flex; flex-direction:column; align-items:center; text-decoration:none; width:100%;">
          <span class="workspace-icon" data-letter="${escapeHtml(name.charAt(0))}">
            <img ${getAppIconAttr(name, url)} alt="${escapeHtml(name)}" decoding="async" width="38" height="38" />
          </span>
          <span style="font-size:12px; font-weight:500; color:var(--text, #ffffff); line-height:1.2; text-align:center; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden; margin-top:4px;">${escapeHtml(name)}</span>
        </a>
      </div>`;
  }

  function renderGrid() {
    const grid = $('workspaceGrid');
    if (!grid) return;

    const favs = new Set(getFavorites());
    const query = filterQuery.trim().toLowerCase();

    const filteredApps = APPS.filter(([name]) => !query || name.toLowerCase().includes(query));

    if (filteredApps.length === 0) {
      setSafeHTML(grid, `<div class="workspace-no-results">No matching apps found</div>`);
      return;
    }

    if (activeView === 'fav') {
      const favApps = filteredApps.filter(([name]) => favs.has(name));
      if (favApps.length === 0) {
        setSafeHTML(grid, `<div class="workspace-no-results">No starred apps yet.<br/><span style="opacity:0.7; font-size:11px;">Hover over any app to star it!</span></div>`);
        return;
      }
      setSafeHTML(grid, favApps.map(app => renderAppItem(app, true)).join(''));
    } else {
      if (!query) {
        const favApps = APPS.filter(([name]) => favs.has(name));
        const otherApps = APPS.filter(([name]) => !favs.has(name));
        let html = '';
        if (favApps.length > 0) {
          html += `<div class="workspace-section-header">Starred</div>`;
          html += favApps.map(app => renderAppItem(app, true)).join('');
        }
        if (otherApps.length > 0) {
          html += `<div class="workspace-section-header">All Apps</div>`;
          html += otherApps.map(app => renderAppItem(app, false)).join('');
        }
        setSafeHTML(grid, html);
      } else {
        setSafeHTML(grid, filteredApps.map(app => renderAppItem(app, favs.has(app[0]))).join(''));
      }
    }

    wireFavicons(grid);
  }

  function build() {
    if (built) return;
    built = true;
    renderGrid();
  }

  function init() {
    const btn = $('workspaceBtn');
    const pop = $('workspacePopover');
    if (!btn || !pop) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });

    const searchInput = $('workspaceSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        filterQuery = e.target.value;
        renderGrid();
      });
      searchInput.addEventListener('click', (e) => e.stopPropagation());
    }

    const tabAll = $('wsTabAll');
    const tabFav = $('wsTabFav');
    if (tabAll && tabFav) {
      tabAll.addEventListener('click', (e) => {
        e.stopPropagation();
        activeView = 'all';
        tabAll.classList.add('is-active');
        tabFav.classList.remove('is-active');
        renderGrid();
      });
      tabFav.addEventListener('click', (e) => {
        e.stopPropagation();
        activeView = 'fav';
        tabFav.classList.add('is-active');
        tabAll.classList.remove('is-active');
        renderGrid();
      });
    }

    const grid = $('workspaceGrid');
    if (grid) {
      grid.addEventListener('click', (e) => {
        const starBtn = e.target.closest('.workspace-star-btn');
        if (starBtn) {
          e.preventDefault();
          e.stopPropagation();
          const appName = starBtn.getAttribute('data-app');
          if (appName) toggleFavorite(appName);
          return;
        }
        const link = e.target.closest('.workspace-link');
        if (link) {
          close();
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (pop.classList.contains('open') && !pop.contains(e.target) && !e.target.closest('#workspaceBtn')) {
        close();
      }
    });
  }

  function toggle() {
    const pop = $('workspacePopover');
    if (!pop) return;
    pop.classList.contains('open') ? close() : open();
  }

  function open() {
    const pop = $('workspacePopover');
    const btn = $('workspaceBtn');
    if (!pop || !btn) return;
    build();
    renderGrid();
    const r = btn.getBoundingClientRect();
    pop.style.right = `${Math.max(16, window.innerWidth - r.right)}px`;
    pop.style.top = `${r.bottom + 8}px`;
    pop.classList.add('open');
    btn.classList.add('is-active');
    setTimeout(() => $('workspaceSearchInput')?.focus(), 50);
  }

  function close() {
    $('workspacePopover')?.classList.remove('open');
    $('workspaceBtn')?.classList.remove('is-active');
  }

  return { init, open, close };
})();

const TodoWidget = (() => {
  let reminderInterval = null;
  const firedReminders = new Set();

  /* Parse time patterns like 4:30, 16:30, 4:30pm, 4:30 PM from task text */
  function parseTaskTime(text) {
    const m = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = (m[3] || '').toLowerCase();
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    return { h, min };
  }

  function playReminderChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      // Two-tone ding-dong
      [800, 600].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = 'sine';
        const t = now + i * 0.25;
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.start(t); osc.stop(t + 0.6);
      });
    } catch { }
  }

  function checkReminders() {
    const todos = TodoManager.getAll();
    const now = new Date();
    const nowH = now.getHours();
    const nowM = now.getMinutes();
    const todayStr = todayKey();

    for (const t of todos) {
      if (t.done) continue;
      const parsed = parseTaskTime(t.text);
      if (!parsed) continue;
      const key = `${t.id}_${todayStr}_${parsed.h}:${parsed.min}`;
      if (firedReminders.has(key)) continue;
      if (parsed.h === nowH && parsed.min === nowM) {
        firedReminders.add(key);
        playReminderChime();
        ToastSystem.show(`⏰ Reminder: ${t.text}`, 'info', 8000);
      }
    }
  }

  function init() {
    const btn = $('todoWidgetBtn');
    const pop = $('todoPopover');
    const input = $('todoPopInput');
    const clearBtn = $('todoClearDone');
    btn?.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) { TodoManager.add(input.value.trim()); StorageManager.saveImmediate(); input.value = ''; render(); }
    });
    clearBtn?.addEventListener('click', (e) => { e.stopPropagation(); TodoManager.clearDone(); render(); });
    document.addEventListener('click', (e) => {
      if (pop && pop.classList.contains('open') && !pop.contains(e.target) && !e.target.closest('#todoWidgetBtn')) close();
    });
    render();

    // Start reminder scanner (checks every 30s)
    if (!reminderInterval) {
      reminderInterval = setInterval(checkReminders, 30000);
      checkReminders(); // run once immediately
    }
  }
  function toggle() {
    const pop = $('todoPopover');
    if (!pop) return;
    pop.classList.contains('open') ? close() : open();
  }
  function open() {
    const pop = $('todoPopover');
    const btn = $('todoWidgetBtn');
    if (!pop || !btn) return;
    render();
    const r = btn.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 320))}px`;
    pop.style.top = `${r.bottom + 8}px`;
    pop.classList.add('open');
    btn.classList.add('is-active');
    $('todoPopInput')?.focus();
  }
  function close() {
    $('todoPopover')?.classList.remove('open');
    $('todoWidgetBtn')?.classList.remove('is-active');
  }
  function render() {
    const list = $('todoPopList');
    const badge = $('todoPopBadge');
    const clearBtn = $('todoClearDone');
    if (!list) return;
    const todos = TodoManager.getAll();
    const pendingCount = todos.filter(t => !t.done).length;
    const doneCount = todos.filter(t => t.done).length;

    if (badge) badge.textContent = pendingCount;
    if (clearBtn) clearBtn.style.display = doneCount > 0 ? 'inline-block' : 'none';

    setSafeHTML(list, todos.length ? '' : '<div class="todo-pop-empty"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4; margin-bottom:8px;"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><br/>Add your first task below</div>');
    todos.forEach((t, idx) => {
      const timeMatch = parseTaskTime(t.text);
      const timeHint = timeMatch ? ` <span style="opacity:0.5; font-size:11px;">⏰ ${String(timeMatch.h).padStart(2,'0')}:${String(timeMatch.min).padStart(2,'0')}</span>` : '';
      const row = document.createElement('div');
      row.className = `todo-pop-row ${t.done ? 'done' : ''} ${t.pinned ? 'pinned' : ''}`;
      setSafeHTML(row, `
        <button class="todo-pop-check" title="${t.done ? 'Mark pending' : 'Mark done'}">
          ${t.done ? icon('check', 16) : ''}
        </button>
        <span class="todo-pop-text" data-no-tooltip>${escapeHtml(t.text)}${timeHint}</span>
        <button class="todo-pop-move" data-dir="-1" title="Move up" aria-label="Move task up">↑</button>
        <button class="todo-pop-move" data-dir="1" title="Move down" aria-label="Move task down">↓</button>
        <button class="todo-pop-pin ${t.pinned ? 'active' : ''}" title="${t.pinned ? 'Unpin task' : 'Pin task to top'}">
          ${icon('pin', 16)}
        </button>
        <button class="todo-pop-del" title="Delete task">&times;</button>`);

      row.querySelector('.todo-pop-check').addEventListener('click', (e) => { e.stopPropagation(); TodoManager.toggle(t.id); render(); });
      row.querySelector('.todo-pop-pin').addEventListener('click', (e) => { e.stopPropagation(); TodoManager.togglePin(t.id); render(); });
      row.querySelectorAll('.todo-pop-move').forEach(mb => {
        mb.addEventListener('click', (e) => {
          e.stopPropagation();
          if (TodoManager.shift(t.id, parseInt(mb.dataset.dir, 10))) render();
        });
      });

      const textEl = row.querySelector('.todo-pop-text');
      textEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        showPrompt('Edit Task', 'Update task description:', t.text, (val) => {
          if (val && val.trim()) {
            TodoManager.edit(t.id, val.trim());
            render();
          }
        });
      });

      row.querySelector('.todo-pop-del').addEventListener('click', (e) => {
        e.stopPropagation();
        TodoManager.remove(t.id);
        render();
        ToastSystem.action('Task deleted', 'Undo', () => { TodoManager.insertAt(t, idx); render(); });
      });
      list.appendChild(row);
    });
  }
  return { init, render, open, close };
})();

const NotesRenderer = (() => {
  let bound = false;
  /* The previous version kept its own 300ms timer on top of StorageManager's
     debounce, and flushPending() only re-armed a save if area.value differed
     from the in-memory data.notes -- but the input handler had ALREADY copied
     area.value into data.notes on every keystroke, so that comparison was
     always false. flush() (on refresh/close) found nothing pending and wrote
     nothing: the exact "notes disappear on refresh" bug. There is now exactly
     one debounce (StorageManager's), so flush() always has real work to do. */

  // Snapshot of the field's content when the current edit session began, for
  // the focus/blur history checkpoint and for the manual Save button's
  // "anything to save?" check. Null when nothing is being edited.
  let sessionStart = null;

  // Terminal-style recall: -1 means "not browsing history, this is live text".
  let historyIndex = -1;
  let draftBeforeHistory = null;

  function commitSessionToHistory() {
    if (sessionStart === null) return;
    const area = $('notesArea');
    if (area && sessionStart !== area.value) NotesManager.pushHistory(sessionStart);
    sessionStart = null;
  }

  function flushPending() {
    const area = $('notesArea');
    if (!area || !bound) return;
    if (area.value !== NotesManager.get()) {
      NotesManager.set(area.value);
    }
    commitSessionToHistory();
  }

  function updateStats(text) {
    const badge = $('notesStatsBadge');
    if (!badge) return;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    badge.textContent = `${words} word${words === 1 ? '' : 's'}`;
  }

  function markSaved(saved) {
    $('notesSaveBtn')?.classList.toggle('is-saved', saved);
  }

  function render() {
    const area = $('notesArea');
    if (!area) return;
    if (document.activeElement !== area) {
      area.value = NotesManager.get();
      updateStats(area.value);
      markSaved(true);
    }
    ClipboardRenderer.render();
    if (!bound) {
      bound = true;

      area.addEventListener('focus', () => {
        if (sessionStart === null) sessionStart = area.value;
      });

      area.addEventListener('input', () => {
        const val = area.value;
        StorageManager.getData().notes = val;
        updateStats(val);
        markSaved(false);
        historyIndex = -1;          // fresh typing cancels any history browse
        NotesManager.set(val);      // debounced write; StorageManager owns the timing
      });

      area.addEventListener('blur', () => {
        NotesManager.set(area.value);
        markSaved(true);
        commitSessionToHistory();
      });

      area.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = area.selectionStart;
          const end = area.selectionEnd;
          area.value = area.value.substring(0, start) + '  ' + area.value.substring(end);
          area.selectionStart = area.selectionEnd = start + 2;
          StorageManager.getData().notes = area.value;
          updateStats(area.value);
          markSaved(false);
          return;
        }

        /* Terminal-style recall, gated on the caret sitting at the very start
           of the field so it never fights normal up/down navigation inside a
           multi-line note. Repeated presses step further back, like shell
           history; Down steps forward and lands back on your live draft. */
        const atStart = area.selectionStart === 0 && area.selectionEnd === 0;
        if (e.key === 'ArrowUp' && atStart) {
          const hist = NotesManager.getHistory();
          if (!hist.length) return;
          e.preventDefault();
          if (historyIndex === -1) draftBeforeHistory = area.value;
          if (historyIndex < hist.length - 1) historyIndex++;
          area.value = hist[historyIndex];
          area.selectionStart = area.selectionEnd = 0;
          updateStats(area.value);
          markSaved(false);
        } else if (e.key === 'ArrowDown' && historyIndex !== -1) {
          e.preventDefault();
          historyIndex--;
          area.value = historyIndex === -1 ? (draftBeforeHistory ?? '') : NotesManager.getHistory()[historyIndex];
          area.selectionStart = area.selectionEnd = area.value.length;
          updateStats(area.value);
          markSaved(false);
        }
      });

      $('notesSaveBtn')?.addEventListener('click', () => {
        NotesManager.setImmediate(area.value);
        commitSessionToHistory();
        markSaved(true);
        ToastSystem.success('Notes saved');
      });

      $('notesExportBtn')?.addEventListener('click', () => {
        NotesManager.set(area.value);
        NotesManager.exportTxt();
        ToastSystem.success('Notes exported');
      });
    }
  }
  return { render, flushPending };
})();

const ClipboardRenderer = (() => {
  let bound = false;

  function render() {
    const listEl = $('clipList');
    const badgeEl = $('clipCountBadge');
    if (!listEl) return;

    const snippets = ClipboardManager.getAll();
    if (badgeEl) badgeEl.textContent = `${snippets.length} saved`;

    if (snippets.length === 0) {
      setSafeHTML(listEl, `
        <div class="et-clip-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          <span>No snippets saved yet. Paste a command or link above to save!</span>
        </div>`);
    } else {
      setSafeHTML(listEl, snippets.map(item => `
        <div class="et-clip-item" data-id="${item.id}">
          <div class="et-clip-item-main" style="display:flex; flex-direction:column; gap:2px; flex:1; overflow:hidden;">
            ${item.title ? `<span class="et-clip-item-title" style="font-weight:600; color:var(--text); font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.title)}</span>` : ''}
            <span class="et-clip-item-text" style="font-size:12px; color:var(--text-dim); font-family:monospace; word-break:break-all;">${escapeHtml(item.text)}</span>
          </div>
          <div class="et-clip-item-actions">
            <button class="et-clip-copy-btn" data-no-tooltip aria-label="Copy snippet ${escapeHtml(item.title || item.label || item.text)}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="16" height="16" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy</span>
            </button>
            <button class="et-clip-del-btn" title="Delete snippet" aria-label="Delete snippet ${escapeHtml(item.title || item.label || item.text)}">&times;</button>
          </div>
        </div>
      `).join(''));
    }

    if (!bound) {
      bound = true;
      const titleInp = $('clipTitleInput');
      const textInp = $('clipTextInput');
      const addBtn = $('clipAddBtn');

      function handleAdd() {
        if (!textInp) return;
        const text = textInp.value.trim();
        const title = titleInp ? titleInp.value.trim() : '';
        if (text) {
          ClipboardManager.add(text, title, title);
          StorageManager.saveImmediate();
          textInp.value = '';
          if (titleInp) titleInp.value = '';
          render();
          ToastSystem.success('Snippet added');
        }
      }

      addBtn?.addEventListener('click', handleAdd);
      textInp?.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAdd(); });
      titleInp?.addEventListener('keydown', (e) => { if (e.key === 'Enter') textInp?.focus(); });

      listEl.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('.et-clip-copy-btn');
        if (copyBtn) {
          const itemEl = copyBtn.closest('.et-clip-item');
          const snippets = ClipboardManager.getAll();
          const found = snippets.find(s => s.id === itemEl.dataset.id);
          if (found) {
            ClipboardManager.copy(found.text);
            copyBtn.classList.add('copied');
            const txt = copyBtn.querySelector('span');
            if (txt) txt.textContent = 'Copied!';
            setTimeout(() => {
              copyBtn.classList.remove('copied');
              if (txt) txt.textContent = 'Copy';
            }, 1500);
            ToastSystem.success('Copied to clipboard');
          }
          return;
        }

        const delBtn = e.target.closest('.et-clip-del-btn');
        if (delBtn) {
          const itemEl = delBtn.closest('.et-clip-item');
          ClipboardManager.remove(itemEl.dataset.id);
          render();
          ToastSystem.info('Snippet deleted');
        }
      });
    }
  }

  return { render };
})();

const HomeRenderer = (() => {
  function init() {
    renderPinned();
  }
  function render() {
    WidgetsRenderer.applyWidgetVisibility();
    renderPinned();
  }
  function showAddPinModal() {
    const boards = BoardManager.getAll();
    if (!boards.length) {
      ToastSystem.info('Create a board first, then pin links to Home.');
      ViewController.show('boards');
      return;
    }

    showCustomModal('Pin a link to Home', `
      <div class="dialog-stack">
        <div class="dialog-field">
          <label class="dialog-label" for="pinTitleInp">Title</label>
          <input type="text" id="pinTitleInp" class="dialog-input" placeholder="Title (e.g. GitHub)" />
        </div>
        <div class="dialog-field">
          <label class="dialog-label" for="pinUrlInp">URL</label>
          <input type="text" id="pinUrlInp" class="dialog-input" placeholder="https://github.com" />
        </div>
        <div class="dialog-field">
          <label class="dialog-label" for="pinBoardSel">Save to board</label>
          ${CustomSelect.render({
            id: 'pinBoardSel',
            value: boards[0]?.id || '',
            options: boards.map(b => ({ value: b.id, label: b.name }))
          })}
        </div>
      </div>`, () => {
      const titleEl = $('pinTitleInp');
      const urlEl = $('pinUrlInp');
      const title = titleEl.value.trim();
      const url = urlEl.value.trim();
      if (!url) {
        markInvalid(urlEl, true);
        showModalError('URL is required.');
        return false;
      }
      const boardId = $('pinBoardSel').value;
      const bm = BookmarkManager.add(boardId, title || url, url, []);
      if (!bm) {
        markInvalid(urlEl, true);
        showModalError('That does not look like a valid link.');
        return false;
      }
      if (BookmarkManager.togglePin(boardId, bm.id) === null) {
        ToastSystem.error(`Home holds ${BookmarkManager.PIN_LIMIT} pins. Unpin one first.`);
      } else {
        ToastSystem.success('Pinned to Home');
      }
      StorageManager.saveImmediate();
      renderPinned();
      BoardRenderer.renderBoards();
      return true;
    }, 'Pin');
    CustomSelect.initAll($('appDynamicModal'));
  }

  function renderPinned() {
    const wrap = $('homePinned');
    if (!wrap) return;
    const settings = StorageManager.getSettings();
    if (settings.hidePinnedOnHome) {
      wrap.style.display = 'none';
      return;
    }
    const pinned = BookmarkManager.getPinned();
    setSafeHTML(wrap, '');
    wrap.style.display = 'flex';

    pinned.forEach(bm => {
      const cell = document.createElement('div');
      cell.className = 'dock-pin-wrap';
      cell.draggable = true;
      cell.dataset.id = bm.id;

      cell.addEventListener('dragstart', e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', bm.id);
        cell.style.opacity = '0.5';
      });
      cell.addEventListener('dragend', () => cell.style.opacity = '');
      cell.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        cell.style.transform = 'scale(1.05)';
      });
      cell.addEventListener('dragleave', () => cell.style.transform = '');
      cell.addEventListener('drop', e => {
        e.preventDefault();
        cell.style.transform = '';
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId && draggedId !== bm.id) {
          const arr = Array.from(wrap.children).filter(c => c.dataset.id).map(c => c.dataset.id);
          const fromIdx = arr.indexOf(draggedId);
          const toIdx = arr.indexOf(bm.id);
          if (fromIdx > -1 && toIdx > -1) {
            arr.splice(fromIdx, 1);
            arr.splice(toIdx, 0, draggedId);
            BookmarkManager.reorderPinned(arr);
            renderPinned();
          }
        }
      });

      const a = document.createElement('a');
      a.className = 'dock-pin';
      a.href = safeHref(bm.url);
      a.target = '_blank';
      a.rel = 'noopener';
      a.setAttribute('data-id', bm.id);
      a.title = `${bm.title}
${bm.url}`;
      setSafeHTML(a, `
        <span class="dock-pin-icon"><img class="dock-pin-fav" ${faviconAttr(bm.url)} alt="" /></span>
        <span class="dock-pin-label">${escapeHtml(bm.title)}</span>
      `);
      wireFavicons(a);

      const menuBtn = document.createElement('button');
      menuBtn.type = 'button';
      menuBtn.className = 'dock-pin-menu-btn';
      menuBtn.setAttribute('aria-label', `Options for ${bm.title}`);
      menuBtn.setAttribute('title', 'Options');
      menuBtn.textContent = '⋮';

      const showMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const r = menuBtn.getBoundingClientRect();
        if (typeof ContextMenu !== 'undefined') {
          ContextMenu.show(e.clientX || r.left, e.clientY || (r.bottom + 4), bm.boardId, bm);
        }
      };

      a.addEventListener('contextmenu', showMenu);
      menuBtn.addEventListener('click', showMenu);

      cell.append(a, menuBtn);
      wrap.appendChild(cell);
    });

    if (pinned.length >= BookmarkManager.PIN_LIMIT) return;

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'dock-pin dock-pin-add';
    add.setAttribute('aria-label', 'Add a link and pin it to Home');
    setSafeHTML(add, `
      <span class="dock-pin-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </span>
      <span class="dock-pin-label">${pinned.length ? 'Add pin' : 'Pin a link'}</span>
    `);
    add.addEventListener('click', showAddPinModal);
    wrap.appendChild(add);
  }
  return { init, render, renderPinned };
})();
