"use strict";

/**
 * Pinned boards on Home.
 *
 * Any board can be pinned from its menu. Pinned boards open from a board button
 * at the end of the pinned links: a panel with a tab per board and that board's
 * links in a grid, so a whole set of links - every AI tool, every social site -
 * is two clicks away without taking room from the clock and the search bar.
 * Pinned links stay the one-click row; this is for the sets.
 */
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

  // What the panel shows: the pinned boards, or - until any are pinned -
  // every board. Opening it goes straight to a board's heading and its links;
  // an earlier version first showed a list of boards to pin, so seeing any
  // links at all took a second click.
  const shown = () => {
    const list = pinned();
    return list.length ? list : BoardManager.getAll().slice(0, MAX_PINNED);
  };

  /** @returns {boolean|null} The new state, or null when nothing changed. */
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

  /**
   * Closes the panel when the feature is off, and repaints it if it is open.
   *
   * The button follows the setting alone. It used to stay hidden until a board
   * had been pinned, so switching the feature on showed nothing at all - and
   * the only way to pin was a menu on another page nobody had reason to open.
   * With nothing pinned yet, the panel offers the boards to pin instead.
   */
  function render() {
    if (!enabled()) {
      close();
      return;
    }
    const list = shown();
    if (!list.some((b) => b.id === activeId)) activeId = list[0]?.id || null;
    if (isOpen()) paint();
  }

  /** With no boards at all there is nothing to show but the way to make one. */
  function paintEmpty(panel) {
    setSafeHTML(
      panel,
      `
      <div class="et-pb-head"><div class="et-pb-title">Pinned boards</div></div>
      <div class="et-pb-intro">Make a board, and its links will open from here.</div>
      <div class="et-pb-pick">
        <button type="button" class="et-pb-pick-row" data-act="go-boards"><span class="et-pb-pick-name">Go to Boards</span></button>
      </div>`,
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
    // Hung off the button wherever the pinned links are - under the search
    // bar, down a side or along the bottom - and flipped above it in the
    // lower half of the window.
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
    // The button is rebuilt with the pinned links, so it is wired there; a
    // resize would leave the panel hanging off where the button used to be.
    window.addEventListener("resize", () => close(), { passive: true });

    panel.addEventListener("click", (e) => {
      // Picking a board or switching tabs repaints the panel, so by the time
      // the click reaches the page's outside-click check its target is no
      // longer inside the panel - and the panel closed on its own tab click.
      // Handled clicks stop here instead.
      if (e.target.closest(".et-pb-tab")) e.stopPropagation();
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
      // A link navigates as a link does; the panel just gets out of the way.
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
      // The links are a two-column grid, and the arrows move through it.
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
