/* State managers layered over StorageManager: tabs, boards, bookmarks
   (add/move/search), notes, clipboard snippets, todos and tags.
   Every mutation persists itself. */
'use strict';

const TabManager = (() => {
  const TABS = ['home', 'boards', 'notes'];
  let localTab = null;

  function get() {
    if (localTab) return localTab;
    const t = StorageManager.getSettings().activeTab;
    localTab = TABS.includes(t) ? t : 'home';
    return localTab;
  }
  function set(tab) {
    if (!TABS.includes(tab)) return;
    localTab = tab;
    StorageManager.getSettings().activeTab = tab;
    /* Don't call StorageManager.save() here. activeTab is a per-instance
       UI state, not a cross-tab setting. Writing it to storage immediately
       fires onChanged in every other open tab, causing a repaintAll() loop
       that makes views fight each other. The value is still persisted on
       pagehide / visibilitychange flush so the next new tab opens on the
       last-used view. */
  }
  return { TABS, get, set };
})();
const BoardManager = (() => {
  const boards = () => StorageManager.getData().boards;

  function addBoard(name = '', targetCol = null) {
    if (!name) name = 'New board';
    const board = {
      id: uuid(), name: name.trim(),
      color: StorageManager.getSettings().accentColor,
      col: targetCol, order: boards().length,
      pinnedToHome: false, bookmarks: []
    };
    boards().push(board);
    StorageManager.save();
    return board;
  }
  function find(id) {
    return boards().find(b => b.id === id) || null;
  }
  function deleteBoard(id) {
    const d = StorageManager.getData();
    d.boards = d.boards.filter(b => b.id !== id);
    StorageManager.save();
  }
  function rename(id, name) {
    const b = find(id);
    if (b) { b.name = name.trim(); StorageManager.save(); }
  }
  function restoreBoard(board, index) {
    const arr = boards();
    const i = (Number.isInteger(index) && index >= 0) ? Math.min(index, arr.length) : arr.length;
    arr.splice(i, 0, board);
    StorageManager.save();
  }
  function reorder(fromId, toId, after) {
    const arr = boards();
    const from = arr.findIndex(b => b.id === fromId);
    if (from < 0) return;
    const [moved] = arr.splice(from, 1);
    const to = arr.findIndex(b => b.id === toId);
    if (to < 0) { arr.splice(from, 0, moved); return; }
    const targetBoard = arr[to];
    if (targetBoard && targetBoard.col != null) {
      moved.col = targetBoard.col;
    }
    arr.splice(after ? to + 1 : to, 0, moved);
    arr.forEach((b, i) => b.order = i);
    StorageManager.save();
  }
  function shift(id, delta) {
    const arr = boards();
    const i = arr.findIndex(b => b.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= arr.length) return false;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    const col = arr[j].col;
    arr[i].col = arr[j].col = col;
    arr.forEach((b, k) => b.order = k);
    StorageManager.save();
    return true;
  }
  return { addBoard, find, deleteBoard, rename, restoreBoard, reorder, shift, getAll: boards };
})();

