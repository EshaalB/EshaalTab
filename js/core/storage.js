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

  pinFilled:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M14.3 2.3a1 1 0 0 1 1.4 0l6 6a1 1 0 0 1-.7 1.7 4 4 0 0 0-2.9 1.2l-2.6 2.6a5.5 5.5 0 0 1-.9 4.6 1 1 0 0 1-1.5.1l-3.4-3.4-4.4 4.4a1 1 0 0 1-1.4-1.4l4.4-4.4-3.4-3.4a1 1 0 0 1 .1-1.5 5.5 5.5 0 0 1 4.6-.9l2.6-2.6a4 4 0 0 0 1.2-2.9 1 1 0 0 1 .3-.7z"/></svg>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',

  more: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  search:
    '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5" fill="#fcd34d"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  weatherSun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.4v2M12 19.6v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.4 12h2M19.6 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  weatherCloud: '<path d="M17.6 18.5H7.4a4.4 4.4 0 0 1-.5-8.77 6 6 0 0 1 11.4 1.42 3.7 3.7 0 0 1-.7 7.35Z"/>',
  weatherRain: '<path d="M17.4 15.5H7.6a4.2 4.2 0 0 1-.5-8.38 5.8 5.8 0 0 1 11 1.36 3.55 3.55 0 0 1-.7 7.02Z"/><path d="M9 18.4 8.2 21M12.4 18.4l-.8 2.6M15.8 18.4l-.8 2.6"/>',
  weatherSnow: '<path d="M17.4 15.5H7.6a4.2 4.2 0 0 1-.5-8.38 5.8 5.8 0 0 1 11 1.36 3.55 3.55 0 0 1-.7 7.02Z"/><path d="M8.6 19h.01M12 20.4h.01M15.4 19h.01"/>',
  weatherStorm: '<path d="M17.4 14.5H7.6a4.2 4.2 0 0 1-.5-8.38 5.8 5.8 0 0 1 11 1.36 3.55 3.55 0 0 1-.7 7.02Z"/><path d="m12.8 16.6-2.4 3.4h3l-2 3"/>',
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
    const tools = [
      ["ChatGPT", "https://chatgpt.com"],
      ["Claude", "https://claude.ai"],
      ["Gemini", "https://gemini.google.com"],
      ["Perplexity", "https://www.perplexity.ai"],
      ["Grok", "https://grok.com"],
      ["DeepSeek", "https://chat.deepseek.com"],
      ["Copilot", "https://copilot.microsoft.com"],
      ["Meta AI", "https://www.meta.ai"],
      ["Le Chat", "https://chat.mistral.ai"],
      ["NotebookLM", "https://notebooklm.google.com"],
      ["AI Studio", "https://aistudio.google.com"],
      ["HuggingChat", "https://huggingface.co/chat"],
    ];
    const social = [
      ["YouTube", "https://www.youtube.com"],
      ["Instagram", "https://www.instagram.com"],
      ["X", "https://x.com"],
      ["Facebook", "https://www.facebook.com"],
      ["Reddit", "https://www.reddit.com"],
      ["TikTok", "https://www.tiktok.com"],
      ["LinkedIn", "https://www.linkedin.com"],
      ["Threads", "https://www.threads.net"],
      ["Pinterest", "https://www.pinterest.com"],
      ["Discord", "https://discord.com/app"],
      ["WhatsApp", "https://web.whatsapp.com"],
      ["Telegram", "https://web.telegram.org"],
    ];
    return [
      {
        id: uuid(),
        name: "AI Tools",
        color: "#a855f7",
        col: 0,
        order: 0,

        pinnedToHome: true,
        bookmarks: tools.map(([title, url], i) => ({
          id: uuid(),
          title,
          url,
          tags: ["ai"],
          ...(i < 5 ? { pinnedToHome: true } : {}),
        })),
      },
      {
        id: uuid(),
        name: "Social Media",
        color: "#ec4899",
        col: 1,
        order: 0,
        pinnedToHome: false,
        bookmarks: social.map(([title, url]) => ({
          id: uuid(),
          title,
          url,
          tags: ["social"],
        })),
      },
    ];
  }
  const RETIRED_PRESET_IDS = ["neon", "synthwave", "matrix", "amber"];

  const MAX_SESSIONS = 30;
  const MAX_WORKSPACES = 30;
  const MAX_READ_LATER = 200;
  const MAX_SESSION_TABS = 200;

  const MAX_NOTE_TABS = 5;
  const MAX_NOTE_CHARS = 100000;

  const DEFAULT_DATA = {
    boards: seedBoards(),
    notes: "",
    noteTabs: [],
    activeNoteId: "",
    notesHistory: [],

    sessions: [],
    workspaces: [],
    tabStashes: [],

    readLater: [],
    todos: [],
    tags: ["ai", "social"],
    wallpapers: [],
    focus: {},

    pinsMigrated: true,
  };

  const SURFACE_KEYS = ["boards", "topbar", "search", "notes", "widgets", "pins"];

  const SETTINGS_PAGES = [
    "appearance",
    "themes",
    "presets",
    "wallpaper",
    "home",
    "backup",
    "maintenance",
    "privacy",
    "reset",
    "help",
    "support",
  ];

  const DEFAULT_SETTINGS = {
    mode: "dark",
    autoColor: false,
    accentColor: "#5888ec",
    boardColor: "#ffffff",
    boardOpacity: 0.08,
    interfaceOpacity: 90,
    surfaceOpacity: {},
    notesFontSize: 15,
    backgroundType: "solid",
    backgroundValue: "#0d1117",
    solidSeed: "#5888ec",
    wallpaperZoom: 100,
    wallpaperFit: "cover",
    wallpaperPosX: 50,
    wallpaperPosY: 50,
    wallpaperMuted: true,
    wallpaperVolume: 0.5,

    enabledEngines: [
      "default",
      "google",
      "duckduckgo",
      "yandex",
      "yahoo",
      "chatgpt",
      "claude",
      "gemini",
      "perplexity",
      "research",
      "youtube",
      "reddit",
      "pinterest",
      "quora",
    ],
    lastSettingsPage: "appearance",
    collapsedSettingsAccordions: {
      theme: [
        "themes",
        "theme and colours",
        "position and crop",
        "share your theme",
      ],
      widgets: [
        "general appearance",
        "clock and text",
        "search",
        "weather",
      ],
      data: ["privacy", "data management"],
    },

    expandedSettingsAccordions: {},
    settingsLayoutVersion: 13,
    settingsScrollPositions: {},
    lastSavedBoardId: "",
    boardWidth: 260,
    boardTransparency: 0,
    searchEngine: "default",
    homeTaskCount: 3,
    pinsPosition: "center",
    weatherCity: "",
    weatherUnit: "c",
    widgets: {
      clock: true,
      navSearch: true,

      date: false,
      weather: false,
      workspace: true,
      library: true,
      focusTimer: true,
      palette: true,

      notesTodos: true,
      greeting: true,
    },
    activeTab: "home",
    displayName: "",
    preset: "",
    accent2: "#fda6c8",
    accentGradient: false,
    cursorUrl: "",
    cornerRadius: "16px",
    fontFamily: "inter",
    use12h: false,
    hidePinnedOnHome: false,
    clockPosition: "center",
    clockFont: "system",
    clockColor: "",
    clockScale: 100,
    greetingScale: 100,
    metaScale: 100,
    greetingColor: "",
    metaColor: "",
    solidAmbient: true,
    performanceMode: false,
    wpShadowAuto: true,
    wpShadowOpacity: 60,
    wpShadowColor: "#000000",
    wallpaperOverlay: false,
    wallpaperOverlayOpacity: 35,
    wallpaperBlur: false,
    wallpaperBlurAmount: 40,
    wallpaperVignette: false,
    wallpaperVignetteAmount: 45,

    remoteFavicons: true,

    remoteFaviconsDefaultVersion: 1,
    onboardingSeen: false,

    packagedWallpaperTried: false,

    welcomeSeen: false,
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

  const MAX_IMPORT_MEDIA = 5;
  const MAX_IMPORT_MEDIA_BYTES = 50 * 1024 * 1024;

  const MEDIA_PREFIX = "wpmedia:";
  const MEDIA_INDEX_KEY = "wpmediaIndex";

  const MEDIA_CACHE_MAX = 2;
  const mediaCache = new Map();

  function cacheMedia(id, value) {
    if (mediaCache.has(id)) mediaCache.delete(id);
    mediaCache.set(id, value);
    while (mediaCache.size > MEDIA_CACHE_MAX) {
      mediaCache.delete(mediaCache.keys().next().value);
    }
  }

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
    cacheMedia(id, dataUrl);
    const key = MEDIA_PREFIX + id;
    if (isExtValid()) await EXT.storage.local.set({ [key]: dataUrl });
    else localStorage.setItem(key, dataUrl);
    const idx = await readMediaIndex();
    if (!idx.includes(id)) await writeMediaIndex([...idx, id]);
    return "ref:" + id;
  }

  async function getMedia(id) {
    if (mediaCache.has(id)) {
      const hit = mediaCache.get(id);
      cacheMedia(id, hit);
      return hit;
    }
    const key = MEDIA_PREFIX + id;
    let val = "";
    try {
      if (isExtValid()) val = (await EXT.storage.local.get(key))[key] || "";
      else val = localStorage.getItem(key) || "";
    } catch (e) {
      handleStorageError("media read:", e);
    }
    if (val) cacheMedia(id, val);
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

  const INBOX_QUEUE_KEY = "inboxQueue";

  const UPDATE_PENDING_KEY = "updatePending";

  async function drainInboxQueue() {
    if (!isExtValid()) return 0;
    let queued = [];
    try {
      const bag = await EXT.storage.local.get(INBOX_QUEUE_KEY);
      queued = Array.isArray(bag[INBOX_QUEUE_KEY]) ? bag[INBOX_QUEUE_KEY] : [];
      if (!queued.length) return 0;
      await EXT.storage.local.remove(INBOX_QUEUE_KEY);
    } catch (e) {
      handleStorageError("inbox drain:", e);
      return 0;
    }

    if (!Array.isArray(data.boards)) data.boards = [];
    let inbox = data.boards.find((b) => b.name === "Inbox");
    if (!inbox) {
      inbox = {
        id: uuid(),
        name: "Inbox",
        color: null,
        col: null,
        order: data.boards.length,
        pinnedToHome: false,
        bookmarks: [],
      };
      data.boards.push(inbox);
    }
    if (!Array.isArray(inbox.bookmarks)) inbox.bookmarks = [];

    let added = 0;
    for (const entry of queued) {
      const bm = normalizeBookmark(entry);
      if (!bm) continue;

      if (inbox.bookmarks.some((b) => b.url === bm.url || b.id === bm.id))
        continue;
      bm.order = inbox.bookmarks.length;
      inbox.bookmarks.push(bm);
      added++;
    }
    if (added) saveImmediate();
    return added;
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

  const SAFE_BOOKMARK_URL = /^https?:\/\//i;
  const MAX_URL_LEN = 2000;

  function normalizeBookmark(bm) {
    if (!bm || typeof bm !== "object") return null;
    let url = typeof bm.url === "string" ? bm.url.trim() : "";
    if (!url) return null;

    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = "https://" + url;
    if (!SAFE_BOOKMARK_URL.test(url)) return null;
    url = url.slice(0, MAX_URL_LEN);
    return {
      id: bm.id || uuid(),
      title: String(typeof bm.title === "string" ? bm.title : url)
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

      name: String(b.name || "Bookmarks").trim().slice(0, 80),
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

  const CLOCK_POSITIONS = [
    "center",
    "top-left",
    "top-right",
    "bottom-left",
    "bottom-right",
  ];

  function normalizeClockPosition(value) {
    if (value === "auto") return "center";
    if (value === "corner") return "bottom-left";
    return CLOCK_POSITIONS.includes(value) ? value : undefined;
  }

  function normalizeNoteTabs(d) {
    if (!d || typeof d !== "object") return d;

    let tabs = Array.isArray(d.noteTabs) ? d.noteTabs : [];
    tabs = tabs
      .filter((t) => t && typeof t === "object")
      .slice(0, MAX_NOTE_TABS)
      .map((t, i) => ({
        id: typeof t.id === "string" && t.id ? t.id : uuid(),
        title:
          typeof t.title === "string" && t.title.trim()
            ? t.title.trim().slice(0, 40)
            : `Note ${i + 1}`,
        text:
          typeof t.text === "string" ? t.text.slice(0, MAX_NOTE_CHARS) : "",
        updatedAt: typeof t.updatedAt === "number" ? t.updatedAt : Date.now(),
      }));

    if (!tabs.length) {
      const legacy = typeof d.notes === "string" ? d.notes : "";
      tabs = [
        {
          id: uuid(),
          title: "Note 1",
          text: legacy.slice(0, MAX_NOTE_CHARS),
          updatedAt: Date.now(),
        },
      ];
    }

    d.noteTabs = tabs;
    drainTodosIntoNotes(d, tabs);
    if (!tabs.some((t) => t.id === d.activeNoteId)) d.activeNoteId = tabs[0].id;
    d.notes = tabs.find((t) => t.id === d.activeNoteId).text;
    return d;
  }

  let todosDrained = false;

  const escapeNoteText = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  function drainTodosIntoNotes(d, tabs) {
    const todos = Array.isArray(d.todos) ? d.todos.filter((t) => t && t.text) : [];
    if (!Array.isArray(d.todos) || !d.todos.length) return;
    d.todos = [];
    todosDrained = true;
    if (!todos.length) return;

    const items = todos
      .map(
        (t) =>
          `<li data-checked="${t.done ? "true" : "false"}">` +
          escapeNoteText(t.text) +
          "</li>",
      )
      .join("");
    const block = `<ul class="et-note-checklist">${items}</ul>`;

    const target =
      tabs.length < MAX_NOTE_TABS
        ? (tabs.push({
            id: uuid(),
            title: "Tasks",
            text: "",
            updatedAt: Date.now(),
          }),
          tabs[tabs.length - 1])
        : tabs[0];

    target.text = (target.text ? target.text + "<div><br></div>" : "").concat(
      block,
    ).slice(0, MAX_NOTE_CHARS);
    target.updatedAt = Date.now();
  }

  function normalizeSessions(d, extraStashes) {
    if (!d || typeof d !== "object") return d;

    const cleanTabs = (list) =>
      (Array.isArray(list) ? list : [])
        .filter((t) => t && typeof t === "object" && typeof t.url === "string")
        .filter((t) => /^https?:\/\//i.test(t.url))
        .slice(0, MAX_SESSION_TABS)
        .map((t) => ({
          title: String(t.title || t.url).slice(0, 300),
          url: t.url.slice(0, 2000),
        }));

    const clean = (s, i) => {
      if (!s || typeof s !== "object") return null;
      const tabs = cleanTabs(s.tabs);
      if (!tabs.length) return null;
      return {
        id: typeof s.id === "string" && s.id ? s.id : uuid(),

        name: typeof s.name === "string" ? s.name.trim().slice(0, 60) : "",
        ts: typeof s.ts === "number" ? s.ts : Date.now() - i,
        tabs,
      };
    };

    const merged = [
      ...(Array.isArray(d.sessions) ? d.sessions : []),
      ...(Array.isArray(extraStashes) ? extraStashes : []),
      ...(Array.isArray(d.tabStashes) ? d.tabStashes : []),
    ];

    const seen = new Set();
    const out = [];
    for (let i = 0; i < merged.length; i++) {
      const s = clean(merged[i], i);
      if (!s || seen.has(s.id)) continue;
      seen.add(s.id);
      out.push(s);
    }

    out.sort((a, b) => b.ts - a.ts);
    d.sessions = out.slice(0, MAX_SESSIONS);
    d.tabStashes = [];
    return d;
  }

  function normalizeReadLater(d) {
    if (!d || typeof d !== "object") return d;
    const seen = new Set();
    const out = [];

    for (const raw of Array.isArray(d.readLater) ? d.readLater : []) {
      if (!raw || typeof raw !== "object") continue;
      if (typeof raw.url !== "string" || !/^https?:\/\//i.test(raw.url))
        continue;
      const url = raw.url.slice(0, 2000);

      if (seen.has(url)) continue;
      seen.add(url);
      out.push({
        id: typeof raw.id === "string" && raw.id ? raw.id : uuid(),
        url,
        title: String(raw.title || url).slice(0, 300),
        addedAt: typeof raw.addedAt === "number" ? raw.addedAt : Date.now(),
        read: raw.read === true,
      });
    }

    out.sort((a, b) => b.addedAt - a.addedAt);
    d.readLater = out.slice(0, MAX_READ_LATER);
    return d;
  }

  function normalizeWorkspaces(d) {
    if (!d || typeof d !== "object") return d;
    const boardIds = new Set(
      (Array.isArray(d.boards) ? d.boards : []).map((b) => b && b.id),
    );
    const seen = new Set();
    const out = [];
    for (const raw of Array.isArray(d.workspaces) ? d.workspaces : []) {
      if (!raw || typeof raw !== "object") continue;
      const tabs = (Array.isArray(raw.tabs) ? raw.tabs : [])
        .filter((t) => t && typeof t.url === "string" && /^https?:\/\//i.test(t.url))
        .slice(0, MAX_SESSION_TABS)
        .map((t) => ({
          title: String(t.title || t.url).slice(0, 300),
          url: t.url.slice(0, 2000),
        }));
      if (!tabs.length) continue;
      const id = typeof raw.id === "string" && raw.id ? raw.id : uuid();
      if (seen.has(id)) continue;
      seen.add(id);
      const ts = typeof raw.ts === "number" ? raw.ts : Date.now();
      out.push({
        id,
        name: typeof raw.name === "string" ? raw.name.trim().slice(0, 60) : "",
        boardId:
          typeof raw.boardId === "string" && boardIds.has(raw.boardId)
            ? raw.boardId
            : "",
        ts,
        updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : ts,
        tabs,
      });
    }
    out.sort((a, b) => b.updatedAt - a.updatedAt);
    d.workspaces = out.slice(0, MAX_WORKSPACES);
    return d;
  }

  function normalizeFeatureState(d) {
    if (!d || typeof d !== "object") return d;

    d.remindersMutedBefore =
      typeof d.remindersMutedBefore === "number" ? d.remindersMutedBefore : 0;
    return d;
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
    let legacyStashes = null;
    try {
      let rawSettings, rawData;
      if (isExtValid()) {
        const localBag = await EXT.storage.local.get([
          "data",
          "settings",
          "tabStashes",
        ]);
        rawData = localBag.data;
        rawSettings = localBag.settings;
        legacyStashes = localBag.tabStashes;
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
      if ((loadedSettings.settingsLayoutVersion || 0) < 9) {
        const themeCollapsed = new Set(collapsedSettingsAccordions.theme || []);
        const deliberate = new Set(
          (loadedSettings.expandedSettingsAccordions || {}).theme || [],
        );
        ["themes", "theme and colours"].forEach((key) => {
          if (!deliberate.has(key)) themeCollapsed.add(key);
        });
        collapsedSettingsAccordions.theme = [...themeCollapsed];
      }

      if (RETIRED_PRESET_IDS.includes(loadedSettings.preset)) {
        loadedSettings.preset = "";
        if (
          !loadedSettings.cornerRadius ||
          loadedSettings.cornerRadius === "default"
        )
          loadedSettings.cornerRadius = "0px";
      }

      if ((loadedSettings.settingsLayoutVersion || 0) < 10) {
        const px = loadedSettings.wallpaperBlurAmount;
        if (typeof px === "number")
          loadedSettings.wallpaperBlurAmount = Math.round(
            Math.sqrt(Math.min(26, Math.max(0, px)) / 26) * 100,
          );
      }

      if (!CORNER_RADII.includes(loadedSettings.cornerRadius))
        loadedSettings.cornerRadius = CORNER_STYLES[0].value;
      if (!APP_FONT_VALUES.includes(loadedSettings.fontFamily))
        loadedSettings.fontFamily = APP_FONTS[0].value;

      if ((loadedSettings.settingsLayoutVersion || 0) < 11) {
        if (loadedSettings.searchEngine === "google")
          loadedSettings.searchEngine = "default";
        if (Array.isArray(loadedSettings.enabledEngines))
          loadedSettings.enabledEngines = [
            ...new Set(["default", ...loadedSettings.enabledEngines]),
          ];
      }

      if (
        (loadedSettings.settingsLayoutVersion || 0) < 13 &&
        Array.isArray(loadedSettings.enabledEngines)
      ) {
        loadedSettings.enabledEngines = [
          ...new Set([
            ...loadedSettings.enabledEngines,
            "yandex",
            "yahoo",
            "reddit",
            "pinterest",
            "quora",
          ]),
        ];
      }

      const faviconDefaults = {};
      if (
        (loadedSettings.remoteFaviconsDefaultVersion || 0) <
          DEFAULT_SETTINGS.remoteFaviconsDefaultVersion &&
        loadedSettings.remoteFaviconsChoice === undefined
      ) {
        faviconDefaults.remoteFavicons = DEFAULT_SETTINGS.remoteFavicons;
        faviconDefaults.remoteFaviconsDefaultVersion =
          DEFAULT_SETTINGS.remoteFaviconsDefaultVersion;
      }

      const packagedWallpaperDefaults = {};
      if (
        rawSettings &&
        typeof rawSettings === "object" &&
        Object.keys(rawSettings).length &&
        rawSettings.packagedWallpaperTried === undefined
      ) {
        packagedWallpaperDefaults.packagedWallpaperTried = true;
      }

      const strengthRescaled = (loadedSettings.settingsLayoutVersion || 0) >= 8;
      const interfaceOpacity = strengthRescaled
        ? Math.max(0, Math.min(100, migratedInterfaceOpacity))
        : DEFAULT_SETTINGS.interfaceOpacity;
      const surfaceOpacity = strengthRescaled
        ? loadedSettings.surfaceOpacity || {}
        : {};

      if (
        !strengthRescaled &&
        typeof loadedSettings.boardTransparency === "number" &&
        loadedSettings.boardTransparency > 0 &&
        typeof surfaceOpacity.boards !== "number"
      ) {
        const transp = Math.min(90, Math.max(0, loadedSettings.boardTransparency));
        surfaceOpacity.boards = Math.round(100 - transp);
      }

      settings = refill(settings, {
        ...DEFAULT_SETTINGS,
        ...loadedSettings,
        ...faviconDefaults,
        ...packagedWallpaperDefaults,
        interfaceOpacity,
        surfaceOpacity,
        settingsLayoutVersion: 13,
        clockPosition:
          normalizeClockPosition(loadedSettings.clockPosition) ??
          DEFAULT_SETTINGS.clockPosition,
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
    normalizeNoteTabs(data);
    normalizeFeatureState(data);
    normalizeSessions(data, legacyStashes);
    normalizeReadLater(data);
    normalizeWorkspaces(data);
    if (todosDrained) {
      todosDrained = false;
      saveImmediate();
    }

    if (Array.isArray(legacyStashes) && legacyStashes.length && isExtValid()) {
      try {
        await EXT.storage.local.set({ data, writer: nextWriterStamp() });
        await EXT.storage.local.remove("tabStashes");
      } catch (e) {
        handleStorageError("session migration:", e);
      }
    }

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

    storedData = snapshot(data);
    storedSettings = snapshot(settings);
    return { data, settings };
  }

  let bootBg = null;

  function mirrorBootState() {
    try {
      const isLight =
        settings.mode === "light" ||
        (settings.mode === "system" &&
          !window.matchMedia("(prefers-color-scheme: dark)").matches);
      const mode = isLight ? "light" : "dark";

      let prev = null;
      try {
        prev = JSON.parse(localStorage.getItem("et_boot") || "null");
      } catch {}

      let bg = null;
      if (typeof bootBg === "string" && /^#[0-9a-f]{3,6}$/i.test(bootBg)) {
        bg = bootBg;
      } else if (
        prev &&
        prev.mode === mode &&
        typeof prev.pageBg === "string" &&
        /^#[0-9a-f]{3,6}$/i.test(prev.pageBg)
      ) {
        bg = prev.pageBg;
      } else {
        bg = isLight ? "#f4f6f8" : "#0d1117";
      }

      localStorage.setItem("et_boot", JSON.stringify({ mode, pageBg: bg }));
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

  const SYNC_MIN_INTERVAL = 30000;
  let syncTimer = null;
  let syncFirstQueuedAt = 0;
  let lastSyncedSettingsStr = "";

  let syncQuotaWarned = false;

  let syncAttempts = 0;
  const MAX_SYNC_ATTEMPTS = 3;

  function writeSyncNow() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = null;
    syncFirstQueuedAt = 0;
    if (!isExtValid() || !EXT.storage || !EXT.storage.sync) return;
    try {
      const trimmed = trimForSync(settings);
      const str = JSON.stringify(trimmed);
      if (str === lastSyncedSettingsStr) return;

      const previous = lastSyncedSettingsStr;
      lastSyncedSettingsStr = str;

      EXT.storage.sync
        .set({ settings: trimmed })
        .then(() => {
          syncAttempts = 0;
        })
        .catch((e) => {
          lastSyncedSettingsStr = previous;
          const msg = String(e?.message || e || "");

          const transient = !/QUOTA_BYTES/i.test(msg);
          if (/QUOTA_BYTES/i.test(msg) && !syncQuotaWarned) {
            syncQuotaWarned = true;
            try {
              ToastSystem.warning(
                "Settings are too large to sync",
                0,
                "This device keeps them; other devices will not receive them.",
              );
            } catch {}
          }
          if (transient && syncAttempts < MAX_SYNC_ATTEMPTS) {
            syncAttempts++;
            if (syncTimer) clearTimeout(syncTimer);
            syncFirstQueuedAt = 0;
            syncTimer = setTimeout(writeSyncNow, SYNC_MIN_INTERVAL * syncAttempts);
          }
          handleStorageError("sync save:", e);
        });
    } catch (e) {
      handleStorageError("sync save:", e);
    }
  }

  function queueSync() {
    if (!isExtValid() || !EXT.storage || !EXT.storage.sync) return;
    if (!syncFirstQueuedAt) syncFirstQueuedAt = Date.now();
    if (Date.now() - syncFirstQueuedAt >= SYNC_MIN_INTERVAL) {
      writeSyncNow();
      return;
    }
    if (syncTimer) return;
    syncTimer = setTimeout(writeSyncNow, SYNC_MIN_INTERVAL);
  }

  function flushSync() {
    if (syncTimer || syncFirstQueuedAt) writeSyncNow();
  }

  let storedData = null;
  let storedSettings = null;
  const snapshot = (value) => {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  };

  function persist() {
    mirrorBootState();
    const nextData = snapshot(data);
    const nextSettings = snapshot(settings);
    const dataChanged = nextData === null || nextData !== storedData;
    const settingsChanged = nextSettings === null || nextSettings !== storedSettings;
    if (!dataChanged && !settingsChanged) return;
    if (isExtValid()) {
      try {
        const payload = { writer: nextWriterStamp() };
        if (dataChanged) payload.data = data;
        if (settingsChanged) payload.settings = settings;
        storedData = nextData;
        storedSettings = nextSettings;
        EXT.storage.local.set(payload).catch((e) => {
          storedData = storedSettings = null;
          handleStorageError("local save:", e);
        });
        queueSync();
      } catch (e) {
        storedData = storedSettings = null;
        handleStorageError("local save:", e);
      }
    } else {
      storedData = nextData;
      storedSettings = nextSettings;
      if (settingsChanged) localStorage.setItem("markmez_settings", nextSettings);
      if (dataChanged) localStorage.setItem("markmez_data", nextData);
    }
  }

  function persistSettings() {
    mirrorBootState();
    const nextSettings = snapshot(settings);
    if (nextSettings !== null && nextSettings === storedSettings) return;
    storedSettings = nextSettings;
    if (isExtValid()) {
      try {
        EXT.storage.local
          .set({ settings, writer: nextWriterStamp() })
          .catch((e) => {
            storedSettings = null;
            handleStorageError("local save:", e);
          });
        queueSync();
      } catch (e) {
        storedSettings = null;
        handleStorageError("local save:", e);
      }
    } else {
      localStorage.setItem("markmez_settings", nextSettings);
    }
  }

  let pendingPersist = null;

  let dataDirty = false;

  function schedule(withData) {
    if (withData) dataDirty = true;
    pendingPersist = () => {
      const full = dataDirty;
      dataDirty = false;
      if (full) persist();
      else persistSettings();
    };
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(flush, 120);
  }
  function save() {
    schedule(true);
  }
  function saveSettings() {
    schedule(false);
  }
  function saveImmediate() {
    clearTimeout(saveTimeout);
    pendingPersist = null;
    dataDirty = false;
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
      "accentGradient",
      typeof raw.accentGradient === "boolean" ? raw.accentGradient : undefined,
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
    if (raw.surfaceOpacity && typeof raw.surfaceOpacity === "object") {
      const clean = {};
      SURFACE_KEYS.forEach((k) => {
        const v = num(raw.surfaceOpacity[k], 0, 100);
        if (v !== undefined) clean[k] = v;
      });
      out.surfaceOpacity = clean;
    }
    pick("notesFontSize", num(raw.notesFontSize, 11, 28));
    if (raw.interfaceOpacity === undefined && raw.boardOpacity !== undefined) {
      const legacyInterfaceOpacity = num(raw.boardOpacity, 0, 1);
      if (legacyInterfaceOpacity !== undefined)
        out.interfaceOpacity = legacyInterfaceOpacity * 100;
    }
    pick("boardWidth", num(raw.boardWidth, 200, 560));
    pick("boardTransparency", num(raw.boardTransparency, 0, 90));
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
      CORNER_RADII.includes(raw.cornerRadius) ? raw.cornerRadius : undefined,
    );
    pick(
      "fontFamily",
      APP_FONT_VALUES.includes(raw.fontFamily) ? raw.fontFamily : undefined,
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
      "lastSettingsPage",
      SETTINGS_PAGES.includes(raw.lastSettingsPage)
        ? raw.lastSettingsPage
        : undefined,
    );
    pick("settingsLayoutVersion", num(raw.settingsLayoutVersion, 0, 20));
    const pickAccordionMap = (key) => {
      const src = raw[key];
      if (!src || typeof src !== "object" || Array.isArray(src)) return;
      out[key] = {};
      for (const tab of ["theme", "widgets", "data", "help", "support"]) {
        if (Array.isArray(src[tab])) {
          out[key][tab] = src[tab]
            .filter((v) => typeof v === "string")
            .map((v) => v.slice(0, 100))
            .slice(0, 30);
        }
      }
    };
    pickAccordionMap("collapsedSettingsAccordions");
    pickAccordionMap("expandedSettingsAccordions");
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
    if ((num(raw.settingsLayoutVersion, 0, 20) || 0) < 9) {
      const themeCollapsed = new Set(
        out.collapsedSettingsAccordions.theme || [],
      );
      const deliberate = new Set(
        (out.expandedSettingsAccordions || {}).theme || [],
      );
      ["themes", "theme and colours"].forEach((key) => {
        if (!deliberate.has(key)) themeCollapsed.add(key);
      });
      out.collapsedSettingsAccordions.theme = [...themeCollapsed];
      out.settingsLayoutVersion = 9;
    }
    if (
      raw.settingsScrollPositions &&
      typeof raw.settingsScrollPositions === "object" &&
      !Array.isArray(raw.settingsScrollPositions)
    ) {
      out.settingsScrollPositions = {};
      for (const tab of ["theme", "widgets", "data", "help", "support"]) {
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
    if (raw.remoteFaviconsChoice !== undefined)
      out.remoteFaviconsChoice = !!raw.remoteFaviconsChoice;
    pick(
      "remoteFaviconsDefaultVersion",
      num(raw.remoteFaviconsDefaultVersion, 0, 99),
    );
    pick(
      "onboardingSeen",
      typeof raw.onboardingSeen === "boolean" ? raw.onboardingSeen : undefined,
    );
    pick(
      "welcomeSeen",
      typeof raw.welcomeSeen === "boolean" ? raw.welcomeSeen : undefined,
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

    pick("clockPosition", normalizeClockPosition(raw.clockPosition));
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
    pick("clockScale", num(raw.clockScale, 60, 130));
    pick("greetingScale", num(raw.greetingScale, 70, 150));
    pick("metaScale", num(raw.metaScale, 70, 150));
    ["greetingColor", "metaColor"].forEach((key) =>
      pick(
        key,
        /^#[0-9a-f]{6}$/i.test(raw[key] || "") || raw[key] === "" ? raw[key] : undefined,
      ),
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
    pick("wpShadowAuto", typeof raw.wpShadowAuto === "boolean" ? raw.wpShadowAuto : undefined);
    pick("wpShadowOpacity", num(raw.wpShadowOpacity, 0, 100));
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
      "wallpaperBlur",
      typeof raw.wallpaperBlur === "boolean" ? raw.wallpaperBlur : undefined,
    );
    pick("wallpaperBlurAmount", num(raw.wallpaperBlurAmount, 0, 100));
    pick(
      "wallpaperVignette",
      typeof raw.wallpaperVignette === "boolean" ? raw.wallpaperVignette : undefined,
    );
    pick("wallpaperVignetteAmount", num(raw.wallpaperVignetteAmount, 0, 100));
    pick(
      "wpExtractedAccent",
      HEX.test(raw.wpExtractedAccent || "") ? raw.wpExtractedAccent : undefined,
    );
    pick(
      "wpTone",
      raw.wpTone && typeof raw.wpTone === "object"
        ? {
            top: HEX.test(raw.wpTone.top || "") ? raw.wpTone.top : "#4a4a52",
            middle: HEX.test(raw.wpTone.middle || "") ? raw.wpTone.middle : "#4a4a52",
            bottom: HEX.test(raw.wpTone.bottom || "") ? raw.wpTone.bottom : "#4a4a52",
            overall: HEX.test(raw.wpTone.overall || "") ? raw.wpTone.overall : "#4a4a52",
            spread: num(raw.wpTone.spread, 0, 1) ?? 0.15,
          }
        : undefined,
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
          const MAX_MEDIA_CHARS = Math.ceil(MAX_IMPORT_MEDIA_BYTES * 1.4);
          let taken = 0;
          for (const [id, value] of Object.entries(imported.media)) {
            if (taken >= MAX_IMPORT_MEDIA) break;
            if (!/^[a-z0-9_-]{1,128}$/i.test(id)) continue;
            if (
              typeof value !== "string" ||
              !/^data:(image|video)\//i.test(value)
            )
              continue;
            if (value.length > MAX_MEDIA_CHARS) continue;
            await putMedia(id, value);
            taken++;
            await new Promise((r) => setTimeout(r, 0));
          }
        }
        if (imported.data) data = refill(data, restoredData);
        if (imported.settings) settings = refill(settings, restoredSettings);
        normalizeNoteTabs(data);
        normalizeFeatureState(data);
        normalizeSessions(data);
        normalizeReadLater(data);
        normalizeWorkspaces(data);

        muteRemindersFromNow();
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

  function muteRemindersFromNow() {
    const now = Date.now();
    data.remindersMutedBefore = now;
  }

  function resetAll() {
    data = refill(data, deepClone(DEFAULT_DATA));
    settings = refill(settings, deepClone(DEFAULT_SETTINGS));
    normalizeNoteTabs(data);
    normalizeFeatureState(data);
    normalizeSessions(data);
    normalizeReadLater(data);
    normalizeWorkspaces(data);
    muteRemindersFromNow();
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
    drainInboxQueue,
    INBOX_QUEUE_KEY,
    UPDATE_PENDING_KEY,
    flushSync,
    isMediaRef,
    refId,
    sanitizeSettings,
    normalizeNoteTabs,
    normalizeFeatureState,
    normalizeSessions,
    normalizeWorkspaces,
    MAX_SESSIONS,
    MAX_WORKSPACES,
    MAX_READ_LATER,
    muteRemindersFromNow,
    MAX_NOTE_TABS,
    MAX_NOTE_CHARS,
    setBootBg,
    getWriterId: () => WRITER_ID,
    isOwnWriter,
    SURFACE_KEYS,
    DEFAULT_SETTINGS,
    DEFAULT_DATA,
  };
})();
