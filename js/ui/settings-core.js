"use strict";

const SettingsRenderer = (() => {
  // Which subject the sheet is showing. The tab modules are an authoring
  // detail underneath this - a page may need one of them or two.
  let activePage = "appearance";
  // Queued scroll target, consumed by the next paint. Used by deep links such
  // as "open settings at the wallpaper picker".
  let pendingSection = null;

  const PRESETS = [
    {
      id: "pastel-pink",
      name: "Pastel Pink",
      group: "Pastel",
      mode: "light",
      accent: "#f9c8d6",
      accent2: "#f18fae",
      radius: null,
    },
    {
      id: "pastel-blue",
      name: "Pastel Blue",
      group: "Pastel",
      mode: "light",
      accent: "#bbd6fd",
      accent2: "#7db0f5",
      radius: null,
    },
    {
      id: "pastel-red",
      name: "Pastel Red",
      group: "Pastel",
      mode: "light",
      accent: "#fdbdbd",
      accent2: "#f58585",
      radius: null,
    },
    {
      id: "pastel-yellow",
      name: "Pastel Yellow",
      group: "Pastel",
      mode: "light",
      accent: "#ffed80",
      accent2: "#f5cf3d",
      radius: null,
    },
    {
      id: "pastel-green",
      name: "Pastel Green",
      group: "Pastel",
      mode: "light",
      accent: "#c7e4c7",
      accent2: "#8ec98e",
      radius: null,
    },
    {
      id: "pastel-cyan",
      name: "Pastel Cyan",
      group: "Pastel",
      mode: "light",
      accent: "#9cefef",
      accent2: "#4fd4d4",
      radius: null,
    },
    {
      id: "pastel-orange",
      name: "Pastel Orange",
      group: "Pastel",
      mode: "light",
      accent: "#ffd8b2",
      accent2: "#f7ac68",
      radius: null,
    },
    {
      id: "pastel-purple",
      name: "Pastel Purple",
      group: "Pastel",
      mode: "light",
      accent: "#dac2e8",
      accent2: "#b48fd0",
      radius: null,
    },
    {
      id: "pastel-silver",
      name: "Pastel Silver",
      group: "Pastel",
      mode: "light",
      accent: "#c6c6c6",
      accent2: "#949494",
      radius: null,
    },

    {
      id: "neon-original",
      name: "Original GX",
      group: "Neon",
      mode: "dark",
      accent: "#fa1e4e",
      accent2: "#ff5c7a",
      seed: "#0f0f13",
      radius: "0px",
    },
    {
      id: "neon-ultraviolet",
      name: "Ultraviolet",
      group: "Neon",
      mode: "dark",
      accent: "#9d4edd",
      accent2: "#00f0ff",
      seed: "#100e17",
      radius: "0px",
    },
    {
      id: "neon-subzero",
      name: "Subzero",
      group: "Neon",
      mode: "dark",
      accent: "#00e5ff",
      accent2: "#4361ee",
      seed: "#0b1017",
      radius: "0px",
    },
    {
      id: "neon-rose-quartz",
      name: "Rose Quartz",
      group: "Neon",
      mode: "dark",
      accent: "#ff5376",
      accent2: "#c77dff",
      seed: "#140e14",
      radius: "0px",
    },
    {
      id: "neon-frutti",
      name: "Frutti di Mare",
      group: "Neon",
      mode: "dark",
      accent: "#ff2a85",
      accent2: "#00f5d4",
      seed: "#120e16",
      radius: "0px",
    },
    {
      id: "neon-hackerman",
      name: "Hackerman",
      group: "Neon",
      mode: "dark",
      accent: "#00ff66",
      accent2: "#00e5ff",
      seed: "#090e0c",
      radius: "0px",
    },
  ];

  const PRESET_GROUPS = ["Pastel", "Neon"];

  // Presets retired when the Gamer group was replaced. Anyone still on one
  // keeps the exact colours they had -- the theme simply becomes "Custom" --
  // so the swap cannot silently restyle someone's page.
  const RETIRED_PRESETS = {
    neon: "0px",
    synthwave: "0px",
    matrix: "0px",
    amber: "0px",
  };

  const presetById = (id) => PRESETS.find((p) => p.id === id) || null;

  const HEX6 = /^#[0-9a-f]{6}$/i;

  function liveVar(name, fallback) {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return HEX6.test(v) ? v : fallback;
  }

  function effectiveAccent() {
    const s = StorageManager.getSettings();
    if (HEX6.test(s.accentOverride || "")) return s.accentOverride;
    if (HEX6.test(s.accentColor || "")) return s.accentColor;
    return liveVar("--accent-color", "#6366f1");
  }

  const darkMedia = window.matchMedia("(prefers-color-scheme: dark)");

  const systemDark = () => darkMedia.matches;

  const MAX_WALLPAPERS = 5;

  const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

  const WP_MAX_PX = 2560;

  function rememberWallpaper(wp) {
    const arr = StorageManager.getData().wallpapers;
    const existing = arr.findIndex((w) => w.value === wp.value);
    if (existing >= 0) arr.splice(existing, 1);
    arr.push(wp);
    if (arr.length > MAX_WALLPAPERS) arr.splice(0, arr.length - MAX_WALLPAPERS);
  }

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("Could not read that file."));
      r.readAsDataURL(file);
    });
  }

  function downscaleImage(file) {
    return new Promise((resolve, reject) => {
      let url = null;
      const done = (fn, arg) => {
        if (url) {
          URL.revokeObjectURL(url);
          url = null;
        }
        fn(arg);
      };
      try {
        url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          try {
            const scale = Math.min(
              1,
              WP_MAX_PX / Math.max(img.width, img.height),
            );
            const w = Math.max(1, Math.round(img.width * scale));
            const h = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            canvas.getContext("2d").drawImage(img, 0, 0, w, h);

            let out = canvas.toDataURL("image/webp", 0.85);
            if (!out.startsWith("data:image/webp")) {
              out = canvas.toDataURL("image/jpeg", 0.86);
            }
            done(resolve, out);
          } catch (e) {
            done(reject, new Error("Could not process that image."));
          }
        };
        img.onerror = () =>
          done(reject, new Error("That file is not a readable image."));
        img.src = url;
      } catch (e) {
        done(reject, new Error("Could not read that file."));
      }
    });
  }

  const MAX_REMOTE_BYTES = 25 * 1024 * 1024;

  async function localiseImage(url) {
    try {
      const res = await fetch(url, { credentials: "omit", redirect: "follow" });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!/^image\//i.test(blob.type)) return null;
      if (blob.size > MAX_REMOTE_BYTES) return null;
      return await downscaleImage(blob);
    } catch {
      return null;
    }
  }

  async function localiseAllRemoteWallpapers() {
    try {
      const data = StorageManager.getData();
      if (!data || !Array.isArray(data.wallpapers)) return;
      for (const wp of data.wallpapers) {
        if (
          wp.type === "image" &&
          typeof wp.value === "string" &&
          /^https?:\/\//i.test(wp.value)
        ) {
          const oldVal = wp.value;
          const local = await localiseImage(oldVal);
          if (local) {
            const stored = await StorageManager.putMedia(uuid(), local);
            wp.value = stored;
            const settings = StorageManager.getSettings();
            if (settings.backgroundValue === oldVal) {
              settings.backgroundValue = stored;
              const photoBg = $("photo-bg");
              if (photoBg)
                photoBg.style.backgroundImage = `url("${String(local).replace(/"/g, "%22")}")`;
            }
            StorageManager.save();
            StorageManager.pruneMedia();
          }
        }
      }
    } catch {}
  }

  const TAB_SCRIPTS = {
    theme: "js/ui/settings-theme.js",
    widgets: "js/ui/settings-widgets.js",
    search: "js/ui/settings-search.js",
    data: "js/ui/settings-data.js",
    help: "js/ui/settings-help.js",
    support: "js/ui/settings-support.js",
  };
  const tabModules = Object.create(null);
  const tabPromises = Object.create(null);

  let renderToken = 0;

  function registerTab(name, mod) {
    tabModules[name] = mod;
  }

  function loadTab(name) {
    if (tabModules[name]) return Promise.resolve(tabModules[name]);
    if (tabPromises[name]) return tabPromises[name];

    const src = TAB_SCRIPTS[name];
    if (!src) return Promise.reject(new Error("Unknown settings tab: " + name));

    tabPromises[name] = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = () => {
        if (tabModules[name]) resolve(tabModules[name]);
        else reject(new Error(name + " did not register"));
      };
      script.onerror = () => reject(new Error("Could not load " + src));
      document.head.appendChild(script);
    });

    tabPromises[name].catch(() => {
      delete tabPromises[name];
    });
    return tabPromises[name];
  }

  function init() {
    initSideSheet();
    setTimeout(localiseAllRemoteWallpapers, 200);

    darkMedia.addEventListener("change", () => {
      const s = StorageManager.getSettings();
      if (s.mode === "system") {
        const hasCustomBg = ["image", "video"].includes(s.backgroundType);
        if (!hasCustomBg) {
          applySeed(systemDark() ? "#0e1014" : "#f6f7fb");
          s.mode = "system";
          StorageManager.save();
        }
        applyTheme();
      }
    });
  }

  /**
   * The settings pages, in sidebar order.
   *
   * A page is a subject, not a module. "Wallpaper" means every wallpaper
   * control there is, wherever it happens to be authored - the picker lives in
   * the theme module and the crop and blur controls in the widgets module, and
   * the user should never have to know or care. Each page names the tab modules
   * whose markup it needs; everything rendered is then filtered down to the
   * blocks tagged `data-page` with this page's id, so one module can contribute
   * sections to several pages without any of them being rendered twice.
   *
   * `find` carries the words someone might search for that are not in the
   * title. Adding a setting later is a row here plus a `data-page` attribute.
   */
  const PAGES = [
    {
      group: "Customize",
      items: [
        {
          id: "appearance",
          label: "Appearance",
          tabs: ["widgets", "theme"],
          find: "corner radius rounded sharp font typeface board width size interface background strength opacity transparency surface performance ambient wash",
        },
        {
          id: "themes",
          label: "Themes",
          tabs: ["theme"],
          find: "light dark system mode accent colour color two-tone secondary base background scheme",
        },
        {
          id: "presets",
          label: "Presets",
          tabs: ["theme"],
          find: "preset share copy code export import theme pastel neon",
        },
        {
          id: "wallpaper",
          label: "Wallpaper",
          tabs: ["theme", "widgets"],
          find: "photo video upload url blur soften dim crop zoom position fit gallery saved mute volume",
        },
        {
          id: "home",
          label: "Home page",
          tabs: ["theme", "widgets"],
          find: "widgets clock greeting name date weather search bar pinned links launcher time format 12 24 hour shadow",
        },
        {
          id: "search",
          label: "Search engines",
          tabs: ["search"],
          find: "engine default browser google duckduckgo yandex yahoo bing chatgpt claude gemini perplexity brave youtube reddit pinterest quora ai",
        },
      ],
    },
    {
      group: "Your data",
      items: [
        { id: "backup", label: "Backup & import", tabs: ["data"], find: "export json bookmarks raindrop restore" },
        { id: "maintenance", label: "Maintenance", tabs: ["data"], find: "duplicates repair wallpaper cache" },
        { id: "privacy", label: "Privacy", tabs: ["data"], find: "favicons remote tracking permissions" },
        { id: "reset", label: "Reset", tabs: ["data"], find: "clear boards wipe delete everything factory danger" },
      ],
    },
    {
      group: "About",
      items: [
        { id: "help", label: "Help", tabs: ["help"], find: "guide how to shortcuts keyboard" },
        { id: "support", label: "Support", tabs: ["support"], find: "discord instagram contact feedback bug" },
      ],
    },
  ];

  /* Deep links from elsewhere in the app still name the old tabs. */
  const TAB_TO_PAGE = {
    theme: "themes",
    widgets: "appearance",
    search: "search",
    data: "backup",
    help: "help",
    support: "support",
  };

  const allPages = () => PAGES.flatMap((g) => g.items);
  const pageById = (id) => allPages().find((p) => p.id === id);

  function renderSettingsNav(filter = "") {
    const nav = $("settingsNav");
    if (!nav) return;
    const q = filter.trim().toLowerCase();
    // The group name comes from the group, not the item - matching a section by
    // the heading it sits under is half of what makes searching for "data" or
    // "customize" work.
    const match = (it, group) =>
      !q ||
      it.label.toLowerCase().includes(q) ||
      group.toLowerCase().includes(q) ||
      (it.find || "").includes(q);

    const groups = PAGES.map((g) => ({
      ...g,
      items: g.items.filter((it) => match(it, g.group)),
    })).filter((g) => g.items.length);

    if (!groups.length) {
      setSafeHTML(
        nav,
        `<p class="et-set-nav-empty">Nothing matches &ldquo;${escapeHtml(filter.trim())}&rdquo;.</p>`,
      );
      return;
    }

    setSafeHTML(
      nav,
      groups
        .map(
          (g) => `
        <div class="et-set-nav-group">
          <div class="et-set-nav-group-title">${escapeHtml(g.group)}</div>
          ${g.items
            .map(
              (it) => `<button type="button" class="et-set-nav-item" data-page="${it.id}">${escapeHtml(it.label)}</button>`,
            )
            .join("")}
        </div>`,
        )
        .join(""),
    );
    markActiveNavItem();
  }

  /** Opens a page from a sidebar row, a search hit or a deep link. */
  function goToPage(id) {
    const page = pageById(id);
    if (!page) return;
    rememberSettingsScroll(activePage);
    activePage = id;
    const settings = StorageManager.getSettings();
    settings.lastSettingsPage = id;
    StorageManager.saveSettings();
    markActiveNavItem();
    renderSideSheetContent(false);
  }

  /**
   * Marks the one sidebar row that is on screen.
   *
   * A tab can render several sections, so "same tab" is not enough to identify
   * a row - matching on that alone lit up four rows at once. When no section
   * has been chosen (the sheet was opened cold on its last tab) the first row
   * belonging to that tab stands in, because that is what the page opens at.
   */
  function markActiveNavItem() {
    $$("#settingsNav .et-set-nav-item").forEach((el) => {
      const on = el.dataset.page === activePage;
      el.classList.toggle("is-active", on);
      if (on) el.setAttribute("aria-current", "true");
      else el.removeAttribute("aria-current");
    });
  }

  function initSideSheet() {
    const overlay = $("sidesheetOverlay");
    const closeBtn = $("sidesheetCloseBtn");
    const topBtn = $("topSettingsBtn");

    if (topBtn) topBtn.addEventListener("click", () => openSideSheet(null));
    if (closeBtn) closeBtn.addEventListener("click", closeSideSheet);

    if (overlay) {
      overlay.addEventListener("click", (e) => {
        // Ignores a text selection that was dragged out of the panel onto the
        // backdrop; that reports the backdrop as the click target.
        if (e.target === overlay && !gestureStartedIn($("sidesheetPanel")))
          closeSideSheet();
      });
      overlay.addEventListener("keydown", (e) => {
        if (e.key === "Tab" && overlay.classList.contains("open"))
          trapFocus(e, overlay);
      });
    }

    const body = $("sidesheetBody");
    if (body) {
      body.addEventListener("click", (e) => {
        const header = e.target.closest(".st-accordion-header");
        if (header) {
          const acc = header.closest(".st-accordion");
          const isExp = acc.classList.contains("is-expanded");
          const ownBody = header.nextElementSibling;
          const isBody = ownBody?.classList.contains("st-accordion-body");
          // Measured before the class flip below changes which CSS rule is
          // active, so the slide has a real starting height to animate from
          // - measuring after would read the height it is becoming.
          const fromHeight = isBody
            ? ownBody.getBoundingClientRect().height
            : null;
          acc.classList.toggle("is-expanded", !isExp);
          if (isBody) slideHeight(ownBody, !isExp, "is-animating", fromHeight);
          const settings = StorageManager.getSettings();
          if (
            !settings.collapsedSettingsAccordions ||
            typeof settings.collapsedSettingsAccordions !== "object"
          ) {
            settings.collapsedSettingsAccordions = {};
          }
          const key = accordionKey(header);
          const collapsed = new Set(
            settings.collapsedSettingsAccordions[activePage] || [],
          );
          const expanded = new Set(
            settings.expandedSettingsAccordions?.[activePage] || [],
          );
          // Recorded in both directions. Only tracking what was collapsed made
          // "never touched" and "deliberately expanded" the same state, so a
          // section that ships collapsed was force-opened on every load.
          if (isExp) {
            collapsed.add(key);
            expanded.delete(key);
          } else {
            collapsed.delete(key);
            expanded.add(key);
          }
          settings.collapsedSettingsAccordions[activePage] = [...collapsed];
          if (
            !settings.expandedSettingsAccordions ||
            typeof settings.expandedSettingsAccordions !== "object"
          ) {
            settings.expandedSettingsAccordions = {};
          }
          settings.expandedSettingsAccordions[activePage] = [...expanded];
          StorageManager.saveSettings();
        }
      });
    }

    const nav = $("settingsNav");
    nav?.addEventListener("click", (e) => {
      const item = e.target.closest(".et-set-nav-item");
      if (item) goToPage(item.dataset.page);
    });

    const search = $("settingsSearch");
    search?.addEventListener("input", (e) => renderSettingsNav(e.target.value));
    search?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.target.value = "";
        renderSettingsNav("");
        return;
      }
      // Enter goes to the first thing left in the list, so a search that has
      // narrowed to one answer does not also need a click to accept it.
      if (e.key === "Enter") {
        const first = nav?.querySelector(".et-set-nav-item");
        if (first) goToPage(first.dataset.page);
      }
    });

    renderSettingsNav("");
  }

  let sheetReturnFocus = null;

  function openSideSheet(tab = null, section = null) {
    const overlay = $("sidesheetOverlay");
    const topBtn = $("topSettingsBtn");
    if (!overlay) return;

    sheetReturnFocus = document.activeElement;
    const settings = StorageManager.getSettings();
    // Callers still name a tab ("theme") or a page ("wallpaper"); both resolve
    // to a page, so old deep links keep working.
    const asked = TAB_TO_PAGE[tab] || tab;
    activePage = pageById(asked)
      ? asked
      : pageById(settings.lastSettingsPage || "")
        ? settings.lastSettingsPage
        : "appearance";
    pendingSection = section;
    settings.lastSettingsPage = activePage;
    StorageManager.saveSettings();

    renderSettingsNav($("settingsSearch")?.value || "");
    renderSideSheetContent(false);
    overlay.classList.remove("closing");
    overlay.classList.add("open");
    if (topBtn) topBtn.classList.add("is-active");

    ($("sidesheetCloseBtn") || overlay).focus?.();
  }

  function closeSideSheet() {
    const overlay = $("sidesheetOverlay");
    const topBtn = $("topSettingsBtn");
    if (topBtn) topBtn.classList.remove("is-active");
    if (sheetReturnFocus && document.contains(sheetReturnFocus))
      sheetReturnFocus.focus();
    sheetReturnFocus = null;
    rememberSettingsScroll(activePage);

    if (overlay) {
      overlay.classList.add("closing");
      overlay.classList.remove("open");
      const onEnd = (e) => {
        if (e.target !== overlay) return;
        overlay.classList.remove("closing");
        overlay.removeEventListener("transitionend", onEnd);
        const body = $("sidesheetBody");
        if (body) setSafeHTML(body, "");
      };
      overlay.addEventListener("transitionend", onEnd);
    }
  }

  function accordionKey(header) {
    const stableKey = header?.closest(".st-accordion")?.dataset.accordionKey;
    if (stableKey) return stableKey;
    const title = header?.querySelector(".st-group-title")?.cloneNode(true);
    title?.querySelectorAll(".st-group-note").forEach((note) => note.remove());
    return String(title?.textContent || header?.textContent || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase()
      .slice(0, 100);
  }

  function rememberSettingsScroll(tab) {
    const body = $("sidesheetBody");
    if (!body || !tab) return;
    const settings = StorageManager.getSettings();
    if (
      !settings.settingsScrollPositions ||
      typeof settings.settingsScrollPositions !== "object"
    ) {
      settings.settingsScrollPositions = {};
    }
    settings.settingsScrollPositions[tab] = Math.max(
      0,
      Math.round(body.scrollTop),
    );
    StorageManager.saveSettings();
  }

  /**
   * Paints one page.
   *
   * A page may be authored across two tab modules, so each one it needs is
   * rendered in turn and appended, then bound. Every section carries a
   * `data-page`; anything not tagged for this page is dropped, so a module that
   * contributes to three pages still only ever renders once per paint and the
   * user sees exactly the subject they asked for.
   */
  function paintPage(mods, page, token, savedScrollTop) {
    const body = $("sidesheetBody");
    if (!body || token !== renderToken || activePage !== page) return;
    const settings = StorageManager.getSettings();
    const data = StorageManager.getData();

    body.replaceChildren();
    for (const mod of mods) {
      const holder = document.createElement("div");
      setSafeHTML(holder, mod.render(settings, data));
      body.append(...holder.childNodes);
    }

    // Sections belonging to another page are removed rather than hidden: a
    // hidden duplicate still answers `getElementById`, so a binding meant for
    // the visible copy could silently attach to an off-page one.
    body.querySelectorAll("[data-page]").forEach((el) => {
      if (el.dataset.page !== page) el.remove();
    });
    // A container left holding nothing is a stack of padding with no content.
    body.querySelectorAll(".st-container").forEach((el) => {
      if (!el.children.length) el.remove();
    });

    const lower = (list) =>
      new Set((list || []).map((v) => String(v).toLowerCase()));
    const collapsed = lower(settings.collapsedSettingsAccordions?.[page]);
    const expanded = lower(settings.expandedSettingsAccordions?.[page]);
    body.querySelectorAll(".st-accordion").forEach((acc) => {
      // `querySelector` would reach into a nested accordion when the outer one
      // has no header of its own, which would key the two together.
      const header = acc.querySelector(":scope > .st-accordion-header");
      const key = accordionKey(header);
      // An accordion nobody has touched keeps whatever the markup asked for.
      if (collapsed.has(key)) acc.classList.remove("is-expanded");
      else if (expanded.has(key)) acc.classList.add("is-expanded");
    });

    mods.forEach((mod) => mod.bind(settings, data));
    CustomSelect.initAll(body);
    SliderValueEditor.wire(body);
    hydrateGalleryThumbs(body);
    body.scrollTop = Math.max(0, savedScrollTop || 0);
    revealSection(body, page);
    markActiveNavItem();
  }

  /**
   * Opens and scrolls to whichever section was asked for, then forgets it.
   *
   * Was a single hardcoded case for the wallpaper card. Every sidebar row and
   * every search hit needs the same behaviour, so it looks the section up by
   * the key the accordion already carries rather than by knowing what is in it.
   */
  function revealSection(body, page) {
    if (!pendingSection) return;

    if (pendingSection === "wallpaper") {
      const target = $("themeWpToggle")?.closest(".st-card");
      target?.closest(".st-accordion")?.classList.add("is-expanded");
      target?.scrollIntoView({ block: "center" });
      pendingSection = null;
      return;
    }

    const acc = [...body.querySelectorAll(".st-accordion")].find(
      (el) => accordionKey(el.querySelector(".st-accordion-header")) === pendingSection,
    );
    if (acc) {
      acc.classList.add("is-expanded");
      const inner = acc.querySelector(".st-accordion-body");
      if (inner) inner.style.height = "auto";
      acc.scrollIntoView({ block: "start" });
      body.scrollTop = Math.max(0, body.scrollTop - 12);
    }
    pendingSection = null;
  }

  function renderSideSheetContent(preserveScroll = true) {
    const body = $("sidesheetBody");
    if (!body) return;

    const page = activePage;
    const spec = pageById(page);
    if (!spec) return;
    const settings = StorageManager.getSettings();
    const savedScrollTop = preserveScroll
      ? body.scrollTop
      : settings.settingsScrollPositions?.[page] || 0;
    const token = ++renderToken;

    // Everything this page needs already in memory: paint without a frame of
    // "Loading", which is the common case once a module has been fetched.
    if (spec.tabs.every((t) => tabModules[t])) {
      paintPage(
        spec.tabs.map((t) => tabModules[t]),
        page,
        token,
        savedScrollTop,
      );
      return;
    }

    setSafeHTML(
      body,
      '<div class="st-tab-status" role="status" aria-live="polite">' +
        '<span class="st-tab-spinner" aria-hidden="true"></span><span>Loading…</span></div>',
    );

    Promise.all(spec.tabs.map(loadTab))
      .then((mods) => paintPage(mods, page, token, savedScrollTop))
      .catch(() => {
        if (token !== renderToken || activePage !== page) return;
        setSafeHTML(
          body,
          '<div class="st-tab-status st-tab-error" role="alert">' +
            "<p>This section could not be loaded. Check your connection to the extension files and try again.</p>" +
            '<button type="button" class="st-action-btn" id="stTabRetryBtn">Try again</button></div>',
        );
        $("stTabRetryBtn")?.addEventListener("click", renderSideSheetContent);
      });
  }

  async function hydrateGalleryThumbs(root) {
    const thumbs = root.querySelectorAll("[data-wp-thumb]");
    for (const el of thumbs) {
      const val = el.getAttribute("data-wp-thumb");
      if (el.getAttribute("data-wp-thumb-type") === "video") {
        el.classList.add("is-video");
        continue;
      }
      try {
        const src = await StorageManager.resolveMedia(val);

        if (/^(data:image\/|https?:\/\/)/i.test(src || "")) {
          el.style.backgroundImage = `url("${src.replace(/["\\]/g, "")}")`;
        }
      } catch {}
    }
  }

  /** The overall interface strength, 0-100, with the legacy key folded in. */
  function overallStrength(settings) {
    const legacy =
      typeof settings.boardOpacity === "number" ? settings.boardOpacity * 100 : 8;
    const raw =
      typeof settings.interfaceOpacity === "number"
        ? settings.interfaceOpacity
        : legacy;
    return Math.max(0, Math.min(100, raw));
  }

  /**
   * Resolves each interface surface to a concrete strength, 0-100.
   *
   * The overall slider is a promise: 0% is fully transparent and 100% fully
   * opaque. Surfaces that carry small text (notes, widgets, the topbar) want a
   * little more body than a board card at the same setting, but that boost has
   * to fade out towards both ends - otherwise 0% is not really transparent and
   * 100% is reached early.
   *
   * There is one slider now. The per-surface overrides that used to sit under
   * it were six more ways to end up with unreadable text, for a distinction
   * most people never wanted to draw; the relationships between the surfaces
   * are what this curve is for.
   */
  function surfaceStrengths(settings) {
    const t = overallStrength(settings) / 100;
    // Peaks mid-slider and vanishes at both ends.
    const lift = (amount) => (t + amount * t * (1 - t) * 4) * 100;
    const auto = {
      boards: t * 100,
      topbar: lift(0.04),
      search: lift(0.04),
      notes: lift(0.06),
      widgets: lift(0.08),
      // Panels, popovers and dialogs sit *over* the page rather than being part
      // of it, and they carry the densest text in the app. They stay solid
      // unless the user asks otherwise, so dragging the overall slider down for
      // a glassier home page does not also make the settings sheet unreadable.
      panels: 100,
    };
    // A surface listed in `surfaceOpacity` opts out of the curve: the override
    // is an absolute strength, taken literally, because someone who reached for
    // one surface wants that number and not that number plus a boost.
    const overrides = settings.surfaceOpacity || {};
    const out = {};
    for (const key of Object.keys(auto)) {
      out[key] = Math.max(
        0,
        Math.min(
          100,
          typeof overrides[key] === "number" ? overrides[key] : auto[key],
        ),
      );
    }
    return out;
  }

  function resolveMode() {
    const m = StorageManager.getSettings().mode;
    if (m === "system") return systemDark() ? "dark" : "light";
    return m === "light" ? "light" : "dark";
  }

  function hexToHsl(hex) {
    const { r, g, b } = hexToRgb(hex);
    const rn = r / 255,
      gn = g / 255,
      bn = b / 255;
    const mx = Math.max(rn, gn, bn),
      mn = Math.min(rn, gn, bn);
    let h = 0,
      s = 0;
    const l = (mx + mn) / 2;
    const d = mx - mn;
    if (d) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
      else if (mx === gn) h = (bn - rn) / d + 2;
      else h = (rn - gn) / d + 4;
      h *= 60;
    }
    return { h, s, l };
  }

  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    const c = (1 - Math.abs(2 * l - 1)) * s,
      x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
      m = l - c / 2;
    let r = 0,
      g = 0,
      b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const to = (v) =>
      Math.round((v + m) * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${to(r)}${to(g)}${to(b)}`;
  }

  const MONO_PALETTES = {
    "#f9c8d6": {
      light: {
        bg: "#f9c8d6",
        surface: "#ffebf2",
        accent: "#ec5e78",
        border: "transparent",
      },
      dark: {
        bg: "#411b28",
        surface: "#b24b64",
        accent: "#f9c8d6",
        border: "transparent",
      },
    },
    "#fecdd3": {
      light: {
        bg: "#f9c8d6",
        surface: "#ffebf2",
        accent: "#ec5e78",
        border: "transparent",
      },
      dark: {
        bg: "#411b28",
        surface: "#b24b64",
        accent: "#f9c8d6",
        border: "transparent",
      },
    },

    "#bbd6fd": {
      light: {
        bg: "#bbd6fd",
        surface: "#e2eeff",
        accent: "#4382ec",
        border: "transparent",
      },
      dark: {
        bg: "#1b3041",
        surface: "#3569b2",
        accent: "#bbd6fd",
        border: "transparent",
      },
    },
    "#c7d2fe": {
      light: {
        bg: "#bbd6fd",
        surface: "#e2eeff",
        accent: "#4382ec",
        border: "transparent",
      },
      dark: {
        bg: "#1b3041",
        surface: "#3569b2",
        accent: "#bbd6fd",
        border: "transparent",
      },
    },

    "#fdbdbd": {
      light: {
        bg: "#fdbdbd",
        surface: "#ffe7e7",
        accent: "#ec4343",
        border: "transparent",
      },
      dark: {
        bg: "#411b1b",
        surface: "#b23535",
        accent: "#fdbdbd",
        border: "transparent",
      },
    },
    "#fca5a5": {
      light: {
        bg: "#fdbdbd",
        surface: "#ffe7e7",
        accent: "#ec4343",
        border: "transparent",
      },
      dark: {
        bg: "#411b1b",
        surface: "#b23535",
        accent: "#fdbdbd",
        border: "transparent",
      },
    },

    "#ffed80": {
      light: {
        bg: "#ffed80",
        surface: "#fff6c3",
        accent: "#d1a93d",
        border: "transparent",
      },
      dark: {
        bg: "#2f2707",
        surface: "#ae9502",
        accent: "#ffed80",
        border: "transparent",
      },
    },
    "#fef08a": {
      light: {
        bg: "#ffed80",
        surface: "#fff6c3",
        accent: "#d1a93d",
        border: "transparent",
      },
      dark: {
        bg: "#2f2707",
        surface: "#ae9502",
        accent: "#ffed80",
        border: "transparent",
      },
    },

    "#c7e4c7": {
      light: {
        bg: "#c7e4c7",
        surface: "#e1f1e1",
        accent: "#5cba5c",
        border: "transparent",
      },
      dark: {
        bg: "#1b411b",
        surface: "#458245",
        accent: "#c7e4c7",
        border: "transparent",
      },
    },
    "#a7f3d0": {
      light: {
        bg: "#c7e4c7",
        surface: "#e1f1e1",
        accent: "#5cba5c",
        border: "transparent",
      },
      dark: {
        bg: "#1b411b",
        surface: "#458245",
        accent: "#c7e4c7",
        border: "transparent",
      },
    },
    "#dcfce7": {
      light: {
        bg: "#c7e4c7",
        surface: "#e1f1e1",
        accent: "#5cba5c",
        border: "transparent",
      },
      dark: {
        bg: "#1b411b",
        surface: "#458245",
        accent: "#c7e4c7",
        border: "transparent",
      },
    },

    "#9cefef": {
      light: {
        bg: "#9cefef",
        surface: "#d5ffff",
        accent: "#09b2b4",
        border: "transparent",
      },
      dark: {
        bg: "#08354b",
        surface: "#07787f",
        accent: "#9cefef",
        border: "transparent",
      },
    },
    "#bae6fd": {
      light: {
        bg: "#9cefef",
        surface: "#d5ffff",
        accent: "#09b2b4",
        border: "transparent",
      },
      dark: {
        bg: "#08354b",
        surface: "#07787f",
        accent: "#9cefef",
        border: "transparent",
      },
    },

    "#ffd8b2": {
      light: {
        bg: "#ffd8b2",
        surface: "#ffedd5",
        accent: "#ec844d",
        border: "transparent",
      },
      dark: {
        bg: "#412b1e",
        surface: "#b26d3e",
        accent: "#ffd8b2",
        border: "transparent",
      },
    },
    "#fed7aa": {
      light: {
        bg: "#ffd8b2",
        surface: "#ffedd5",
        accent: "#ec844d",
        border: "transparent",
      },
      dark: {
        bg: "#412b1e",
        surface: "#b26d3e",
        accent: "#ffd8b2",
        border: "transparent",
      },
    },

    "#dac2e8": {
      light: {
        bg: "#dac2e8",
        surface: "#e9e2f3",
        accent: "#9563b5",
        border: "transparent",
      },
      dark: {
        bg: "#2d1b3e",
        surface: "#724b8f",
        accent: "#dac2e8",
        border: "transparent",
      },
    },
    "#e9d5ff": {
      light: {
        bg: "#dac2e8",
        surface: "#e9e2f3",
        accent: "#9563b5",
        border: "transparent",
      },
      dark: {
        bg: "#2d1b3e",
        surface: "#724b8f",
        accent: "#dac2e8",
        border: "transparent",
      },
    },

    "#c6c6c6": {
      light: {
        bg: "#c6c6c6",
        surface: "#e8e8e8",
        accent: "#555555",
        border: "transparent",
      },
      dark: {
        bg: "#1f1f1f",
        surface: "#333333",
        accent: "#c6c6c6",
        border: "transparent",
      },
    },
  };

  function derivePalette(seed, targetMode) {
    const normSeed = (seed || "").toLowerCase();
    const isDark = targetMode === "dark";

    if (MONO_PALETTES[normSeed]) {
      const p = MONO_PALETTES[normSeed][isDark ? "dark" : "light"];
      return {
        light: !isDark,
        bg: p.bg,
        surface: p.surface,
        accent: p.accent,
        onSurface: isDark ? "#f1f5f9" : "#1e293b",
        onDim: isDark ? "#94a3b8" : "#64748b",
        border: p.border,
      };
    }

    const { r, g, b } = hexToRgb(seed);
    const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    const { h } = hexToHsl(seed);
    const tinted = chroma >= 0.05;

    if (!isDark) {
      const accS = tinted ? 0.72 : 0.15;
      const accL = 0.42;
      const bgS = tinted ? 0.35 : 0.04;
      const surfS = tinted ? 0.25 : 0.03;
      const txtS = tinted ? 0.25 : 0.05;

      return {
        light: true,
        bg: hslToHex(h, bgS, 0.94),
        surface: hslToHex(h, surfS, 0.985),
        accent: hslToHex(h, accS, accL),
        onSurface: hslToHex(h, txtS, 0.18),
        onDim: hslToHex(h, txtS * 0.8, 0.4),
        border: hslToHex(h, surfS, 0.85),
      };
    } else {
      const accS = tinted ? 0.78 : 0.15;
      const accL = 0.66;
      const bgS = tinted ? 0.35 : 0.05;
      const surfS = tinted ? 0.28 : 0.04;

      return {
        light: false,
        bg: hslToHex(h, bgS, 0.08),
        surface: hslToHex(h, surfS, 0.15),
        accent: hslToHex(h, accS, accL),
        onSurface: "#f1f5f9",
        onDim: "#94a3b8",
        border: hslToHex(h, surfS, 0.25),
      };
    }
  }

  function applySeed(seed) {
    const s = StorageManager.getSettings();
    s.solidSeed = seed;

    const isCustomWallpaper =
      s.backgroundType === "image" || s.backgroundType === "video";
    if (!isCustomWallpaper) {
      s.backgroundType = "solid";
      s.backgroundValue = seed;

      const currentMode = resolveMode();
      const p = derivePalette(seed, currentMode);

      const photoBg = $("photo-bg"),
        videoBg = $("video-bg");
      if (photoBg) {
        photoBg.style.backgroundImage = "none";
        photoBg.style.backgroundColor = p.bg;
        photoBg.classList.add("active");
      }
      if (videoBg) {
        videoBg.pause();
        videoBg.classList.remove("active");
      }
    }

    StorageManager.saveSettings();
    applyTheme();
  }

  function applyPresetShell() {
    const settings = StorageManager.getSettings();
    const p = presetById(settings.preset);
    const el = document.documentElement.style;

    PRESETS.forEach((x) => x.cls && document.body.classList.remove(x.cls));

    const shape = cornerStyle(settings.cornerRadius || (p && p.radius));
    CORNER_STYLES.forEach((c) => c.cls.forEach((k) => document.body.classList.remove(k)));
    shape.cls.forEach((k) => document.body.classList.add(k));
    Object.entries(shape.vars).forEach(([k, v]) => el.setProperty(k, v));
    el.setProperty("--radius", shape.value);
    if (p && p.cls) document.body.classList.add(p.cls);

    const face = appFont(settings.fontFamily);
    document.body.classList.toggle("font-handwriting", face.cls === "font-handwriting");
    el.setProperty("--font-app", face.stack);

    WidgetsRenderer.applyClockAppearance(settings);
  }

  /**
   * One angle for every gradient in the UI.
   *
   * Mixed angles are the single loudest tell of a slapped-together gradient:
   * a 135deg button next to a 90deg pill reads as two unrelated surfaces. The
   * horizontal variant exists only for elements that are far wider than they
   * are tall, where a diagonal compresses into a visible corner-to-corner
   * band.
   */
  const GRADIENT_ANGLE = 135;

  /**
   * Constrains an accent pair into a gradient that reads as one colour with
   * depth rather than two colours fighting.
   *
   * Three things make an interface gradient look cheap, and this fixes all
   * three:
   *
   * 1. *Too much hue travel.* A sweep across more than a quarter of the wheel
   *    stops being a shade and becomes a rainbow. The secondary hue is pulled
   *    to sit within MAX_HUE_TRAVEL of the primary, taking the short way
   *    round the wheel.
   * 2. *Too much lightness travel.* A stop much lighter than the other forces
   *    the label to fight for contrast at one end. Lightness delta is capped,
   *    and the darker stop is placed last so the diagonal falls off into
   *    shadow the way a lit surface does.
   * 3. *A dead midpoint.* sRGB interpolation routes between saturated hues
   *    through a desaturated middle, which is where the grey smear in the
   *    centre of a bad gradient comes from. Interpolating in oklab keeps
   *    chroma up across the whole ramp.
   *
   * @param {string} [bg] Background the pair is read against, so the tuned
   *   stop goes through the same contrast pass as the accent itself - nudging
   *   a hue can push a stop under AA, and a label has to stay readable at
   *   both ends of the ramp, not just the one it was checked against.
   * @returns {{from:string,to:string}} Ordered stops, lighter first.
   */
  function harmoniseGradient(primary, secondary, bg) {
    const a = hexToHsl(primary);
    const b = hexToHsl(secondary);

    /* How far the second stop may sit from the first. These were 45deg and
       0.16, tuned back when the ramp interpolated through sRGB and anything
       wider went grey in the middle. The ramp runs in OKLab now, which stays
       chromatic across the transit, so the clamp no longer has to protect the
       midpoint - only the composition. Widening it is what lets a deliberately
       chosen second colour actually show up instead of being pulled back onto
       the first and rendering as one flat colour twice. */
    const MAX_HUE_TRAVEL = 110;
    const MAX_LIGHT_TRAVEL = 0.26;

    // Signed shortest distance around the wheel, so a red->magenta pair does
    // not travel the long way through green.
    let dh = ((b.h - a.h + 540) % 360) - 180;
    dh = Math.max(-MAX_HUE_TRAVEL, Math.min(MAX_HUE_TRAVEL, dh));

    const dl = Math.max(
      -MAX_LIGHT_TRAVEL,
      Math.min(MAX_LIGHT_TRAVEL, b.l - a.l),
    );

    /* Keep the second stop in the same register as the first - a vivid stop
       next to a washed-out one looks like a rendering error rather than a
       choice - but band it around the *pair* rather than pinning it to the
       primary. The old rule multiplied the primary's saturation, so a near-grey
       primary forced the secondary grey too and every pairing involving a
       muted colour came out muddy whatever the user picked. A floor keeps the
       ramp from collapsing when both are desaturated. */
    const sat = Math.max(0.25, Math.min(Math.max(a.s, b.s), (a.s + b.s) / 2 + 0.18));

    let tuned = hslToHex(a.h + dh, sat, a.l + dl);
    if (bg) tuned = accentTokens(tuned, bg).ui;

    // The label colour is picked once, from the primary, but it has to stay
    // legible everywhere along the ramp - the far stop is a background too.
    // So the tuned stop is mixed back toward the primary until the ink clears
    // AA against it.
    //
    // The mix runs in RGB rather than HSL: HSL lightness is not luminance, and
    // a blue and a cyan at the same nominal lightness sit almost three stops
    // apart in contrast, so nudging lightness could iterate to no effect.
    // Mixing toward the primary always converges, because the primary is by
    // definition the colour the ink was chosen for.
    const ink = contrastText(primary);
    const base = hexToRgb(primary);
    const far = hexToRgb(tuned);
    const STEPS = 12;
    for (
      let i = 1;
      i <= STEPS && Math.abs(Contrast.lc(ink, tuned)) < INK_MIN_LC;
      i++
    ) {
      const t = i / STEPS;
      const mix = (c1, c2) => Math.round(c2 + (c1 - c2) * t);
      tuned = `#${[
        mix(base.r, far.r),
        mix(base.g, far.g),
        mix(base.b, far.b),
      ]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")}`;
    }

    // Lighter stop first: light reads as coming from the top-left, so a
    // 135deg ramp that darkens matches how every other surface is lit.
    return dl >= 0 ? { from: tuned, to: primary } : { from: primary, to: tuned };
  }

  /**
   * True when the browser understands perceptual gradient interpolation.
   *
   * Custom properties accept almost any token sequence, so an unsupported
   * `in oklab` would sail into `--accent-fill` and only fail later, at the
   * `background: var(--accent-fill)` that uses it - painting nothing at all.
   * The support question is settled once, here.
   */
  const SUPPORTS_OKLAB_GRADIENT = (() => {
    try {
      return CSS.supports(
        "background-image",
        "linear-gradient(in oklab, red, blue)",
      );
    } catch {
      return false;
    }
  })();

  /**
   * Builds the gradient, interpolated perceptually where the browser allows.
   *
   * The sRGB fallback adds a midpoint stop: without perceptual interpolation
   * the centre of the ramp desaturates, and an explicit middle colour is what
   * keeps it from going grey there.
   */
  function gradientCss(angle, { from, to }) {
    if (SUPPORTS_OKLAB_GRADIENT)
      return `linear-gradient(${angle}deg in oklab, ${from} 0%, ${to} 100%)`;

    const a = hexToHsl(from);
    const b = hexToHsl(to);
    let dh = ((b.h - a.h + 540) % 360) - 180;
    const mid = hslToHex(
      a.h + dh / 2,
      Math.max(a.s, b.s),
      (a.l + b.l) / 2,
    );
    return `linear-gradient(${angle}deg, ${from} 0%, ${mid} 50%, ${to} 100%)`;
  }

  /**
   * Publishes the secondary accent.
   *
   * Historically this was handed the primary accent, so `--accent-2` was only
   * ever a duplicate of `--accent-1` and the stored `accent2` did nothing. It
   * now prefers the real secondary, run through the same contrast pass as the
   * primary so a theme cannot ship an unreadable second colour, and falls back
   * to the primary whenever no secondary is set.
   *
   * @param {string} primary Already contrast-corrected primary accent.
   * @param {string} [secondary] Raw secondary from settings, may be empty.
   * @param {string} [bg] Background the pair is read against.
   * @param {boolean} [gradient] Whether `--accent-fill` sweeps the two colours.
   */
  function applyAccent2(el, primary, secondary, bg, gradient) {
    const raw = HEX6.test(secondary || "") ? secondary : primary;
    const value = bg ? accentTokens(raw, bg).ui : raw;
    el.setProperty("--accent-2", value);
    el.setProperty("--accent-2-contrast", contrastText(value));
    const rgb = hexToRgb(value);
    el.setProperty("--accent-2-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    // The gradient tokens always describe the accent pair, so anything that
    // specifically wants a sweep can reach for `--accent-gradient` directly.
    // `--accent-fill` is what every button, pill and active tab paints with,
    // and it stays flat unless the user asked for two-tone.
    const stops = harmoniseGradient(primary, value, bg);
    el.setProperty("--accent-gradient", gradientCss(GRADIENT_ANGLE, stops));
    el.setProperty("--accent-gradient-h", gradientCss(90, stops));
    el.setProperty(
      "--accent-fill",
      gradient && value !== primary
        ? gradientCss(GRADIENT_ANGLE, stops)
        : primary,
    );
  }

  /**
   * The ground a surface that carries its *own* colour is built on.
   *
   * `--board-rgb` is deliberately tinted with the theme accent, which is right
   * for anything that should follow the theme - but wrong for a board the user
   * has given a colour of its own. Mixing a red board into a blue-tinted ground
   * produces a muddy purple that is neither colour, which is exactly the "my
   * board colour got blended with the accent" complaint. Boards with a colour
   * mix into this neutral instead, so the only hue in the result is the one
   * that was picked.
   */
  function setNeutralGround(el, isLight) {
    el.setProperty("--board-neutral-rgb", isLight ? "247, 248, 250" : "18, 19, 24");
  }

  function applyWallpaperStyle() {
    const settings = StorageManager.getSettings();
    const photoBg = $("photo-bg");
    const videoBg = $("video-bg");
    const zoom = (settings.wallpaperZoom || 100) / 100;
    const posX = settings.wallpaperPosX ?? 50;
    const posY = settings.wallpaperPosY ?? 50;

    if (photoBg) {
      photoBg.style.backgroundSize = settings.wallpaperFit || "cover";
      photoBg.style.backgroundPosition = `${posX}% ${posY}%`;
      photoBg.style.transform = `scale(${zoom})`;
      photoBg.style.transformOrigin = `${posX}% ${posY}%`;
    }
    if (videoBg) {
      videoBg.style.transform = `scale(${zoom})`;
      videoBg.style.transformOrigin = `${posX}% ${posY}%`;
      videoBg.style.objectPosition = `${posX}% ${posY}%`;
      const shouldMute = settings.wallpaperMuted !== false;
      videoBg.muted = shouldMute;
      if (shouldMute) {
        videoBg.setAttribute("muted", "");
      } else {
        videoBg.removeAttribute("muted");
      }
      videoBg.volume = settings.wallpaperVolume ?? 0.5;
    }
  }

  /**
   * Darkens the edges of the wallpaper and leaves the middle alone.
   *
   * A photo is usually brightest where the clock sits, and the ink measurement
   * then has to work hardest exactly where the largest text is. A vignette buys
   * that contrast back without dimming the picture as a whole the way the
   * overlay does - the subject stays lit and only the corners give way. It is
   * one radial gradient on a layer that already exists, so it costs nothing to
   * have switched on.
   */
  function applyWallpaperVignette() {
    const settings = StorageManager.getSettings();
    const on =
      !!settings.wallpaperVignette &&
      ["image", "video"].includes(settings.backgroundType);
    document.body.classList.toggle("wp-vignette-on", on);
    document.documentElement.style.setProperty(
      "--wp-vignette-opacity",
      String(Math.max(0, Math.min(100, settings.wallpaperVignetteAmount ?? 45)) / 100),
    );
  }

  function applyWallpaperOverlay() {
    const settings = StorageManager.getSettings();
    document.body.classList.toggle(
      "wp-overlay-on",
      !!settings.wallpaperOverlay,
    );
    document.documentElement.style.setProperty(
      "--wp-overlay-opacity",
      (settings.wallpaperOverlayOpacity ?? 35) / 100,
    );
  }

  /**
   * Blurs the wallpaper itself rather than laying anything over it, so a busy
   * photo stops competing with the text without being darkened as well. The
   * filter goes on the two background layers only - putting it on a wrapper
   * would blur the interface along with the picture.
   */
  /* Radius, in pixels, that 100% blur means. Past roughly this the picture has
     stopped being a picture and the extra cost buys nothing but a slower
     paint, so the slider spends its whole range where the change is visible. */
  const BLUR_MAX_PX = 26;

  /**
   * Blur strength as a percentage of "as blurred as this is worth going",
   * rather than as a raw pixel radius.
   *
   * Two things were harsh about the old control. It was labelled in pixels,
   * which is a number about the implementation rather than about the picture -
   * nobody knows what 12px of blur looks like until they try it. And it was
   * linear, so the first third of the slider went from sharp to unrecognisable
   * and the rest was mush; the useful range - a photo softened just enough to
   * read text over - lived in about four pixels near the bottom.
   *
   * The curve fixes the second problem: raising the fraction to 1.8 spends most
   * of the travel in the gentle end, where the differences are actually worth
   * choosing between, while still reaching full blur at 100%. A straight square
   * pushed too far the other way and left the bottom quarter of the slider
   * doing nothing visible at all.
   */
  const blurRadius = (percent) =>
    BLUR_MAX_PX * Math.pow(Math.max(0, Math.min(100, percent)) / 100, 1.8);

  function applyWallpaperBlur() {
    const settings = StorageManager.getSettings();
    const on = !!settings.wallpaperBlur;
    const px = on ? blurRadius(settings.wallpaperBlurAmount ?? 40) : 0;

    document.body.classList.toggle("wp-blur-on", on);
    const el = document.documentElement.style;
    el.setProperty("--wp-blur-amount", `${px.toFixed(1)}px`);
    // A blur samples past the edge of its own element, so an un-compensated
    // one leaves a feathered grey border around the viewport - which is what
    // "harsh" looked like at the top of the old slider, where a fixed 1.06
    // scale could not cover a 40px radius. Overscanning by three radii on
    // every side keeps the edge off screen at any strength, and costs nothing
    // at zero.
    const shortest = Math.min(window.innerWidth, window.innerHeight) || 1;
    el.setProperty(
      "--wp-blur-scale",
      String(1 + (px * 6) / shortest),
    );
  }

  /**
   * Turns the measured wallpaper tone into the ink and halo that everything
   * sitting over the picture is drawn with.
   *
   * Three grounds come out of the analysis - the strip under the toolbar, the
   * middle where the clock and pins are, the strip under the date and weather -
   * and each one picks its own ink through the same APCA call the rest of the
   * app uses, so a bright sky gets dark icons while dark ground below it keeps
   * light ones. The scrim is folded in first: a wallpaper the user has dimmed
   * by 40% is a genuinely darker ground and choosing ink for the undimmed
   * picture is choosing it for something nobody can see.
   *
   * The halo is the inverse of whatever ink won, and its weight is derived
   * rather than fixed: busy pictures (high luminance spread) and grounds where
   * the winning ink only just cleared the bar get a real shadow, flat ones get
   * almost none. A uniform heavy halo is what made the toolbar look smudged on
   * wallpapers that never needed one.
   */
  function applyWallpaperTone() {
    const settings = StorageManager.getSettings();
    const el = document.documentElement.style;
    const tone = settings.wpTone;
    const onWallpaper = ["image", "video"].includes(settings.backgroundType);
    const bandVars = [
      ["--wp-ink", "--wp-halo", "top"],
      ["--wp-ink-mid", "--wp-halo-mid", "middle"],
      ["--wp-ink-low", "--wp-halo-low", "bottom"],
    ];

    if (!onWallpaper || !tone) {
      bandVars.forEach(([ink, halo]) => {
        el.removeProperty(ink);
        el.removeProperty(halo);
        el.removeProperty(ink.replace("--wp-ink", "--wp-ink-rgb"));
      });
      document.body.classList.remove("wp-light");
      applyTextHalo(settings, null);
      return;
    }

    const scrim = settings.wallpaperOverlay
      ? (settings.wallpaperOverlayOpacity ?? 35) / 100
      : 0;
    const dim = (hex) => {
      const c = Contrast.toRgb(hex);
      return Contrast.toHex({
        r: c.r * (1 - scrim),
        g: c.g * (1 - scrim),
        b: c.b * (1 - scrim),
      });
    };

    let worstLc = Infinity;
    bandVars.forEach(([inkVar, haloVar, key]) => {
      const ground = dim(tone[key] || tone.overall);
      const ink = Contrast.ink(ground);
      const light = ink === Contrast.INK_LIGHT;
      el.setProperty(inkVar, ink);
      // The same pair as rgb components, for the borders and plates that need
      // the ink at a partial alpha rather than as a solid colour.
      el.setProperty(
        inkVar.replace("--wp-ink", "--wp-ink-rgb"),
        light ? "255, 255, 255" : "20, 21, 26",
      );
      el.setProperty(haloVar, light ? "0, 0, 0" : "255, 255, 255");
      worstLc = Math.min(worstLc, Math.abs(Contrast.lc(ink, ground)));
    });

    document.body.classList.toggle(
      "wp-light",
      Contrast.isLight(dim(tone.overall)),
    );
    applyTextHalo(settings, { spread: tone.spread, worstLc });
  }

  /* Weakest contrast, in Lc, a band can reach before the halo stops scaling up. */
  const HALO_FLOOR_LC = 78;

  /**
   * Writes the halo the wallpaper text shadows are built from - derived from
   * the picture when the user has not overridden it, and taken verbatim from
   * their own colour and opacity the moment they have.
   */
  function applyTextHalo(settings, measured) {
    const el = document.documentElement.style;
    if (settings.wpShadowAuto === false || !measured) {
      const hex = /^#[0-9a-f]{6}$/i.test(settings.wpShadowColor || "")
        ? settings.wpShadowColor
        : "#000000";
      const { r, g, b } = Contrast.toRgb(hex);
      el.setProperty("--wp-shadow-rgb", `${r}, ${g}, ${b}`);
      el.setProperty(
        "--wp-shadow-opacity",
        String((settings.wpShadowOpacity ?? 60) / 100),
      );
      el.setProperty("--wp-shadow-blur", "20px");
      return;
    }

    const marginal = Math.max(0, (HALO_FLOOR_LC - measured.worstLc) / HALO_FLOOR_LC);
    const strength = Math.max(
      0.1,
      Math.min(0.6, 0.08 + measured.spread * 1.9 + marginal * 0.3),
    );
    el.setProperty("--wp-shadow-rgb", "var(--wp-halo-mid, 0, 0, 0)");
    el.setProperty("--wp-shadow-opacity", strength.toFixed(3));
    // A busier picture needs the halo spread wider as well as darker, or it
    // reads as an outline rather than as separation.
    el.setProperty("--wp-shadow-blur", `${Math.round(12 + strength * 16)}px`);
  }

  function applyTheme() {
    const settings = StorageManager.getSettings();
    const el = document.documentElement.style;
    const solid =
      settings.backgroundType === "solid" || !settings.backgroundType;

    document.body.classList.toggle("solid-mode", solid);
    document.body.classList.toggle("wallpaper-mode", !solid);
    document.body.classList.toggle(
      "performance-mode",
      !!settings.performanceMode,
    );
    const performanceVideo = $("video-bg");
    if (performanceVideo?.src) {
      if (settings.performanceMode) performanceVideo.pause();
      else if (
        !document.hidden &&
        performanceVideo.classList.contains("active")
      )
        performanceVideo.play().catch(() => {});
    }
    applyWallpaperOverlay();
    applyWallpaperVignette();
    applyWallpaperBlur();
    applyWallpaperTone();

    const activeMode = resolveMode();
    const isLight = activeMode === "light";
    let solidBgColor = null;

    const strengths = surfaceStrengths(settings);
    const px = (v) => String(Number(Math.max(0, Math.min(1, v / 100)).toFixed(4)));

    el.setProperty("--board-opacity", px(strengths.boards));
    el.setProperty("--board-opacity-pct", `${strengths.boards}%`);
    // At full strength a board is painted as a plain solid colour. The mix
    // toward transparent is exact in most engines, but a browser that cannot
    // evaluate it drops the whole background and the board turned see-through
    // at the very setting that asks for it to be solid.
    document.body.classList.toggle("boards-opaque", strengths.boards >= 100);
    el.setProperty("--search-opacity", px(strengths.search));
    el.setProperty("--notes-opacity", px(strengths.notes));
    // No `--topbar-opacity` / `--widget-bg-alpha`: neither has a consumer since
    // the tab bar and toolbar buttons stopped having a fill of their own.
    el.setProperty("--panel-opacity", px(strengths.panels));

    document.body.classList.toggle(
      "ambient-on",
      settings.solidAmbient !== false,
    );

    document.documentElement.style.colorScheme = isLight ? "light" : "dark";

    if (solid) {
      const seed = settings.solidSeed || (isLight ? "#c7d2fe" : "#0d1117");
      const p = derivePalette(seed, activeMode);

      document.body.classList.toggle("theme-light", isLight);
      document.body.classList.toggle("theme-dark", !isLight);

      const accent =
        settings.accentOverride ||
        settings.accentColor ||
        p.accent ||
        "#bcbeffff";

      const photoBg = $("photo-bg");
      if (photoBg) {
        photoBg.style.backgroundImage = "none";
        photoBg.style.backgroundColor = p.bg;
        photoBg.classList.add("active");
      }
      solidBgColor = p.bg;

      const { ui, ink, display } = accentTokens(accent, p.bg, presetSwatch(settings));
      const accRgb = hexToRgb(ui);
      el.setProperty("--accent-color", ui);
      el.setProperty("--accent-ink", ink);
      el.setProperty("--accent-display", display);
      // The deeper body-text step: the brighter display step washed logos out
      // on white tiles in pastel themes.
      applyIconTint(ink);
      el.setProperty("--accent-contrast", contrastText(ui));
      applyAccent2(el, ui, settings.accent2, p.bg, !!settings.accentGradient);
      el.setProperty("--accent-rgb", `${accRgb.r}, ${accRgb.g}, ${accRgb.b}`);

      const sRgb = hexToRgb(p.surface);
      el.setProperty("--board-rgb", `${sRgb.r}, ${sRgb.g}, ${sRgb.b}`);
      setNeutralGround(el, isLight);
      // The wallpaper branch writes `--page-bg` and only clears it in its own
      // light case, so switching to a solid background left whatever the last
      // wallpaper render had put there. Solid mode owns the page colour while
      // it is on, and derives it from the base colour for both modes - which is
      // what makes a chosen base survive a light/dark switch instead of
      // reverting to the stock grey.
      el.setProperty("--page-bg", p.bg);

      const bodyEl = document.body.style;
      bodyEl.setProperty("--board-text", p.onSurface);
      bodyEl.setProperty("--board-text-secondary", p.onDim);
      bodyEl.setProperty("--board-text-dim", p.onDim);
      bodyEl.setProperty("--board-text-hover", p.onSurface);
      bodyEl.setProperty("--board-border", p.border);
    } else {
      document.body.classList.toggle("theme-light", isLight);
      document.body.classList.toggle("theme-dark", !isLight);

      const accent =
        settings.accentOverride || settings.accentColor || "#6366f1";

      const { ui, ink, display } = accentTokens(
        accent,
        isLight ? "#ffffff" : "#090a0f",
        presetSwatch(settings),
      );
      const accRgb = hexToRgb(ui);
      el.setProperty("--accent-color", ui);
      el.setProperty("--accent-ink", ink);
      el.setProperty("--accent-display", display);
      // The deeper body-text step: the brighter display step washed logos out
      // on white tiles in pastel themes.
      applyIconTint(ink);
      el.setProperty("--accent-contrast", contrastText(ui));
      applyAccent2(
        el,
        ui,
        settings.accent2,
        isLight ? "#ffffff" : "#090a0f",
        !!settings.accentGradient,
      );
      el.setProperty("--accent-rgb", `${accRgb.r}, ${accRgb.g}, ${accRgb.b}`);

      const a = hexToRgb(accent);
      const rgb = isLight
        ? {
            r: Math.round(a.r * 0.35 + 240 * 0.65),
            g: Math.round(a.g * 0.35 + 240 * 0.65),
            b: Math.round(a.b * 0.35 + 240 * 0.65),
          }
        : {
            // Dark mode: slate black base (18, 19, 24) without cold blue cast
            r: Math.round(a.r * 0.12 + 18 * 0.88),
            g: Math.round(a.g * 0.12 + 19 * 0.88),
            b: Math.round(a.b * 0.12 + 24 * 0.88),
          };
      el.setProperty("--board-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      setNeutralGround(el, isLight);

      // In dark mode, tint the obsidian slate background and panel with a clean, subtle hue
      if (!isLight) {
        const pageBg = {
          r: Math.round(a.r * 0.03 + 9 * 0.97),
          g: Math.round(a.g * 0.03 + 10 * 0.97),
          b: Math.round(a.b * 0.03 + 15 * 0.97),
        };
        const panel = {
          r: Math.round(a.r * 0.04 + 17 * 0.96),
          g: Math.round(a.g * 0.04 + 18 * 0.96),
          b: Math.round(a.b * 0.04 + 23 * 0.96),
        };
        const toHex = (c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0");
        el.setProperty("--page-bg", `#${toHex(pageBg.r)}${toHex(pageBg.g)}${toHex(pageBg.b)}`);
        // Components, not a hex: `--panel` is composed from these plus the
        // strength alpha, so overriding the colour here must not also pin the
        // opacity back to solid.
        el.setProperty("--panel-rgb", `${panel.r}, ${panel.g}, ${panel.b}`);
      } else {
        // Light mode over a wallpaper: the page colour is barely visible behind
        // the photo, but it is what the browser paints before the picture
        // loads, so it is set rather than left to whatever ran last.
        el.setProperty("--page-bg", "#f4f6f8");
        el.removeProperty("--panel-rgb");
      }

      const bodyEl = document.body.style;
      [
        "--board-text",
        "--board-text-secondary",
        "--board-text-dim",
        "--board-text-hover",
        "--board-border",
      ].forEach((v) => bodyEl.removeProperty(v));
    }

    applyWallpaperStyle();

    const metaTheme =
      document.querySelector('meta[name="theme-color"]') ||
      document.createElement("meta");
    metaTheme.name = "theme-color";
    const topColor = solid
      ? solidBgColor || (isLight ? "#ffffff" : "#0d1117")
      : isLight
        ? "#f8fafc"
        : "#090a0f";
    metaTheme.content = topColor;
    if (!metaTheme.parentNode) document.head.appendChild(metaTheme);

    const metaMs =
      document.querySelector('meta[name="msapplication-navbutton-color"]') ||
      document.createElement("meta");
    metaMs.name = "msapplication-navbutton-color";
    metaMs.content = topColor;
    if (!metaMs.parentNode) document.head.appendChild(metaMs);

    StorageManager.setBootBg(topColor);
  }

  function setMode(mode) {
    const settings = StorageManager.getSettings();
    const m =
      mode === "light" || mode === "dark" || mode === "system" ? mode : "dark";
    settings.mode = m;
    settings.modeLocked = true;
    StorageManager.save();
    applyTheme();
  }

  /* How long the boot will wait for a wallpaper before showing the page.

     This is an anti-flash measure, not a correctness one: `boot.js` has
     already painted a small cached preview of this very wallpaper as the page
     background, so revealing a few frames before the full-resolution image is
     ready costs a slight sharpening, not a flash of the wrong colour. Half a
     second is far longer than a local file needs and short enough that a
     wallpaper which is not coming back never holds up the page. */
  const WALLPAPER_PAINT_DEADLINE = 500;
  const DECODE_DEADLINE = 250;

  /**
   * Resolves once the wallpaper is ready to be shown - or once waiting for it
   * has stopped being worth it - with the decoded image when there is one, so
   * the caller can reuse it instead of decoding the same file again.
   *
   * Two deadlines, because the two ways this can hang are different.
   *
   * `img.decode()` does not settle at all in a document that is not being
   * painted, and a new tab page is very often opened in the background:
   * ctrl-clicked, restored with a session, or in a window that opens behind
   * another. The previous version awaited it with only a 5000ms backstop, so
   * every background new tab sat blank for five seconds before revealing
   * itself - measured at 5651ms against 314ms for the image to actually load.
   * The decode is now raced rather than awaited.
   *
   * And when the document is hidden there is nothing being painted to flash,
   * so there is nothing to wait for at all.
   */
  function waitForImagePaint(src) {
    if (!src) return Promise.resolve();
    if (document.hidden) return Promise.resolve();

    return new Promise((resolve) => {
      const img = new Image();
      let done = false;
      /** @param {HTMLImageElement|null} loaded The decoded image, when there is one. */
      const finish = (loaded) => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(loaded || null);
        }
      };
      const timer = setTimeout(() => finish(null), WALLPAPER_PAINT_DEADLINE);
      img.onload = () => {
        if (!img.decode) return finish(img);
        Promise.race([
          img.decode().catch(() => {}),
          new Promise((r) => setTimeout(r, DECODE_DEADLINE)),
        ]).then(
          () => finish(img),
          () => finish(img),
        );
      };
      img.onerror = () => finish(null);
      img.src = src;
    });
  }

  /* Same reasoning as the image path: a hidden document paints nothing, and a
     video that has not produced a frame must not hold the page back. */
  function waitForVideoPaint(video) {
    if (!video || video.readyState >= 2) return Promise.resolve();
    if (document.hidden) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        video.removeEventListener("loadeddata", finish);
        video.removeEventListener("error", finish);
        resolve();
      };
      const timer = setTimeout(finish, WALLPAPER_PAINT_DEADLINE);
      video.addEventListener("loadeddata", finish, { once: true });
      video.addEventListener("error", finish, { once: true });
      video.load();
    });
  }

  function cacheBootPreview(source, type) {
    try {
      const paint = (media) => {
        try {
          const sw = media.videoWidth || media.naturalWidth || media.width;
          const sh = media.videoHeight || media.naturalHeight || media.height;
          if (!sw || !sh) return;
          const canvas = document.createElement("canvas");
          canvas.width = 160;
          canvas.height = 90;
          const ctx = canvas.getContext("2d", { alpha: false });
          const scale = Math.max(canvas.width / sw, canvas.height / sh);
          const dw = sw * scale,
            dh = sh * scale;
          ctx.drawImage(
            media,
            (canvas.width - dw) / 2,
            (canvas.height - dh) / 2,
            dw,
            dh,
          );
          StorageManager.setBootPreview(canvas.toDataURL("image/jpeg", 0.68));
        } catch {}
      };
      if (type === "video") paint(source);
      else if (source instanceof HTMLImageElement) {
        // Already decoded by the caller. Decoding a 2560x1440 wallpaper a
        // second time, purely to shrink it to a 160x90 thumbnail, is a whole
        // extra full-size bitmap in memory and a second pass of decode work -
        // on the same image that was decoded a moment ago.
        paint(source);
      } else {
        const img = new Image();
        img.onload = () => paint(img);
        img.src = source;
      }
    } catch {}
  }

  /* The wallpaper that ships inside the package.

     Referenced by its path rather than copied into storage. A packaged file is
     already on disk, already the right size, and already served from the
     extension's own origin, so putting a base64 copy of it into
     `chrome.storage.local` would spend quota and startup time duplicating
     something the browser can read directly. It also means the picture
     survives an update without migration - the path is still the path.

     `.webp` because every image the extension stores goes through
     `downscaleImage`, which encodes WebP; shipping a PNG or JPEG here would
     make the one wallpaper users start on the only one that is not. */
  const PACKAGED_WALLPAPER = "wallpaper/default.webp";

  const packagedWallpaperUrl = () => {
    try {
      if (HAS_EXT && EXT.runtime && EXT.runtime.getURL)
        return EXT.runtime.getURL(PACKAGED_WALLPAPER);
    } catch {}
    // Outside the extension host the page is served from the project root, so
    // the relative path resolves on its own.
    return PACKAGED_WALLPAPER;
  };

  /**
   * Applies the packaged wallpaper, once, on a profile that has not chosen a
   * background of its own.
   *
   * Deliberately conditional on three things:
   *
   *  - it has not been tried before, so a user who switches back to a solid
   *    colour is not overruled on the next new tab;
   *  - the profile is still on a solid background, so an install that arrives
   *    with a wallpaper already configured (a restored backup, a managed
   *    deployment, a synced profile) keeps the one it came with;
   *  - the file actually exists, checked with a real request rather than
   *    assumed, so a build that ships without one degrades to the solid
   *    default instead of painting a broken image.
   */
  async function applyPackagedWallpaper() {
    const settings = StorageManager.getSettings();
    if (settings.packagedWallpaperTried) return false;

    settings.packagedWallpaperTried = true;

    const untouched =
      !settings.backgroundType || settings.backgroundType === "solid";
    if (!untouched) {
      StorageManager.saveSettings();
      return false;
    }

    const url = packagedWallpaperUrl();
    try {
      // HEAD would be lighter, but the extension protocol does not answer it
      // consistently across engines, so the file is fetched and discarded.
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) {
        StorageManager.saveSettings();
        return false;
      }
      const blob = await res.blob();
      if (!blob.size || !/^image\//i.test(blob.type || "")) {
        StorageManager.saveSettings();
        return false;
      }
    } catch {
      StorageManager.saveSettings();
      return false;
    }

    rememberWallpaper({
      id: "packaged-default",
      type: "image",
      value: url,
      name: "Included wallpaper",
    });
    await applyWallpaper("image", url);
    return true;
  }

  async function applyWallpaper(type, value, extract = true) {
    const settings = StorageManager.getSettings();
    settings.backgroundType = type;
    settings.backgroundValue = value;

    if (extract && (type === "image" || type === "video")) {
      autoExtractColor(
        await StorageManager.resolveMedia(value),
        type === "video",
      );
    }

    if (
      type === "image" &&
      typeof value === "string" &&
      /^https?:\/\//i.test(value)
    ) {
      (async () => {
        try {
          {
            const local = await localiseImage(value);
            if (local) {
              const stored = await StorageManager.putMedia(uuid(), local);
              settings.backgroundValue = stored;
              const data = StorageManager.getData();
              if (Array.isArray(data.wallpapers)) {
                const item = data.wallpapers.find((w) => w.value === value);
                if (item) item.value = stored;
              }
              StorageManager.save();
              StorageManager.pruneMedia();
            }
          }
        } catch {}
      })();
    }

    StorageManager.save();

    const videoBg = $("video-bg");
    const photoBg = $("photo-bg");
    const src = await StorageManager.resolveMedia(value);

    if (type === "video") {
      if (videoBg) {
        videoBg.src = src;
        await waitForVideoPaint(videoBg);
        cacheBootPreview(videoBg, "video");
        videoBg.classList.add("active");
        if (!document.hidden && !settings.performanceMode)
          videoBg.play().catch(() => {});
      }
      if (photoBg) photoBg.classList.remove("active");
    } else if (type === "image") {
      if (photoBg) {
        const decoded = await waitForImagePaint(src);
        photoBg.style.backgroundImage = `url("${String(src).replace(/"/g, "%22")}")`;
        photoBg.classList.add("active");
        // The element when the wait produced one, the URL when it did not
        // (a hidden document skips the wait entirely) - `cacheBootPreview`
        // takes either and only re-decodes in the second case.
        cacheBootPreview(decoded || src, "image");
      }
      if (videoBg) {
        videoBg.pause();
        videoBg.removeAttribute("src");
        videoBg.classList.remove("active");
      }
    } else {
      StorageManager.setBootPreview(null);
      if (photoBg) {
        photoBg.style.backgroundImage = "none";
        photoBg.style.backgroundColor = value;
        photoBg.classList.add("active");
      }
      if (videoBg) videoBg.classList.remove("active");
    }

    applyWallpaperStyle();
    applyTheme();
  }

  async function autoExtractColor(rawMediaUrl, isVideo = false, toneOnly = false) {
    const mod = await loadTab("theme");
    return mod.autoExtractColor(rawMediaUrl, isVideo, toneOnly);
  }

  function applyCursor() {
    const url = StorageManager.getSettings().cursorUrl;
    const root = document.documentElement.style;
    const ok = typeof url === "string" && url.startsWith("data:image/");
    if (ok) root.setProperty("--app-cursor", `url("${url}") 0 0, auto`);
    else root.removeProperty("--app-cursor");
    document.body.classList.toggle("has-custom-cursor", ok);
  }

  function hexToRgb(hex) {
    let c = (hex || "#ffffff").replace("#", "");
    if (c.length === 3)
      c = c
        .split("")
        .map((x) => x + x)
        .join("");

    const parsed = parseInt(c, 16);
    const num = Number.isNaN(parsed) ? 0xffffff : parsed;
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  /* Accent text has to clear APCA Lc 60 - the body-text floor - not WCAG 2's
     4.5:1 ratio.

     The two disagree badly on exactly the colours this app deals in. A
     saturated mid-tone accent can pass 4.5:1 and still score Lc 34, which is
     roughly a third of readable; that is precisely what left the Boards and
     Notes labels washed out on a solid ground for any accent a user picked.
     WCAG 2's formula is symmetric and does not know that light-on-mid reads
     worse than dark-on-mid, which is the whole reason DESIGN.md picked APCA
     for the ink decision in the first place. This is the last place that had
     not caught up. */
  const INK_MIN_LC = 60;

  // Fills only have to separate from the ground, not be read as text, so the
  // bar is deliberately much lower and the accent nearly always survives it.
  const FILL_MIN_LC = 25;
  // Display type: the clock and other very large accent text.
  const DISPLAY_MIN_LC = 35;

  /**
   * @param {string} [swatch] A preset's second colour - the dot its swatch
   *   shows. Pastel presets pair a very pale first colour with a stronger
   *   second one, and deriving everything from the pale one produced an accent
   *   that matched nothing on the swatch: too faint to use as-is, so it was
   *   darkened into a muted shade the user never picked. The shown colour now
   *   leads the ink, and stands in for the fill when the first is too faint.
   */
  function accentTokens(accent, bg, swatch) {
    const shown = HEX6.test(swatch || "") ? swatch : accent;
    const ink = readableInk(shown, bg);
    // Large type - the clock above all - stays readable at far lower contrast
    // than body text, so it gets its own, brighter step of the same colour.
    // Holding it to the body-text bar is what turned a pastel pink swatch into
    // a dark wine on the page.
    const display = Contrast.readable(shown, bg, DISPLAY_MIN_LC);
    const ui =
      [accent, shown].find((c) => Math.abs(Contrast.lc(c, bg)) >= FILL_MIN_LC) ||
      Contrast.readable(shown, bg, FILL_MIN_LC + 5);
    return { ui, ink, display };
  }

  /** The swatch colour, only for a preset - a custom second colour is a gradient stop, not an ink. */
  const presetSwatch = (s) => (presetById(s.preset) ? s.accent2 : "");

  const SVG_NS = "http://www.w3.org/2000/svg";

  /**
   * Recolours pinned-link icons on a solid background as a duotone.
   *
   * The dark parts of a logo take the accent and the light parts stay light,
   * by mapping each pixel's luminance between the two. It replaced a mask that
   * painted the icon's whole shape in the accent: that was fine for a line
   * glyph and useless for a logo drawn as a filled shape - YouTube's play
   * button, a solid app tile - which became a blank coloured blob. A filter
   * works on the rendered pixels, so it also applies to icons loaded from
   * another site, which a mask cannot read.
   */
  function applyIconTint(hex) {
    if (!document.body || !HEX6.test(hex || "")) return;
    let svg = document.getElementById("etIconTintSvg");
    if (!svg) {
      svg = document.createElementNS(SVG_NS, "svg");
      svg.id = "etIconTintSvg";
      svg.setAttribute("width", "0");
      svg.setAttribute("height", "0");
      svg.setAttribute("aria-hidden", "true");
      svg.style.position = "absolute";
      const filter = document.createElementNS(SVG_NS, "filter");
      filter.id = "et-icon-tint";
      filter.setAttribute("color-interpolation-filters", "sRGB");
      filter.appendChild(document.createElementNS(SVG_NS, "feColorMatrix"));
      svg.appendChild(filter);
      document.body.appendChild(svg);
    }
    const { r, g, b } = hexToRgb(hex);
    const row = (c) => {
      const a = c / 255;
      const k = 1 - a;
      return `${(k * 0.2126).toFixed(4)} ${(k * 0.7152).toFixed(4)} ${(k * 0.0722).toFixed(4)} 0 ${a.toFixed(4)}`;
    };
    const matrix = svg.querySelector("feColorMatrix");
    matrix.setAttribute("type", "matrix");
    matrix.setAttribute("values", `${row(r)} ${row(g)} ${row(b)} 0 0 0 1 0`);
  }

  /**
   * The accent, kept as itself where it is already legible and nudged along
   * its own hue toward the ground's ink where it is not.
   *
   * `Contrast.readable` walks the colour toward whichever ink the background
   * calls for and stops the moment it clears the bar, so the hue survives and
   * only lightness moves - a brand colour stays recognisable instead of
   * collapsing to grey.
   */
  function readableInk(accent, bg) {
    return Contrast.readable(accent, bg, INK_MIN_LC);
  }

  // --- APCA (Accessible Perceptual Contrast Algorithm), constants from the
  // published 0.98G-4g formulation.
  //
  // WCAG 2's contrast ratio is symmetric: it does not know that light text on
  // a mid colour reads far worse than dark text on the same colour. Picking
  // black-vs-white by ratio therefore flips to white too early on saturated
  // mid-tones - the classic "white label on a medium blue button" that looks
  // washed out. APCA models polarity, so the flip lands where the eye puts it.
  /** Picks the ink - near-black or white - that reads best on `color`. */
  const contrastText = (color) => Contrast.ink(color);

  /**
   * Makes every slider's numeric readout directly editable, everywhere in
   * Settings, without touching each slider's own binding code.
   *
   * A value label opts in with `data-slider-val="<slider id>"`, or, for a
   * slider addressed by a data-attribute rather than an id (the per-surface
   * strength sliders), `data-slider-val-key="<key>"` naming the value of its
   * `data-surface-slider`. Clicking the label swaps it for a number input;
   * Enter or blur commits by writing the slider's `value` and dispatching a
   * real `input` and `change` event on it, so the slider's own listener does
   * the clamping, the storage write and the repaint exactly as if the user
   * had dragged it. Escape cancels. This file never needs to know what a
   * given slider is for.
   */
  const SliderValueEditor = (() => {
    function resolveSlider(label) {
      const key = label.getAttribute("data-slider-val-key");
      if (key) return document.querySelector(`[data-surface-slider="${key}"]`);
      const id = label.getAttribute("data-slider-val");
      return id ? document.getElementById(id) : null;
    }

    function suffixOf(label) {
      return label.getAttribute("data-slider-suffix") ?? "";
    }

    function startEdit(label) {
      if (label.querySelector("input")) return;
      const slider = resolveSlider(label);
      if (!slider) return;

      const suffix = suffixOf(label);
      const min = Number(slider.min || 0);
      const max = Number(slider.max || 100);
      const original = label.textContent;

      const input = document.createElement("input");
      input.type = "number";
      input.className = "st-slider-val-input";
      input.value = slider.value;
      input.min = String(min);
      input.max = String(max);
      input.step = slider.step || "1";

      const commit = () => {
        const n = parseFloat(input.value);
        const clamped = Number.isFinite(n)
          ? Math.min(max, Math.max(min, n))
          : Number(slider.value);
        slider.value = String(clamped);
        slider.dispatchEvent(new Event("input", { bubbles: true }));
        slider.dispatchEvent(new Event("change", { bubbles: true }));
        // The dispatched events already repaint most labels; this covers the
        // rare slider whose `input` handler does not touch its own label.
        if (label.isConnected && label.querySelector("input"))
          label.textContent = `${clamped}${suffix}`;
      };

      input.addEventListener("keydown", (e) => {
        // Without this, Enter/Escape bubbles up to the label's own keydown
        // listener (there so the label itself is keyboard-operable) and
        // immediately reopens the editor it was just told to close.
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
          input.blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          label.textContent = original;
        }
      });
      input.addEventListener("blur", () => {
        if (label.contains(input)) commit();
      });
      input.addEventListener("click", (e) => e.stopPropagation());

      label.textContent = "";
      label.appendChild(input);
      input.focus();
      input.select();
    }

    function wire(root) {
      (root || document)
        .querySelectorAll("[data-slider-val], [data-slider-val-key]")
        .forEach((label) => {
          if (label.dataset.sliderValWired) return;
          label.dataset.sliderValWired = "1";
          label.setAttribute("tabindex", "0");
          label.setAttribute("role", "button");
          label.title = "Click to type a value";
          label.addEventListener("click", () => startEdit(label));
          label.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              startEdit(label);
            }
          });
        });
    }

    return { wire };
  })();

  /** Coalesces repeated repaints per key into one animation frame. */
  function createFrameScheduler() {
    const pending = new Map();
    return function paintNextFrame(key, fn) {
      if (pending.has(key)) return;
      pending.set(
        key,
        requestAnimationFrame(() => {
          pending.delete(key);
          fn();
        }),
      );
    };
  }

  window.SettingsShared = {
    createFrameScheduler,
    PRESETS,
    PRESET_GROUPS,
    presetById,
    HEX6,
    MAX_WALLPAPERS,
    MAX_VIDEO_BYTES,
    WP_MAX_PX,
    MAX_REMOTE_BYTES,
    liveVar,
    effectiveAccent,
    darkMedia,
    systemDark,
    rememberWallpaper,
    readAsDataUrl,
    downscaleImage,
    localiseImage,
    localiseAllRemoteWallpapers,
    resolveMode,
    hslToHex,
    hexToRgb,
    accentTokens,
    contrastText,
    derivePalette,
    applySeed,
    applyAccent2,
    applyPresetShell,
    applyTheme,
    applyCursor,
    applyWallpaper,
    applyWallpaperStyle,
    applyWallpaperOverlay,
    applyWallpaperVignette,
    applyWallpaperBlur,
    setMode,
    waitForImagePaint,
    waitForVideoPaint,
    hydrateGalleryThumbs,
    openSideSheet,
    closeSideSheet,
    renderSideSheetContent: (...a) => renderSideSheetContent(...a),
    getActivePage: () => activePage,
    registerTab,
    loadTab,
    surfaceStrengths,
    overallStrength,
    SliderValueEditor,
  };

  return {
    init,
    openSideSheet,
    closeSideSheet,
    applyTheme,
    applyPresetShell,
    setMode,
    applyWallpaper,
    applyPackagedWallpaper,
    autoExtractColor,
    applyCursor,
  };
})();

window.SettingsReady = Promise.resolve();
