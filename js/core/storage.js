"use strict";

var $ = window.$ || ((id) => document.getElementById(id));
var $$ = window.$$ || ((sel) => document.querySelectorAll(sel));

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const ICONS = {
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
  trash:
    '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  copy: '<rect x="9" y="9" width="16" height="16" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  incognito:
    '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  search:
    '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5" fill="#fcd34d"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  weatherSun:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5" fill="#fcd34d"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  weatherCloud:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" fill="#e2e8f0"/></svg>',
  weatherRain:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 13v8M8 13v8M12 15v8M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" stroke="#94a3b8"/><path d="M18 7h-1.26A8 8 0 1 0 4 15.25" fill="#e2e8f0" stroke="none"/></svg>',
  weatherSnow:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#93c5fd" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" stroke="#94a3b8"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="16" y1="16" x2="16.01" y2="16"/><line x1="10" y1="21" x2="10.01" y2="21"/><line x1="14" y1="21" x2="14.01" y2="21"/><path d="M18 8h-1.26A8 8 0 1 0 4 16.25" fill="#e2e8f0" stroke="none"/></svg>',
  weatherStorm:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" fill="#cbd5e1"/><polygon points="13 11 9 17 15 17 11 23" fill="#fde047" stroke="#eab308"/></svg>',
  coffee:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" fill="#fcd34d"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
  sunset:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#f97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14a5 5 0 0 0-10 0" fill="#fdba74"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="4.93" y1="6.93" x2="6.34" y2="8.34"/><line x1="19.07" y1="6.93" x2="17.66" y2="8.34"/><line x1="2" y1="14" x2="22" y2="14" stroke="#ea580c" stroke-width="2.5"/><line x1="4" y1="18" x2="20" y2="18" stroke="#ea580c" stroke-width="2"/></svg>',
  sparkles:
    '<svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L10.088 8.813A2 2 0 0 1 8.813 10.088L3 12L8.813 13.912A2 2 0 0 1 10.088 15.187L12 21L13.912 15.187A2 2 0 0 1 15.187 13.912L21 12L15.187 10.088A2 2 0 0 1 13.912 8.813L12 3Z" fill="#ddd6fe"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill="#bfdbfe"/></svg>',
};
function icon(name, size = 16) {
  if (ICONS[name] && ICONS[name].startsWith("<svg")) {
    return ICONS[name].replace("<svg", `<svg width="${size}" height="${size}"`);
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
}

const StorageManager = (() => {
  function seedBoards() {
    return [
      {
        id: uuid(),
        name: "Quick Links",
        color: "#10b981",
        col: 0,
        order: 0,
        bookmarks: [
          {
            id: uuid(),
            title: "YouTube",
            url: "https://youtube.com",
            tags: ["video", "media"],
            pinnedToHome: true,
          },
          {
            id: uuid(),
            title: "Gmail",
            url: "https://mail.google.com",
            tags: ["mail"],
            pinnedToHome: true,
          },
        ],
      },
    ];
  }

  const DEFAULT_DATA = {
    boards: seedBoards(),
    notes: "",
    notesHistory: [],
    tabStashes: [],
    todos: [],
    tags: ["video", "media", "mail"],
    wallpapers: [],
    focus: {},
    pinsMigrated: true,
  };

  const DEFAULT_SETTINGS = {
    mode: "dark",
    autoColor: false,
    accentColor: "#212269",
    boardColor: "#ffffff",
    boardOpacity: 0.08,
    interfaceOpacity: 8,
    backgroundType: "solid",
    backgroundValue: "#0d1117",
    wallpaperZoom: 100,
    wallpaperFit: "cover",
    wallpaperPosX: 50,
    wallpaperPosY: 50,
    wallpaperMuted: true,
    wallpaperVolume: 0.5,
    dualAccent: true,

    enabledEngines: [
      "default",
      "duckduckgo",
      "youtube",
      "chatgpt",
      "claude",
      "gemini",
      "research",
      "perplexity",
    ],
    lastSettingsTab: "theme",
    collapsedSettingsAccordions: {
      theme: ["position and crop", "share your theme"],
      widgets: ["general appearance", "clock and text", "search", "weather"],
      data: ["privacy", "data management"],
    },
    settingsLayoutVersion: 5,
    settingsScrollPositions: {},
    lastSavedBoardId: "",
    boardWidth: 260,
    searchEngine: "default",
    weatherCity: "",
    weatherUnit: "c",
    widgets: {
      clock: true,
      navSearch: true,
      weather: false,
      todo: true,
      workspace: true,
    },
    activeTab: "home",
    displayName: "",
    preset: "",
    accent2: "",
    cursorUrl: "",
    cornerRadius: "default",
    fontFamily: "default",
    use12h: false,
    hidePinnedOnHome: false,
    clockPosition: "center",
    clockFont: "system",
    clockColor: "",
    solidAmbient: true,
    performanceMode: false,
    wpShadowOpacity: 60,
    wpShadowBlur: 20,
    wpShadowColor: "#000000",
    wallpaperOverlay: false,
    wallpaperOverlayOpacity: 35,
    remoteFavicons: false,
    onboardingSeen: false,
    aiAutoSend: false,
    workspaceFavorites: [
      "Search",
      "Gmail",
      "Drive",
      "YouTube",
      "Gemini",
      "AI Studio",
      "NotebookLM",
    ],
  };

  const WRITER_ID = uuid();

  let writeSeq = 0;
  const nextWriterStamp = () => WRITER_ID + ":" + ++writeSeq;
  const isOwnWriter = (v) =>
    typeof v === "string" && v.slice(0, WRITER_ID.length) === WRITER_ID;

  let data = null,
    settings = null,
    saveTimeout = null;
  const chromeAvailable = HAS_EXT;

  const MEDIA_PREFIX = "wpmedia:";
  const MEDIA_INDEX_KEY = "wpmediaIndex";
  const mediaCache = new Map();

  const isMediaRef = (v) => typeof v === "string" && v.startsWith("ref:");
  const refId = (v) => String(v).slice(4);

  function isExtValid() {
    try {
      return !!(chromeAvailable && EXT && EXT.runtime && EXT.runtime.id);
    } catch {
      return false;
    }
  }

  function handleStorageError(label, err) {
    const msg = String(err?.message || err || "");
    if (/MAX_WRITE_OPERATIONS|quota|invalidated/i.test(msg)) return;
    console.warn(label, err);
  }

  async function readMediaIndex() {
    try {
      if (isExtValid())
        return (
          (await EXT.storage.local.get(MEDIA_INDEX_KEY))[MEDIA_INDEX_KEY] || []
        );
      return JSON.parse(localStorage.getItem(MEDIA_INDEX_KEY) || "[]");
    } catch {
      return [];
    }
  }

  async function writeMediaIndex(ids) {
    try {
      if (isExtValid()) await EXT.storage.local.set({ [MEDIA_INDEX_KEY]: ids });
      else localStorage.setItem(MEDIA_INDEX_KEY, JSON.stringify(ids));
    } catch (e) {
      handleStorageError("media index:", e);
    }
  }

  async function putMedia(id, dataUrl) {
    mediaCache.set(id, dataUrl);
    const key = MEDIA_PREFIX + id;
    if (isExtValid()) await EXT.storage.local.set({ [key]: dataUrl });
    else localStorage.setItem(key, dataUrl);
    const idx = await readMediaIndex();
    if (!idx.includes(id)) await writeMediaIndex([...idx, id]);
    return "ref:" + id;
  }

  async function getMedia(id) {
    if (mediaCache.has(id)) return mediaCache.get(id);
    const key = MEDIA_PREFIX + id;
    let val = "";
    try {
      if (isExtValid()) val = (await EXT.storage.local.get(key))[key] || "";
      else val = localStorage.getItem(key) || "";
    } catch (e) {
      handleStorageError("media read:", e);
    }
    if (val) mediaCache.set(id, val);
    return val;
  }

  async function delMedia(id) {
    mediaCache.delete(id);
    const key = MEDIA_PREFIX + id;
    try {
      if (isExtValid()) await EXT.storage.local.remove(key);
      else localStorage.removeItem(key);
    } catch (e) {
      handleStorageError("media delete:", e);
    }
  }

  async function resolveMedia(value) {
    return isMediaRef(value) ? await getMedia(refId(value)) : value;
  }

  async function pruneMedia() {
    const live = new Set(
      (data.wallpapers || [])
        .filter((w) => isMediaRef(w.value))
        .map((w) => refId(w.value)),
    );
    if (isMediaRef(settings.backgroundValue))
      live.add(refId(settings.backgroundValue));
    try {
      const idx = await readMediaIndex();
      const keep = [];
      for (const id of idx) {
        if (live.has(id)) keep.push(id);
        else await delMedia(id);
      }
      if (keep.length !== idx.length) await writeMediaIndex(keep);
    } catch (e) {
      handleStorageError("media prune:", e);
    }
  }

  function trimForSync(s) {
    const c = { ...s };
    if (
      typeof c.backgroundValue === "string" &&
      c.backgroundValue.length > 4000
    ) {
      c.backgroundValue = "";
      if (c.backgroundType === "image" || c.backgroundType === "video")
        c.backgroundType = "solid";
    }

    if (typeof c.cursorUrl === "string" && c.cursorUrl.length > 2000)
      c.cursorUrl = "";
    return c;
  }

  function normalizeBookmark(bm) {
    if (!bm || typeof bm !== "object") return null;
    const url = typeof bm.url === "string" ? bm.url.trim() : "";
    if (!url) return null;
    return {
      id: bm.id || uuid(),
      title: String(bm.title || url)
        .trim()
        .slice(0, 300),
      url: url,
      tags: Array.isArray(bm.tags)
        ? bm.tags
            .map((t) =>
              String(t)
                .toLowerCase()
                .trim()
                .replace(/\s+/g, "-")
                .replace(/[^a-z0-9\-_]/g, "")
                .slice(0, 30),
            )
            .filter(Boolean)
        : [],
      pinnedToHome: !!bm.pinnedToHome,
      order: typeof bm.order === "number" ? bm.order : 0,
    };
  }

  function normalizeBoard(b) {
    if (!b || typeof b !== "object") b = {};
    const rawBms = Array.isArray(b.bookmarks) ? b.bookmarks : [];
    const normBms = rawBms.map(normalizeBookmark).filter(Boolean);
    const out = {
      id: b.id || uuid(),
      name: String(b.name || "Bookmarks").trim(),
      color: b.color || null,
      col: b.col ?? null,
      order: typeof b.order === "number" ? b.order : 0,
      bookmarks: normBms,
    };
    if (b.pinnedToHome) out.pinnedToHome = true;
    return out;
  }

  const MAX_MIGRATED_PINS = 5;

  function capPinnedBookmarks(d) {
    if (!d || !Array.isArray(d.boards)) return d;
    let count = 0;
    d.boards.forEach((b) => {
      (b.bookmarks || []).forEach((bm) => {
        if (bm && bm.pinnedToHome) {
          if (count >= MAX_MIGRATED_PINS) {
            delete bm.pinnedToHome;
          } else {
            count++;
          }
        }
      });
    });
    return d;
  }

  function migratePins(d) {
    if (d.pinsMigrated) return d;
    d.pinsMigrated = true;
    let budget = MAX_MIGRATED_PINS;
    (d.boards || []).forEach((b) => {
      if (b.pinnedToHome) {
        (b.bookmarks || []).forEach((bm) => {
          if (budget > 0 && bm && !bm.pinnedToHome) {
            bm.pinnedToHome = true;
            budget--;
          }
        });
      }
      delete b.pinnedToHome;
    });
    return capPinnedBookmarks(d);
  }

  function migrate(oldData) {
    if (Array.isArray(oldData.boards) && !Array.isArray(oldData.pages)) {
      return capPinnedBookmarks(
        migratePins({
          ...oldData,
          boards: oldData.boards.map(normalizeBoard),
          notes: typeof oldData.notes === "string" ? oldData.notes : "",
          todos: Array.isArray(oldData.todos) ? oldData.todos : [],
          tags: oldData.tags || [],
          wallpapers: oldData.wallpapers || [],
          focus: oldData.focus || {},
        }),
      );
    }

    const boards = [];
    const notesParts = [];
    const todos = [];

    (oldData.pages || []).forEach((p) => {
      (p.boards || []).forEach((b) => {
        const type = b.type || "links";
        if (type === "notes") {
          if (typeof b.notes === "string" && b.notes.trim())
            notesParts.push(b.notes.trim());
        } else if (type === "todo") {
          (Array.isArray(b.todos) ? b.todos : []).forEach((t) => todos.push(t));
        } else {
          boards.push(normalizeBoard(b));
        }
      });
    });

    if (typeof oldData.notes === "string" && oldData.notes.trim())
      notesParts.unshift(oldData.notes.trim());
    if (Array.isArray(oldData.todos))
      oldData.todos.forEach((t) => todos.push(t));

    const { pages, ...rest } = oldData;
    return capPinnedBookmarks(
      migratePins({
        ...rest,
        boards,
        notes: notesParts.join("\n\n---\n\n"),
        todos,
        tags: oldData.tags || [],
        wallpapers: oldData.wallpapers || [],
        focus: oldData.focus || {},
      }),
    );
  }

  function refill(target, source) {
    if (!target || typeof target !== "object") return source;
    Object.keys(target).forEach((k) => delete target[k]);
    return Object.assign(target, source);
  }

  function deepClone(obj) {
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(obj);
      } catch {}
    }
    return JSON.parse(JSON.stringify(obj));
  }

  async function load() {
    try {
      let rawSettings, rawData;
      if (isExtValid()) {
        const localBag = await EXT.storage.local.get(["data", "settings"]);
        rawData = localBag.data;
        rawSettings = localBag.settings;
        if (!rawSettings) {
          try {
            rawSettings = (await EXT.storage.sync.get("settings")).settings;
          } catch {}
        }
      } else {
        rawSettings = JSON.parse(
          localStorage.getItem("markmez_settings") || "null",
        );
        rawData = JSON.parse(localStorage.getItem("markmez_data") || "null");
      }
      const loadedSettings = rawSettings || {};

      const migratedInterfaceOpacity =
        typeof loadedSettings.interfaceOpacity === "number"
          ? loadedSettings.interfaceOpacity
          : typeof loadedSettings.boardOpacity === "number"
            ? loadedSettings.boardOpacity * 100
            : DEFAULT_SETTINGS.interfaceOpacity;
      const collapsedSettingsAccordions = deepClone(
        loadedSettings.collapsedSettingsAccordions ||
          DEFAULT_SETTINGS.collapsedSettingsAccordions,
      );
      if ((loadedSettings.settingsLayoutVersion || 0) < 2) {
        const themeCollapsed = new Set(collapsedSettingsAccordions.theme || []);
        if (themeCollapsed.delete("preset")) themeCollapsed.add("themes");
        themeCollapsed.add("position and crop");
        collapsedSettingsAccordions.theme = [...themeCollapsed];
        collapsedSettingsAccordions.widgets = [
          ...new Set([
            ...(collapsedSettingsAccordions.widgets || []),
            "fine-tune home",
          ]),
        ];
      }
      if ((loadedSettings.settingsLayoutVersion || 0) < 3) {
        const widgetCollapsed = new Set(
          collapsedSettingsAccordions.widgets || [],
        );
        if (widgetCollapsed.delete("fine-tune home"))
          widgetCollapsed.add("clock and readability");
        const dataCollapsed = new Set(collapsedSettingsAccordions.data || []);
        widgetCollapsed.delete("ai search privacy");
        dataCollapsed.delete("ai search privacy");
        collapsedSettingsAccordions.widgets = [...widgetCollapsed];
        collapsedSettingsAccordions.data = [...dataCollapsed];
      }
      if ((loadedSettings.settingsLayoutVersion || 0) < 4) {
        const widgetCollapsed = new Set(
          collapsedSettingsAccordions.widgets || [],
        );
        if (widgetCollapsed.delete("identity"))
          widgetCollapsed.add("appearance and identity");
        collapsedSettingsAccordions.widgets = [...widgetCollapsed];
      }
      if ((loadedSettings.settingsLayoutVersion || 0) < 5) {
        const widgetCollapsed = new Set(
          collapsedSettingsAccordions.widgets || [],
        );
        if (widgetCollapsed.delete("appearance and identity"))
          widgetCollapsed.add("general appearance");
        if (widgetCollapsed.delete("clock and readability"))
          widgetCollapsed.add("clock and text");
        const dataCollapsed = new Set(collapsedSettingsAccordions.data || []);
        const formerDataGroups = [
          "import",
          "cleanup",
          "backup",
          "reset and data",
        ];
        if (formerDataGroups.every((key) => dataCollapsed.has(key)))
          dataCollapsed.add("data management");
        formerDataGroups.forEach((key) => dataCollapsed.delete(key));
        collapsedSettingsAccordions.widgets = [...widgetCollapsed];
        collapsedSettingsAccordions.data = [...dataCollapsed];
      }
      settings = refill(settings, {
        ...DEFAULT_SETTINGS,
        ...loadedSettings,
        interfaceOpacity: Math.max(0, Math.min(100, migratedInterfaceOpacity)),
        settingsLayoutVersion: 5,
        collapsedSettingsAccordions,
        widgets: {
          ...DEFAULT_SETTINGS.widgets,
          ...(loadedSettings.widgets || {}),
        },
      });
      if (rawSettings && rawSettings.theme && !rawSettings.mode) {
        settings.mode = rawSettings.theme === "light" ? "light" : "dark";
      }
      data = refill(data, rawData ? migrate(rawData) : deepClone(DEFAULT_DATA));
    } catch (e) {
      console.warn("Storage load failed, using defaults:", e);
      settings = refill(settings, deepClone(DEFAULT_SETTINGS));
      data = refill(data, deepClone(DEFAULT_DATA));
    }
    if (!["home", "boards", "notes"].includes(settings.activeTab))
      settings.activeTab = "home";
    [
      "accentColor",
      "accent2",
      "boardColor",
      "solidSeed",
      "accentOverride",
    ].forEach((k) => {
      if (
        typeof settings[k] === "string" &&
        /^#[0-9a-f]{8}$/i.test(settings[k])
      ) {
        settings[k] = settings[k].slice(0, 7);
      }
    });
    mirrorBootState();
    return { data, settings };
  }

  let bootBg = null;

  let bootPreview;

  function mirrorBootState() {
    try {
      const isLight =
        settings.mode === "light" ||
        (settings.mode === "system" &&
          !window.matchMedia("(prefers-color-scheme: dark)").matches);
      const bg =
        typeof bootBg === "string" && /^#[0-9a-f]{3,6}$/i.test(bootBg)
          ? bootBg
          : isLight
            ? "#f4f6f8"
            : "#0d1117";
      let preview = bootPreview;
      if (preview === undefined) {
        try {
          preview = JSON.parse(
            localStorage.getItem("et_boot") || "null",
          )?.preview;
        } catch {}
      }
      const boot = { mode: isLight ? "light" : "dark", pageBg: bg };
      if (typeof preview === "string") boot.preview = preview;
      localStorage.setItem("et_boot", JSON.stringify(boot));
    } catch (e) {}
  }

  function setBootBg(color) {
    if (
      typeof color === "string" &&
      /^#[0-9a-f]{3,6}$/i.test(color) &&
      color !== bootBg
    ) {
      bootBg = color;
      mirrorBootState();
    }
  }

  function setBootPreview(dataUrl) {
    bootPreview = typeof dataUrl === "string" ? dataUrl : null;
    mirrorBootState();
  }

  const SYNC_MIN_INTERVAL = 30000;
  let syncTimer = null;
  let lastSyncedSettingsStr = "";

  function writeSyncNow() {
    syncTimer = null;
    if (!isExtValid() || !EXT.storage || !EXT.storage.sync) return;
    try {
      const trimmed = trimForSync(settings);
      const str = JSON.stringify(trimmed);
      if (str === lastSyncedSettingsStr) return;
      lastSyncedSettingsStr = str;

      EXT.storage.sync
        .set({ settings: trimmed })
        .catch((e) => handleStorageError("sync save:", e));
    } catch (e) {
      handleStorageError("sync save:", e);
    }
  }

  function queueSync() {
    if (!isExtValid() || !EXT.storage || !EXT.storage.sync) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(writeSyncNow, SYNC_MIN_INTERVAL);
  }

  function persist() {
    mirrorBootState();
    if (isExtValid()) {
      try {
        EXT.storage.local
          .set({ data, settings, writer: nextWriterStamp() })
          .catch((e) => handleStorageError("local save:", e));
        queueSync();
      } catch (e) {
        handleStorageError("local save:", e);
      }
    } else {
      localStorage.setItem("markmez_settings", JSON.stringify(settings));
      localStorage.setItem("markmez_data", JSON.stringify(data));
    }
  }

  function persistSettings() {
    mirrorBootState();
    if (isExtValid()) {
      try {
        EXT.storage.local
          .set({ settings, writer: nextWriterStamp() })
          .catch((e) => handleStorageError("local save:", e));
        queueSync();
      } catch (e) {
        handleStorageError("local save:", e);
      }
    } else {
      localStorage.setItem("markmez_settings", JSON.stringify(settings));
    }
  }

  let pendingPersist = null;

  function schedule() {
    pendingPersist = persist;
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      pendingPersist = null;
      persist();
    }, 120);
  }
  function save() {
    schedule();
  }
  function saveSettings() {
    schedule();
  }
  function saveImmediate() {
    clearTimeout(saveTimeout);
    pendingPersist = null;
    persist();
  }

  function flush() {
    if (pendingPersist) {
      const fn = pendingPersist;
      pendingPersist = null;
      clearTimeout(saveTimeout);
      fn();
    }
  }

  function getData() {
    return data;
  }
  function getSettings() {
    return settings;
  }

  async function exportJSON() {
    flush();
    const dataSnapshot = deepClone(data);
    const settingsSnapshot = deepClone(settings);

    const requiredIds = new Set();
    for (const wp of dataSnapshot.wallpapers || []) {
      if (isMediaRef(wp?.value)) requiredIds.add(refId(wp.value));
    }
    if (isMediaRef(settingsSnapshot.backgroundValue)) {
      requiredIds.add(refId(settingsSnapshot.backgroundValue));
    }

    const media = {};
    const missing = [];
    for (const id of requiredIds) {
      const value = await getMedia(id);
      if (value) media[id] = value;
      else missing.push(id);
    }
    if (missing.length) {
      throw new Error(
        `Wallpaper media is incomplete (${missing.length} missing item${missing.length === 1 ? "" : "s"}). Run Repair Wallpaper Cache and export again.`,
      );
    }
    const backup = {
      format: "eshaaltab-backup",
      version: 2,
      data: dataSnapshot,
      settings: settingsSnapshot,
      media,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `eshaaltab-backup-${new Date().toLocaleDateString("sv")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const SAFE_MEDIA = (v) =>
    typeof v === "string" &&
    (HEX.test(v) ||
      /^https?:\/\//i.test(v) ||
      v.startsWith("ref:") ||
      v.startsWith("data:image/") ||
      v.startsWith("data:video/"));

  function sanitizeSettings(raw) {
    const out = deepClone(DEFAULT_SETTINGS);
    if (!raw || typeof raw !== "object") return out;
    const str = (v, max = 200) =>
      typeof v === "string" ? v.slice(0, max) : undefined;
    const num = (v, lo, hi) => {
      const n =
        typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
      return typeof n === "number" && isFinite(n)
        ? Math.min(hi, Math.max(lo, n))
        : undefined;
    };
    const pick = (k, v) => {
      if (v !== undefined) out[k] = v;
    };

    pick(
      "mode",
      ["light", "dark", "system"].includes(raw.mode) ? raw.mode : undefined,
    );
    pick(
      "accentColor",
      HEX.test(raw.accentColor || "") ? raw.accentColor : undefined,
    );
    pick(
      "accent2",
      HEX.test(raw.accent2 || "")
        ? raw.accent2
        : raw.accent2 === ""
          ? ""
          : undefined,
    );
    pick(
      "boardColor",
      HEX.test(raw.boardColor || "") ? raw.boardColor : undefined,
    );
    pick(
      "solidSeed",
      HEX.test(raw.solidSeed || "") ? raw.solidSeed : undefined,
    );
    pick("boardOpacity", num(raw.boardOpacity, 0, 1));
    pick("interfaceOpacity", num(raw.interfaceOpacity, 0, 100));
    if (raw.interfaceOpacity === undefined && raw.boardOpacity !== undefined) {
      const legacyInterfaceOpacity = num(raw.boardOpacity, 0, 1);
      if (legacyInterfaceOpacity !== undefined)
        out.interfaceOpacity = legacyInterfaceOpacity * 100;
    }
    pick("boardWidth", num(raw.boardWidth, 200, 560));
    pick(
      "backgroundType",
      ["solid", "image", "video"].includes(raw.backgroundType)
        ? raw.backgroundType
        : undefined,
    );
    pick(
      "backgroundValue",
      SAFE_MEDIA(raw.backgroundValue) ? raw.backgroundValue : undefined,
    );
    pick(
      "cornerRadius",
      ["default", "0px", "8px", "16px", "circle", "9999px"].includes(
        raw.cornerRadius,
      )
        ? raw.cornerRadius
        : undefined,
    );
    pick(
      "fontFamily",
      [
        "system",
        "default",
        "sans-serif",
        "geometric",
        "serif",
        "monospace",
        "rounded",
        "slab",
        "handwriting",
      ].includes(raw.fontFamily)
        ? raw.fontFamily
        : undefined,
    );
    pick("searchEngine", str(raw.searchEngine, 30));
    pick("weatherCity", str(raw.weatherCity, 80));
    pick("weatherUnit", raw.weatherUnit === "f" ? "f" : "c");
    pick("displayName", str(raw.displayName, 24));
    pick("preset", str(raw.preset, 40));
    pick("wallpaperZoom", num(raw.wallpaperZoom, 10, 500));
    pick(
      "wallpaperFit",
      ["cover", "contain"].includes(raw.wallpaperFit)
        ? raw.wallpaperFit
        : undefined,
    );
    pick("wallpaperPosX", num(raw.wallpaperPosX, -300, 300));
    pick("wallpaperPosY", num(raw.wallpaperPosY, -300, 300));
    pick(
      "wallpaperMuted",
      typeof raw.wallpaperMuted === "boolean" ? raw.wallpaperMuted : undefined,
    );
    pick("wallpaperVolume", num(raw.wallpaperVolume, 0, 1));
    pick(
      "dualAccent",
      typeof raw.dualAccent === "boolean" ? raw.dualAccent : undefined,
    );
    pick(
      "lastSettingsTab",
      ["theme", "widgets", "data", "help"].includes(raw.lastSettingsTab)
        ? raw.lastSettingsTab
        : undefined,
    );
    pick("settingsLayoutVersion", num(raw.settingsLayoutVersion, 0, 20));
    if (
      raw.collapsedSettingsAccordions &&
      typeof raw.collapsedSettingsAccordions === "object" &&
      !Array.isArray(raw.collapsedSettingsAccordions)
    ) {
      out.collapsedSettingsAccordions = {};
      for (const tab of ["theme", "widgets", "data", "help"]) {
        if (Array.isArray(raw.collapsedSettingsAccordions[tab])) {
          out.collapsedSettingsAccordions[tab] =
            raw.collapsedSettingsAccordions[tab]
              .filter((v) => typeof v === "string")
              .map((v) => v.slice(0, 100))
              .slice(0, 30);
        }
      }
    }
    if ((num(raw.settingsLayoutVersion, 0, 20) || 0) < 2) {
      const themeCollapsed = new Set(
        out.collapsedSettingsAccordions.theme || [],
      );
      if (themeCollapsed.delete("preset")) themeCollapsed.add("themes");
      themeCollapsed.add("position and crop");
      out.collapsedSettingsAccordions.theme = [...themeCollapsed];
      out.collapsedSettingsAccordions.widgets = [
        ...new Set([
          ...(out.collapsedSettingsAccordions.widgets || []),
          "fine-tune home",
        ]),
      ];
      out.settingsLayoutVersion = 2;
    }
    if ((num(raw.settingsLayoutVersion, 0, 20) || 0) < 3) {
      const widgetCollapsed = new Set(
        out.collapsedSettingsAccordions.widgets || [],
      );
      if (widgetCollapsed.delete("fine-tune home"))
        widgetCollapsed.add("clock and readability");
      const dataCollapsed = new Set(out.collapsedSettingsAccordions.data || []);
      widgetCollapsed.delete("ai search privacy");
      dataCollapsed.delete("ai search privacy");
      out.collapsedSettingsAccordions.widgets = [...widgetCollapsed];
      out.collapsedSettingsAccordions.data = [...dataCollapsed];
      out.settingsLayoutVersion = 3;
    }
    if ((num(raw.settingsLayoutVersion, 0, 20) || 0) < 4) {
      const widgetCollapsed = new Set(
        out.collapsedSettingsAccordions.widgets || [],
      );
      if (widgetCollapsed.delete("identity"))
        widgetCollapsed.add("appearance and identity");
      out.collapsedSettingsAccordions.widgets = [...widgetCollapsed];
      out.settingsLayoutVersion = 4;
    }
    if ((num(raw.settingsLayoutVersion, 0, 20) || 0) < 5) {
      const widgetCollapsed = new Set(
        out.collapsedSettingsAccordions.widgets || [],
      );
      if (widgetCollapsed.delete("appearance and identity"))
        widgetCollapsed.add("general appearance");
      if (widgetCollapsed.delete("clock and readability"))
        widgetCollapsed.add("clock and text");
      const dataCollapsed = new Set(out.collapsedSettingsAccordions.data || []);
      const formerDataGroups = [
        "import",
        "cleanup",
        "backup",
        "reset and data",
      ];
      if (formerDataGroups.every((key) => dataCollapsed.has(key)))
        dataCollapsed.add("data management");
      formerDataGroups.forEach((key) => dataCollapsed.delete(key));
      out.collapsedSettingsAccordions.widgets = [...widgetCollapsed];
      out.collapsedSettingsAccordions.data = [...dataCollapsed];
      out.settingsLayoutVersion = 5;
    }
    if (
      raw.settingsScrollPositions &&
      typeof raw.settingsScrollPositions === "object" &&
      !Array.isArray(raw.settingsScrollPositions)
    ) {
      out.settingsScrollPositions = {};
      for (const tab of ["theme", "widgets", "data", "help"]) {
        const pos = num(raw.settingsScrollPositions[tab], 0, 100000);
        if (pos !== undefined) out.settingsScrollPositions[tab] = pos;
      }
    }
    if (Array.isArray(raw.enabledEngines)) {
      const filtered = raw.enabledEngines.filter(
        (e) => typeof e === "string" && e.trim(),
      );
      out.enabledEngines =
        filtered.length > 0 ? filtered : [...DEFAULT_SETTINGS.enabledEngines];
    }
    if (Array.isArray(raw.workspaceFavorites)) {
      out.workspaceFavorites = raw.workspaceFavorites.filter(
        (e) => typeof e === "string",
      );
    }
    pick(
      "activeTab",
      ["home", "boards", "notes"].includes(raw.activeTab)
        ? raw.activeTab
        : undefined,
    );
    pick("use12h", typeof raw.use12h === "boolean" ? raw.use12h : undefined);
    pick("remoteFavicons", !!raw.remoteFavicons);
    pick(
      "onboardingSeen",
      typeof raw.onboardingSeen === "boolean" ? raw.onboardingSeen : undefined,
    );
    pick(
      "aiAutoSend",
      typeof raw.aiAutoSend === "boolean" ? raw.aiAutoSend : undefined,
    );

    pick(
      "autoColor",
      typeof raw.autoColor === "boolean" ? raw.autoColor : undefined,
    );
    pick(
      "hidePinnedOnHome",
      typeof raw.hidePinnedOnHome === "boolean"
        ? raw.hidePinnedOnHome
        : undefined,
    );

    pick(
      "clockPosition",
      raw.clockPosition === "auto"
        ? "center"
        : ["center", "corner"].includes(raw.clockPosition)
          ? raw.clockPosition
          : undefined,
    );
    pick(
      "clockFont",
      [
        "system",
        "default",
        "thin",
        "light",
        "app",
        "serif",
        "mono",
        "handwriting",
      ].includes(raw.clockFont)
        ? raw.clockFont
        : undefined,
    );
    pick(
      "clockColor",
      /^#[0-9a-f]{6}$/i.test(raw.clockColor || "") || raw.clockColor === ""
        ? raw.clockColor
        : undefined,
    );
    pick("topbarOpacity", num(raw.topbarOpacity, 0, 100));
    pick("widgetBgOpacity", num(raw.widgetBgOpacity, 0, 100));
    pick("notesOpacity", num(raw.notesOpacity, 0, 100));
    pick(
      "solidAmbient",
      typeof raw.solidAmbient === "boolean" ? raw.solidAmbient : undefined,
    );
    pick(
      "performanceMode",
      typeof raw.performanceMode === "boolean"
        ? raw.performanceMode
        : undefined,
    );
    pick("wpShadowOpacity", num(raw.wpShadowOpacity, 0, 100));
    pick("wpShadowBlur", num(raw.wpShadowBlur, 0, 40));
    pick(
      "wpShadowColor",
      HEX.test(raw.wpShadowColor || "") ? raw.wpShadowColor : undefined,
    );
    pick(
      "wallpaperOverlay",
      typeof raw.wallpaperOverlay === "boolean"
        ? raw.wallpaperOverlay
        : undefined,
    );
    pick("wallpaperOverlayOpacity", num(raw.wallpaperOverlayOpacity, 0, 90));
    pick(
      "wpExtractedAccent",
      HEX.test(raw.wpExtractedAccent || "") ? raw.wpExtractedAccent : undefined,
    );
    pick("lastSavedBoardId", str(raw.lastSavedBoardId, 120));

    pick(
      "modeLocked",
      typeof raw.modeLocked === "boolean" ? raw.modeLocked : undefined,
    );
    pick(
      "accentOverride",
      HEX.test(raw.accentOverride || "") ? raw.accentOverride : undefined,
    );
    pick(
      "cursorUrl",
      typeof raw.cursorUrl === "string" &&
        raw.cursorUrl.startsWith("data:image/")
        ? raw.cursorUrl
        : "",
    );
    if (raw.widgets && typeof raw.widgets === "object") {
      out.widgets = { ...DEFAULT_SETTINGS.widgets };
      Object.keys(DEFAULT_SETTINGS.widgets).forEach((k) => {
        if (typeof raw.widgets[k] === "boolean")
          out.widgets[k] = raw.widgets[k];
      });
    }
    return out;
  }

  function importJSON(file, onDone) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (
          !imported ||
          typeof imported !== "object" ||
          (!imported.data && !imported.settings)
        ) {
          onDone && onDone(false);
          return;
        }
        const restoredData = imported.data
          ? capPinnedBookmarks(migrate(imported.data))
          : data;
        const restoredSettings = imported.settings
          ? sanitizeSettings(imported.settings)
          : settings;

        if (
          imported.media &&
          typeof imported.media === "object" &&
          !Array.isArray(imported.media)
        ) {
          for (const [id, value] of Object.entries(imported.media)) {
            if (!/^[a-z0-9_-]{1,128}$/i.test(id)) continue;
            if (
              typeof value !== "string" ||
              !/^data:(image|video)\//i.test(value)
            )
              continue;
            await putMedia(id, value);
          }
        }
        if (imported.data) data = refill(data, restoredData);
        if (imported.settings) settings = refill(settings, restoredSettings);
        saveImmediate();
        await pruneMedia();
        await repairMedia();
        onDone && onDone(true);
      } catch (err) {
        handleStorageError("backup restore:", err);
        onDone && onDone(false);
      }
    };
    reader.onerror = () => onDone && onDone(false);
    reader.readAsText(file);
  }

  function resetAll() {
    data = refill(data, deepClone(DEFAULT_DATA));
    settings = refill(settings, deepClone(DEFAULT_SETTINGS));
    settings.activeTab = "home";
    saveImmediate();
    pruneMedia();
  }

  async function repairMedia() {
    const before = Array.isArray(data.wallpapers) ? data.wallpapers.length : 0;
    const repaired = [];
    for (const wp of data.wallpapers || []) {
      if (!isMediaRef(wp.value) || (await getMedia(refId(wp.value))))
        repaired.push(wp);
    }
    data.wallpapers = repaired;

    let backgroundReset = false;
    if (
      isMediaRef(settings.backgroundValue) &&
      !(await getMedia(refId(settings.backgroundValue)))
    ) {
      settings.backgroundType = "solid";
      settings.backgroundValue =
        settings.solidSeed ||
        (settings.mode === "light" ? "#f4f6f8" : "#0d1117");
      backgroundReset = true;
    }
    saveImmediate();
    await pruneMedia();
    return { removed: before - repaired.length, backgroundReset };
  }

  return {
    load,
    save,
    saveSettings,
    saveImmediate,
    flush,
    getData,
    getSettings,
    exportJSON,
    importJSON,
    resetAll,
    putMedia,
    getMedia,
    delMedia,
    resolveMedia,
    pruneMedia,
    repairMedia,
    isMediaRef,
    refId,
    sanitizeSettings,
    setBootBg,
    setBootPreview,
    getWriterId: () => WRITER_ID,
    isOwnWriter,
    DEFAULT_SETTINGS,
    DEFAULT_DATA,
  };
})();
