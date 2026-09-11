"use strict";

const WidgetsRenderer = (() => {
  let clockInterval = null;
  let lastClockKey = "";

  const CLOCK_POSITIONS = [
    "center",
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
  ];

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
    // `visibleInterval` stops the tick entirely while the tab is hidden - a
    // clock nobody can see is not worth a wake-up per second - and repaints
    // immediately on the way back, so it is never briefly stale on return.
    if (clockInterval) clockInterval();
    clockInterval = visibleInterval(updateClock, 1000);
  }
  function updateClock(force) {
    const dateEl = $("clockDate");
    const timeEl = $("clockTime");
    const greetingEl = $("clockGreeting");
    if (!dateEl || !timeEl) return;
    const now = new Date();

    const pref = StorageManager.getSettings().use12h;
    const hour12 = pref === true ? true : pref === false ? false : undefined;

    const nameVal = capitalName(StorageManager.getSettings().displayName);
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
      const name = capitalName(StorageManager.getSettings().displayName);
      // The full stop is the difference between a label and the page saying
      // something to you. Only when there is a name to say it to.
      const fullText = name ? `${greetingText}, ${name}.` : greetingText;
      greetingEl.textContent = fullText;
    }

    dateEl.textContent = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
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

  /** The name as a greeting shows it: first letter capitalised, rest as typed. */
  function capitalName(raw) {
    const name = String(raw || "").trim();
    return name ? name.charAt(0).toLocaleUpperCase() + name.slice(1) : "";
  }

  function initFocusStats() {
    const btn = $("pomoToggleBtn");
    if (!btn) return;
    const today = todayKey();
    const data = StorageManager.getData();
    const count = (data.focus && data.focus[today]) || 0;
    const countEl = $("pomoToggleCount");
    if (countEl) {
      // From the second session on; a badge reading "1" says nothing the
      // timer does not.
      countEl.textContent = count;
      countEl.style.display = count > 1 ? "flex" : "none";
    }
    btn.onclick = () => PomodoroMode.enter();
  }

  /* First entry is the shipped default, and it has to be the browser's own
     search provider.
     
     Chrome Web Store policy requires that a new tab page which offers search
     respects the user's selected search settings, via the Search API. Shipping
     a hardcoded provider as the default changes the user's search experience
     without asking, which is a single-purpose violation - the extension would
     be replacing both the new tab page and the search provider. Routing the
     default through `chrome.search.query` means EshaalTab replaces the page
     and nothing else; whatever the user already chose is what answers.
     
     The named providers below stay available as an explicit per-search choice.
     Picking one is the user changing their own mind for one query, which is a
     preference, not a hijack. */
  const q$ = encodeURIComponent;
  const ENGINES = {
    default: {
      name: "Default (Browser)",
      group: "web",
      useSystemDefault: true,
      // Only reached when the Search API is unavailable, which outside the
      // installed extension is always - the dev server has no chrome.search.
      url: (q) => `https://www.google.com/search?q=${q$(q)}`,
    },
    google: {
      name: "Google",
      group: "web",
      home: "https://www.google.com",
      url: (q) => `https://www.google.com/search?q=${q$(q)}`,
    },
    duckduckgo: {
      name: "DuckDuckGo",
      group: "web",
      home: "https://duckduckgo.com",
      url: (q) => `https://duckduckgo.com/?q=${q$(q)}`,
    },
    yandex: {
      name: "Yandex",
      group: "web",
      home: "https://yandex.com",
      url: (q) => `https://yandex.com/search/?text=${q$(q)}`,
    },
    yahoo: {
      name: "Yahoo",
      group: "web",
      home: "https://search.yahoo.com",
      url: (q) => `https://search.yahoo.com/search?p=${q$(q)}`,
    },
    chatgpt: {
      name: "ChatGPT",
      group: "ai",
      ask: true,
      home: "https://chatgpt.com",
      url: (q) => `https://chatgpt.com/?q=${q$(q)}`,
    },
    claude: {
      name: "Claude",
      group: "ai",
      ask: true,
      home: "https://claude.ai",
      url: (q) => `https://claude.ai/new?q=${q$(q)}`,
    },
    gemini: {
      name: "Gemini",
      group: "ai",
      ask: true,
      home: "https://gemini.google.com",
      url: (q) => `https://gemini.google.com/app?q=${q$(q)}`,
    },
    perplexity: {
      name: "Perplexity",
      group: "ai",
      ask: true,
      home: "https://www.perplexity.ai",
      url: (q) => `https://www.perplexity.ai/search?q=${q$(q)}`,
    },
    research: {
      name: "Brave Research",
      group: "ai",
      ask: true,
      home: "https://search.brave.com",
      url: (q) =>
        `https://search.brave.com/ask?enable_research=true&q=${q$(q)}`,
    },
    youtube: {
      name: "YouTube",
      group: "sites",
      home: "https://www.youtube.com",
      url: (q) => `https://www.youtube.com/results?search_query=${q$(q)}`,
    },
    reddit: {
      name: "Reddit",
      group: "sites",
      home: "https://www.reddit.com",
      url: (q) => `https://www.reddit.com/search/?q=${q$(q)}`,
    },
    pinterest: {
      name: "Pinterest",
      group: "sites",
      home: "https://www.pinterest.com",
      url: (q) => `https://www.pinterest.com/search/pins/?q=${q$(q)}`,
    },
    quora: {
      name: "Quora",
      group: "sites",
      home: "https://www.quora.com",
      url: (q) => `https://www.quora.com/search?q=${q$(q)}`,
    },
  };

  /** Menu sections, in order. */
  const ENGINE_GROUPS = [
    ["web", "Search engines"],
    ["ai", "AI assistants"],
    ["sites", "Platforms"],
  ];

  const BROWSER_GLYPH =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/></svg>';

  /**
   * An engine's icon: its site's favicon, through the same local-first lookup
   * pins use, with a lettermark underneath for when no icon can be had. The
   * browser default has no site of its own, so it gets a globe.
   *
   * Call `wireFavicons` on the container after inserting it - that is what
   * walks the fallback chain and reveals the lettermark.
   */
  function engineIcon(key, size = 18) {
    const eng = ENGINES[key] || ENGINES.default;
    if (!eng.home) {
      return `<span class="et-eng-ico is-browser" aria-hidden="true" style="--eng-size:${size}px">${BROWSER_GLYPH}</span>`;
    }
    return `<span class="et-eng-ico" aria-hidden="true" style="--eng-size:${size}px"><img class="et-eng-fav" ${faviconAttr(eng.home)} alt="" width="${size}" height="${size}" /><span class="et-eng-letter">${escapeHtml(eng.name.charAt(0))}</span></span>`;
  }

  // The engine is already shown by its icon beside this field, so naming it in
  // the placeholder too just made the line long enough to crowd the submit
  // button.
  const hintFor = (key) => {
    const e = ENGINES[key] || ENGINES.default;
    return e.ask ? "Ask or type a URL" : "Search or type a URL";
  };

  /**
   * Hands the query to the browser's own configured search provider.
   *
   * This is the Search API the Web Store policy asks for: the extension never
   * decides where a default search goes, it asks the browser to run the search
   * the user's own settings describe.
   *
   * @returns {boolean} False when the API is not available, so the caller can
   *   fall back to a URL rather than swallowing the search.
   */
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

  /** Searches with the engine chosen for the search bar, from anywhere. */
  function searchWeb(query, newTab = false) {
    const text = String(query || "").trim();
    if (!text) return;
    const eng = ENGINES[StorageManager.getSettings().searchEngine] || ENGINES.default;
    if (eng.useSystemDefault && searchWithDefaultEngine(text, newTab)) return;
    const url = eng.url(text);
    if (newTab) window.open(url, "_blank", "noopener");
    else window.location.assign(url);
  }

  const engineName = () =>
    (ENGINES[StorageManager.getSettings().searchEngine] || ENGINES.default).name;

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

    const current = () => ENGINES[currentEngineKey] || ENGINES.default;
    // A panel of sections, each a grid, rather than one long column: with every
    // engine switched on the column ran past the bottom of the window. The
    // first section's header carries the way to choose which engines appear.
    let firstSection = true;
    const optionsHtml = ENGINE_GROUPS.map(([group, label]) => {
      const rows = renderEngines.filter(([, eng]) => (eng.group || "web") === group);
      if (!rows.length) return "";
      const edit = firstSection
        ? `<button type="button" class="nsb-eng-edit" data-act="edit-engines" tabindex="-1">Edit</button>`
        : "";
      firstSection = false;
      return `
        <div class="nsb-eng-section" role="group" aria-label="${label}">
          <div class="nsb-eng-head"><span aria-hidden="true">${label}</span>${edit}</div>
          <div class="nsb-eng-grid">
            ${rows
              .map(
                ([key, eng]) => `
            <div class="et-search-opt ${key === currentEngineKey ? "active" : ""}" data-engine="${key}" role="option" tabindex="-1" aria-selected="${key === currentEngineKey}">
              <span class="et-eng-slot" data-eng="${key}"></span>
              <span class="et-search-opt-name">${escapeHtml(eng.name)}</span>
            </div>`,
              )
              .join("")}
          </div>
        </div>`;
    }).join("");

    /* The engine is shown by its icon alone - the menu it opens names every
       option, and a word in the bar was the widest thing in it after the
       field. The accessible name still says which engine is in use. */
    setSafeHTML(
      bar,
      `
      <div class="et-search-pill" style="position:relative;">
        <span class="et-search-glyph" aria-hidden="true">${icon("search", 17)}</span>
        <button type="button" class="et-search-engine" id="nsbEngLogo" data-no-tooltip aria-haspopup="listbox" aria-expanded="false" aria-controls="nsbEngMenu" aria-label="Search engine: ${escapeHtml(current().name)}">
          <span class="et-search-engine-icon">${engineIcon(currentEngineKey, 18)}</span>
          <svg class="et-search-engine-caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="nsb-eng-menu" id="nsbEngMenu" role="listbox" aria-label="Search engines">
          ${optionsHtml}
        </div>
        <input type="text" class="et-search-input" id="nsbInput" placeholder="${hintFor(currentEngineKey)}" autocomplete="off" spellcheck="false" />
        <button class="et-search-btn et-search-submit" id="nsbSearchBtn" title="Search" aria-label="Search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>`,
    );
    wireFavicons(bar);

    const input = $("nsbInput");
    const logoBtn = $("nsbEngLogo");
    const menu = $("nsbEngMenu");
    const searchBtn = $("nsbSearchBtn");

    bar.onmousedown = (e) => {
      if (input && !e.target.closest("button, .nsb-eng-menu")) {
        e.preventDefault();
        input.focus();
      }
    };

    if (logoBtn && menu) {
      let closeTimeout = null;
      // Opened by a click or a key rather than by passing over it. A menu that
      // opened on hover closes when the pointer leaves; one the user asked for
      // stays until they pick, press Escape or click elsewhere. Before this, a
      // click on the button toggled the hover-opened menu straight back shut.
      let held = false;

      const pill = logoBtn.closest(".et-search-pill") || bar;
      const options = () => [...menu.querySelectorAll(".et-search-opt")];

      const openMenu = (hold = false) => {
        if (closeTimeout) clearTimeout(closeTimeout);
        // Icons are filled in the first time the menu opens. A hidden image
        // still downloads, so building them with the bar cost every new tab a
        // favicon lookup per engine for a menu most tabs never open.
        if (!menu.__icons) {
          menu.__icons = true;
          menu.querySelectorAll(".et-eng-slot").forEach((slot) => {
            setSafeHTML(slot, engineIcon(slot.dataset.eng, 18));
          });
          wireFavicons(menu);
        }
        held = held || hold;
        menu.classList.add("open");
        if (pill) pill.classList.add("menu-open");
        logoBtn.setAttribute("aria-expanded", "true");
        logoBtn.classList.add("active");
      };

      const closeMenu = (immediate = false) => {
        if (closeTimeout) clearTimeout(closeTimeout);
        const resetState = () => {
          held = false;
          menu.classList.remove("open");
          if (pill) pill.classList.remove("menu-open");
          logoBtn.setAttribute("aria-expanded", "false");
          logoBtn.classList.remove("active");
        };
        if (immediate) {
          resetState();
        } else if (!held) {
          closeTimeout = setTimeout(resetState, 200);
        }
      };

      const focusOption = (index) => {
        const opts = options();
        if (!opts.length) return;
        const opt = opts[(index + opts.length) % opts.length];
        opt.focus({ preventScroll: true });
        opt.scrollIntoView({ block: "nearest" });
      };

      const openFromKeyboard = (where) => {
        openMenu(true);
        const opts = options();
        const active = opts.findIndex((o) => o.dataset.engine === currentEngineKey);
        focusOption(where === "last" ? opts.length - 1 : Math.max(active, 0));
      };

      const selectEngine = (engKey) => {
        if (!ENGINES[engKey]) return;
        currentEngineKey = engKey;
        settings.searchEngine = engKey;
        StorageManager.save();
        const iconHost = logoBtn.querySelector(".et-search-engine-icon");
        if (iconHost) {
          setSafeHTML(iconHost, engineIcon(engKey, 18));
          wireFavicons(iconHost);
        }
        logoBtn.setAttribute("aria-label", `Search engine: ${ENGINES[engKey].name}`);
        input.placeholder = hintFor(engKey);
        options().forEach((o) => {
          const on = o.dataset.engine === engKey;
          o.classList.toggle("active", on);
          o.setAttribute("aria-selected", String(on));
        });
        closeMenu(true);
        input.focus();
      };

      logoBtn.dataset.popoverTrigger = "search-engine";
      logoBtn.addEventListener("click", (e) => {
        const isOpen = menu.classList.contains("open");
        // `detail` is 0 for a click made with Enter or Space.
        if (e.detail === 0) {
          if (isOpen) closeMenu(true);
          else openFromKeyboard();
          return;
        }
        if (isOpen && held) closeMenu(true);
        else openMenu(true);
      });

      logoBtn.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          openFromKeyboard(e.key === "ArrowUp" ? "last" : "active");
        } else if (e.key === "Escape" && menu.classList.contains("open")) {
          e.preventDefault();
          e.stopPropagation();
          closeMenu(true);
        }
      });

      logoBtn.addEventListener("mouseenter", () => openMenu());
      menu.addEventListener("mouseenter", () => openMenu());
      logoBtn.addEventListener("mouseleave", () => closeMenu(false));
      menu.addEventListener("mouseleave", () => closeMenu(false));

      menu.addEventListener("click", (e) => {
        if (e.target.closest('[data-act="edit-engines"]')) {
          e.stopPropagation();
          closeMenu(true);
          SettingsRenderer.openSideSheet("search");
          return;
        }
        const opt = e.target.closest(".et-search-opt");
        if (!opt) return;
        e.stopPropagation();
        selectEngine(opt.dataset.engine);
      });

      // Arrows move through the grid the way it looks: left and right along a
      // row and on into the next, up and down to the nearest option in the row
      // above or below - including across a section break, where the columns
      // of the two grids need not line up.
      const neighbour = (opts, from, key) => {
        const i = opts.indexOf(from);
        if (key === "ArrowLeft") return opts[i - 1] || null;
        if (key === "ArrowRight") return opts[i + 1] || null;
        const r0 = from.getBoundingClientRect();
        const cx = r0.left + r0.width / 2;
        const cy = r0.top + r0.height / 2;
        const down = key === "ArrowDown";
        let best = null;
        let bestScore = Infinity;
        for (const o of opts) {
          if (o === from) continue;
          const r = o.getBoundingClientRect();
          const dy = r.top + r.height / 2 - cy;
          if (down ? dy <= 4 : dy >= -4) continue;
          const score = Math.abs(dy) * 4 + Math.abs(r.left + r.width / 2 - cx);
          if (score < bestScore) {
            bestScore = score;
            best = o;
          }
        }
        return best;
      };

      menu.addEventListener("keydown", (e) => {
        const opts = options();
        const i = opts.indexOf(document.activeElement);
        const handled = () => {
          e.preventDefault();
          e.stopPropagation();
        };
        switch (e.key) {
          case "ArrowDown":
          case "ArrowUp":
          case "ArrowLeft":
          case "ArrowRight": {
            handled();
            if (i < 0) {
              focusOption(0);
              break;
            }
            const next = neighbour(opts, opts[i], e.key);
            if (next) {
              next.focus({ preventScroll: true });
              next.scrollIntoView({ block: "nearest" });
            }
            break;
          }
          case "Home":
            handled();
            focusOption(0);
            break;
          case "End":
            handled();
            focusOption(opts.length - 1);
            break;
          case "Enter":
          case " ":
            if (i >= 0) {
              handled();
              selectEngine(opts[i].dataset.engine);
            }
            break;
          case "Escape":
            handled();
            closeMenu(true);
            logoBtn.focus();
            break;
          case "Tab":
            closeMenu(true);
            break;
        }
      });

      // Hover-opened, so it registers for outside-click/close-others handling
      // but never calls closeAll itself - brushing past the logo should not
      // dismiss a popover the user deliberately opened.
      PopoverRegistry.register("search-engine", () => menu, () =>
        closeMenu(true),
      );
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

  /**
   * City search for the weather.
   *
   * Typing asks Open-Meteo's geocoder for up to six places matching what has
   * been typed so far, so a city is picked from a list - with its region and
   * country, which is what tells two Springfields apart - instead of being
   * guessed at and reported "not found" a second later. The picked place's
   * coordinates go straight into the weather cache, so the forecast request
   * that follows skips the geocoder.
   *
   * Nothing is sent until two characters are typed and the typing has paused.
   *
   * @param {HTMLInputElement} input
   * @param {{onPick?: (p: {city: string, place: object}) => void}} [opts]
   */
  function attachCityPicker(input, { onPick } = {}) {
    if (!input || input.__cityPicker) return;
    input.__cityPicker = true;

    // Positioned against a wrapper rather than the field's parent, which in
    // settings is a flex row the list would otherwise join as a third column.
    const wrap = document.createElement("span");
    wrap.className = "et-city-wrap";
    input.replaceWith(wrap);
    wrap.appendChild(input);

    const listId = `${input.id || "city"}-places`;
    const list = document.createElement("div");
    list.id = listId;
    list.className = "et-city-list";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Matching places");
    list.hidden = true;
    wrap.appendChild(list);

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", listId);
    input.autocomplete = "off";
    input.spellcheck = false;

    let results = [];
    let active = -1;
    let timer = null;
    let controller = null;

    const close = () => {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      active = -1;
    };

    const describe = (r) =>
      [r.admin1 && r.admin1 !== r.name ? r.admin1 : "", r.country]
        .filter(Boolean)
        .join(", ");

    // Moves the highlight without rebuilding the list. Rebuilding under the
    // pointer replaced the option between mousedown and mouseup, and a click
    // whose two halves land on different elements is not a click.
    const highlight = (i) => {
      active = i;
      list.querySelectorAll(".et-city-opt").forEach((el, n) => {
        const on = n === i;
        el.classList.toggle("is-active", on);
        el.setAttribute("aria-selected", String(on));
        if (on) el.scrollIntoView({ block: "nearest" });
      });
      if (i >= 0) input.setAttribute("aria-activedescendant", `${listId}-${i}`);
      else input.removeAttribute("aria-activedescendant");
    };

    const paint = () => {
      if (!results.length) {
        setSafeHTML(list, `<div class="et-city-empty">No matching places</div>`);
        list.hidden = false;
        input.setAttribute("aria-expanded", "false");
        return;
      }
      setSafeHTML(
        list,
        results
          .map(
            (r, i) => `
          <div class="et-city-opt" id="${listId}-${i}" role="option" aria-selected="false" data-i="${i}">
            <span class="et-city-name">${escapeHtml(r.name)}</span>
            <span class="et-city-meta">${escapeHtml(describe(r))}</span>
          </div>`,
          )
          .join(""),
      );
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      highlight(0);
    };

    const pick = (i) => {
      const r = results[i];
      if (!r) return;
      input.value = r.name;
      close();
      weatherCache.write({
        city: r.name,
        lat: r.latitude,
        lon: r.longitude,
        name: r.name,
        data: null,
        time: 0,
      });
      onPick?.({ city: r.name, place: r });
    };

    const search = async (q) => {
      controller?.abort();
      controller = new AbortController();
      const lang = String(navigator.language || "en").slice(0, 2).toLowerCase();
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=${encodeURIComponent(lang)}&format=json`,
          { signal: controller.signal },
        );
        const json = await res.json();
        // A slower answer to an older query must not replace a newer one.
        if (input.value.trim() !== q || document.activeElement !== input) return;
        // The geocoder can list the same place twice under different ids.
        const seen = new Set();
        results = (Array.isArray(json.results) ? json.results : []).filter((r) => {
          const id = `${r.name}|${r.admin1 || ""}|${r.country || ""}`;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        paint();
      } catch (e) {
        if (e?.name !== "AbortError") close();
      }
    };

    input.addEventListener("input", () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) {
        controller?.abort();
        results = [];
        close();
        return;
      }
      timer = setTimeout(() => search(q), 250);
    });

    input.addEventListener("keydown", (e) => {
      if (list.hidden || !results.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        highlight((active + step + results.length) % results.length);
      } else if (e.key === "Enter" && active >= 0) {
        // Stopped here so a dialog around the field does not also take Enter
        // as "save" for the half-typed text.
        e.preventDefault();
        e.stopPropagation();
        pick(active);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    });

    // Keeps focus in the field, so the blur below does not close the list
    // before the click that picks from it lands.
    list.addEventListener("mousedown", (e) => e.preventDefault());
    list.addEventListener("click", (e) => {
      const opt = e.target.closest(".et-city-opt");
      if (opt) pick(Number(opt.dataset.i));
    });
    list.addEventListener("pointermove", (e) => {
      const opt = e.target.closest(".et-city-opt");
      if (opt && Number(opt.dataset.i) !== active) highlight(Number(opt.dataset.i));
    });
    input.addEventListener("blur", () => setTimeout(close, 120));
  }

  function initWeather() {
    const weatherEl = $("weatherWidget");
    if (!weatherEl) return;

    weatherEl.onclick = () => {
      const s = StorageManager.getSettings();
      showCustomModal(
        "Weather location",
        `
        <div class="dialog-field">
          <label class="dialog-label" for="dlgCity">City</label>
          <input type="text" id="dlgCity" class="dialog-input" value="${escapeHtml(s.weatherCity || "")}" placeholder="Start typing a city" />
        </div>`,
        () => {
          const input = $("dlgCity");
          const val = (input?.value || "").trim();
          if (!val) {
            markInvalid(input, true);
            input?.focus();
            return false;
          }
          s.weatherCity = val;
          s.widgets.weather = true;
          StorageManager.save();
          initWeather();
          applyWidgetVisibility();
          ToastSystem.success(`Weather set to ${val}`);
          return true;
        },
      );
      const input = $("dlgCity");
      // Picking a place is the answer, so it saves - no second Enter needed.
      attachCityPicker(input, { onPick: () => $("modalOkBtn")?.click() });
      input?.focus();
      input?.select();
    };

    const settings = StorageManager.getSettings();
    if (!settings.weatherCity) {
      setSafeHTML(weatherEl, `${weatherIcon(0, true).svg} <span>Set City</span>`);
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
        `${weatherIcon(0, true).svg} <span>Set City in Settings</span>`,
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
            `${weatherIcon(0, true).svg} <span>City Not Found</span>`,
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
          `${weatherIcon(0, true).svg} <span>Offline</span>`,
        );
    }
  }
  /* Weather glyphs, drawn in colour.

     The old ones were single-colour outlines at the size of the text beside
     them: over a busy photo the sun and the cloud were hard to tell apart and
     easy to miss. These are filled - a yellow sun, a white cloud with a grey
     edge that still shows on a light page, blue rain, a yellow bolt - and a
     night variant uses the moon. Codes are Open-Meteo's WMO weather codes. */
  const WX_CLOUD = (fill = "#F4F7FB", stroke = "#94A3B8", dy = 0) =>
    `<path transform="translate(0 ${dy})" d="M7.2 19h10a4.3 4.3 0 0 0 .6-8.56A6 6 0 0 0 6.5 9.2 4.9 4.9 0 0 0 7.2 19z" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>`;
  const WX_SUN = `<circle cx="12" cy="12" r="4.6" fill="#FFC53D"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4 7 7M17 17l1.6 1.6M5.4 18.6 7 17M17 7l1.6-1.6" stroke="#FFB020" stroke-width="2" stroke-linecap="round"/>`;
  const WX_MOON = `<path d="M15.6 3.3a8.6 8.6 0 1 0 5.2 13.7A7.1 7.1 0 0 1 15.6 3.3z" fill="#FFD66B" stroke="#E8B53A" stroke-width="0.8"/>`;
  const WX_SMALL_SUN = `<circle cx="8.6" cy="8.2" r="3.7" fill="#FFC53D"/><path d="M8.6 1.9v1.5M2.3 8.2h1.5M4.1 3.7l1.1 1.1M13.1 3.7 12 4.8" stroke="#FFB020" stroke-width="1.7" stroke-linecap="round"/>`;
  const WX_SMALL_MOON = `<path d="M10.8 2.6a5.6 5.6 0 1 0 3.3 9.1 4.6 4.6 0 0 1-3.3-9.1z" fill="#FFD66B" stroke="#E8B53A" stroke-width="0.7"/>`;

  function weatherIcon(code, isDay = true) {
    const c = Number(code) || 0;
    let label = "Clear";
    let body;
    if (c === 0) {
      body = isDay ? WX_SUN : WX_MOON;
    } else if (c === 1 || c === 2) {
      label = c === 1 ? "Mostly clear" : "Partly cloudy";
      body = (isDay ? WX_SMALL_SUN : WX_SMALL_MOON) + `<g transform="translate(2.2 1.6) scale(0.92)">${WX_CLOUD()}</g>`;
    } else if (c === 3) {
      label = "Overcast";
      body = `<g transform="translate(-2 -3.2) scale(0.9)">${WX_CLOUD("#CBD5E1", "#94A3B8")}</g>` + WX_CLOUD();
    } else if (c === 45 || c === 48) {
      label = "Fog";
      body = WX_CLOUD("#F4F7FB", "#94A3B8", -3) + `<path d="M4.5 19.5h11M8.5 22.5h11" stroke="#94A3B8" stroke-width="1.9" stroke-linecap="round"/>`;
    } else if (c >= 51 && c <= 57) {
      label = "Drizzle";
      body = WX_CLOUD("#F4F7FB", "#94A3B8", -3) + `<path d="M9 18.8l-.7 2M13 18.8l-.7 2M17 18.8l-.7 2" stroke="#4FB3F6" stroke-width="1.8" stroke-linecap="round"/>`;
    } else if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) {
      label = c >= 80 ? "Rain showers" : "Rain";
      body = WX_CLOUD("#E2E8F0", "#8492A6", -3) + `<path d="M8.6 18.6l-1.2 3.4M12.6 18.6l-1.2 3.4M16.6 18.6l-1.2 3.4" stroke="#2F9BF0" stroke-width="2.1" stroke-linecap="round"/>`;
    } else if ((c >= 71 && c <= 77) || c === 85 || c === 86) {
      label = "Snow";
      body = WX_CLOUD("#F8FAFC", "#94A3B8", -3) + `<g fill="#7CC4F5" stroke="#4E9FD6" stroke-width="0.5"><circle cx="8.4" cy="20" r="1.4"/><circle cx="12.4" cy="22.2" r="1.4"/><circle cx="16.4" cy="20" r="1.4"/></g>`;
    } else if (c >= 95) {
      label = "Thunderstorm";
      body = WX_CLOUD("#B7C2D0", "#6B7A8F", -3) + `<path d="M12.9 14.3 9.8 19h2.7l-1.5 4.5 4.6-6.2h-2.8l1.7-3z" fill="#FFC53D" stroke="#D99A00" stroke-width="0.6" stroke-linejoin="round"/>`;
    } else {
      label = "Cloudy";
      body = WX_CLOUD();
    }
    return {
      label,
      svg: `<svg class="et-wx" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`,
    };
  }

  function renderWeatherData(weatherData, name) {
    const weatherEl = $("weatherWidget");
    if (!weatherEl || !weatherData.current_weather) return;
    const current = weatherData.current_weather;
    const settings = StorageManager.getSettings();
    const unitSymbol = settings.weatherUnit === "f" ? "°F" : "°C";
    const temp = Math.round(current.temperature);
    const { svg, label } = weatherIcon(current.weathercode, current.is_day !== 0);

    // Temperature and icon only. The city is something you set once and then
    // already know; printing it on every new tab spent the longest word in the
    // line on the least useful fact in it. It stays in the tooltip.
    weatherEl.title = `${label} in ${name} - click to change city`;
    weatherEl.setAttribute(
      "aria-label",
      `${label}, ${temp}${unitSymbol} in ${name}. Change city`,
    );
    setSafeHTML(weatherEl, `${svg} <span>${temp}${unitSymbol}</span>`);
  }

  function applyWidgetVisibility() {
    const s = StorageManager.getSettings();
    const w = s.widgets || {};
    const clock = $("clockWidget");
    const cornerLeft = $("homeCornerLeft");
    const cornerRight = $("homeCornerRight");
    const search = $("navSearchBar");
    const weather = $("weatherWidget");
    const pinned = $("homePinned");
    const workspace = $("workspaceBtn");

    if (clock) clock.style.display = w.clock !== false ? "" : "none";
    const greetingEl = $("clockGreeting");
    if (greetingEl) greetingEl.style.display = w.greeting === false ? "none" : "";
    if (search) search.style.display = w.navSearch !== false ? "" : "none";
    if (weather) weather.style.display = w.weather ? "" : "none";
    // The corner boxes are positioned absolutely, so an empty one still sits
    // in the page taking hover; hide the box, not just its contents.
    if (cornerLeft) cornerLeft.classList.toggle("is-off", w.date !== true);
    if (cornerRight) cornerRight.classList.toggle("is-off", !w.weather);
    if (workspace)
      workspace.style.display = w.workspace !== false ? "" : "none";
    if (pinned) pinned.style.display = s.hidePinnedOnHome ? "none" : "flex";
    document.body.classList.toggle("hide-pinned-home", !!s.hidePinnedOnHome);
    const pinsPos = ["left", "right", "bottom"].includes(s.pinsPosition)
      ? s.pinsPosition
      : "center";
    ["center", "left", "right", "bottom"].forEach((p) =>
      document.body.classList.toggle(`pins-pos-${p}`, p === pinsPos),
    );
    // Beside or below the column, the row is placed against the Home view
    // itself. Left inside the centre column it was positioned against the
    // column, and "left side" landed in the middle of the page.
    const pinsEl = $("homePinned");
    const homeView = $("homeView");
    const centreCol = document.querySelector("#homeView > .et-home-center");
    if (pinsEl && homeView && centreCol) {
      if (pinsPos === "center") {
        if (pinsEl.parentElement !== centreCol)
          centreCol.insertBefore(pinsEl, $("homeTodos"));
      } else if (pinsEl.parentElement !== homeView) {
        homeView.appendChild(pinsEl);
      }
    }

    const raw = s.clockPosition === "corner" ? "bottom-left" : s.clockPosition;
    const pos = CLOCK_POSITIONS.includes(raw) ? raw : "center";
    CLOCK_POSITIONS.forEach((p) =>
      document.body.classList.toggle(`clock-pos-${p}`, p === pos),
    );

    document.body.classList.toggle("clock-pos-fixed", pos !== "center");
    placeClockBlock(pos !== "center");

    applyClockAppearance(s);
    // The clock only repaints on a tick, and ticks are suspended while the tab
    // is in the background - so a layout change made while it was hidden could
    // leave the date and greeting blank until the next visible second. Anything
    // that rearranges the home block repaints it.
    updateClock(true);
  }

  /**
   * Puts the clock block where the chosen layout wants it.
   *
   * The greeting, the time, the date and the weather are one element now, so
   * there is nothing to gather up first - only the block itself to move. It is
   * lifted out of `#homeView` and into `.app` whenever it leaves the centre:
   * `.et-view.active` runs a `translateY` entrance animation, and a transformed
   * ancestor becomes the containing block for `position: fixed` descendants, so
   * `top: 15px` was being measured from the top of the view rather than the top
   * of the window and landed 66px down. `.app` carries no transform, so from
   * there the corner offsets mean what they say.
   */
  function placeClockBlock(docked) {
    const app = document.querySelector(".app");
    const centre = $("homeWidgets");
    const clock = $("clockWidget");
    const target = docked ? app : centre;
    if (clock && target && clock.parentElement !== target)
      target.appendChild(clock);
  }

  const CLOCK_FONT_STACKS = {
    system: {
      stack:
        "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      // Regular, not semibold. At the size the clock is now set, 600 read as
      // heavy and made the page feel denser than it is; the weight is what
      // separates a calm clock from a loud one. The Thin and Light faces are
      // still there for anyone who wants to go further.
      weight: 400,
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
    // Bundled (fonts/outfit-latin.woff2), so it renders the same offline and
    // on every browser. Geometric, open numerals that stay light at display
    // size without going as thin as the iOS-style face.
    outfit: {
      stack: "'Outfit', var(--font-app, sans-serif)",
      weight: 400,
      spacing: "-0.02em",
    },
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

    watchClockSpacing();
    fitClockSpacing();
  }

  /* Clock-to-greeting spacing, measured from the letters themselves.

     A text box is taller than the ink in it by an amount that belongs to the
     font: under the digits sit the descender band and any leading, above the
     greeting the ascender band. Those bands came to 47px under a 139px clock
     here, and more on a bigger screen, so the gap you saw was mostly empty box
     rather than the spacing the stylesheet asked for. `text-box` was meant to
     trim them and did not reliably reach the digits' baseline.

     The font's own metrics say exactly how deep those bands are, so they are
     measured on a canvas in the computed font and handed to CSS, which pulls
     the boxes in by that much. The gap on screen is then the stylesheet's
     number on every font, size and browser. */
  const inkCanvas = document.createElement("canvas").getContext("2d");

  /**
   * Empty space above the first line's ink, and between the ink and the
   * bottom of the element's box (so anything else holding the box open is
   * counted too).
   */
  function inkBands(el, sample) {
    const cs = getComputedStyle(el);
    inkCanvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = inkCanvas.measureText(sample);
    const ascent = m.fontBoundingBoxAscent;
    const descent = m.fontBoundingBoxDescent;
    if (!(ascent > 0)) return null;
    const lineHeight = parseFloat(cs.lineHeight);
    const line = Number.isFinite(lineHeight) ? lineHeight : ascent + descent;
    const baseline = (line - (ascent + descent)) / 2 + ascent;
    const box = el.getBoundingClientRect().height || line;
    return {
      top: Math.max(0, baseline - m.actualBoundingBoxAscent),
      bottom: Math.max(0, box - baseline - m.actualBoundingBoxDescent),
    };
  }

  function fitClockSpacing() {
    const clock = $("clockWidget");
    const time = $("clockTime");
    const greeting = $("clockGreeting");
    if (!clock || !time) return;
    const digits = time.querySelector(".clock-digits");
    const clockInk = inkBands(time, (digits || time).textContent.trim() || "00:00");
    if (clockInk) {
      clock.style.setProperty("--clock-ink-top", `${clockInk.top.toFixed(1)}px`);
      clock.style.setProperty("--clock-ink-bottom", `${clockInk.bottom.toFixed(1)}px`);
    }
    // Capital height is what the eye reads as the top of a line of text.
    const greetInk = greeting ? inkBands(greeting, "H") : null;
    if (greetInk)
      clock.style.setProperty("--greeting-ink-top", `${greetInk.top.toFixed(1)}px`);
  }

  let clockSpacingWatched = false;
  function watchClockSpacing() {
    if (clockSpacingWatched) return;
    clockSpacingWatched = true;
    // The clock is sized in viewport units and fonts arrive late, so either
    // changes the bands. Resizes of the two boxes cover both; setting the
    // margins does not resize them, so this cannot feed itself.
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(() => fitClockSpacing());
      [$("clockTime"), $("clockGreeting")].forEach((el) => el && observer.observe(el));
    }
    document.fonts?.addEventListener?.("loadingdone", fitClockSpacing);
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
    engineIcon,
    attachCityPicker,
    searchWeb,
    engineName,
  };
})();

