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
    StorageManager.getSettings().activeTab = tab;
  }
  return { TABS, get, set };
})();
const BoardManager = (() => {
  const boards = () => StorageManager.getData().boards;

  function addBoard(name = "", targetCol = null) {
    if (!name) name = "New board";
    const board = {
      id: uuid(),
      name: name.trim(),
      color: StorageManager.getSettings().accentColor,
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
    d.boards = d.boards.filter((b) => b.id !== id);
    StorageManager.save();
  }
  function rename(id, name) {
    const b = find(id);
    if (b) {
      b.name = name.trim();
      StorageManager.save();
    }
  }
  function restoreBoard(board, index) {
    const arr = boards();
    const i =
      Number.isInteger(index) && index >= 0
        ? Math.min(index, arr.length)
        : arr.length;
    arr.splice(i, 0, board);
    StorageManager.save();
  }
  function reorder(fromId, toId, after) {
    const arr = boards();
    const from = arr.findIndex((b) => b.id === fromId);
    if (from < 0) return;
    const [moved] = arr.splice(from, 1);
    const to = arr.findIndex((b) => b.id === toId);
    if (to < 0) {
      arr.splice(from, 0, moved);
      return;
    }
    const targetBoard = arr[to];
    if (targetBoard && targetBoard.col != null) {
      moved.col = targetBoard.col;
    }
    arr.splice(after ? to + 1 : to, 0, moved);
    arr.forEach((b, i) => (b.order = i));
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
  return {
    addBoard,
    find,
    deleteBoard,
    rename,
    restoreBoard,
    reorder,
    shift,
    getAll: boards,
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
      title: String(title || safe)
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
    bm.title = String(title || safe)
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

  // Guarantees at least one tab exists before any read/write, so callers never
  // have to null-check. Storage normalises on load; this covers live edits.
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

  // `get`/`set` operate on the active tab, so every existing caller (the
  // editor, export, the search index) keeps working without changes.
  function get() {
    return activeTab().text || "";
  }

  // Set when a write had to drop characters, so the UI can say so once rather
  // than the note quietly coming up short.
  let truncated = false;

  function write(text) {
    const t = activeTab();
    const full = String(text ?? "");
    truncated = full.length > MAX_CHARS;
    t.text = truncated ? full.slice(0, MAX_CHARS) : full;
    t.updatedAt = Date.now();
    StorageManager.getData().notes = t.text; // legacy mirror
    return t;
  }

  /** Whether the last write was cut short, and by how much. */
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
    if (list.length <= 1) return false; // always keep one note
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

const TodoManager = (() => {
  const list = () => StorageManager.getData().todos;
  function getAll() {
    const todos = list();
    return todos
      .map((t, i) => ({ t, i }))
      .sort((a, b) => (b.t.pinned ? 1 : 0) - (a.t.pinned ? 1 : 0) || a.i - b.i)
      .map((x) => x.t);
  }
  function shift(id, delta) {
    const arr = list();
    const item = arr.find((t) => t.id === id);
    if (!item) return false;

    const section = arr.filter((t) => !!t.pinned === !!item.pinned);
    const secIndex = section.findIndex((t) => t.id === id);
    const targetSecIndex = secIndex + delta;

    if (secIndex < 0 || targetSecIndex < 0 || targetSecIndex >= section.length)
      return false;

    const targetItem = section[targetSecIndex];
    const realIdxA = arr.indexOf(item);
    const realIdxB = arr.indexOf(targetItem);

    if (realIdxA < 0 || realIdxB < 0) return false;

    [arr[realIdxA], arr[realIdxB]] = [arr[realIdxB], arr[realIdxA]];
    StorageManager.save();
    return true;
  }
  /**
   * Pins down what a bare time in the task text means, using the clock at the
   * moment it was typed. "2:20" entered at 1pm is 14:20, not 02:20 tomorrow.
   * Stored on the todo so later reads don't re-guess and drift.
   */
  function stampReminder(t) {
    if (typeof ReminderKit === "undefined") return t;
    const parsed = ReminderKit.parseTime(t.text);
    if (!parsed) {
      delete t.remindH;
      delete t.remindM;
      return t;
    }
    t.remindH = ReminderKit.resolveHour(parsed);
    t.remindM = parsed.min;
    return t;
  }

  function add(text) {
    const t = {
      id: uuid(),
      text: String(text).trim(),
      done: false,
      pinned: false,
    };
    if (!t.text) return null;
    stampReminder(t);
    list().push(t);
    StorageManager.save();
    return t;
  }
  function toggle(id) {
    const t = list().find((x) => x.id === id);
    if (t) {
      t.done = !t.done;
      StorageManager.save();
    }
  }
  function togglePin(id) {
    const t = list().find((x) => x.id === id);
    if (t) {
      t.pinned = !t.pinned;
      StorageManager.save();
    }
  }
  function edit(id, newText) {
    const clean = String(newText || "").trim();
    if (!clean) {
      remove(id);
      return;
    }
    const t = list().find((x) => x.id === id);
    if (t) {
      t.text = clean;
      stampReminder(t);
      StorageManager.save();
    }
  }
  function remove(id) {
    const d = StorageManager.getData();
    d.todos = d.todos.filter((x) => x.id !== id);
    StorageManager.save();
  }
  function insertAt(todo, index) {
    const arr = list();
    const i =
      Number.isInteger(index) && index >= 0
        ? Math.min(index, arr.length)
        : arr.length;
    arr.splice(i, 0, todo);
    StorageManager.save();
  }
  function clearDone() {
    const d = StorageManager.getData();
    d.todos = d.todos.filter((t) => !t.done);
    StorageManager.save();
  }
  return {
    getAll,
    add,
    toggle,
    togglePin,
    edit,
    remove,
    insertAt,
    clearDone,
    shift,
  };
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
