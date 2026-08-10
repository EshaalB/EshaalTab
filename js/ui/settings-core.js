"use strict";

const SettingsRenderer = (() => {
  let activeTab = "theme";
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
      id: "neon",
      name: "Neon",
      group: "Gamer",
      mode: "dark",
      accent: "#22d3ee",
      accent2: "#ff4655",
      radius: "0px",
      mono: true,
      cls: "preset-neon",
    },
    {
      id: "synthwave",
      name: "Synthwave",
      group: "Gamer",
      mode: "dark",
      accent: "#f062ff",
      accent2: "#31d0ff",
      radius: "0px",
      mono: true,
      cls: "preset-neon",
    },
    {
      id: "matrix",
      name: "Matrix",
      group: "Gamer",
      mode: "dark",
      accent: "#3ddc84",
      accent2: "#7bffb0",
      radius: "0px",
      mono: true,
      cls: "preset-neon",
    },
    {
      id: "amber",
      name: "Amber CRT",
      group: "Gamer",
      mode: "dark",
      accent: "#ffb300",
      accent2: "#ff6f3c",
      radius: "0px",
      mono: true,
      cls: "preset-neon",
    },
  ];

  const PRESET_GROUPS = ["Pastel", "Gamer"];

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

  async function ensureHostAccess(url) {
    return true;
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
    data: "js/ui/settings-data.js",
    help: "js/ui/settings-help.js",
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

  function initSideSheet() {
    const overlay = $("sidesheetOverlay");
    const closeBtn = $("sidesheetCloseBtn");
    const topBtn = $("topSettingsBtn");
    const tabBtns = $$(".et-set-tab");

    if (topBtn) topBtn.addEventListener("click", () => openSideSheet(null));
    if (closeBtn) closeBtn.addEventListener("click", closeSideSheet);

    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeSideSheet();
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
          acc.classList.toggle("is-expanded", !isExp);
          const settings = StorageManager.getSettings();
          if (
            !settings.collapsedSettingsAccordions ||
            typeof settings.collapsedSettingsAccordions !== "object"
          ) {
            settings.collapsedSettingsAccordions = {};
          }
          const key = accordionKey(header);
          const collapsed = new Set(
            settings.collapsedSettingsAccordions[activeTab] || [],
          );
          if (isExp) collapsed.add(key);
          else collapsed.delete(key);
          settings.collapsedSettingsAccordions[activeTab] = [...collapsed];
          StorageManager.saveSettings();
        }
      });
    }

    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        rememberSettingsScroll(activeTab);
        tabBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        activeTab = btn.dataset.tab;
        const settings = StorageManager.getSettings();
        settings.lastSettingsTab = activeTab;
        StorageManager.saveSettings();
        renderSideSheetContent(false);
      });
    });
  }

  let sheetReturnFocus = null;

  function openSideSheet(tab = null, section = null) {
    const overlay = $("sidesheetOverlay");
    const topBtn = $("topSettingsBtn");
    if (!overlay) return;

    sheetReturnFocus = document.activeElement;
    const settings = StorageManager.getSettings();
    activeTab =
      tab && ["theme", "widgets", "data", "help"].includes(tab)
        ? tab
        : settings.lastSettingsTab || "theme";
    pendingSection = section;
    settings.lastSettingsTab = activeTab;
    StorageManager.saveSettings();

    $$(".et-set-tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === activeTab);
    });

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
    rememberSettingsScroll(activeTab);

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

  function paintTab(mod, tab, token, savedScrollTop) {
    const body = $("sidesheetBody");
    if (!body || token !== renderToken || activeTab !== tab) return;
    const settings = StorageManager.getSettings();
    const data = StorageManager.getData();
    setSafeHTML(body, mod.render(settings, data));
    const collapsed = new Set(
      (settings.collapsedSettingsAccordions?.[tab] || []).map((v) =>
        String(v).toLowerCase(),
      ),
    );
    body.querySelectorAll(".st-accordion").forEach((acc) => {
      const header = acc.querySelector(".st-accordion-header");
      acc.classList.toggle("is-expanded", !collapsed.has(accordionKey(header)));
    });
    mod.bind(settings, data);
    CustomSelect.initAll(body);
    hydrateGalleryThumbs(body);
    body.scrollTop = Math.max(0, savedScrollTop || 0);
    if (pendingSection === "wallpaper" && tab === "theme") {
      const target = $("themeWpToggle")?.closest(".st-card");
      const accordion = target?.closest(".st-accordion");
      if (accordion) accordion.classList.add("is-expanded");
      target?.scrollIntoView({ block: "center" });
      pendingSection = null;
    }
  }

  function renderSideSheetContent(preserveScroll = true) {
    const body = $("sidesheetBody");
    if (!body) return;

    const tab = activeTab;
    const settings = StorageManager.getSettings();
    const savedScrollTop = preserveScroll
      ? body.scrollTop
      : settings.settingsScrollPositions?.[tab] || 0;
    const token = ++renderToken;

    const cached = tabModules[tab];
    if (cached) {
      paintTab(cached, tab, token, savedScrollTop);
      return;
    }

    setSafeHTML(
      body,
      '<div class="st-tab-status" role="status" aria-live="polite">' +
        '<span class="st-tab-spinner" aria-hidden="true"></span><span>Loading\u2026</span></div>',
    );

    loadTab(tab)
      .then((mod) => {
        paintTab(mod, tab, token, savedScrollTop);
      })
      .catch(() => {
        if (token !== renderToken || activeTab !== tab) return;
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

    const RADIUS_VARS = ["--r-xs", "--r-sm", "--r-md", "--r-lg", "--r-xl", "--r-pill"];
    let override =
      settings.cornerRadius && settings.cornerRadius !== "default"
        ? settings.cornerRadius
        : p && p.radius
          ? p.radius
          : null;

    if (override === "circle" || override === "9999px") {
      override = "16px";
    }

    if (override === "0px") {
      RADIUS_VARS.forEach((v) => el.setProperty(v, "0px"));
      el.setProperty("--radius", "0px");
      document.body.classList.add("radius-sharp");
      document.body.classList.remove("tiles-circle", "radius-round");
    } else if (override === "8px") {
      document.body.classList.remove("radius-sharp", "tiles-circle", "radius-round");
      el.setProperty("--r-xs", "4px");
      el.setProperty("--r-sm", "6px");
      el.setProperty("--r-md", "8px");
      el.setProperty("--r-lg", "10px");
      el.setProperty("--r-xl", "12px");
      el.setProperty("--r-pill", "12px");
      el.setProperty("--radius", "8px");
    } else if (override === "16px" || override === "round") {
      document.body.classList.remove("radius-sharp");
      document.body.classList.add("tiles-circle", "radius-round");
      el.setProperty("--r-xs", "6px");
      el.setProperty("--r-sm", "10px");
      el.setProperty("--r-md", "14px");
      el.setProperty("--r-lg", "16px");
      el.setProperty("--r-xl", "20px");
      el.setProperty("--r-pill", "9999px");
      el.setProperty("--radius", "16px");
    } else if (override) {
      document.body.classList.remove("radius-sharp", "tiles-circle", "radius-round");
      RADIUS_VARS.forEach((v) => el.setProperty(v, override));
      el.setProperty("--radius", override);
    } else {
      document.body.classList.remove("radius-sharp", "tiles-circle", "radius-round");
      RADIUS_VARS.forEach((v) => el.removeProperty(v));
      el.removeProperty("--radius");
    }
    if (p && p.cls) document.body.classList.add(p.cls);

    if (settings.fontFamily === "geometric") {
      document.body.classList.remove("font-handwriting");
      el.setProperty("--font-app", "'Outfit', system-ui, sans-serif");
    } else if (settings.fontFamily === "rounded") {
      document.body.classList.remove("font-handwriting");
      el.setProperty("--font-app", "'Lexend', system-ui, sans-serif");
    } else if (settings.fontFamily === "monospace") {
      document.body.classList.remove("font-handwriting");
      el.setProperty("--font-app", "'JetBrains Mono', monospace");
    } else if (settings.fontFamily === "serif") {
      document.body.classList.remove("font-handwriting");
      el.setProperty("--font-app", "'Lora', Georgia, serif");
    } else if (settings.fontFamily === "slab") {
      document.body.classList.remove("font-handwriting");
      el.setProperty("--font-app", "'Roboto Slab', Georgia, serif");
    } else if (settings.fontFamily === "sans-serif") {
      document.body.classList.remove("font-handwriting");
      el.setProperty(
        "--font-app",
        "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      );
    } else if (settings.fontFamily === "handwriting") {
      el.setProperty("--font-app", "'Patrick Hand', 'Comic Neue', cursive");
      document.body.classList.add("font-handwriting");
    } else {
      document.body.classList.remove("font-handwriting");
      el.setProperty(
        "--font-app",
        "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      );
    }

    WidgetsRenderer.applyClockAppearance(settings);
  }

  function applyAccent2(el, accent1) {
    el.setProperty("--accent-2", accent1);
    el.setProperty("--accent-2-contrast", contrastText(accent1));
    const rgb = hexToRgb(accent1);
    el.setProperty("--accent-2-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
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

    const activeMode = resolveMode();
    const isLight = activeMode === "light";
    let solidBgColor = null;

    const legacyStrength =
      typeof settings.boardOpacity === "number"
        ? settings.boardOpacity * 100
        : 8;
    const rawStrength = Math.max(
      0,
      Math.min(
        100,
        typeof settings.interfaceOpacity === "number"
          ? settings.interfaceOpacity
          : legacyStrength,
      ),
    );
    const maxCap = 0.85;
    const effectiveOpacity = (rawStrength / 100) * maxCap;

    if (rawStrength === 0) {
      el.setProperty("--board-opacity", "0");
      el.setProperty("--topbar-opacity", "0");
      el.setProperty("--notes-opacity", "0");
      el.setProperty("--widget-bg-alpha", "0");
    } else {
      el.setProperty("--board-opacity", String(Number(effectiveOpacity.toFixed(4))));
      el.setProperty("--topbar-opacity", String(Number(Math.min(maxCap, effectiveOpacity + 0.04).toFixed(4))));
      el.setProperty("--notes-opacity", String(Number(Math.min(maxCap, effectiveOpacity + 0.06).toFixed(4))));
      el.setProperty("--widget-bg-alpha", String(Number(Math.min(maxCap, effectiveOpacity + 0.08).toFixed(4))));
    }

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

      const { ui, ink } = accentTokens(accent, p.bg);
      const accRgb = hexToRgb(ui);
      el.setProperty("--accent-color", ui);
      el.setProperty("--accent-ink", ink);
      el.setProperty("--accent-contrast", contrastText(ui));
      applyAccent2(el, ui);
      el.setProperty("--accent-rgb", `${accRgb.r}, ${accRgb.g}, ${accRgb.b}`);

      const sRgb = hexToRgb(p.surface);
      el.setProperty("--board-rgb", `${sRgb.r}, ${sRgb.g}, ${sRgb.b}`);

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

      const { ui, ink } = accentTokens(accent, isLight ? "#ffffff" : "#0d1117");
      const accRgb = hexToRgb(ui);
      el.setProperty("--accent-color", ui);
      el.setProperty("--accent-ink", ink);
      el.setProperty("--accent-contrast", contrastText(ui));
      applyAccent2(el, ui);
      el.setProperty("--accent-rgb", `${accRgb.r}, ${accRgb.g}, ${accRgb.b}`);

      const a = hexToRgb(accent);
      const rgb = isLight
        ? {
            r: Math.round(a.r * 0.35 + 240 * 0.65),
            g: Math.round(a.g * 0.35 + 240 * 0.65),
            b: Math.round(a.b * 0.35 + 240 * 0.65),
          }
        : {
            // Dark mode: blend only 18% of the accent into a neutral dark base (20,20,28)
            // so surfaces stay a subtle grey, not a saturated accent hue
            r: Math.round(a.r * 0.18 + 20 * 0.82),
            g: Math.round(a.g * 0.18 + 20 * 0.82),
            b: Math.round(a.b * 0.18 + 28 * 0.82),
          };
      el.setProperty("--board-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);

      // In dark mode, also tint the base background and panel with a very faint
      // accent hue (~4-6% mix) so the whole UI shifts subtly with the accent color.
      // This keeps it near #141414 but gives it personality.
      if (!isLight) {
        const pageBg = {
          r: Math.round(a.r * 0.04 + 11 * 0.96),
          g: Math.round(a.g * 0.04 + 11 * 0.96),
          b: Math.round(a.b * 0.06 + 16 * 0.94),
        };
        const panel = {
          r: Math.round(a.r * 0.06 + 15 * 0.94),
          g: Math.round(a.g * 0.06 + 15 * 0.94),
          b: Math.round(a.b * 0.08 + 22 * 0.92),
        };
        const toHex = (c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0");
        el.setProperty("--page-bg", `#${toHex(pageBg.r)}${toHex(pageBg.g)}${toHex(pageBg.b)}`);
        el.setProperty("--panel", `#${toHex(panel.r)}${toHex(panel.g)}${toHex(panel.b)}`);
      } else {
        el.removeProperty("--page-bg");
        el.removeProperty("--panel");
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

  function waitForImagePaint(src) {
    if (!src) return Promise.resolve();
    return new Promise((resolve) => {
      const img = new Image();
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve();
        }
      };
      const timer = setTimeout(finish, 5000);
      img.onload = async () => {
        try {
          if (img.decode) await img.decode();
        } catch {}
        finish();
      };
      img.onerror = finish;
      img.src = src;
    });
  }

  function waitForVideoPaint(video) {
    if (!video || video.readyState >= 2) return Promise.resolve();
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
      const timer = setTimeout(finish, 5000);
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
      else {
        const img = new Image();
        img.onload = () => paint(img);
        img.src = source;
      }
    } catch {}
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
          if (await ensureHostAccess(value)) {
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
        await waitForImagePaint(src);
        photoBg.style.backgroundImage = `url("${String(src).replace(/"/g, "%22")}")`;
        photoBg.classList.add("active");
        cacheBootPreview(src, "image");
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

  async function autoExtractColor(rawMediaUrl, isVideo = false) {
    const mod = await loadTab("theme");
    return mod.autoExtractColor(rawMediaUrl, isVideo);
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

  function relLuminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    const lin = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  }

  function contrastRatio(a, b) {
    const L1 = relLuminance(a),
      L2 = relLuminance(b);
    return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  }

  const INK_MIN_CONTRAST = 4.5;

  const FILL_MIN_CONTRAST = 2.0;

  function accentTokens(accent, bg) {
    const ink =
      contrastRatio(accent, bg) >= INK_MIN_CONTRAST
        ? accent
        : readableInk(accent, bg);
    const ui = contrastRatio(accent, bg) >= FILL_MIN_CONTRAST ? accent : ink;
    return { ui, ink };
  }

  function readableInk(accent, bg) {
    if (contrastRatio(accent, bg) >= INK_MIN_CONTRAST) return accent;
    const { h, s } = hexToHsl(accent);

    const sat = s < 0.08 ? s : Math.max(s, 0.35);
    const goDarker = relLuminance(bg) > 0.4;
    for (let i = 0; i < 24; i++) {
      const l = goDarker ? 0.46 - i * 0.02 : 0.54 + i * 0.02;
      const cand = hslToHex(h, sat, Math.max(0.04, Math.min(0.96, l)));
      if (contrastRatio(cand, bg) >= INK_MIN_CONTRAST) return cand;
    }
    return goDarker ? "#14151a" : "#ffffff";
  }

  function contrastText(color) {
    const { r, g, b } = hexToRgb(color);
    const lin = [r, g, b].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    const againstWhite = 1.05 / (L + 0.05);
    const againstInk = (L + 0.05) / 0.05265;
    return againstInk >= againstWhite ? "#14151a" : "#ffffff";
  }

  window.SettingsShared = {
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
    ensureHostAccess,
    darkMedia,
    systemDark,
    rememberWallpaper,
    readAsDataUrl,
    downscaleImage,
    localiseImage,
    localiseAllRemoteWallpapers,
    resolveMode,
    hexToHsl,
    hslToHex,
    hexToRgb,
    relLuminance,
    contrastRatio,
    accentTokens,
    readableInk,
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
    setMode,
    waitForImagePaint,
    waitForVideoPaint,
    hydrateGalleryThumbs,
    openSideSheet,
    closeSideSheet,
    renderSideSheetContent: (...a) => renderSideSheetContent(...a),
    getActiveTab: () => activeTab,
    registerTab,
    loadTab,
  };

  return {
    init,
    openSideSheet,
    closeSideSheet,
    applyTheme,
    applyPresetShell,
    setMode,
    applyWallpaper,
    autoExtractColor,
    applyCursor,
  };
})();

window.SettingsReady = Promise.resolve();
