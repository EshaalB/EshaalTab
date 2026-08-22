"use strict";

/**
 * Saved windows of tabs.
 *
 * This grew out of the toolbar popup's "stash all tabs" button, which could
 * only dump a window and reopen it into whatever window happened to be
 * focused. Sessions keep the same one-click capture but add the parts that
 * make it a replacement for a dedicated session manager: names, reopening
 * into a fresh window, and per-tab control so one dead link doesn't force you
 * to restore all forty.
 *
 * Everything lives in `data.sessions`, so sessions are included in backups —
 * the old top-level `tabStashes` key never was.
 */
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

  /** Newest first, which is the order the UI always wants. */
  function getAll() {
    return [...list()].sort((a, b) => b.ts - a.ts);
  }

  function countTabs() {
    return list().reduce((n, s) => n + (s.tabs?.length || 0), 0);
  }

  /**
   * Captures the current window.
   * @param {{name?:string, closeAfter?:boolean}} opts
   * @returns {Promise<{session:Object, closed:number}|null>}
   */
  async function saveCurrentWindow({ name = "", closeAfter = true } = {}) {
    if (!(HAS_EXT && EXT.tabs)) {
      ToastSystem.error("Saving sessions needs the installed extension.");
      return null;
    }

    let tabs = [];
    try {
      tabs = (await EXT.tabs.query({ currentWindow: true })).filter((t) =>
        isWeb(t.url),
      );
    } catch {
      ToastSystem.error("Could not read the tabs in this window.");
      return null;
    }

    // The new tab page itself is not worth saving, and closing it would shut
    // the page the user is looking at.
    const saveable = tabs.filter((t) => t.url !== location.href);
    if (!saveable.length) {
      ToastSystem.info("No open web pages to save.");
      return null;
    }

    const session = {
      id: uuid(),
      name: String(name || "").trim().slice(0, 60),
      ts: Date.now(),
      tabs: saveable.map((t) => ({ title: t.title || t.url, url: t.url })),
    };

    const arr = list();
    arr.unshift(session);
    if (arr.length > StorageManager.MAX_SESSIONS)
      arr.length = StorageManager.MAX_SESSIONS;
    StorageManager.saveImmediate();

    let closed = 0;
    if (closeAfter) {
      const ids = saveable.map((t) => t.id).filter((id) => id != null);
      try {
        if (ids.length) {
          await EXT.tabs.remove(ids);
          closed = ids.length;
        }
      } catch {}
    }

    return { session, closed };
  }

  /**
   * Reopens a session.
   * @param {string} id
   * @param {{newWindow?:boolean}} opts Opening into a new window keeps the
   *   restored set separate from whatever the user is already doing.
   */
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
        // Falls through to per-tab opening below.
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

  /** Drops one tab, deleting the whole session once the last one goes. */
  function removeTab(id, url) {
    const s = find(id);
    if (!s) return false;
    s.tabs = s.tabs.filter((t) => t.url !== url);
    if (!s.tabs.length) return remove(id) ? "emptied" : false;
    StorageManager.saveImmediate();
    return true;
  }

  /** Saves every link in a session into a board, for anything worth keeping. */
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
    countTabs,
    saveCurrentWindow,
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

/**
 * The Sessions popover, anchored to its topbar button the same way as the
 * task and app-launcher popovers.
 */
const SessionsRenderer = (() => {
  let bound = false;
  // Which sessions are showing their tab list. Kept in memory rather than in
  // storage: it is view state, not something worth persisting or syncing.
  const expanded = new Set();

  function open() {
    const pop = $("sessionsPopover");
    const btn = $("sessionsBtn");
    if (!pop || !btn) return;
    PopoverRegistry.closeAll("sessions");
    render();
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
        : `<div class="et-session-empty">No saved sessions yet.<br />Use <strong>Save this window</strong> to put your open tabs somewhere safe.</div>`,
    );
    wireFavicons(listEl);
  }

  function init() {
    const btn = $("sessionsBtn");
    const pop = $("sessionsPopover");
    if (!btn || !pop || bound) return;
    bound = true;

    btn.addEventListener("click", () => toggle());

    $("sessionsSaveBtn")?.addEventListener("click", async () => {
      const saveBtn = $("sessionsSaveBtn");
      saveBtn.disabled = true;
      try {
        const keepOpen = !!$("sessionsKeepOpen")?.checked;
        const result = await SessionManager.saveCurrentWindow({
          closeAfter: !keepOpen,
        });
        if (!result) return;
        render();
        const n = result.session.tabs.length;
        ToastSystem.success(
          `Saved ${n} tab${n === 1 ? "" : "s"}` +
            (result.closed ? ` and closed ${result.closed}` : ""),
        );
      } finally {
        saveBtn.disabled = false;
      }
    });

    // One delegated handler for the whole list, so re-rendering never leaves
    // stale listeners behind.
    $("sessionsPopList")?.addEventListener("click", async (e) => {
      const row = e.target.closest(".et-session");
      if (!row) return;
      const id = row.dataset.id;
      const session = SessionManager.find(id);
      if (!session) return;

      const actEl = e.target.closest("[data-act]");
      const act = actEl?.dataset.act;

      if (act === "drop-tab") {
        const url = e.target.closest(".et-session-tab")?.dataset.url;
        if (SessionManager.removeTab(id, url) === "emptied") expanded.delete(id);
        render();
        return;
      }

      // Clicking a tab row (but not its delete button) opens that one tab.
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
        // Reopening dozens of tabs at once is slow and hard to undo, so it is
        // worth one confirmation.
        if (many > 10) {
          showConfirm(
            "Reopen this session?",
            `This opens ${many} tabs${act === "restore-window" ? " in a new window" : ""}.`,
            go,
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

    PopoverRegistry.register("sessions", () => $("sessionsPopover"), close);
  }

  return { init, open, close, toggle, isOpen, render };
})();
