"use strict";

const PinnedBoards = (() => {
  const MAX_PINNED = 6;
  let activeId = null;
  let bound = false;

  const btnEl = () => $("pinnedBoardsBtn");
  const panelEl = () => $("pinnedBoardsPanel");
  const pinned = () => BoardManager.getAll().filter((b) => b.pinnedToHome);
  const enabled = () =>
    StorageManager.getSettings().widgets?.pinnedBoards !== false;

  const isPinned = (id) => !!BoardManager.find(id)?.pinnedToHome;

  const shown = () => pinned();

  function togglePin(id) {
    const board = BoardManager.find(id);
    if (!board) return null;
    if (!board.pinnedToHome && pinned().length >= MAX_PINNED) {
      ToastSystem.info(`Up to ${MAX_PINNED} boards can be pinned to Home.`);
      return null;
    }
    if (board.pinnedToHome) delete board.pinnedToHome;
    else board.pinnedToHome = true;
    StorageManager.save();
    render();
    return !!board.pinnedToHome;
  }

  const isOpen = () => !!panelEl()?.classList.contains("open");

  function render() {
    if (!enabled()) {
      close();
      return;
    }
    const list = shown();
    if (!list.some((b) => b.id === activeId)) activeId = list[0]?.id || null;
    if (isOpen()) paint();
  }

  function paintEmpty(panel) {
    const boards = BoardManager.getAll();
    const rows = boards.length
      ? boards
          .map(
            (b) =>
              `<button type="button" class="et-pb-pick-row" data-act="pin" data-board="${escapeHtml(b.id)}"><span class="et-pb-pick-name">${escapeHtml(b.name)}</span><span class="et-pb-pick-meta">Pin</span></button>`,
          )
          .join("")
      : `<button type="button" class="et-pb-pick-row" data-act="go-boards"><span class="et-pb-pick-name">Go to Boards</span></button>`;
    setSafeHTML(
      panel,
      `
      <div class="et-pb-head"><div class="et-pb-title">Pin a board</div></div>
      <div class="et-pb-intro">${boards.length ? "Pinned boards open right here on Home." : "Make a board first, then pin it here."}</div>
      <div class="et-pb-pick">${rows}</div>`,
    );
  }

  function paint() {
    const panel = panelEl();
    const list = shown();
    if (!panel) return;
    if (!list.length) {
      paintEmpty(panel);
      return;
    }
    const board = list.find((b) => b.id === activeId) || list[0];
    activeId = board.id;

    const tabs = list
      .map((b) => {
        const on = b.id === board.id;
        return `<button type="button" class="et-pb-tab${on ? " is-active" : ""}" role="tab" id="pbTab-${escapeHtml(b.id)}" aria-selected="${on}" aria-controls="pbGrid" tabindex="${on ? 0 : -1}" data-board="${escapeHtml(b.id)}">${escapeHtml(b.name)}</button>`;
      })
      .join("");

    const links = board.bookmarks || [];
    const grid = links.length
      ? links
          .map(
            (bm) => `
        <a class="et-pb-link" href="${escapeHtml(safeHref(bm.url))}" title="${escapeHtml(bm.url)}">
          <img class="et-pb-fav" ${faviconAttr(bm.url)} alt="" width="22" height="22" />
          <span class="et-pb-name">${escapeHtml(bm.title || bm.url)}</span>
        </a>`,
          )
          .join("")
      : `<div class="et-pb-empty">No links on this board yet.</div>`;

    setSafeHTML(
      panel,
      `
      <div class="et-pb-head">
        <div class="et-pb-tabs" role="tablist" aria-label="Pinned boards">${tabs}</div>
        <button type="button" class="et-pb-edit" data-act="edit" data-tooltip="Edit on Boards" aria-label="Edit ${escapeHtml(board.name)} on Boards">${icon("edit", 16)}</button>
      </div>
      <div class="et-pb-grid" id="pbGrid" role="tabpanel" aria-labelledby="pbTab-${escapeHtml(board.id)}">${grid}</div>`,
    );
    wireFavicons(panel);
  }

  function open(focusInside = false) {
    const btn = btnEl();
    const panel = panelEl();
    if (!btn || !panel) return;
    PopoverRegistry.closeAll("pinned-boards");
    paint();
    panel.classList.add("open");

    PopoverRegistry.position(panel, btn, {
      width: Math.min(480, window.innerWidth - 48),
    });
    btn.setAttribute("aria-expanded", "true");
    if (focusInside)
      panel.querySelector(".et-pb-tab.is-active, .et-pb-pick-row")?.focus();
  }

  function close(returnFocus = false) {
    const panel = panelEl();
    if (!panel?.classList.contains("open")) return;
    panel.classList.remove("open");
    const btn = btnEl();
    btn?.setAttribute("aria-expanded", "false");
    if (returnFocus) btn?.focus();
  }

  function toggle(focusInside = false) {
    if (isOpen()) close();
    else open(focusInside);
  }

  function selectTab(id) {
    activeId = id;
    paint();
    panelEl()?.querySelector(".et-pb-tab.is-active")?.focus();
  }

  function init() {
    const panel = panelEl();
    if (bound || !panel) return;
    bound = true;

    window.addEventListener("resize", () => close(), { passive: true });

    panel.addEventListener("click", (e) => {
      if (e.target.closest(".et-pb-tab, .et-pb-pick-row")) e.stopPropagation();
      const pick = e.target.closest('[data-act="pin"]');
      if (pick) {
        if (togglePin(pick.dataset.board)) {
          activeId = pick.dataset.board;
          paint();
          panel.querySelector(".et-pb-tab.is-active")?.focus();
        }
        return;
      }
      if (e.target.closest('[data-act="go-boards"]')) {
        close();
        ViewController.show("boards");
        return;
      }
      const tab = e.target.closest(".et-pb-tab");
      if (tab) {
        selectTab(tab.dataset.board);
        return;
      }
      if (e.target.closest('[data-act="edit"]')) {
        const id = activeId;
        close();
        ViewController.show("boards");
        BoardRenderer.reveal(id);
        return;
      }

      if (e.target.closest(".et-pb-link")) close();
    });

    panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close(true);
        return;
      }
      const tab = e.target.closest?.(".et-pb-tab");
      if (tab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const tabs = [...panel.querySelectorAll(".et-pb-tab")];
        const i = tabs.indexOf(tab);
        const n =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? tabs.length - 1
              : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        selectTab(tabs[n].dataset.board);
        return;
      }
      if (tab && e.key === "ArrowDown") {
        e.preventDefault();
        panel.querySelector(".et-pb-link")?.focus();
        return;
      }

      const link = e.target.closest?.(".et-pb-link");
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -2, ArrowDown: 2 }[e.key];
      if (link && step) {
        e.preventDefault();
        const links = [...panel.querySelectorAll(".et-pb-link")];
        const next = links[links.indexOf(link) + step];
        if (next) next.focus();
        else if (step < 0) panel.querySelector(".et-pb-tab.is-active")?.focus();
      }
    });

    PopoverRegistry.register("pinned-boards", panelEl, () => close());
    render();
  }

  return {
    init,
    render,
    open,
    close,
    toggle,
    togglePin,
    isPinned,
    isOpen,
    enabled,
    MAX_PINNED,
  };
})();
