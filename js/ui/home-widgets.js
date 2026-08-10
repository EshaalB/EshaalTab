"use strict";

const WidgetsRenderer = (() => {
  let clockInterval = null;
  let lastClockKey = "";

  const WEATHER_TTL = 30 * 60 * 1000;
  const weatherCache = {
    read() {
      const c = StorageManager.getData().weatherCache;
      return c && typeof c === "object" ? c : null;
    },
    write(patch) {
      const d = StorageManager.getData();
      d.weatherCache = { ...(d.weatherCache || {}), ...patch };
      StorageManager.save();
    },

    coordsFor(city) {
      const c = weatherCache.read();
      return c && c.city === city && c.lat != null ? c : null;
    },
    readingFor(city, unit) {
      const c = weatherCache.coordsFor(city);
      return c && c.data && c.unit === unit ? c : null;
    },
    freshFor(city, unit) {
      const c = weatherCache.readingFor(city, unit);
      return c && Date.now() - (c.time || 0) < WEATHER_TTL ? c : null;
    },
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
    const dateEl = $("clockDate");
    const timeEl = $("clockTime");
    const greetingEl = $("clockGreeting");
    if (!dateEl || !timeEl) return;
    const now = new Date();

    const pref = StorageManager.getSettings().use12h;
    const hour12 = pref === true ? true : pref === false ? false : undefined;

    const nameVal = (StorageManager.getSettings().displayName || "").trim();
    const key = `${now.getHours()}:${now.getMinutes()}|${hour12}|${now.toDateString()}|${nameVal}`;
    if (!force && key === lastClockKey) return;
    lastClockKey = key;

    if (greetingEl) {
      const hrs = now.getHours();
      let greetingText = "Good morning";
      if (hrs >= 12 && hrs < 17) {
        greetingText = "Good afternoon";
      } else if (hrs >= 17 && hrs < 22) {
        greetingText = "Good evening";
      } else if (hrs >= 22 || hrs < 5) {
        greetingText = "Good night";
      }
      const name = (StorageManager.getSettings().displayName || "").trim();
      const fullText = name ? `${greetingText}, ${name}` : greetingText;
      greetingEl.textContent = fullText;
    }

    dateEl.textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(now);

    const parts = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12,
    }).formatToParts(now);
    let main = "",
      period = "";
    for (const p of parts) {
      if (p.type === "dayPeriod") period = p.value;
      else main += p.value;
    }
    main = main.trim();
    const formattedMain = escapeHtml(main).replace(
      ":",
      '<span class="clock-colon" aria-hidden="true">:</span>',
    );
    setSafeHTML(
      timeEl,
      period
        ? `<span class="clock-digits">${formattedMain}</span><span class="clock-ampm">${escapeHtml(period)}</span>`
        : `<span class="clock-digits">${formattedMain}</span>`,
    );
  }

  function initFocusStats() {
    const btn = $("pomoToggleBtn");
    if (!btn) return;
    const today = todayKey();
    const data = StorageManager.getData();
    const count = (data.focus && data.focus[today]) || 0;
    const countEl = $("pomoToggleCount");
    if (countEl) {
      countEl.textContent = count;
      countEl.style.display = count > 0 ? "flex" : "none";
    }
    btn.onclick = () => PomodoroMode.enter();
  }

  const ENGINES = {
    default: {
      name: "Default (Browser)",
      useSystemDefault: true,
      url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    },
    chatgpt: {
      name: "ChatGPT",
      ask: true,
      url: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`,
    },
    claude: {
      name: "Claude",
      ask: true,
      url: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`,
    },
    gemini: {
      name: "Gemini",
      ask: true,
      url: (q) => `https://gemini.google.com/app?q=${encodeURIComponent(q)}`,
    },
    research: {
      name: "Research",
      ask: true,
      url: (q) =>
        `https://search.brave.com/ask?enable_research=true&q=${encodeURIComponent(q)}`,
    },
    perplexity: {
      name: "Perplexity",
      ask: true,
      url: (q) => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`,
    },
    duckduckgo: {
      name: "DuckDuckGo",
      url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
    },
    youtube: {
      name: "YouTube",
      url: (q) =>
        `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
    },
  };
  const hintFor = (key) => {
    const e = ENGINES[key] || ENGINES.default;
    return e.ask
      ? `Ask ${e.name} or type a URL…`
      : `Search ${e.name} or type a URL…`;
  };

  function searchWithDefaultEngine(query, newTab = false) {
    try {
      if (HAS_EXT && EXT.search && typeof EXT.search.query === "function") {
        EXT.search.query({
          text: query,
          disposition: newTab ? "NEW_TAB" : "CURRENT_TAB",
        });
        return true;
      }
      if (HAS_EXT && EXT.search && typeof EXT.search.search === "function") {
        EXT.search.search({
          query,
          disposition: newTab ? "NEW_TAB" : "CURRENT_TAB",
        });
        return true;
      }
    } catch {}
    return false;
  }

  function initNavSearch() {
    const bar = $("navSearchBar");
    if (!bar) return;

    const settings = StorageManager.getSettings();
    const enabledList = settings.enabledEngines || Object.keys(ENGINES);
    const availableEngines = Object.entries(ENGINES).filter(([k]) =>
      enabledList.includes(k),
    );
    const renderEngines = availableEngines.length
      ? availableEngines
      : Object.entries(ENGINES);
    let currentEngineKey = ENGINES[settings.searchEngine]
      ? settings.searchEngine
      : "default";

    setSafeHTML(
      bar,
      `
      <div class="et-search-pill" style="position:relative;">
        <button class="et-search-engine" id="nsbEngLogo" data-no-tooltip aria-haspopup="listbox" aria-expanded="false">
          <span class="et-search-engine-name">${escapeHtml((ENGINES[currentEngineKey] || ENGINES.default).name)}</span>
          <svg class="et-search-engine-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="nsb-eng-menu" id="nsbEngMenu" role="listbox">
          ${renderEngines
            .map(
              ([key, eng]) => `
            <div class="et-search-opt ${key === currentEngineKey ? "active" : ""}" data-engine="${key}" role="option" aria-selected="${key === currentEngineKey}">
              <span>${escapeHtml(eng.name)}</span>
            </div>
          `,
            )
            .join("")}
        </div>
        <input type="text" class="et-search-input" id="nsbInput" placeholder="${hintFor(currentEngineKey)}" autocomplete="off" spellcheck="false" />
        <button class="et-search-btn et-search-submit" id="nsbSearchBtn" title="Search">
          ${icon("search", 16)}
          <span class="search-btn-label">Search</span>
        </button>
      </div>`,
    );

    const input = $("nsbInput");
    const logoBtn = $("nsbEngLogo");
    const menu = $("nsbEngMenu");
    const searchBtn = $("nsbSearchBtn");

    bar.addEventListener("mousedown", (e) => {
      if (input && !e.target.closest("button")) {
        e.preventDefault();
        input.focus();
      }
    });

    if (logoBtn && menu) {
      let closeTimeout = null;

      const pill = logoBtn.closest(".et-search-pill") || bar;
      const openMenu = () => {
        if (closeTimeout) clearTimeout(closeTimeout);
        menu.classList.add("open");
        if (pill) pill.classList.add("menu-open");
        logoBtn.setAttribute("aria-expanded", "true");
        logoBtn.classList.add("active");
      };

      const closeMenu = (immediate = false) => {
        if (closeTimeout) clearTimeout(closeTimeout);
        const resetState = () => {
          menu.classList.remove("open");
          if (pill) pill.classList.remove("menu-open");
          logoBtn.setAttribute("aria-expanded", "false");
          logoBtn.classList.remove("active");
        };
        if (immediate) {
          resetState();
        } else {
          closeTimeout = setTimeout(resetState, 200);
        }
      };

      logoBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (menu.classList.contains("open")) closeMenu(true);
        else openMenu();
      });

      logoBtn.addEventListener("mouseenter", openMenu);
      menu.addEventListener("mouseenter", openMenu);

      logoBtn.addEventListener("mouseleave", () => closeMenu(false));
      menu.addEventListener("mouseleave", () => closeMenu(false));

      document.addEventListener("click", (e) => {
        if (!logoBtn.contains(e.target) && !menu.contains(e.target)) {
          closeMenu(true);
        }
      });

      menu.querySelectorAll(".et-search-opt").forEach((opt) => {
        opt.addEventListener("click", (e) => {
          e.stopPropagation();
          const engKey = opt.dataset.engine;
          if (ENGINES[engKey]) {
            currentEngineKey = engKey;
            settings.searchEngine = engKey;
            StorageManager.save();
            logoBtn.querySelector(".et-search-engine-name").textContent =
              ENGINES[engKey].name;
            input.placeholder = hintFor(engKey);
            menu.querySelectorAll(".et-search-opt").forEach((o) => {
              const on = o.dataset.engine === engKey;
              o.classList.toggle("active", on);
              o.setAttribute("aria-selected", on);
            });
            closeMenu(true);
            input.focus();
          }
        });
      });
    }

    const executeSearch = (event) => {
      const val = input ? input.value.trim() : "";
      if (!val) return;
      const newTab = !!(
        event?.ctrlKey ||
        event?.metaKey ||
        event?.shiftKey ||
        event?.button === 1
      );
      const isUrl =
        /^https?:\/\//i.test(val) ||
        /^localhost(:[0-9]+)?/i.test(val) ||
        /^[a-z0-9-]+(\.[a-z0-9-]+)+\/?.*/i.test(val);

      if (isUrl) {
        const targetUrl = /^https?:\/\//i.test(val) ? val : "https://" + val;
        if (newTab) window.open(targetUrl, "_blank", "noopener");
        else window.location.assign(targetUrl);
        input.value = "";
        return;
      }

      const eng = ENGINES[currentEngineKey] || ENGINES.default;
      if (eng.useSystemDefault && searchWithDefaultEngine(val, newTab)) {
        input.value = "";
        return;
      }

      const targetUrl = eng.url(val);
      if (newTab) window.open(targetUrl, "_blank", "noopener");
      else window.location.assign(targetUrl);
      input.value = "";
    };

    if (searchBtn) {
      searchBtn.addEventListener("click", executeSearch);
      searchBtn.addEventListener("auxclick", (e) => {
        if (e.button === 1) {
          e.preventDefault();
          executeSearch(e);
        }
      });
    }

    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") executeSearch(e);
      });
    }
  }

  function initWeather() {
    const weatherEl = $("weatherWidget");
    if (!weatherEl) return;

    weatherEl.onclick = () => {
      const s = StorageManager.getSettings();
      showPrompt(
        "Weather Location",
        "Enter city name for weather:",
        s.weatherCity || "",
        (val) => {
          if (val !== null && val.trim()) {
            s.weatherCity = val.trim();
            s.widgets.weather = true;
            StorageManager.save();
            initWeather();
            applyWidgetVisibility();
            ToastSystem.success(`Weather city set to ${val.trim()}`);
          }
        },
      );
    };

    const settings = StorageManager.getSettings();
    if (!settings.weatherCity) {
      setSafeHTML(weatherEl, `${icon("weatherSun", 16)} <span>Set City</span>`);
      return;
    }
    const unit = settings.weatherUnit === "f" ? "f" : "c";
    const fresh = weatherCache.freshFor(settings.weatherCity, unit);
    if (fresh) {
      renderWeatherData(fresh.data, fresh.name || settings.weatherCity);
      return;
    }
    fetchWeather(settings.weatherCity, unit);
  }

  async function fetchWeather(city, unit) {
    const weatherEl = $("weatherWidget");
    if (!weatherEl) return;
    const cleanCity = String(city || "").trim();
    if (!cleanCity) {
      setSafeHTML(
        weatherEl,
        `${icon("weatherSun", 16)} <span>Set City in Settings</span>`,
      );
      return;
    }
    try {
      let coords = weatherCache.coordsFor(cleanCity);
      if (!coords) {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=1&language=en&format=json`,
        );
        const geoData = await geoRes.json();
        if (!geoData.results || !geoData.results.length) {
          setSafeHTML(
            weatherEl,
            `${icon("weatherSun", 16)} <span>City Not Found</span>`,
          );
          return;
        }
        const { latitude, longitude, name } = geoData.results[0];

        coords = {
          city: cleanCity,
          lat: latitude,
          lon: longitude,
          name,
          data: null,
          time: 0,
        };
        weatherCache.write(coords);
      }

      const unitParam = unit === "f" ? "&temperature_unit=fahrenheit" : "";
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true${unitParam}`,
      );
      const weatherData = await weatherRes.json();
      weatherCache.write({ data: weatherData, unit, time: Date.now() });
      renderWeatherData(weatherData, coords.name || city);
    } catch (e) {
      const stale = weatherCache.readingFor(city, unit);
      if (stale) renderWeatherData(stale.data, stale.name || city);
      else
        setSafeHTML(
          weatherEl,
          `${icon("weatherSun", 16)} <span>Offline</span>`,
        );
    }
  }
  function renderWeatherData(weatherData, name) {
    const weatherEl = $("weatherWidget");
    if (!weatherEl || !weatherData.current_weather) return;
    const current = weatherData.current_weather;
    const settings = StorageManager.getSettings();
    const unitSymbol = settings.weatherUnit === "f" ? "°F" : "°C";
    const temp = Math.round(current.temperature);
    const code = current.weathercode;
    let iconName = "weatherSun";
    if (code >= 1 && code <= 3) iconName = "weatherCloud";
    else if (code >= 51 && code <= 67) iconName = "weatherRain";
    else if (code >= 71 && code <= 77) iconName = "weatherSnow";
    else if (code >= 95) iconName = "weatherStorm";

    setSafeHTML(
      weatherEl,
      `${icon(iconName, 16)} <span>${temp}${unitSymbol} ${escapeHtml(name)}</span>`,
    );
  }

  function applyWidgetVisibility() {
    const s = StorageManager.getSettings();
    const w = s.widgets || {};
    const clock = $("clockWidget");
    const search = $("navSearchBar");
    const weather = $("weatherWidget");
    const pinned = $("homePinned");
    const workspace = $("workspaceBtn");

    const todo = $("todoWidgetBtn");

    if (clock) clock.style.display = w.clock !== false ? "" : "none";
    if (search) search.style.display = w.navSearch !== false ? "" : "none";
    if (weather) weather.style.display = w.weather ? "" : "none";
    if (workspace)
      workspace.style.display = w.workspace !== false ? "" : "none";
    if (todo) {
      const on = w.todo !== false;
      todo.style.display = on ? "" : "none";
      if (!on) TodoWidget.close();
    }
    if (pinned) pinned.style.display = s.hidePinnedOnHome ? "none" : "flex";
    document.body.classList.toggle("hide-pinned-home", !!s.hidePinnedOnHome);

    const pos = s.clockPosition === "corner" ? "corner" : "center";
    document.body.classList.toggle("clock-pos-corner", pos === "corner");
    document.body.classList.toggle("clock-pos-center", pos === "center");

    applyClockAppearance(s);
  }

  const CLOCK_FONT_STACKS = {
    system: {
      stack:
        "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      weight: 600,
      spacing: "-0.03em",
    },
    default: {
      stack: "'Orbitron', var(--font-app, sans-serif)",
      weight: 700,
      spacing: "0.02em",
    },
    thin: {
      stack:
        "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', 'Segoe UI', sans-serif",
      weight: 200,
      spacing: "-0.02em",
    },
    light: {
      stack: "'Roboto', 'Segoe UI', system-ui, -apple-system, sans-serif",
      weight: 300,
      spacing: "-0.01em",
    },
    app: {
      stack: "var(--font-app, sans-serif)",
      weight: 600,
      spacing: "normal",
    },
    serif: {
      stack: "'Lora', Georgia, 'Times New Roman', serif",
      weight: 400,
      spacing: "normal",
    },
    mono: {
      stack: "'JetBrains Mono', ui-monospace, Consolas, monospace",
      weight: 400,
      spacing: "-0.03em",
    },
    handwriting: { stack: "'Caveat', cursive", weight: 700, spacing: "normal" },
  };

  function applyClockAppearance(s) {
    const root = document.documentElement.style;
    const face = CLOCK_FONT_STACKS[s.clockFont] || CLOCK_FONT_STACKS.system;
    root.setProperty("--clock-font", face.stack);
    root.setProperty("--clock-weight", String(face.weight));
    root.setProperty("--clock-tracking", face.spacing);

    const custom = /^#[0-9a-f]{6}$/i.test(s.clockColor || "")
      ? s.clockColor
      : "";
    if (custom) root.setProperty("--clock-color", custom);
    else root.removeProperty("--clock-color");
    const opacity =
      typeof s.wpShadowOpacity === "number" ? s.wpShadowOpacity : 60;
    const blur = 20;
    const shadowHex = /^#[0-9a-f]{6}$/i.test(s.wpShadowColor || "")
      ? s.wpShadowColor
      : "#000000";
    const shadowRgb = [1, 3, 5]
      .map((i) => parseInt(shadowHex.slice(i, i + 2), 16))
      .join(", ");
    root.setProperty("--wp-shadow-opacity", String(opacity / 100));
    root.setProperty("--wp-shadow-blur", blur + "px");
    root.setProperty("--wp-shadow-rgb", shadowRgb);
  }

  return {
    init,
    updateClock,
    initWeather,
    initFocusStats,
    initNavSearch,
    applyWidgetVisibility,
    applyClockAppearance,
    getEngines: () => ENGINES,
  };
})();