const BookmarkManager = (() => {
  const boards = () => StorageManager.getData().boards;

  function normalizeUrl(raw) {
    const s = String(raw || '').trim();
    if (!s) return null;
    if (/^(javascript|data|vbscript|blob):/i.test(s.replace(/[\s - ]/g, ''))) return null;
    if (/^https?:\/\//i.test(s)) return s;
    if (/^(chrome|edge|about|moz-extension|chrome-extension|file):/i.test(s)) return s;
    if (/^(localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?(\/.*)?$/i.test(s)) return 'http://' + s;
    return 'https://' + s;
  }

  function add(boardId, title, url, tags = [], nickname = '') {
    const b = BoardManager.find(boardId);
    if (!b) return null;
    const safe = normalizeUrl(url);
    if (!safe) return null;
    const norm = tags.map(TagManager.normalize).filter(Boolean);
    norm.forEach(TagManager.add);
    const bm = { id: uuid(), title: String(title || safe).trim().slice(0, 300), nickname: String(nickname || '').trim().slice(0, 60), url: safe, tags: norm, order: b.bookmarks.length };
    b.bookmarks.push(bm);
    StorageManager.save();
    return bm;
  }
  function edit(boardId, bmId, title, url, tags, nickname = '') {
    const b = BoardManager.find(boardId);
    const bm = b && b.bookmarks.find(x => x.id === bmId);
    if (!bm) return;
    const safe = normalizeUrl(url);
    if (!safe) return;
    bm.title = String(title || safe).trim().slice(0, 300);
    bm.nickname = String(nickname || '').trim().slice(0, 60);
    bm.url = safe;
    bm.tags = (tags || []).map(TagManager.normalize).filter(Boolean);
    bm.tags.forEach(TagManager.add);
    StorageManager.save();
  }
  function remove(boardId, bmId) {
    const b = BoardManager.find(boardId);
    if (!b) return;
    b.bookmarks = b.bookmarks.filter(x => x.id !== bmId);
    StorageManager.save();
  }
  function insertAt(boardId, bm, index) {
    const b = BoardManager.find(boardId);
    if (!b) return;
    const i = (Number.isInteger(index) && index >= 0) ? Math.min(index, b.bookmarks.length) : b.bookmarks.length;
    b.bookmarks.splice(i, 0, bm);
    StorageManager.save();
  }
  function move(srcBoardId, destBoardId, bmId, beforeId) {
    const arr = boards();
    const src = arr.find(b => b.id === srcBoardId);
    const dest = arr.find(b => b.id === destBoardId);
    if (!src || !dest) return;
    const i = src.bookmarks.findIndex(x => x.id === bmId);
    if (i < 0) return;
    const [bm] = src.bookmarks.splice(i, 1);
    const at = beforeId ? dest.bookmarks.findIndex(x => x.id === beforeId) : dest.bookmarks.length;
    dest.bookmarks.splice(at < 0 ? dest.bookmarks.length : at, 0, bm);
    StorageManager.save();
  }
  function searchAll(query) {
    const isTag = query.startsWith('#');
    const term = (isTag ? query.slice(1) : query).toLowerCase();
    const out = [];
    const LIMIT = 25;
    for (const board of boards()) {
      for (const bm of board.bookmarks) {
        const hit = isTag
          ? (bm.tags || []).some(t => t.includes(term))
          : bm.title.toLowerCase().includes(term) || bm.url.toLowerCase().includes(term) ||
            (bm.tags || []).some(t => t.includes(term));
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
      for (const bm of (board.bookmarks || [])) {
        if (bm.pinnedToHome) out.push({ ...bm, boardId: board.id, boardName: board.name });
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
    return getPinned().some(bm => bm.id === bmId);
  }
  function countPinned() {
    return getPinned().length;
  }
  function togglePin(boardId, bmId) {
    const b = BoardManager.find(boardId);
    const bm = b && (b.bookmarks || []).find(x => x.id === bmId);
    if (!bm) return null;
    if (!bm.pinnedToHome && countPinned() >= PIN_LIMIT) return null;
    bm.pinnedToHome = !bm.pinnedToHome;
    if (!bm.pinnedToHome) delete bm.pinnedToHome;
    StorageManager.save();
    return !!bm.pinnedToHome;
  }
  function unpin(bmId) {
    for (const board of boards()) {
      const bm = (board.bookmarks || []).find(x => x.id === bmId);
      if (bm && bm.pinnedToHome) { delete bm.pinnedToHome; StorageManager.save(); return true; }
    }
    return false;
  }

  return { add, edit, remove, insertAt, move, searchAll, normalizeUrl,
           getPinned, isPinned, countPinned, togglePin, unpin, reorderPinned, PIN_LIMIT };
})();

const NotesManager = (() => {
  const MAX_HISTORY = 25;

  function get() { return StorageManager.getData().notes || ''; }
  function set(text) { StorageManager.getData().notes = text; StorageManager.save(); }
  /* Same as set(), but forces the write to disk instead of waiting on the
     debounce. Used for the manual "Save" button and before a history recall
     overwrites the field, so the version you're about to leave is durable. */
  function setImmediate(text) { StorageManager.getData().notes = text; StorageManager.saveImmediate(); }

  function getHistory() {
    const d = StorageManager.getData();
    return Array.isArray(d.notesHistory) ? d.notesHistory : (d.notesHistory = []);
  }
  /* One checkpoint per "editing session" (see the focus/blur pairing in
     NotesRenderer), not per keystroke -- a history entry per character would
     make the recall list useless. */
  function pushHistory(text) {
    const t = String(text || '');
    if (!t.trim()) return;
    const hist = getHistory();
    if (hist[0] === t) return;
    hist.unshift(t);
    if (hist.length > MAX_HISTORY) hist.length = MAX_HISTORY;
    StorageManager.save();
  }

  function exportTxt() {
    const blob = new Blob([get()], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `eshaaltab-notes-${new Date().toLocaleDateString('sv')}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return { get, set, setImmediate, getHistory, pushHistory, exportTxt };
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
  function add(text, label = '', title = '') {
    const cleanText = String(text).trim();
    if (!cleanText) return null;
    const snippets = getAll();
    const item = {
      id: uuid(),
      text: cleanText,
      title: title.trim(),
      label: label.trim() || cleanText.slice(0, 26),
      timestamp: Date.now()
    };
    snippets.unshift(item);
    if (snippets.length > MAX_SNIPPETS) snippets.length = MAX_SNIPPETS;
    StorageManager.save();
    return item;
  }
  function remove(id) {
    const snippets = getAll();
    const idx = snippets.findIndex(x => x.id === id);
    if (idx !== -1) {
      snippets.splice(idx, 1);
      StorageManager.save();
    }
  }
  function copy(text) {
    if (!navigator.clipboard) return Promise.resolve(false);
    return navigator.clipboard.writeText(text).then(() => true, () => false);
  }
  return { getAll, add, remove, copy };
})();

const TodoManager = (() => {
  const list = () => StorageManager.getData().todos;
  function getAll() {
    const todos = list();
    return todos.map((t, i) => ({ t, i }))
      .sort((a, b) => ((b.t.pinned ? 1 : 0) - (a.t.pinned ? 1 : 0)) || (a.i - b.i))
      .map(x => x.t);
  }
  function shift(id, delta) {
    const arr = list();
    const item = arr.find(t => t.id === id);
    if (!item) return false;

    const section = arr.filter(t => !!t.pinned === !!item.pinned);
    const secIndex = section.findIndex(t => t.id === id);
    const targetSecIndex = secIndex + delta;

    if (secIndex < 0 || targetSecIndex < 0 || targetSecIndex >= section.length) return false;

    const targetItem = section[targetSecIndex];
    const realIdxA = arr.indexOf(item);
    const realIdxB = arr.indexOf(targetItem);

    if (realIdxA < 0 || realIdxB < 0) return false;

    [arr[realIdxA], arr[realIdxB]] = [arr[realIdxB], arr[realIdxA]];
    StorageManager.save();
    return true;
  }
  function add(text) {
    const t = { id: uuid(), text: String(text).trim(), done: false, pinned: false };
    if (!t.text) return null;
    list().push(t);
    StorageManager.save();
    return t;
  }
  function toggle(id) {
    const t = list().find(x => x.id === id);
    if (t) { t.done = !t.done; StorageManager.save(); }
  }
  function togglePin(id) {
    const t = list().find(x => x.id === id);
    if (t) { t.pinned = !t.pinned; StorageManager.save(); }
  }
  function edit(id, newText) {
    const clean = String(newText || '').trim();
    if (!clean) {
      remove(id);
      return;
    }
    const t = list().find(x => x.id === id);
    if (t) { t.text = clean; StorageManager.save(); }
  }
  function remove(id) {
    const d = StorageManager.getData();
    d.todos = d.todos.filter(x => x.id !== id);
    StorageManager.save();
  }
  function insertAt(todo, index) {
    const arr = list();
    const i = (Number.isInteger(index) && index >= 0) ? Math.min(index, arr.length) : arr.length;
    arr.splice(i, 0, todo);
    StorageManager.save();
  }
  function clearDone() {
    const d = StorageManager.getData();
    d.todos = d.todos.filter(t => !t.done);
    StorageManager.save();
  }
  return { getAll, add, toggle, togglePin, edit, remove, insertAt, clearDone, shift };
})();

const TagManager = (() => {
  const all = () => StorageManager.getData().tags;
  function normalize(t) {
    return String(t).toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '').slice(0, 30) || null;
  }
  function add(tag) {
    const n = normalize(tag);
    if (n && !all().includes(n)) { all().push(n); all().sort(); StorageManager.save(); }
    return n;
  }
  return { getAll: all, normalize, add };
})();
