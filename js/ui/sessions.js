"use strict";

const SessionManager = (() => {
  const list = () => {
    const d = StorageManager.getData();
    if (!Array.isArray(d.sessions)) d.sessions = [];
    return d.sessions;
  };

  const isWeb = (u) => typeof u === "string" && /^https?:\/\//i.test(u);

  function find(id) {
    return list().find((s) => s.id === id) || null;
  }

  function getAll() {
    return [...list()].sort((a, b) => b.ts - a.ts);
  }

  async function restore(id, { newWindow = false } = {}) {
    const s = find(id);
    if (!s) return false;

    const urls = s.tabs.map((t) => t.url).filter(isWeb);
    if (!urls.length) return false;

    if (!(HAS_EXT && EXT.tabs)) {
      urls.forEach((u) => window.open(safeHref(u), "_blank"));
      return true;
    }

    if (newWindow && EXT.windows?.create) {
      try {
        await EXT.windows.create({ url: urls });
        return true;
      } catch {
      }
    }

    for (const url of urls) {
      try {
        await EXT.tabs.create({ url: safeHref(url), active: false });
      } catch {}
    }
    return true;
  }

  async function openTab(url) {
    if (!isWeb(url)) return;
    if (HAS_EXT && EXT.tabs) {
      try {
        await EXT.tabs.create({ url: safeHref(url), active: false });
        return;
      } catch {}
    }
    window.open(safeHref(url), "_blank");
  }

  function rename(id, name) {
    const s = find(id);
    if (!s) return false;
    s.name = String(name || "").trim().slice(0, 60);
    StorageManager.saveImmediate();
    return true;
  }

  function remove(id) {
    const d = StorageManager.getData();
    const before = d.sessions.length;
    d.sessions = d.sessions.filter((s) => s.id !== id);
    if (d.sessions.length === before) return null;
    StorageManager.saveImmediate();
    return true;
  }

  function removeTab(id, url) {
    const s = find(id);
    if (!s) return false;
    s.tabs = s.tabs.filter((t) => t.url !== url);
    if (!s.tabs.length) return remove(id) ? "emptied" : false;
    StorageManager.saveImmediate();
    return true;
  }

  function toBoard(id) {
    const s = find(id);
    if (!s) return null;
    const board = BoardManager.addBoard(displayName(s));
    s.tabs.forEach((t) =>
      BookmarkManager.add(board.id, t.title, t.url, ["session"]),
    );
    return board;
  }

  function displayName(s) {
    if (s.name) return s.name;
    return new Date(s.ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function search(term) {
    const q = String(term || "").toLowerCase();
    if (!q) return [];
    const out = [];
    for (const s of getAll()) {
      const hit =
        displayName(s).toLowerCase().includes(q) ||
        s.tabs.some(
          (t) =>
            (t.title || "").toLowerCase().includes(q) ||
            t.url.toLowerCase().includes(q),
        );
      if (hit) out.push(s);
      if (out.length >= 5) break;
    }
    return out;
  }

  return {
    getAll,
    find,
    restore,
    openTab,
    rename,
    remove,
    removeTab,
    toBoard,
    displayName,
    search,
  };
})();

const ReadLaterManager = (() => {
  const isWeb = (u) => typeof u === "string" && /^https?:\/\//i.test(u);

  const list = () => {
    const d = StorageManager.getData();
    if (!Array.isArray(d.readLater)) d.readLater = [];
    return d.readLater;
  };

  function getAll() {
    return [...list()].sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return b.addedAt - a.addedAt;
    });
  }

  const unreadCount = () => list().filter((i) => !i.read).length;

  function normalizeUrl(raw) {
    const t = String(raw || "").trim();
    if (!t) return "";
    const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    try {
      const u = new URL(withScheme);
      return u.hostname.includes(".") ? u.href : "";
    } catch {
      return "";
    }
  }

  function add(url, title = "") {
    const clean = normalizeUrl(url);
    if (!isWeb(clean)) return null;

    const arr = list();
    const existing = arr.find((i) => i.url === clean);
    if (existing) {
      existing.addedAt = Date.now();
      existing.read = false;
      if (title) existing.title = String(title).slice(0, 300);
      StorageManager.saveImmediate();
      return existing;
    }

    const entry = {
      id: uuid(),
      url: clean,
      title: String(title || clean).slice(0, 300),
      addedAt: Date.now(),
      read: false,
    };
    arr.unshift(entry);
    if (arr.length > StorageManager.MAX_READ_LATER)
      arr.length = StorageManager.MAX_READ_LATER;
    StorageManager.saveImmediate();
    return entry;
  }

  function remove(id) {
    const d = StorageManager.getData();
    const before = list().length;
    d.readLater = list().filter((i) => i.id !== id);
    if (d.readLater.length === before) return false;
    StorageManager.saveImmediate();
    return true;
  }

  function setRead(id, read) {
    const item = list().find((i) => i.id === id);
    if (!item) return false;
    item.read = !!read;
    StorageManager.saveImmediate();
    return true;
  }

  function clearRead() {
    const d = StorageManager.getData();
    const before = list().length;
    d.readLater = list().filter((i) => !i.read);
    const removed = before - d.readLater.length;
    if (removed) StorageManager.saveImmediate();
    return removed;
  }

  async function open(id) {
    const item = list().find((i) => i.id === id);
    if (!item) return;
    setRead(id, true);
    if (HAS_EXT && EXT.tabs) {
      try {
        await EXT.tabs.create({ url: safeHref(item.url), active: true });
        return;
      } catch {}
    }
    window.open(safeHref(item.url), "_blank");
  }

  function toBoard() {
    const unread = list().filter((i) => !i.read);
    if (!unread.length) return null;
    const board = BoardManager.addBoard("Read later");
    unread.forEach((i) =>
      BookmarkManager.add(board.id, i.title, i.url, ["read-later"]),
    );
    return board;
  }

  function search(term) {
    const q = String(term || "").toLowerCase();
    if (!q) return [];
    return getAll()
      .filter(
        (i) =>
          i.title.toLowerCase().includes(q) || i.url.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }

  return {
    getAll,
    unreadCount,
    add,
    remove,
    setRead,
    clearRead,
    open,
    toBoard,
    search,
    normalizeUrl,
  };
})();

const WorkspaceManager = (() => {
  const list = () => {
    const d = StorageManager.getData();
    if (!Array.isArray(d.workspaces)) d.workspaces = [];
    return d.workspaces;
  };
  const isWeb = (u) => typeof u === "string" && /^https?:\/\//i.test(u);

  function getAll() {
    return [...list()].sort(
      (a, b) => (b.updatedAt || b.ts) - (a.updatedAt || a.ts),
    );
  }

  function find(id) {
    return list().find((w) => w.id === id) || null;
  }

  async function ensureTabsAccess() {
    if (!(HAS_EXT && EXT.tabs)) {
      ToastSystem.error("Workspace snapshots need the installed extension.");
      return false;
    }
    try {
      if (!EXT.permissions?.request) return true;
      if (await EXT.permissions.request({ permissions: ["tabs"] })) return true;
    } catch {}
    ToastSystem.info("Allow tab access to snapshot the tabs in this window.");
    return false;
  }

  async function captureWindow() {
    let tabs = [];
    try {
      tabs = await EXT.tabs.query({ currentWindow: true });
    } catch {
      return null;
    }
    return tabs
      .filter((t) => isWeb(t.url) && t.url !== location.href)
      .slice(0, 200)
      .map((t) => ({ title: String(t.title || t.url).slice(0, 300), url: t.url }));
  }

  async function snapshot({ name = "" } = {}) {
    if (!(await ensureTabsAccess())) return null;
    const tabs = await captureWindow();
    if (!tabs) {
      ToastSystem.error("Could not read the tabs in this window.");
      return null;
    }
    if (!tabs.length) {
      ToastSystem.info("No open web pages to snapshot.");
      return null;
    }
    const now = Date.now();
    const ws = {
      id: uuid(),
      name: String(name || "").trim().slice(0, 60),
      ts: now,
      updatedAt: now,
      tabs,
    };
    const arr = list();
    arr.unshift(ws);
    if (arr.length > StorageManager.MAX_WORKSPACES)
      arr.length = StorageManager.MAX_WORKSPACES;
    StorageManager.saveImmediate();
    return ws;
  }

  async function recapture(id) {
    const ws = find(id);
    if (!ws) return null;
    if (!(await ensureTabsAccess())) return null;
    const tabs = await captureWindow();
    if (!tabs || !tabs.length) {
      ToastSystem.info("No open web pages to capture.");
      return null;
    }
    ws.tabs = tabs;
    ws.updatedAt = Date.now();
    StorageManager.saveImmediate();
    return ws;
  }

  async function restore(id, { newWindow = true } = {}) {
    const ws = find(id);
    if (!ws) return false;
    const urls = ws.tabs.map((t) => t.url).filter(isWeb);
    if (!urls.length) return false;
    if (!(HAS_EXT && EXT.tabs)) {
      urls.forEach((u) => window.open(safeHref(u), "_blank", "noopener"));
      return true;
    }
    if (newWindow && EXT.windows?.create) {
      try {
        await EXT.windows.create({ url: urls, focused: true });
        return true;
      } catch {
      }
    }
    for (const url of urls) {
      try {
        await EXT.tabs.create({ url: safeHref(url), active: false });
      } catch {}
    }
    return true;
  }

  function makeBoard(name, tabs) {
    const board = BoardManager.addBoard(String(name || "Saved tabs").slice(0, 60));
    tabs.forEach((t) => BookmarkManager.add(board.id, t.title, t.url, ["workspace"]));
    StorageManager.saveImmediate();
    return board;
  }

  async function saveAsBoard(name = "") {
    if (!(await ensureTabsAccess())) return null;
    const tabs = await captureWindow();
    if (!tabs || !tabs.length) {
      ToastSystem.info("No open web pages to save.");
      return null;
    }
    const fallback = `Tabs, ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
    return makeBoard(String(name || "").trim() || fallback, tabs);
  }

  function toBoard(id) {
    const ws = find(id);
    return ws ? makeBoard(label(ws), ws.tabs) : null;
  }

  function rename(id, name) {
    const ws = find(id);
    if (!ws) return false;
    ws.name = String(name || "").trim().slice(0, 60);
    StorageManager.saveImmediate();
    return true;
  }

  function remove(id) {
    const d = StorageManager.getData();
    const before = list().length;
    d.workspaces = list().filter((w) => w.id !== id);
    if (d.workspaces.length === before) return false;
    StorageManager.saveImmediate();
    return true;
  }

  function label(ws) {
    if (ws.name) return ws.name;
    return new Date(ws.ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const rtf =
    typeof Intl !== "undefined" && Intl.RelativeTimeFormat
      ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
      : null;

  function ago(ts) {
    const diff = (ts - Date.now()) / 1000;
    if (Math.abs(diff) < 60) return "just now";
    const units = [
      ["year", 31536000],
      ["month", 2592000],
      ["week", 604800],
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60],
    ];
    for (const [unit, sec] of units) {
      if (Math.abs(diff) >= sec)
        return rtf
          ? rtf.format(Math.round(diff / sec), unit)
          : new Date(ts).toLocaleString();
    }
    return "just now";
  }

  function search(term) {
    const q = String(term || "").toLowerCase();
    if (!q) return [];
    return getAll()
      .filter(
        (w) =>
          label(w).toLowerCase().includes(q) ||
          w.tabs.some(
            (t) =>
              (t.title || "").toLowerCase().includes(q) ||
              t.url.toLowerCase().includes(q),
          ),
      )
      .slice(0, 5);
  }

  return {
    getAll,
    find,
    snapshot,
    recapture,
    restore,
    rename,
    remove,
    label,
    ago,
    search,
    saveAsBoard,
    toBoard,
  };
})();

const SessionsRenderer = (() => {
  let bound = false;

  const expanded = new Set();

  function open(paneName) {
    const pop = $("sessionsPopover");
    const btn = $("sessionsBtn");
    if (!pop || !btn) return;
    PopoverRegistry.closeAll("sessions");
    if (typeof paneName === "string") showPane(paneName);
    else render();
    pop.classList.add("open");
    btn.classList.add("is-active");
    PopoverRegistry.position(pop, btn, { width: 390 });
  }

  function close() {
    $("sessionsPopover")?.classList.remove("open");
    $("sessionsBtn")?.classList.remove("is-active");
  }

  function toggle() {
    const pop = $("sessionsPopover");
    if (!pop) return;
    pop.classList.contains("open") ? close() : open();
  }

  function isOpen() {
    return !!$("sessionsPopover")?.classList.contains("open");
  }

  function tabRowHtml(tab) {
    return `
      <div class="et-session-tab" data-url="${escapeHtml(tab.url)}">
        <img class="et-session-tab-fav" ${faviconAttr(tab.url)} alt="" width="14" height="14" />
        <span class="et-session-tab-title" title="${escapeHtml(tab.url)}">${escapeHtml(tab.title || tab.url)}</span>
        <button class="et-session-tab-later" data-act="to-read-later" title="Save to Read later" aria-label="Save ${escapeHtml(tab.title || tab.url)} to Read later">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </button>
        <button class="et-session-tab-del" data-act="drop-tab" title="Remove this tab" aria-label="Remove ${escapeHtml(tab.title || tab.url)}">&times;</button>
      </div>`;
  }

  function sessionHtml(s) {
    const isShowing = expanded.has(s.id);
    const count = s.tabs.length;
    return `
      <div class="et-session" data-id="${escapeHtml(s.id)}">
        <div class="et-session-head">
          <button class="et-session-toggle" data-act="expand" aria-expanded="${isShowing}" title="Show tabs">
            <svg class="et-session-chevron ${isShowing ? "is-open" : ""}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <div class="et-session-meta">
            <span class="et-session-name" data-act="rename" title="Double-click to rename">${escapeHtml(SessionManager.displayName(s))}</span>
            <span class="et-session-count">${count} tab${count === 1 ? "" : "s"}</span>
          </div>
          <div class="et-session-actions">
            <button class="et-session-btn" data-act="restore" title="Reopen in this window" aria-label="Reopen in this window">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>
            </button>
            <button class="et-session-btn" data-act="restore-window" title="Reopen in a new window" aria-label="Reopen in a new window">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
            </button>
            <button class="et-session-btn" data-act="board" title="Save these links to a board" aria-label="Save these links to a board">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
            <button class="et-session-btn danger" data-act="delete" title="Delete this session" aria-label="Delete this session">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            </button>
          </div>
        </div>
        ${isShowing ? `<div class="et-session-tabs">${s.tabs.map(tabRowHtml).join("")}</div>` : ""}
      </div>`;
  }

  let pane = "sessions";

  const PANES = { sessions: "sessionsPane", readLater: "readLaterPane", workspaces: "workspacesPane" };

  function showPane(next) {
    pane = PANES[next] ? next : "sessions";
    document.querySelectorAll("#sessionsPopover .et-pop-tab").forEach((t) => {
      const on = t.dataset.pane === pane;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));

      t.tabIndex = on ? 0 : -1;
    });
    Object.entries(PANES).forEach(([key, id]) => {
      const el = $(id);
      if (el) el.hidden = pane !== key;
    });
    render();
  }

  const openWorkspaces = new Set();

  const WS_ICONS = {
    window: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>',
    restore: '<path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/>',
    update: '<path d="M4 7h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="3.5"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>',
    board: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  };
  const wsIcon = (name) =>
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${WS_ICONS[name]}</svg>`;

  function wsTabHtml(t) {
    return `
      <div class="et-session-tab" data-url="${escapeHtml(t.url)}" role="button" tabindex="0">
        <img class="et-session-tab-fav" ${faviconAttr(t.url)} alt="" width="14" height="14" />
        <span class="et-session-tab-title" title="${escapeHtml(t.url)}">${escapeHtml(t.title || t.url)}</span>
      </div>`;
  }

  function workspaceHtml(ws) {
    const n = ws.tabs.length;
    const name = WorkspaceManager.label(ws);
    const showing = openWorkspaces.has(ws.id);
    const refreshed = ws.updatedAt && ws.updatedAt - ws.ts > 60000;
    const when = `${refreshed ? "Updated" : "Saved"} ${WorkspaceManager.ago(ws.updatedAt || ws.ts)}`;
    return `
      <div class="et-session et-ws" data-ws-id="${escapeHtml(ws.id)}">
        <div class="et-session-head">
          <button class="et-session-toggle" data-ws-act="expand" aria-expanded="${showing}" aria-label="${showing ? "Hide" : "Show"} tabs in ${escapeHtml(name)}">
            <svg class="et-session-chevron ${showing ? "is-open" : ""}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <div class="et-session-meta">
            <span class="et-session-name" data-ws-act="rename" title="Double-click or press F2 to rename">${escapeHtml(name)}</span>
            <span class="et-session-count">${n} tab${n === 1 ? "" : "s"} · ${escapeHtml(when)}</span>
          </div>
          <div class="et-session-actions">
            <button class="et-session-btn" data-ws-act="restore-window" data-tooltip="Restore in a new window" aria-label="Restore ${escapeHtml(name)} in a new window">${wsIcon("window")}</button>
            <button class="et-session-btn" data-ws-act="restore" data-tooltip="Restore in this window" aria-label="Restore ${escapeHtml(name)} in this window">${wsIcon("restore")}</button>
            <button class="et-session-btn" data-ws-act="update" data-tooltip="Replace with the tabs open now" aria-label="Replace ${escapeHtml(name)} with the tabs open now">${wsIcon("update")}</button>
            <button class="et-session-btn" data-ws-act="board" data-tooltip="Save as new board" aria-label="Save ${escapeHtml(name)} as a new board">${wsIcon("board")}</button>
            <button class="et-session-btn danger" data-ws-act="delete" data-tooltip="Delete" aria-label="Delete ${escapeHtml(name)}">${wsIcon("trash")}</button>
          </div>
        </div>
        ${showing ? `<div class="et-session-tabs">${ws.tabs.map(wsTabHtml).join("")}</div>` : ""}
      </div>`;
  }

  function renderWorkspaces() {
    const listEl = $("workspaceList");
    const badge = $("workspacesBadge");
    const all = WorkspaceManager.getAll();
    if (badge) badge.textContent = all.length;
    if (!listEl) return;
    setSafeHTML(
      listEl,
      all.length
        ? all.map(workspaceHtml).join("")
        : `<div class="et-session-empty">No workspaces yet.<br />Name what you are working on and snapshot the tabs you have open. Restore the whole set later in one click.</div>`,
    );
    wireFavicons(listEl);
  }

  function renameWorkspace(id) {
    const ws = WorkspaceManager.find(id);
    if (!ws) return;
    showPrompt("Rename workspace", "Name:", ws.name || "", (val) => {
      WorkspaceManager.rename(id, val);
      renderWorkspaces();
    });
  }

  function bindWorkspaces() {
    $("workspaceForm")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nameEl = $("workspaceName");
      const btn = $("workspaceSave");
      if (btn) btn.disabled = true;
      try {
        const ws = await WorkspaceManager.snapshot({
          name: nameEl?.value || "",
        });
        if (ws) {
          if (nameEl) nameEl.value = "";
          renderWorkspaces();
          const n = ws.tabs.length;
          ToastSystem.success(
            `Saved ${n} tab${n === 1 ? "" : "s"} as ${WorkspaceManager.label(ws)}`,
          );
        }
      } finally {
        if (btn) btn.disabled = false;
      }
    });

    $("workspaceToBoard")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const nameEl = $("workspaceName");
      btn.disabled = true;
      try {
        const board = await WorkspaceManager.saveAsBoard(nameEl?.value || "");
        if (board) {
          if (nameEl) nameEl.value = "";
          const n = (board.bookmarks || []).length;
          ToastSystem.action(
            `Saved ${n} link${n === 1 ? "" : "s"} to ${board.name}`,
            "Open board",
            () => {
              close();
              ViewController.show("boards");
              BoardRenderer.reveal(board.id);
            },
            "success",
          );
        }
      } finally {
        btn.disabled = false;
      }
    });

    const listEl = $("workspaceList");
    listEl?.addEventListener("click", async (e) => {
      const row = e.target.closest(".et-ws");
      if (!row) return;
      const id = row.dataset.wsId;
      const ws = WorkspaceManager.find(id);
      if (!ws) return;
      const act = e.target.closest("[data-ws-act]")?.dataset.wsAct;

      const tabRow = e.target.closest(".et-session-tab");
      if (tabRow && !act) {
        SessionManager.openTab(tabRow.dataset.url);
        return;
      }

      if (act === "expand") {
        if (openWorkspaces.has(id)) openWorkspaces.delete(id);
        else openWorkspaces.add(id);
        renderWorkspaces();
        listEl
          .querySelector(`[data-ws-id="${CSS.escape(id)}"] [data-ws-act="expand"]`)
          ?.focus();
        return;
      }

      if (act === "restore" || act === "restore-window") {
        const n = ws.tabs.length;
        const go = async () => {
          await WorkspaceManager.restore(id, { newWindow: act === "restore-window" });
          ToastSystem.success(
            `Restored ${WorkspaceManager.label(ws)} (${n} tab${n === 1 ? "" : "s"})`,
          );
        };
        if (n > 10) {
          showConfirm(
            "Restore this workspace?",
            `This opens ${n} tabs${act === "restore-window" ? " in a new window" : ""}.`,
            go,
            { tone: "info", confirmLabel: "Restore" },
          );
        } else {
          go();
        }
        return;
      }

      if (act === "update") {
        showConfirm(
          "Replace this snapshot?",
          `${WorkspaceManager.label(ws)} will hold the tabs open in this window now, instead of its ${ws.tabs.length}.`,
          async () => {
            const updated = await WorkspaceManager.recapture(id);
            if (updated) {
              renderWorkspaces();
              ToastSystem.success(`Updated ${WorkspaceManager.label(updated)}`);
            }
          },
          { tone: "info", confirmLabel: "Replace" },
        );
        return;
      }

      if (act === "board") {
        const board = WorkspaceManager.toBoard(id);
        if (board) {
          ToastSystem.action(
            `Saved ${ws.tabs.length} link${ws.tabs.length === 1 ? "" : "s"} to ${board.name}`,
            "Open board",
            () => {
              close();
              ViewController.show("boards");
              BoardRenderer.reveal(board.id);
            },
            "success",
          );
        }
        return;
      }

      if (act === "delete") {
        showConfirm(
          "Delete workspace?",
          `${WorkspaceManager.label(ws)} holds ${ws.tabs.length} tab${ws.tabs.length === 1 ? "" : "s"}. This cannot be undone.`,
          () => {
            WorkspaceManager.remove(id);
            openWorkspaces.delete(id);
            renderWorkspaces();
            ToastSystem.info("Workspace deleted");
          },
        );
      }
    });

    listEl?.addEventListener("dblclick", (e) => {
      const nameEl = e.target.closest('[data-ws-act="rename"]');
      if (nameEl) renameWorkspace(nameEl.closest(".et-ws")?.dataset.wsId);
    });

    listEl?.addEventListener("keydown", (e) => {
      const tabRow = e.target.closest?.(".et-session-tab");
      if (tabRow && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        SessionManager.openTab(tabRow.dataset.url);
        return;
      }
      if (e.key === "F2") {
        const row = e.target.closest?.(".et-ws");
        if (!row) return;
        e.preventDefault();
        renameWorkspace(row.dataset.wsId);
      }
    });
  }

  function readLaterHtml(item) {
    const when = new Date(item.addedAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    let host = item.url;
    try {
      host = new URL(item.url).hostname.replace(/^www\./, "");
    } catch {}

    return `
      <div class="et-readlater-item${item.read ? " is-read" : ""}" data-id="${escapeHtml(item.id)}">
        <button class="et-readlater-check" data-act="toggle-read"
                title="${item.read ? "Mark as unread" : "Mark as read"}"
                aria-label="${item.read ? "Mark as unread" : "Mark as read"}"
                aria-pressed="${item.read}">
          ${
            item.read
              ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
              : ""
          }
        </button>
        <div class="et-readlater-main" data-act="open" role="button" tabindex="0"
             title="${escapeHtml(item.url)}">
          <span class="et-readlater-title">${escapeHtml(item.title)}</span>
          <span class="et-readlater-meta">
            <img class="et-session-tab-fav" ${faviconAttr(item.url)} alt="" width="12" height="12" />
            ${escapeHtml(host)} &middot; ${escapeHtml(when)}
          </span>
        </div>
        <button class="et-session-tab-del" data-act="drop" title="Remove"
                aria-label="Remove ${escapeHtml(item.title)}">&times;</button>
      </div>`;
  }

  function renderReadLater() {
    const listEl = $("readLaterList");
    const badge = $("readLaterBadge");
    if (!listEl) return;

    const items = ReadLaterManager.getAll();
    const unread = ReadLaterManager.unreadCount();
    if (badge) badge.textContent = unread;

    setSafeHTML(
      listEl,
      items.length
        ? items.map(readLaterHtml).join("")
        : `<div class="et-session-empty">Nothing saved to read.<br />Hit <strong>Read later</strong> in the toolbar popup on any page, or send a tab here from a saved session.</div>`,
    );
    wireFavicons(listEl);

    const clearBtn = $("readLaterClearRead");
    if (clearBtn) clearBtn.disabled = items.length === unread;
    const boardBtn = $("readLaterToBoard");
    if (boardBtn) boardBtn.disabled = unread === 0;
  }

  function bindReadLater() {
    $("readLaterClearRead")?.addEventListener("click", () => {
      const n = ReadLaterManager.clearRead();
      renderReadLater();
      if (n) ToastSystem.info(`Cleared ${n} read item${n === 1 ? "" : "s"}`);
    });

    $("readLaterToBoard")?.addEventListener("click", () => {
      const board = ReadLaterManager.toBoard();
      if (!board) return;
      BoardRenderer.renderBoards();
      ToastSystem.success(`Saved to board ${board.name}`);
    });

    $("readLaterList")?.addEventListener("click", (e) => {
      const row = e.target.closest(".et-readlater-item");
      if (!row) return;
      const id = row.dataset.id;
      const act = e.target.closest("[data-act]")?.dataset.act;

      if (act === "drop") {
        ReadLaterManager.remove(id);
        renderReadLater();
        return;
      }
      if (act === "toggle-read") {
        const item = ReadLaterManager.getAll().find((i) => i.id === id);
        ReadLaterManager.setRead(id, !item?.read);
        renderReadLater();
        return;
      }
      if (act === "open") {
        ReadLaterManager.open(id);
        renderReadLater();
      }
    });

    $("readLaterList")?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const main = e.target.closest('[data-act="open"]');
      if (!main) return;
      e.preventDefault();
      ReadLaterManager.open(main.closest(".et-readlater-item").dataset.id);
      renderReadLater();
    });

    document
      .querySelectorAll("#sessionsPopover .et-pop-tab")
      .forEach((t) =>
        t.addEventListener("click", () => showPane(t.dataset.pane)),
      );
  }

  function render() {
    const listEl = $("sessionsPopList");
    const badge = $("sessionsPopBadge");
    if (!listEl) return;

    const sessions = SessionManager.getAll();
    if (badge) badge.textContent = sessions.length;

    setSafeHTML(
      listEl,
      sessions.length
        ? sessions.map(sessionHtml).join("")
        : `<div class="et-session-empty">No saved sessions yet.<br />Save a window from the EshaalTab button in your toolbar.</div>`,
    );
    wireFavicons(listEl);

    renderReadLater();
    renderWorkspaces();
  }

  function init() {
    const btn = $("sessionsBtn");
    const pop = $("sessionsPopover");
    if (!btn || !pop || bound) return;
    bound = true;

    btn.addEventListener("click", () => toggle());

    $("sessionsPopList")?.addEventListener("click", async (e) => {
      const row = e.target.closest(".et-session");
      if (!row) return;
      const id = row.dataset.id;
      const session = SessionManager.find(id);
      if (!session) return;

      const actEl = e.target.closest("[data-act]");
      const act = actEl?.dataset.act;

      if (act === "to-read-later") {
        const tabEl = e.target.closest(".et-session-tab");
        const tab = session.tabs.find((t) => t.url === tabEl?.dataset.url);
        if (tab && ReadLaterManager.add(tab.url, tab.title)) {
          renderReadLater();
          ToastSystem.success("Saved to read later");
        }
        return;
      }

      if (act === "drop-tab") {
        const url = e.target.closest(".et-session-tab")?.dataset.url;
        if (SessionManager.removeTab(id, url) === "emptied") expanded.delete(id);
        render();
        return;
      }

      const tabRow = e.target.closest(".et-session-tab");
      if (tabRow && !act) {
        SessionManager.openTab(tabRow.dataset.url);
        return;
      }

      if (act === "expand") {
        if (expanded.has(id)) expanded.delete(id);
        else expanded.add(id);
        render();
        return;
      }

      if (act === "restore" || act === "restore-window") {
        const many = session.tabs.length;
        const go = async () => {
          await SessionManager.restore(id, {
            newWindow: act === "restore-window",
          });
          ToastSystem.success(`Reopened ${many} tab${many === 1 ? "" : "s"}`);
        };

        if (many > 10) {
          showConfirm(
            "Reopen this session?",
            `This opens ${many} tabs${act === "restore-window" ? " in a new window" : ""}.`,
            go,
            { tone: "info", confirmLabel: "Reopen" },
          );
        } else {
          go();
        }
        return;
      }

      if (act === "board") {
        const board = SessionManager.toBoard(id);
        if (!board) return;
        BoardRenderer.renderBoards();
        ToastSystem.success(`Saved to board ${board.name}`);
        return;
      }

      if (act === "delete") {
        const label = SessionManager.displayName(session);
        const n = session.tabs.length;
        showConfirm(
          "Delete session?",
          `${label} holds ${n} tab${n === 1 ? "" : "s"}. This cannot be undone.`,
          () => {
            SessionManager.remove(id);
            expanded.delete(id);
            render();
            ToastSystem.info("Session deleted");
          },
        );
      }
    });

    $("sessionsPopList")?.addEventListener("dblclick", (e) => {
      const nameEl = e.target.closest(".et-session-name");
      if (!nameEl) return;
      const id = e.target.closest(".et-session")?.dataset.id;
      const session = SessionManager.find(id);
      if (!session) return;
      showPrompt("Rename session", "Session name:", session.name || "", (val) => {
        SessionManager.rename(id, val);
        render();
      });
    });

    bindReadLater();
    bindWorkspaces();

    $("sessionsPopover")
      ?.querySelector(".et-pop-tabs")
      ?.addEventListener("keydown", (e) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        const tabs = [...document.querySelectorAll("#sessionsPopover .et-pop-tab")];
        const i = tabs.indexOf(document.activeElement);
        if (i < 0) return;
        e.preventDefault();
        const n =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? tabs.length - 1
              : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        showPane(tabs[n].dataset.pane);
        tabs[n].focus();
      });

    PopoverRegistry.register("sessions", () => $("sessionsPopover"), close);
  }

  return { init, open, close, toggle, isOpen, render, showPane };
})();
