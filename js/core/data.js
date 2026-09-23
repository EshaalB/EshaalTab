"use strict";

const TabManager = (() => {
  const TABS = ["home", "boards", "notes"];
  let localTab = null;

  function get() {
    if (localTab) return localTab;
    const t = StorageManager.getSettings().activeTab;
    localTab = TABS.includes(t) ? t : "home";
    return localTab;
  }

  function set(tab) {
    if (!TABS.includes(tab)) return;
    localTab = tab;
  }
  return { TABS, get, set };
})();
const BoardManager = (() => {
  const boards = () => StorageManager.getData().boards;

  const BOARD_TINTS = [
    { name: "Gray", light: "#dfdfdd", dark: "#2f2f2f", dot: "#8d8d87", legacy: "#f1f1ef" },
    { name: "Brown", light: "#e5d7d1", dark: "#4a3228", dot: "#a3705a", legacy: "#f4eeee" },
    { name: "Orange", light: "#f4d8bb", dark: "#5c3b23", dot: "#d9730d", legacy: "#faebdd" },
    { name: "Yellow", light: "#ebddc0", dark: "#564328", dot: "#b8851d", legacy: "#fbf3db" },
    { name: "Green", light: "#cbdcd3", dark: "#243d30", dot: "#448361", legacy: "#edf3ec" },
    { name: "Blue", light: "#c6dbe7", dark: "#143a4e", dot: "#337ea9", legacy: "#e7f3f8" },
    { name: "Purple", light: "#e0d4e9", dark: "#3c2d49", dot: "#9065b0", legacy: "#f6f3f9" },
    { name: "Pink", light: "#eecdde", dark: "#4e2c3c", dot: "#c14c8a", legacy: "#faf1f5" },
    { name: "Red", light: "#f3cdcb", dark: "#522e2a", dot: "#d44c47", legacy: "#fdebec" },
  ];

  const BOARD_COLORS = BOARD_TINTS.map((t) => t.light);


  function setColor(boardId, color) {
    const b = find(boardId);
    if (!b) return false;
    if (color !== null && !/^#[0-9a-f]{6}$/i.test(color)) return false;
    b.color = color ? color.toLowerCase() : null;
    StorageManager.save();
    return true;
  }

  const MAX_NAME = 80;
  const cleanName = (name) =>
    String(name == null ? "" : name)
      .trim()
      .slice(0, MAX_NAME);

  function addBoard(name = "", targetCol = null) {
    if (!name) name = "New board";
    const board = {
      id: uuid(),
      name: cleanName(name) || "New board",
      color: null,
      col: targetCol,
      order: boards().length,
      pinnedToHome: false,
      bookmarks: [],
    };
    boards().push(board);
    StorageManager.save();
    return board;
  }
  function find(id) {
    return boards().find((b) => b.id === id) || null;
  }

  function deleteBoard(id) {
    const d = StorageManager.getData();
    const board = d.boards.find((b) => b.id === id) || null;
    const index = d.boards.findIndex((b) => b.id === id);
    const layout = d.boards.map((b) => ({
      id: b.id,
      col: b.col,
      order: b.order,
    }));

    d.boards = d.boards.filter((b) => b.id !== id);

    if (Array.isArray(d.collapsedBoards))
      d.collapsedBoards = d.collapsedBoards.filter((bid) => bid !== id);

    if (board) dropFromPinnedOrder((board.bookmarks || []).map((x) => x.id));
    StorageManager.save();
    return { board, index, layout };
  }

  function dropFromPinnedOrder(ids) {
    const d = StorageManager.getData();
    if (!Array.isArray(d.pinnedOrder) || !d.pinnedOrder.length) return;
    const drop = new Set(ids);
    const kept = d.pinnedOrder.filter((x) => !drop.has(x));
    if (kept.length !== d.pinnedOrder.length) d.pinnedOrder = kept;
  }
  function rename(id, name) {
    const b = find(id);
    if (!b) return;

    const next = cleanName(name);
    if (!next) return;
    b.name = next;
    StorageManager.save();
  }

  function restoreBoard(token, index) {
    const arr = boards();
    const board = token && token.board ? token.board : token;
    if (!board) return;
    const at = token && token.board ? token.index : index;
    const i =
      Number.isInteger(at) && at >= 0 ? Math.min(at, arr.length) : arr.length;
    arr.splice(i, 0, board);

    if (token && Array.isArray(token.layout)) {
      const byId = new Map(arr.map((b) => [b.id, b]));
      token.layout.forEach((entry) => {
        const b = byId.get(entry.id);
        if (!b) return;
        b.col = entry.col;
        b.order = entry.order;
      });
    }
    StorageManager.save();
  }
  function shift(id, delta) {
    const arr = boards();
    const i = arr.findIndex((b) => b.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= arr.length) return false;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    const col = arr[j].col;
    arr[i].col = arr[j].col = col;
    arr.forEach((b, k) => (b.order = k));
    StorageManager.save();
    return true;
  }

  function applyColumnLayout(idToCol) {
    let changed = false;
    boards().forEach((b) => {
      const col = idToCol.get(b.id);
      if (col != null && b.col !== col) {
        b.col = col;
        changed = true;
      }
    });
    if (changed) StorageManager.save();
    return changed;
  }

  function compactColumns() {
    const used = [...new Set(boards().map((b) => b.col))]
      .filter((c) => Number.isInteger(c))
      .sort((a, b) => a - b);
    const remap = new Map(used.map((col, i) => [col, i]));
    let changed = false;
    boards().forEach((b) => {
      const next = remap.get(b.col);
      if (next != null && next !== b.col) {
        b.col = next;
        changed = true;
      }
    });
    return changed;
  }

  function columnBoards(col) {
    return boards()
      .filter((b) => b.col === col)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function moveVertical(id, delta) {
    const b = find(id);
    if (!b || b.col == null) return false;
    const col = columnBoards(b.col);
    const i = col.findIndex((x) => x.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= col.length) return false;
    const tmp = col[i].order;
    col[i].order = col[j].order;
    col[j].order = tmp;
    StorageManager.save();
    return true;
  }

  function moveHorizontal(id, deltaCol, numCols) {
    const b = find(id);
    if (!b || b.col == null) return false;
    const targetCol = b.col + deltaCol;
    if (targetCol < 0 || targetCol >= numCols) return false;
    const dest = columnBoards(targetCol);

    if (!dest.length && columnBoards(b.col).length < 2) return false;

    const fromCol = b.col;
    const row = columnBoards(fromCol).findIndex((x) => x.id === b.id);
    const at = Math.min(Math.max(row, 0), dest.length);
    dest.splice(at, 0, b);
    b.col = targetCol;
    dest.forEach((x, i) => (x.order = i));
    columnBoards(fromCol).forEach((x, i) => (x.order = i));

    compactColumns();
    StorageManager.save();
    return true;
  }

  function placeBoard(id, targetCol, index) {
    const b = find(id);
    if (!b || !Number.isInteger(targetCol) || targetCol < 0) return false;
    const fromCol = b.col;
    const dest = columnBoards(targetCol).filter((x) => x.id !== id);
    const at = Math.max(0, Math.min(Number(index) || 0, dest.length));
    dest.splice(Number.isFinite(index) ? at : dest.length, 0, b);
    b.col = targetCol;
    dest.forEach((x, i) => (x.order = i));
    if (Number.isInteger(fromCol) && fromCol !== targetCol)
      columnBoards(fromCol).forEach((x, i) => (x.order = i));
    compactColumns();
    StorageManager.save();
    return true;
  }

  function swapBoards(idA, idB) {
    const a = find(idA);
    const b = find(idB);
    if (!a || !b || a === b) return false;
    const ac = a.col,
      ao = a.order;
    a.col = b.col;
    a.order = b.order;
    b.col = ac;
    b.order = ao;
    StorageManager.save();
    return true;
  }

  const moveUp = (id) => moveVertical(id, -1);
  const moveDown = (id) => moveVertical(id, 1);
  const moveLeft = (id, numCols) => moveHorizontal(id, -1, numCols);
  const moveRight = (id, numCols) => moveHorizontal(id, 1, numCols);

  return {
    addBoard,
    setColor,
    find,
    deleteBoard,
    rename,
    restoreBoard,
    shift,
    applyColumnLayout,
    compactColumns,
    dropFromPinnedOrder,
    columnBoards,
    placeBoard,
    swapBoards,
    moveUp,
    moveDown,
    moveLeft,
    moveRight,
    getAll: boards,
    MAX_NAME,
    BOARD_COLORS,
    BOARD_TINTS,
  };
})();

const BookmarkManager = (() => {
  const boards = () => StorageManager.getData().boards;

  function normalizeUrl(raw) {
    const s = String(raw || "").trim();
    if (!s) return null;
    if (/^(javascript|data|vbscript|blob):/i.test(s.replace(/[\s - ]/g, "")))
      return null;
    if (/^https?:\/\//i.test(s)) return s;
    if (/^(chrome|edge|about|moz-extension|chrome-extension|file):/i.test(s))
      return s;
    if (
      /^(localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?(\/.*)?$/i.test(s)
    )
      return "http://" + s;
    return "https://" + s;
  }

  function add(boardId, title, url, tags = [], nickname = "") {
    const b = BoardManager.find(boardId);
    if (!b) return null;
    const safe = normalizeUrl(url);
    if (!safe) return null;
    const norm = tags.map(TagManager.normalize).filter(Boolean);
    norm.forEach(TagManager.add);
    const bm = {
      id: uuid(),
      title: String(title || "")
        .trim()
        .slice(0, 300),
      nickname: String(nickname || "")
        .trim()
        .slice(0, 60),
      url: safe,
      tags: norm,
      order: b.bookmarks.length,
    };
    b.bookmarks.push(bm);
    StorageManager.save();
    return bm;
  }
  function edit(boardId, bmId, title, url, tags, nickname = "") {
    const b = BoardManager.find(boardId);
    const bm = b && b.bookmarks.find((x) => x.id === bmId);
    if (!bm) return;
    const safe = normalizeUrl(url);
    if (!safe) return;
    bm.title = String(title || "")
      .trim()
      .slice(0, 300);
    bm.nickname = String(nickname || "")
      .trim()
      .slice(0, 60);
    bm.url = safe;
    bm.tags = (tags || []).map(TagManager.normalize).filter(Boolean);
    bm.tags.forEach(TagManager.add);
    StorageManager.save();
  }
  function remove(boardId, bmId) {
    const b = BoardManager.find(boardId);
    if (!b) return;
    b.bookmarks = b.bookmarks.filter((x) => x.id !== bmId);

    BoardManager.dropFromPinnedOrder([bmId]);
    StorageManager.save();
  }
  function insertAt(boardId, bm, index) {
    const b = BoardManager.find(boardId);
    if (!b) return;
    const i =
      Number.isInteger(index) && index >= 0
        ? Math.min(index, b.bookmarks.length)
        : b.bookmarks.length;
    b.bookmarks.splice(i, 0, bm);
    StorageManager.save();
  }
  function move(srcBoardId, destBoardId, bmId, beforeId) {
    const arr = boards();
    const src = arr.find((b) => b.id === srcBoardId);
    const dest = arr.find((b) => b.id === destBoardId);
    if (!src || !dest) return;
    const i = src.bookmarks.findIndex((x) => x.id === bmId);
    if (i < 0) return;
    const [bm] = src.bookmarks.splice(i, 1);
    const at = beforeId
      ? dest.bookmarks.findIndex((x) => x.id === beforeId)
      : dest.bookmarks.length;
    dest.bookmarks.splice(at < 0 ? dest.bookmarks.length : at, 0, bm);
    StorageManager.save();
  }
  function searchAll(query) {
    const isTag = query.startsWith("#");
    const term = (isTag ? query.slice(1) : query).toLowerCase();
    const out = [];
    const LIMIT = 25;
    for (const board of boards()) {
      for (const bm of board.bookmarks) {
        const hit = isTag
          ? (bm.tags || []).some((t) => t.includes(term))
          : bm.title.toLowerCase().includes(term) ||
            bm.url.toLowerCase().includes(term) ||
            (bm.tags || []).some((t) => t.includes(term));
        if (hit) {
          out.push({ ...bm, boardId: board.id, boardName: board.name });
          if (out.length >= LIMIT) return out;
        }
      }
    }
    return out;
  }
  const PIN_LIMIT = 5;

  function getPinned() {
    const out = [];
    for (const board of boards()) {
      for (const bm of board.bookmarks || []) {
        if (bm.pinnedToHome)
          out.push({ ...bm, boardId: board.id, boardName: board.name });
      }
    }
    const order = StorageManager.getData().pinnedOrder || [];
    out.sort((a, b) => {
      const idxA = order.indexOf(a.id);
      const idxB = order.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });
    return out;
  }
  function reorderPinned(pinnedIds) {
    StorageManager.getData().pinnedOrder = pinnedIds;
    StorageManager.save();
  }
  function isPinned(bmId) {
    return getPinned().some((bm) => bm.id === bmId);
  }
  function countPinned() {
    return getPinned().length;
  }
  function togglePin(boardId, bmId) {
    const b = BoardManager.find(boardId);
    const bm = b && (b.bookmarks || []).find((x) => x.id === bmId);
    if (!bm) return null;
    if (!bm.pinnedToHome && countPinned() >= PIN_LIMIT) return null;
    bm.pinnedToHome = !bm.pinnedToHome;
    if (!bm.pinnedToHome) delete bm.pinnedToHome;
    StorageManager.save();
    return !!bm.pinnedToHome;
  }
  function unpin(bmId) {
    for (const board of boards()) {
      const bm = (board.bookmarks || []).find((x) => x.id === bmId);
      if (bm && bm.pinnedToHome) {
        delete bm.pinnedToHome;
        StorageManager.save();
        return true;
      }
    }
    return false;
  }

  return {
    add,
    edit,
    remove,
    insertAt,
    move,
    searchAll,
    normalizeUrl,
    getPinned,
    isPinned,
    countPinned,
    togglePin,
    unpin,
    reorderPinned,
    PIN_LIMIT,
  };
})();

const NotesManager = (() => {
  const MAX_HISTORY = 25;
  const MAX_TABS = StorageManager.MAX_NOTE_TABS;
  const MAX_CHARS = StorageManager.MAX_NOTE_CHARS;

  function tabs() {
    const d = StorageManager.getData();
    if (!Array.isArray(d.noteTabs) || !d.noteTabs.length)
      StorageManager.normalizeNoteTabs(d);
    return d.noteTabs;
  }

  function activeTab() {
    const d = StorageManager.getData();
    const list = tabs();
    return list.find((t) => t.id === d.activeNoteId) || list[0];
  }

  function get() {
    return activeTab().text || "";
  }

  let truncated = false;

  function write(text) {
    const t = activeTab();
    const full = String(text ?? "");
    truncated = full.length > MAX_CHARS;
    t.text = truncated ? full.slice(0, MAX_CHARS) : full;
    t.updatedAt = Date.now();
    StorageManager.getData().notes = t.text;
    return t;
  }

  function lastWriteTruncated() {
    return truncated;
  }

  function set(text) {
    write(text);
    StorageManager.save();
  }

  function setImmediate(text) {
    write(text);
    StorageManager.saveImmediate();
  }

  function list() {
    return tabs();
  }
  function getActiveId() {
    return activeTab().id;
  }
  function setActive(id) {
    if (!tabs().some((t) => t.id === id)) return false;
    const d = StorageManager.getData();
    d.activeNoteId = id;
    d.notes = activeTab().text;
    StorageManager.saveImmediate();
    return true;
  }

  function add(title) {
    const list = tabs();
    if (list.length >= MAX_TABS) return null;
    const note = {
      id: uuid(),
      title: String(title || `Note ${list.length + 1}`)
        .trim()
        .slice(0, 40),
      text: "",
      updatedAt: Date.now(),
    };
    list.push(note);
    StorageManager.getData().activeNoteId = note.id;
    StorageManager.getData().notes = "";
    StorageManager.saveImmediate();
    return note;
  }

  function remove(id) {
    const list = tabs();
    if (list.length <= 1) return false;
    const i = list.findIndex((t) => t.id === id);
    if (i === -1) return false;
    const [removed] = list.splice(i, 1);
    const d = StorageManager.getData();
    if (d.activeNoteId === id)
      d.activeNoteId = list[Math.min(i, list.length - 1)].id;
    d.notes = activeTab().text;
    StorageManager.saveImmediate();
    return removed;
  }

  function rename(id, title) {
    const t = tabs().find((x) => x.id === id);
    if (!t) return false;
    const clean = String(title || "").trim();
    if (!clean) return false;
    t.title = clean.slice(0, 40);
    StorageManager.saveImmediate();
    return true;
  }

  function getHistory() {
    const d = StorageManager.getData();
    return Array.isArray(d.notesHistory)
      ? d.notesHistory
      : (d.notesHistory = []);
  }

  function pushHistory(text) {
    const t = String(text || "");
    if (!t.trim()) return;
    const hist = getHistory();
    if (hist[0] === t) return;
    hist.unshift(t);
    if (hist.length > MAX_HISTORY) hist.length = MAX_HISTORY;
    StorageManager.save();
  }

  function exportTxt() {
    const t = activeTab();
    const blob = new Blob([t.text || ""], {
      type: "text/plain;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const slug =
      (t.title || "notes").replace(/[^a-z0-9]+/gi, "-").toLowerCase() ||
      "notes";
    a.download = `eshaaltab-${slug}-${new Date().toLocaleDateString("sv")}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return {
    get,
    set,
    setImmediate,
    getHistory,
    pushHistory,
    exportTxt,
    list,
    getActiveId,
    setActive,
    add,
    remove,
    rename,
    lastWriteTruncated,
    MAX_TABS,
    MAX_CHARS,
  };
})();

const ClipboardManager = (() => {
  function getAll() {
    const data = StorageManager.getData();
    if (!Array.isArray(data.snippets)) {
      data.snippets = [];
      StorageManager.save();
    }
    return data.snippets;
  }
  const MAX_SNIPPETS = 100;
  function add(text, label = "", title = "") {
    const cleanText = String(text).trim();
    if (!cleanText) return null;
    const snippets = getAll();
    const item = {
      id: uuid(),
      text: cleanText,
      title: title.trim(),
      label: label.trim() || cleanText.slice(0, 26),
      timestamp: Date.now(),
    };
    snippets.unshift(item);
    if (snippets.length > MAX_SNIPPETS) snippets.length = MAX_SNIPPETS;
    StorageManager.save();
    return item;
  }
  function remove(id) {
    const snippets = getAll();
    const idx = snippets.findIndex((x) => x.id === id);
    if (idx !== -1) {
      snippets.splice(idx, 1);
      StorageManager.save();
    }
  }
  function copy(text) {
    if (!navigator.clipboard) return Promise.resolve(false);
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => false,
    );
  }
  return { getAll, add, remove, copy };
})();

const TagManager = (() => {
  const all = () => StorageManager.getData().tags;
  function normalize(t) {
    return (
      String(t)
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-_]/g, "")
        .slice(0, 30) || null
    );
  }
  function add(tag) {
    const n = normalize(tag);
    if (n && !all().includes(n)) {
      all().push(n);
      all().sort();
      StorageManager.save();
    }
    return n;
  }
  return { getAll: all, normalize, add };
})();
