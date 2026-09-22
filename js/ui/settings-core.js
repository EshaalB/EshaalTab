"use strict";

const SettingsRenderer = (() => {
  let activePage = "home";

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
    const overMedia =
      s.backgroundType === "image" || s.backgroundType === "video";
    if (overMedia && HEX6.test(s.wpExtractedAccent || ""))
      return s.wpExtractedAccent;
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

  const PAGES = [
    {
      group: "Everyday",
      items: [
        {
          id: "home",
          label: "Home page",
          tabs: ["theme", "widgets"],
          find: "widgets clock greeting name date weather search bar pinned links launcher time format 12 24 hour shadow top bar library timer palette tasks",
        },
        {
          id: "wallpaper",
          label: "Wallpaper",
          tabs: ["theme", "widgets"],
          find: "photo video upload url blur soften dim crop zoom position fit gallery saved mute volume",
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
      group: "Look and feel",
      items: [
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
          id: "appearance",
          label: "Appearance",
          tabs: ["widgets", "theme"],
          find: "corner radius rounded sharp font typeface board width size interface background strength opacity transparency surface performance ambient wash",
        },
      ],
    },
    {
      group: "Your data",
      items: [
        { id: "backup", label: "Backup & import", tabs: ["data"], find: "export import csv json bookmarks raindrop restore" },
        { id: "privacy", label: "Privacy", tabs: ["data"], find: "favicons remote tracking permissions" },
        { id: "maintenance", label: "Maintenance", tabs: ["data"], find: "duplicates repair wallpaper cache" },
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
      const isPicker = (el) => el?.matches?.('input[type="color"]');
      const stopPicking = () => overlay.classList.remove("is-picking");
      let pop = null;
      let popInput = null;

      const hsvToHex = (h, sat, val) => {
        const f = (n) => {
          const k = (n + h / 60) % 6;
          const v = val - val * sat * Math.max(0, Math.min(k, 4 - k, 1));
          return Math.round(v * 255);
        };
        return Contrast.toHex({ r: f(5), g: f(3), b: f(1) });
      };

      const hexToHsv = (hex) => {
        const { r, g, b } = Contrast.toRgb(hex);
        const max = Math.max(r, g, b) / 255;
        const min = Math.min(r, g, b) / 255;
        const d = max - min;
        let h = 0;
        if (d) {
          if (max === r / 255) h = ((g - b) / 255 / d) % 6;
          else if (max === g / 255) h = (b - r) / 255 / d + 2;
          else h = (r - g) / 255 / d + 4;
          h *= 60;
          if (h < 0) h += 360;
        }
        return { h, s: max ? d / max : 0, v: max };
      };

      const closePop = () => {
        if (pop && popInput) rememberColor(popInput.value);
        pop?.remove();
        pop = null;
        popInput = null;
      };
      closeColorPopover = closePop;

      const commitColor = (hex) => {
        if (!popInput || !HEX6_RE.test(hex)) return;
        popInput.value = hex.toLowerCase();
        popInput.dispatchEvent(new Event("input", { bubbles: true }));
        popInput.dispatchEvent(new Event("change", { bubbles: true }));
      };

      function openPop(input) {
        closePop();
        popInput = input;
        let { h, s: sat, v: val } = hexToHsv(input.value);

        pop = document.createElement("div");
        pop.className = "st-picker";
        setSafeHTML(
          pop,
          '<div class="st-picker-head">' +
            '<span class="st-picker-title">Colour</span>' +
            '<button type="button" class="st-picker-close" aria-label="Close">&#10005;</button>' +
            "</div>" +
            '<div class="st-picker-area" tabindex="0" role="slider" aria-label="Saturation and brightness"><span class="st-picker-thumb"></span></div>' +
            '<input type="range" class="st-picker-hue" min="0" max="359" step="1" aria-label="Hue" />' +
            '<div class="st-picker-foot">' +
            '<span class="st-picker-preview"></span>' +
            '<input type="text" class="st-picker-hex" maxlength="7" spellcheck="false" aria-label="Hex colour" />' +
            ("EyeDropper" in window
              ? '<button type="button" class="st-picker-drop" title="Pick from screen" aria-label="Pick a colour from the screen">&#9678;</button>'
              : "") +
            "</div>" +
            '<div class="st-picker-recent"></div>',
        );

        const area = pop.querySelector(".st-picker-area");
        const thumb = pop.querySelector(".st-picker-thumb");
        const hue = pop.querySelector(".st-picker-hue");
        const hexField = pop.querySelector(".st-picker-hex");
        const preview = pop.querySelector(".st-picker-preview");
        const recent = pop.querySelector(".st-picker-recent");

        const paint = (apply = true) => {
          const value = hsvToHex(h, sat, val);
          area.style.setProperty("--hue", hsvToHex(h, 1, 1));
          thumb.style.left = `${sat * 100}%`;
          thumb.style.top = `${(1 - val) * 100}%`;
          thumb.style.background = value;
          preview.style.background = value;
          hue.value = String(Math.round(h));
          if (document.activeElement !== hexField) hexField.value = value;
          if (apply) commitColor(value);
        };

        recent.replaceChildren(
          ...recentColors().map((c) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "st-recent-swatch";
            b.style.background = c;
            b.title = `Use ${c}`;
            b.setAttribute("aria-label", `Use colour ${c}`);
            b.addEventListener("click", () => {
              ({ h, s: sat, v: val } = hexToHsv(c));
              paint();
            });
            return b;
          }),
        );

        const fromPointer = (e) => {
          const r = area.getBoundingClientRect();
          sat = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
          val = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
          paint();
        };
        area.addEventListener("pointerdown", (e) => {
          area.setPointerCapture(e.pointerId);
          fromPointer(e);
        });
        area.addEventListener("pointermove", (e) => {
          if (e.buttons) fromPointer(e);
        });
        area.addEventListener("keydown", (e) => {
          const step = e.shiftKey ? 0.1 : 0.02;
          if (e.key === "ArrowRight") sat = Math.min(1, sat + step);
          else if (e.key === "ArrowLeft") sat = Math.max(0, sat - step);
          else if (e.key === "ArrowUp") val = Math.min(1, val + step);
          else if (e.key === "ArrowDown") val = Math.max(0, val - step);
          else return;
          e.preventDefault();
          paint();
        });
        hue.addEventListener("input", () => {
          h = +hue.value;
          paint();
        });
        hexField.addEventListener("input", () => {
          const v = hexField.value.trim().replace(/^#?/, "#");
          if (!HEX6_RE.test(v)) return;
          ({ h, s: sat, v: val } = hexToHsv(v));
          paint();
        });
        pop.querySelector(".st-picker-close").addEventListener("click", closePop);
        pop.querySelector(".st-picker-drop")?.addEventListener("click", async () => {
          overlay.classList.add("is-picking");
          pop.classList.add("is-hidden");
          try {
            const { sRGBHex } = await new window.EyeDropper().open();
            ({ h, s: sat, v: val } = hexToHsv(sRGBHex));
            paint();
          } catch {
          } finally {
            stopPicking();
            pop?.classList.remove("is-hidden");
          }
        });

        pop.querySelector(".st-picker-head").addEventListener("pointerdown", (e) => {
          if (e.target.closest(".st-picker-close")) return;
          const box = pop.getBoundingClientRect();
          const dx = e.clientX - box.left;
          const dy = e.clientY - box.top;
          const move = (ev) => {
            pop.style.left = `${Math.max(4, Math.min(innerWidth - box.width - 4, ev.clientX - dx))}px`;
            pop.style.top = `${Math.max(4, Math.min(innerHeight - box.height - 4, ev.clientY - dy))}px`;
          };
          const up = () => {
            document.removeEventListener("pointermove", move);
            document.removeEventListener("pointerup", up);
          };
          document.addEventListener("pointermove", move);
          document.addEventListener("pointerup", up);
        });

        const at = input.getBoundingClientRect();
        pop.style.left = `${Math.max(4, Math.min(at.left - 48, innerWidth - 252))}px`;
        pop.style.top = `${Math.max(4, Math.min(at.bottom + 8, innerHeight - 340))}px`;
        document.body.append(pop);
        paint(false);
      }

      overlay.addEventListener("click", (e) => {
        const btn = e.target.closest?.(".st-swatch");
        if (!btn) return;
        const input = $(btn.dataset.for);
        if (!input) return;
        if (popInput === input) closePop();
        else openPop(input);
      });

      document.addEventListener("pointerdown", (e) => {
        if (!pop || pop.contains(e.target) || e.target.closest?.(".st-swatch")) return;
        closePop();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && pop) {
          closePop();
          stopPicking();
        }
      });

      overlay.addEventListener("change", (e) => {
        if (isPicker(e.target)) stopPicking();
      });
      window.addEventListener("focus", stopPicking);
      document.addEventListener("visibilitychange", stopPicking);

      overlay.addEventListener("click", (e) => {
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

    const asked = TAB_TO_PAGE[tab] || tab;
    activePage = pageById(asked)
      ? asked
      : pageById(settings.lastSettingsPage || "")
        ? settings.lastSettingsPage
        : "home";
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

  const HEX6_RE = /^#[0-9a-f]{6}$/i;
  let closeColorPopover = () => {};

  function recentColors() {
    const list = StorageManager.getSettings().recentColors;
    return Array.isArray(list) ? list.filter((c) => HEX6_RE.test(c)).slice(0, 5) : [];
  }

  function rememberColor(hex) {
    if (!HEX6_RE.test(hex)) return;
    const settings = StorageManager.getSettings();
    const next = [hex.toLowerCase(), ...recentColors().filter((c) => c !== hex.toLowerCase())];
    settings.recentColors = next.slice(0, 5);
    StorageManager.saveSettings();
  }

  function paintSwatches(root) {
    root.querySelectorAll("input.st-color").forEach((input) => {
      if (input.previousElementSibling?.classList.contains("st-swatch")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "st-swatch";
      btn.dataset.for = input.id;
      btn.style.background = input.value;
      const label = input.closest(".st-row")?.querySelector(".st-label")?.textContent;
      btn.setAttribute("aria-label", label ? `${label.trim()}: choose colour` : "Choose colour");
      input.before(btn);
      input.hidden = true;
      input.tabIndex = -1;
      input.addEventListener("input", () => (btn.style.background = input.value));
    });
  }

  function paintPage(mods, page, token, savedScrollTop) {
    closeColorPopover();
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

    body.querySelectorAll("[data-page]").forEach((el) => {
      if (el.dataset.page !== page) el.remove();
    });

    paintSwatches(body);



    body.querySelectorAll(".st-container").forEach((el) => {
      if (!el.children.length) el.remove();
    });

    if (page === "home") {
      const topBar = body.querySelector('[data-accordion-key="top bar"]');
      const containers = body.querySelectorAll(".st-container");
      const last = containers[containers.length - 1];
      if (topBar && last && !last.contains(topBar)) last.append(topBar);
      const oldHolder = [...containers].find((c) => !c.children.length);
      oldHolder?.remove();
    }

    const lower = (list) =>
      new Set((list || []).map((v) => String(v).toLowerCase()));
    const collapsed = lower(settings.collapsedSettingsAccordions?.[page]);
    const expanded = lower(settings.expandedSettingsAccordions?.[page]);
    body.querySelectorAll(".st-accordion").forEach((acc) => {
      const header = acc.querySelector(":scope > .st-accordion-header");
      const key = accordionKey(header);

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

  function overallStrength(settings) {
    const legacy =
      typeof settings.boardOpacity === "number" ? settings.boardOpacity * 100 : 8;
    const raw =
      typeof settings.interfaceOpacity === "number"
        ? settings.interfaceOpacity
        : legacy;
    return Math.max(0, Math.min(100, raw));
  }

  function surfaceStrengths(settings) {
    const t = overallStrength(settings) / 100;

    const lift = (amount) => (t + amount * t * (1 - t) * 4) * 100;
    const auto = {
      boards: t * 100,
      topbar: lift(0.04),
      search: lift(0.04),
      notes: lift(0.06),
      widgets: lift(0.08),
      pins: lift(0.08),

      panels: 100,
    };

    const overrides = { ...(settings.surfaceOpacity || {}) };
    delete overrides.panels;
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

  const GRADIENT_ANGLE = 135;

  function harmoniseGradient(primary, secondary, bg) {
    const a = hexToHsl(primary);
    const b = hexToHsl(secondary);

    const MAX_HUE_TRAVEL = 110;
    const MAX_LIGHT_TRAVEL = 0.26;

    let dh = ((b.h - a.h + 540) % 360) - 180;
    dh = Math.max(-MAX_HUE_TRAVEL, Math.min(MAX_HUE_TRAVEL, dh));

    const dl = Math.max(
      -MAX_LIGHT_TRAVEL,
      Math.min(MAX_LIGHT_TRAVEL, b.l - a.l),
    );

    const sat = Math.max(0.25, Math.min(Math.max(a.s, b.s), (a.s + b.s) / 2 + 0.18));

    let tuned = hslToHex(a.h + dh, sat, a.l + dl);
    if (bg) tuned = accentTokens(tuned, bg).ui;

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

    return dl >= 0 ? { from: tuned, to: primary } : { from: primary, to: tuned };
  }

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

  function applyAccent2(el, primary, secondary, bg, gradient) {
    const raw = HEX6.test(secondary || "") ? secondary : primary;
    const value = bg ? accentTokens(raw, bg).ui : raw;
    el.setProperty("--accent-2", value);
    el.setProperty("--accent-2-contrast", contrastText(value));
    const rgb = hexToRgb(value);
    el.setProperty("--accent-2-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);

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

  const BLUR_MAX_PX = 12;

  const blurRadius = (percent) =>
    BLUR_MAX_PX * Math.pow(Math.max(0, Math.min(100, percent)) / 100, 1.8);

  function applyWallpaperBlur() {
    const settings = StorageManager.getSettings();
    const on = !!settings.wallpaperBlur;
    const px = on ? blurRadius(settings.wallpaperBlurAmount ?? 40) : 0;

    document.body.classList.toggle("wp-blur-on", on);
    const el = document.documentElement.style;
    el.setProperty("--wp-blur-amount", `${px.toFixed(1)}px`);

    const shortest = Math.min(window.innerWidth, window.innerHeight) || 1;
    el.setProperty(
      "--wp-blur-scale",
      String(1 + (px * 6) / shortest),
    );
    const pagePx = Math.max(px, 8);
    el.setProperty("--wp-page-blur", `${pagePx.toFixed(1)}px`);
    el.setProperty(
      "--wp-page-extra",
      `${Math.sqrt(Math.max(0, pagePx * pagePx - px * px)).toFixed(1)}px`,
    );
    el.setProperty("--wp-page-scale", String(1 + (pagePx * 6) / shortest));
    bakePageBlur(Math.sqrt(Math.max(0, pagePx * pagePx - px * px)));
  }

  let bakedKey = "";
  let bakedUrl = "";
  async function bakePageBlur(extra) {
    const photoBg = $("photo-bg");
    const src = /^url\("(.*)"\)$/.exec(photoBg?.style.backgroundImage || "")?.[1];
    const key = `${src}|${extra.toFixed(1)}|${innerWidth}x${innerHeight}`;
    if (key === bakedKey) return;
    bakedKey = key;
    document.body.classList.remove("wp-baked");
    if (!src) return;
    try {
      const img = new Image();
      img.src = src;
      await img.decode();
      if (key !== bakedKey) return;
      const w = 480;
      const h = Math.round((w * img.naturalHeight) / img.naturalWidth);
      const shown = img.naturalWidth * Math.max(innerWidth / img.naturalWidth, innerHeight / img.naturalHeight);
      const r = (extra * w) / shown;
      const m = r * 3;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.filter = `blur(${r}px)`;
      ctx.drawImage(img, -m, -m, w + m * 2, h + m * 2);
      const blob = await new Promise((res) => canvas.toBlob(res, "image/webp", 0.9));
      if (!blob || key !== bakedKey) return;
      if (bakedUrl) URL.revokeObjectURL(bakedUrl);
      bakedUrl = URL.createObjectURL(blob);
      document.documentElement.style.setProperty("--wp-page-img", `url("${bakedUrl}")`);
      document.body.classList.add("wp-baked");
    } catch {}
  }

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

  const HALO_FLOOR_LC = 78;

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

    document.body.classList.toggle("boards-opaque", strengths.boards >= 100);
    document.body.classList.toggle("boards-glass", strengths.boards < 70);
    el.setProperty("--search-opacity", px(strengths.search));
    el.setProperty("--notes-opacity", px(strengths.notes));
    el.setProperty("--topbar-opacity", px(strengths.topbar));
    el.setProperty("--widgets-opacity", px(strengths.widgets));
    el.setProperty("--pins-opacity", px(strengths.pins));
    document.body.classList.toggle("topbar-plate", strengths.topbar >= 1);
    document.body.classList.toggle("widgets-plate", strengths.widgets >= 1);
    document.body.classList.toggle("pins-plate", strengths.pins >= 1);

    el.setProperty("--panel-opacity", px(strengths.panels));

    document.body.classList.toggle(
      "ambient-on",
      settings.solidAmbient !== false,
    );

    document.documentElement.style.colorScheme = isLight ? "light" : "dark";

    if (solid) {
      const seed = settings.solidSeed || (isLight ? "#c7d2fe" : "#0d1117");
      const p = derivePalette(seed, activeMode);
      if (settings.solidExact && HEX6.test(seed)) p.bg = seed;

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

      const tileBg = isLight ? PIN_TILE_LIGHT : PIN_TILE_DARK;
      el.setProperty("--pin-tile-bg", tileBg);
      document.body.classList.toggle("icon-duotone", isLight);
      if (isLight)
        applyIconTint(accentTokens(accent, tileBg, presetSwatch(settings)).ink);
      el.setProperty("--accent-contrast", contrastText(ui));
      applyAccent2(el, ui, settings.accent2, p.bg, !!settings.accentGradient);
      el.setProperty("--accent-rgb", `${accRgb.r}, ${accRgb.g}, ${accRgb.b}`);

      const sRgb = hexToRgb(p.surface);
      el.setProperty("--board-rgb", `${sRgb.r}, ${sRgb.g}, ${sRgb.b}`);
      setNeutralGround(el, isLight);

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
        settings.accentOverride ||
        settings.wpExtractedAccent ||
        settings.accentColor ||
        "#6366f1";

      const { ui, ink, display } = accentTokens(
        accent,
        isLight ? "#ffffff" : "#090a0f",
        presetSwatch(settings),
      );
      const accRgb = hexToRgb(ui);
      el.setProperty("--accent-color", ui);
      el.setProperty("--accent-ink", ink);
      el.setProperty("--accent-display", display);

      document.body.classList.remove("icon-duotone");
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
            r: Math.round(a.r * 0.12 + 18 * 0.88),
            g: Math.round(a.g * 0.12 + 19 * 0.88),
            b: Math.round(a.b * 0.12 + 24 * 0.88),
          };
      el.setProperty("--board-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      setNeutralGround(el, isLight);

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

        el.setProperty("--panel-rgb", `${panel.r}, ${panel.g}, ${panel.b}`);
      } else {
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
    if (typeof repaintBoardInk === "function") repaintBoardInk();
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

  const WALLPAPER_PAINT_DEADLINE = 500;
  const DECODE_DEADLINE = 250;

  function waitForImagePaint(src) {
    if (!src) return Promise.resolve();
    if (document.hidden) return Promise.resolve();

    return new Promise((resolve) => {
      const img = new Image();
      let done = false;

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

  const PACKAGED_WALLPAPER = "wallpaper/default.webp";

  const packagedWallpaperUrl = () => {
    try {
      if (HAS_EXT && EXT.runtime && EXT.runtime.getURL)
        return EXT.runtime.getURL(PACKAGED_WALLPAPER);
    } catch {}

    return PACKAGED_WALLPAPER;
  };

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
      if (photoBg) photoBg.style.backgroundColor = "";
      if (videoBg) {
        videoBg.src = src;
        await waitForVideoPaint(videoBg);
        videoBg.classList.add("active");
        if (!document.hidden && !settings.performanceMode)
          videoBg.play().catch(() => {});
      }
      if (photoBg) photoBg.classList.remove("active");
    } else if (type === "image") {
      if (photoBg) {
        photoBg.style.backgroundColor = "";
        await waitForImagePaint(src);
        photoBg.style.backgroundImage = `url("${String(src).replace(/"/g, "%22")}")`;
        photoBg.classList.add("active");
        applyWallpaperBlur();
      }
      if (videoBg) {
        videoBg.pause();
        videoBg.removeAttribute("src");
        videoBg.classList.remove("active");
      }
    } else {
      if (HEX6.test(settings.solidSeed || "")) {
        settings.backgroundValue = settings.solidSeed;
      } else if (HEX6.test(value || "")) {
        settings.solidSeed = value;
      }
      if (photoBg) {
        photoBg.style.backgroundImage = "none";
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

  const INK_MIN_LC = 60;

  const PIN_TILE_LIGHT = "#ffffff";
  const PIN_TILE_DARK = "#25262c";

  const FILL_MIN_LC = 25;

  const DISPLAY_MIN_LC = 35;

  function accentTokens(accent, bg, swatch) {
    const shown = HEX6.test(swatch || "") ? swatch : accent;
    const ink = readableInk(shown, bg);

    const display = Contrast.readable(shown, bg, DISPLAY_MIN_LC);
    const ui = HEX6.test(accent || "") ? accent : Contrast.readable(shown, bg, FILL_MIN_LC + 5);
    return { ui, ink, display };
  }

  const presetSwatch = (s) => (presetById(s.preset) ? s.accent2 : "");

  const SVG_NS = "http://www.w3.org/2000/svg";

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

  function wcagRatio(a, b) {
    const lin = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = (hex) => {
      const { r, g, b: bl } = Contrast.toRgb(hex);
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl);
    };
    const x = lum(a);
    const y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  function readableInk(accent, bg) {
    let ink = Contrast.readable(accent, bg, INK_MIN_LC);
    for (let lc = INK_MIN_LC + 5; wcagRatio(ink, bg) < 4.5 && lc <= 105; lc += 5) {
      ink = Contrast.readable(accent, bg, lc);
    }
    return ink;
  }

  const contrastText = (color) =>
    wcagRatio("#ffffff", color) >= wcagRatio("#14151a", color) ? "#ffffff" : "#14151a";

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

        if (label.isConnected && label.querySelector("input"))
          label.textContent = `${clamped}${suffix}`;
      };

      input.addEventListener("keydown", (e) => {
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

  function createFrameScheduler() {
    const pending = new Map();
    return function paintNextFrame(key, fn) {
      if (pending.has(key)) return;
      const entry = {};
      const run = () => {
        if (pending.get(key) !== entry) return;
        pending.delete(key);
        cancelAnimationFrame(entry.raf);
        clearTimeout(entry.timer);
        fn();
      };
      pending.set(key, entry);
      entry.raf = requestAnimationFrame(run);
      entry.timer = setTimeout(run, 32);
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