/**
 * First run: the name screen.
 *
 * Shown over the app on the user's own wallpaper before anything else, so the
 * first thing a new install does is ask one question rather than present a
 * finished page addressed to nobody. It is deliberately skippable - a name is
 * a nicety, not a gate - and never appears again once completed.
 */
const WelcomeScreen = (() => {
  function finish(name) {
    const settings = StorageManager.getSettings();
    const clean = String(name || "")
      .trim()
      .slice(0, 40);
    if (clean) settings.displayName = clean;
    settings.welcomeSeen = true;
    StorageManager.saveSettings();

    const screen = $("welcomeScreen");
    if (screen) screen.hidden = true;
    // Repaint so the greeting says the new name immediately rather than on
    // the next minute tick.
    try {
      WidgetsRenderer.updateClock(true);
    } catch {}
  }

  /** @returns {boolean} Whether the screen was shown. */
  function maybeShow() {
    const settings = StorageManager.getSettings();
    if (settings.welcomeSeen || (settings.displayName || "").trim())
      return false;

    const screen = $("welcomeScreen");
    const input = $("welcomeName");
    const button = $("welcomeContinue");
    if (!screen || !input || !button) return false;

    screen.hidden = false;
    // Empty until something is typed: "Continue" with nothing in the field
    // would look like the button is broken rather than like a skip.
    const sync = () => {
      button.disabled = false;
      button.textContent = input.value.trim() ? "Continue" : "Skip";
      button.append(chevron());
    };
    const chevron = () => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "15");
      svg.setAttribute("height", "15");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "currentColor");
      svg.setAttribute("stroke-width", "2.5");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("aria-hidden", "true");
      const p = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polyline",
      );
      p.setAttribute("points", "9 18 15 12 9 6");
      svg.appendChild(p);
      return svg;
    };

    input.addEventListener("input", sync);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        finish(input.value);
      }
      // Escape skips rather than trapping someone on the first screen.
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish("");
      }
    });
    button.addEventListener("click", () => finish(input.value));

    sync();
    // After the boot reveal, or the field is focused while still invisible.
    requestAnimationFrame(() => input.focus());
    return true;
  }

  return { maybeShow };
})();
