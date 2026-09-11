"use strict";

/** The mode a decorative tint has to survive, from the class the theme sets. */
const uiMode = () =>
  document.body.classList.contains("theme-light") ? "light" : "dark";

/** A stored board colour, softened for the mode it is about to be painted in. */
const boardTint = (hex) => Contrast.tint(hex, uiMode());

/* Neutral the coloured card is mixed over, and how much of the colour reaches
   it - kept in step with `.et-board-card.has-own-color` in boards.css so the
   ink is chosen against the surface the eye will actually see. */
const CARD_GROUND = { dark: "#121318", light: "#f7f8fa" };
const CARD_TINT = { dark: 0.52, light: 0.22 };

/**
 * The colour a coloured board writes its title in.
 *
 * The board's own hue, moved far enough from the card behind it to be read
 * comfortably. In dark mode that means lifting it, in light mode dropping it -
 * `Contrast.readable` walks toward whichever ink the surface calls for and
 * stops as soon as it clears the bar, so the hue survives and only lightness
 * moves. A title in the board's colour is the point; a title that has to be
 * squinted at is not.
 */
function boardHeadingInk(hex) {
  const mode = uiMode();
  const tinted = Contrast.toRgb(boardTint(hex));
  const ground = Contrast.toRgb(CARD_GROUND[mode]);
  const t = CARD_TINT[mode];
  const surface = Contrast.toHex({
    r: tinted.r * t + ground.r * (1 - t),
    g: tinted.g * t + ground.g * (1 - t),
    b: tinted.b * t + ground.b * (1 - t),
  });
  return Contrast.readable(boardTint(hex), surface, 60);
}

/** The accent a board falls back to when it has no colour of its own. */
const effectiveBoardAccent = () =>
  (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--accent-color")
      .trim() || "#6366f1"
  ).slice(0, 7);

const ContextMenu = (() => {
  let menuEl = null;

  // The element focus was on when the menu opened, so Escape can hand it back.
  let invoker = null;

  function init() {
    if (menuEl) return;
    menuEl = document.createElement("div");
    menuEl.className = "board-menu";
    menuEl.setAttribute("role", "menu");
    menuEl.style.display = "none";
    document.body.appendChild(menuEl);
    document.addEventListener("click", () => hide());
    // Passive: a capture-phase scroll listener sees every scroll on the page.
    document.addEventListener("scroll", () => hide(), { capture: true, passive: true });
    window.addEventListener("resize", () => hide(), { passive: true });
    menuEl.addEventListener("keydown", onMenuKey);
  }

  /** @param {boolean} [restoreFocus] True when dismissed from the keyboard. */
  function hide(restoreFocus = false) {
    if (!menuEl || menuEl.style.display === "none") return;
    menuEl.style.display = "none";
    menuEl.classList.remove("is-shown");
    if (restoreFocus && invoker?.isConnected) invoker.focus({ preventScroll: true });
    invoker = null;
  }

  /* The menu is a real menu from the keyboard. Its items were plain divs with
     click handlers: reachable by mouse only, invisible to Tab and to screen
     readers. Arrow keys move between items and swatches, Enter or Space
     activates, Escape closes and returns focus to what opened it, and Tab
     leaves (a menu is one stop in the tab order). */
  function onMenuKey(e) {
    const stops = [
      ...menuEl.querySelectorAll(
        '.board-menu-item, button.board-swatch, .board-swatch-custom input',
      ),
    ];
    const i = stops.indexOf(document.activeElement);
    const go = (n) => {
      e.preventDefault();
      stops[(n + stops.length) % stops.length]?.focus();
    };
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        return go(i + 1);
      case "ArrowUp":
      case "ArrowLeft":
        return go(i - 1);
      case "Home":
        return go(0);
      case "End":
        return go(stops.length - 1);
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        return hide(true);
      case "Tab":
        return hide(false);
      case "Enter":
      case " ":
        if (document.activeElement?.classList.contains("board-menu-item")) {
          e.preventDefault();
          document.activeElement.click();
        }
    }
  }

  function show(x, y, boardId, bm) {
    init();
    const pinned = !!bm.pinnedToHome;
    setSafeHTML(
      menuEl,
      `
      <div class="board-menu-item" data-act="open"><span class="board-menu-icon">${icon("link", 16)}</span><span class="board-menu-label">Open in new tab</span></div>
      <div class="board-menu-item" data-act="incognito"><span class="board-menu-icon">${icon("incognito", 16)}</span><span class="board-menu-label">Open in incognito</span></div>
      <div class="board-menu-item" data-act="copy"><span class="board-menu-icon">${icon("copy", 16)}</span><span class="board-menu-label">Copy URL</span></div>
      <div class="board-menu-sep"></div>
      <div class="board-menu-item" data-act="pin"><span class="board-menu-icon">${icon("pin", 16)}</span><span class="board-menu-label">${pinned ? "Unpin from Home" : "Pin to Home"}</span></div>
      <div class="board-menu-item" data-act="edit"><span class="board-menu-icon">${icon("edit", 16)}</span><span class="board-menu-label">Edit link</span></div>
      <div class="board-menu-item danger" data-act="delete"><span class="board-menu-icon">${icon("trash", 16)}</span><span class="board-menu-label">Delete link</span></div>
    `,
    );
    menuEl.querySelectorAll(".board-menu-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        hide();
        const act = item.dataset.act;
        const url = safeHref(bm.url);
        if (act === "open") {
          window.open(url, "_blank");
        } else if (act === "incognito") {
          let opened = false;
          if (HAS_EXT && EXT.windows) {
            try {
              Promise.resolve(
                EXT.windows.create({ url, incognito: true }),
              ).catch(() => window.open(url, "_blank"));
              opened = true;
            } catch {
              opened = false;
            }
          }
          if (!opened) window.open(url, "_blank");
        } else if (act === "copy") {
          if (navigator.clipboard)
            navigator.clipboard.writeText(bm.url).catch(() => {});
        } else if (act === "pin") {
          const now = BookmarkManager.togglePin(boardId, bm.id);
          if (now === null) {
            ToastSystem.error(
              "Home is full",
              4000,
              `Home holds ${BookmarkManager.PIN_LIMIT} pins. Unpin one to make room.`,
            );
          } else {
            BoardRenderer.renderBoards();
            HomeRenderer.renderPinned();
            ToastSystem.success(now ? "Pinned to Home" : "Unpinned from Home");
          }
        } else if (act === "edit") {
          BoardRenderer.showEditLinkPopup(boardId, bm);
        } else if (act === "delete") {
          const board = BoardManager.find(boardId);
          const idx = board
            ? board.bookmarks.findIndex((x) => x.id === bm.id)
            : -1;
          BookmarkManager.remove(boardId, bm.id);
          BoardRenderer.renderBoards();
          HomeRenderer.renderPinned();
          ToastSystem.action("Link deleted", "Undo", () => {
            BookmarkManager.insertAt(boardId, bm, idx);
            BoardRenderer.renderBoards();
            HomeRenderer.renderPinned();
          });
        }
      });
    });
    place(x, y);
  }

  /**
   * Which of the four directions actually move this board somewhere, given
   * where it currently sits (from the last paint's `boardPositions`). A board
   * alone in its column with nothing beside it offers only the directions
   * that exist - this is the "detect where the board is, offer only what
   * applies" behaviour, replacing a fixed up/down pair that moved boards
   * across columns as often as it moved them within one.
   */
  function availableMoves(boardId) {
    const pos = BoardRenderer.getBoardPosition(boardId);
    if (!pos) return [];
    const moves = [];
    if (pos.index > 0) moves.push({ act: "moveup", icon: "↑", label: "Move up" });
    if (pos.index < pos.count - 1)
      moves.push({ act: "movedown", icon: "↓", label: "Move down" });
    if (pos.col > 0) moves.push({ act: "moveleft", icon: "←", label: "Move left" });
    // Rightwards into empty space is only offered when the board leaves
    // something behind. Otherwise the whole grid would shuffle sideways and
    // the layout would be re-compacted straight back, so the menu item would
    // be a control that visibly does nothing.
    const rightIsReal =
      pos.col + 1 <= (pos.maxCol ?? 0) || pos.count > 1;
    if (pos.col < pos.numCols - 1 && rightIsReal)
      moves.push({ act: "moveright", icon: "→", label: "Move right" });
    return moves;
  }

  function showBoardMenu(x, y, board) {
    init();
    const moves = availableMoves(board.id);
    const isCustomColor =
      !!board.color && !BoardManager.BOARD_COLORS.includes(board.color);
    setSafeHTML(
      menuEl,
      `
      <div class="board-menu-item" data-act="rename"><span class="board-menu-icon">${icon("edit", 16)}</span><span class="board-menu-label">Rename board</span></div>
      <div class="board-menu-item" data-act="addlink"><span class="board-menu-icon">+</span><span class="board-menu-label">Add link</span></div>
      <div class="board-menu-item" data-act="openall"><span class="board-menu-icon">${icon("grid", 16)}</span><span class="board-menu-label">Open all in tabs</span></div>
      <div class="board-menu-item" data-act="pinboard"><span class="board-menu-icon">${icon("pin", 16)}</span><span class="board-menu-label">${board.pinnedToHome ? "Unpin from Home" : "Pin board to Home"}</span></div>
      <div class="board-menu-sep"></div>
      <div class="board-menu-swatches" role="group" aria-label="Board colour">
        <button class="board-swatch is-default${board.color ? "" : " active"}" data-color="" title="Theme colour" aria-label="Theme colour"></button>
        ${BoardManager.BOARD_COLORS.map(
          (c) =>
            `<button class="board-swatch${board.color === c ? " active" : ""}" data-color="${c}" style="--swatch: ${boardTint(c)}" title="Board colour" aria-label="Board colour ${c}"></button>`,
        ).join("")}
        <label class="board-swatch board-swatch-custom${isCustomColor ? " active" : ""}" title="Custom colour">
          <input type="color" value="${escapeHtml(board.color || effectiveBoardAccent())}" aria-label="Custom board colour" />
        </label>
      </div>
      ${
        moves.length
          ? `<div class="board-menu-sep"></div>
      <div class="board-menu-moves">
        ${moves
          .map(
            (m) =>
              `<div class="board-menu-item board-menu-move" data-act="${m.act}"><span class="board-menu-icon">${m.icon}</span><span class="board-menu-label">${m.label}</span></div>`,
          )
          .join("")}
      </div>`
          : ""
      }
      <div class="board-menu-sep"></div>
      <div class="board-menu-item danger" data-act="delete"><span class="board-menu-icon">${icon("trash", 16)}</span><span class="board-menu-label">Delete board</span></div>
    `,
    );
    // Swatches stay open on click so a colour can be tried and changed again.
    const markActive = (chosen) =>
      menuEl
        .querySelectorAll(".board-swatch")
        .forEach((o) => o.classList.toggle("active", o === chosen));

    menuEl.querySelectorAll("button.board-swatch").forEach((sw) => {
      sw.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!BoardManager.setColor(board.id, sw.dataset.color || null)) return;
        markActive(sw);
        BoardRenderer.renderBoards();
      });
    });

    const custom = menuEl.querySelector(".board-swatch-custom");
    const customInput = custom?.querySelector("input");
    // `input` rather than `change`: the board repaints live while the wheel is
    // being dragged, so the colour is judged against the board it will be on
    // rather than against the swatch.
    customInput?.addEventListener("input", (e) => {
      e.stopPropagation();
      if (!BoardManager.setColor(board.id, e.target.value)) return;
      markActive(custom);
      BoardRenderer.renderBoards();
    });
    custom?.addEventListener("click", (e) => e.stopPropagation());

    menuEl.querySelectorAll(".board-menu-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        hide();
        const act = item.dataset.act;
        if (act === "rename") {
          showPrompt("Rename board", "Board name:", board.name, (val) => {
            if (val) {
              BoardManager.rename(board.id, val);
              BoardRenderer.renderBoards();
              HomeRenderer.renderPinned();
            }
          });
        } else if (act === "addlink") {
          BoardRenderer.showAddLinkPopup(board.id);
        } else if (act === "openall") {
          TabStash.openAll(board);
        } else if (act === "pinboard") {
          const now = PinnedBoards.togglePin(board.id);
          if (now !== null) {
            BoardRenderer.renderBoards();
            ToastSystem.success(
              now
                ? `${board.name} is pinned to Home`
                : `${board.name} is no longer pinned to Home`,
            );
          }
        } else if (act === "moveup" || act === "movedown") {
          const moved =
            act === "moveup"
              ? BoardManager.moveUp(board.id)
              : BoardManager.moveDown(board.id);
          if (moved) BoardRenderer.renderBoards();
        } else if (act === "moveleft" || act === "moveright") {
          BoardRenderer.moveSideways(board.id, act === "moveleft" ? -1 : 1);
        } else if (act === "delete") {
          const idx = BoardManager.getAll().findIndex((b) => b.id === board.id);
          BoardManager.deleteBoard(board.id);
          BoardRenderer.renderBoards();
          HomeRenderer.renderPinned();
          ToastSystem.action(`Board "${board.name}" deleted`, "Undo", () => {
            BoardManager.restoreBoard(board, idx);
            BoardRenderer.renderBoards();
            HomeRenderer.renderPinned();
          });
        }
      });
    });
    place(x, y);
  }

  function place(x, y) {
    // Positioned while hidden-but-laid-out so the width/height used to clamp
    // it to the viewport are real. The entrance animation is withheld until
    // after that - it used to run unconditionally the moment `display` went
    // to `block`, so by the time `visibility` came back the menu had already
    // spent part or all of its fade-and-rise sitting invisibly off in the
    // measurement phase, which is why it was disabled outright rather than
    // fixed. Gating it on a class added one frame later lets it play in full,
    // starting from the moment anyone can actually see it.
    menuEl.classList.remove("is-shown");
    menuEl.style.visibility = "hidden";
    menuEl.style.display = "block";
    const r = menuEl.getBoundingClientRect();
    menuEl.style.left = `${Math.max(8, Math.min(x, window.innerWidth - r.width - 8))}px`;
    menuEl.style.top = `${Math.max(8, Math.min(y, window.innerHeight - r.height - 8))}px`;
    menuEl.style.visibility = "";

    // The reveal class drives `opacity` from 0. Added only in a frame callback,
    // a page that is not being painted never ran it and the menu opened fully
    // invisible, so a short timeout backs it up.
    const reveal = () => menuEl.classList.add("is-shown");
    requestAnimationFrame(reveal);
    setTimeout(reveal, 50);

    if (!menuEl.contains(document.activeElement)) invoker = document.activeElement;
    menuEl.querySelectorAll(".board-menu-item").forEach((it) => {
      it.setAttribute("role", "menuitem");
      it.tabIndex = -1;
    });
    menuEl.querySelector(".board-menu-item")?.focus({ preventScroll: true });
  }

  return { show, showBoardMenu, hide };
})();

const DragDropEngine = (() => {
  let draggedType = null,
    draggedBoardId = null,
    draggedBmInfo = null;

  const clearMarkers = () =>
    $$(
      ".et-board-card.drop-before, .et-board-card.drop-after, .et-board-card.is-drop-target, .et-board-col.drop-end, .et-board-tile.drop-before",
    ).forEach((el) =>
      el.classList.remove("drop-before", "drop-after", "is-drop-target", "drop-end"),
    );

  /** The last board card in a column, skipping the Add board tile. */
  const lastCardIn = (col) =>
    [...col.querySelectorAll(":scope > .et-board-card")].pop() || null;

  function install(container) {
    // Where the press began. `dragstart` is dispatched on the draggable
    // element itself - for a board, the whole card - not on what was pressed,
    // so asking the event whether it came from the header always answered no,
    // and a real board drag never started. (A scripted event aimed at the
    // header passed the check, which is why it looked fine in testing.)
    let pressTarget = null;
    container.addEventListener(
      "pointerdown",
      (e) => {
        pressTarget = e.target;
      },
      true,
    );

    // What the pointer is over. dragover fires at pointer rate, and a
    // getBoundingClientRect per event forces a synchronous layout that makes
    // the drag stutter, so the hovered card's midpoint is measured on entry
    // and then at most once per frame, which keeps it correct while the page
    // auto-scrolls.
    let hoverBoard = null;
    let hoverMid = 0;
    let hoverAfter = null;
    let hoverCol = null;
    let hoverTile = null;
    let measureQueued = false;

    function forgetHover() {
      hoverBoard = null;
      hoverAfter = null;
      hoverCol = null;
      hoverTile = null;
    }

    function measureHover() {
      if (!hoverBoard || !hoverBoard.isConnected) return;
      const rect = hoverBoard.getBoundingClientRect();
      hoverMid = rect.top + rect.height / 2;
    }

    container.addEventListener("dragstart", (e) => {
      const origin =
        pressTarget instanceof Element && container.contains(pressTarget)
          ? pressTarget
          : e.target;
      const link = e.target.closest(".et-board-tile");
      if (link) {
        draggedType = "bookmark";
        const board = link.closest(".et-board-card");
        draggedBmInfo = { boardId: board?.dataset.id, bmId: link.dataset.id };
        link.classList.add("is-dragging");
        e.dataTransfer.effectAllowed = "move";
        // Firefox will not start a drag that carries no data.
        try {
          e.dataTransfer.setData("text/plain", link.dataset.id);
        } catch {}
        e.stopPropagation();
        return;
      }
      const header = origin.closest(".et-board-card-header");
      const board = header?.closest(".et-board-card");
      if (board && !origin.closest("button, textarea, input")) {
        draggedType = "board";
        draggedBoardId = board.dataset.id;
        board.classList.add("is-dragging");
        document.body.classList.add("dragging-board");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", draggedBoardId);
        return;
      }
      // The card is draggable so that its header can be, but a drag started
      // anywhere else on it has nothing to move. Left alone, the browser still
      // lifted a ghost of the whole card, which then dropped nowhere - a drag
      // that looked like it worked and did nothing.
      if (
        e.target.closest?.(".et-board-card") &&
        !origin.closest("input, textarea, [contenteditable]")
      ) {
        e.preventDefault();
      }
    });

    container.addEventListener("dragend", () => {
      $$(".is-dragging").forEach((el) => el.classList.remove("is-dragging"));
      document.body.classList.remove("dragging-board");
      clearMarkers();
      forgetHover();
      draggedType = null;
      draggedBoardId = null;
      draggedBmInfo = null;
    });

    container.addEventListener("dragover", (e) => {
      if (draggedType === "bookmark") {
        const board = e.target.closest(".et-board-card");
        if (!board) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        // Where the link will land: the board it joins is outlined, and the
        // tile it will sit in front of gets an edge. Without a tile under the
        // pointer it goes to the end of the board.
        const over = e.target.closest(".et-board-tile");
        const tile = over && over.dataset.id !== draggedBmInfo?.bmId ? over : null;
        if (board !== hoverBoard || tile !== hoverTile) {
          clearMarkers();
          hoverBoard = board;
          hoverTile = tile;
          board.classList.add("is-drop-target");
          tile?.classList.add("drop-before");
        }
        return;
      }

      if (draggedType !== "board") return;
      const board = e.target.closest(".et-board-card");

      // Below the last card, or in an empty column: the board goes to the end
      // of that column. This used to refuse the drop, so the only way into a
      // column was to aim at a card already in it.
      if (!board) {
        const col = e.target.closest(".et-board-col");
        if (!col) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (col !== hoverCol) {
          clearMarkers();
          forgetHover();
          hoverCol = col;
          const last = lastCardIn(col);
          if (last && last.dataset.id !== draggedBoardId) last.classList.add("drop-after");
          else col.classList.add("drop-end");
        }
        return;
      }

      if (board.dataset.id === draggedBoardId) {
        if (hoverBoard || hoverCol) {
          clearMarkers();
          forgetHover();
        }
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      if (board !== hoverBoard) {
        // The previous card's marker is dropped here rather than in dragleave:
        // that event also fires as the pointer crosses into a card's own
        // children, which made the drop line flicker on and off mid-drag.
        clearMarkers();
        forgetHover();
        hoverBoard = board;
        measureHover();
      } else if (!measureQueued) {
        measureQueued = true;
        requestAnimationFrame(() => {
          measureQueued = false;
          measureHover();
        });
      }

      const after = e.clientY >= hoverMid;
      if (after === hoverAfter) return;
      hoverAfter = after;
      board.classList.toggle("drop-before", !after);
      board.classList.toggle("drop-after", after);
    });

    container.addEventListener("dragleave", (e) => {
      // Only a genuine exit from the grid clears the markers; a dragleave whose
      // relatedTarget is still inside the container is just the pointer moving
      // between nested children.
      if (e.relatedTarget && container.contains(e.relatedTarget)) return;
      clearMarkers();
      forgetHover();
    });

    container.addEventListener("drop", (e) => {
      const board = e.target.closest(".et-board-card");

      if (draggedType === "bookmark" && draggedBmInfo && board) {
        e.preventDefault();
        clearMarkers();
        const overLink = e.target.closest(".et-board-tile");
        if (overLink && overLink.dataset.id === draggedBmInfo.bmId) return;
        const beforeId = overLink ? overLink.dataset.id : null;
        BookmarkManager.move(
          draggedBmInfo.boardId,
          board.dataset.id,
          draggedBmInfo.bmId,
          beforeId,
        );
        BoardRenderer.renderBoards();
        HomeRenderer.renderPinned();
        return;
      }

      if (draggedType !== "board" || !draggedBoardId) return;

      if (board && board.dataset.id !== draggedBoardId) {
        e.preventDefault();
        const after = board.classList.contains("drop-after");
        clearMarkers();
        const target = BoardManager.find(board.dataset.id);
        if (!target || !Number.isInteger(target.col)) return;
        // Placed by column and row, the way the grid shows it. The old
        // flat-array reorder renumbered every board from its position in
        // storage, which is not the order a column stacks in once boards have
        // been moved up, down or sideways - so a drop could reshuffle the
        // column it landed in.
        const rest = BoardManager.columnBoards(target.col).filter(
          (b) => b.id !== draggedBoardId,
        );
        const at = rest.findIndex((b) => b.id === target.id) + (after ? 1 : 0);
        BoardManager.placeBoard(draggedBoardId, target.col, at);
        BoardRenderer.renderBoards();
        return;
      }

      if (!board) {
        const col = e.target.closest(".et-board-col");
        const colIdx = col ? Number(col.dataset.col) : NaN;
        clearMarkers();
        if (!Number.isInteger(colIdx)) return;
        e.preventDefault();
        BoardManager.placeBoard(draggedBoardId, colIdx, Infinity);
        BoardRenderer.renderBoards();
      }
    });
  }

  return { install };
})();

const BoardRenderer = (() => {
  // Resolved on every use rather than cached once at script eval. A cached
  // node goes stale the moment anything replaces #boardsArea, and every
  // guard below then bails silently - boards simply stop opening, with no
  // error to point at.
  const boardsArea = () => $("boardsArea");

  function addBoardAtRight(name) {
    const board = BoardManager.addBoard(name);
    StorageManager.saveImmediate();
    renderBoards();
    return board;
  }

  const promptNewBoard = (col = undefined) =>
    showPrompt("New Board", "Board name:", "Bookmarks", (val) => {
      if (val) {
        BoardManager.addBoard(val);
        StorageManager.saveImmediate();
        renderBoards();
      }
    });

  let lastNumCols = null;

  // Board id -> { col, numCols, index, count } from the most recent paint.
  // Read by the board menu to know which of up/down/left/right are real moves.
  const boardPositions = new Map();

  let boardsMigrated = false;

  function followBoardLink(url, event) {
    const href = safeHref(url);
    if (
      event?.ctrlKey ||
      event?.metaKey ||
      event?.shiftKey ||
      event?.button === 1
    ) {
      window.open(href, "_blank", "noopener");
    } else {
      window.location.assign(href);
    }
  }

  // Narrowest a board column can go before its own header controls collapse
  // into each other. Measured from a real rendered header rather than a fixed
  // number, so a future redesign of the header (a wider button, an extra
  // icon, a bigger count badge) raises this floor on its own instead of
  // silently clipping again until someone remembers to update a constant.
  let measuredMinColW = 0;

  function measureMinColW() {
    const header = document.querySelector(".et-board-card-header");
    if (!header) return measuredMinColW || 176;

    const left = header.querySelector(".et-board-card-left");
    const title = header.querySelector(".et-board-card-title");
    const right = header.querySelector(".et-board-card-right");
    if (!left || !title || !right) return measuredMinColW || 176;

    const headerStyle = getComputedStyle(header);
    const hPad =
      parseFloat(headerStyle.paddingLeft || "0") +
      parseFloat(headerStyle.paddingRight || "0");

    // Everything in the left group except the title (chevron, count, gaps).
    const chrome = left.offsetWidth - title.getBoundingClientRect().width;
    // A sliver of title is still worth keeping - enough for an ellipsis and a
    // character or two, so a one-letter board name doesn't look truncated to
    // nothing even at the narrowest column.
    const MIN_TITLE = 22;

    measuredMinColW = Math.ceil(hPad + chrome + MIN_TITLE + right.offsetWidth);
    return measuredMinColW;
  }

  function boardLayoutMetrics() {
    const uiScale =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--ui-scale",
        ),
      ) || 1;
    const areaWidth =
      boardsArea()?.clientWidth || Math.max(240, window.innerWidth - 32) || 1200;
    const preferredWidth = Math.round(
      (StorageManager.getSettings().boardWidth || 270) * uiScale,
    );

    const floor = measureMinColW();
    const colW = Math.max(floor, Math.min(preferredWidth, areaWidth - 24));
    const numCols = Math.max(1, Math.floor((areaWidth + 16) / (colW + 16)));
    return { colW, numCols };
  }

  function init() {
    let resizeT = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => {
        if ($("boardsView")?.classList.contains("active")) {
          const { numCols } = boardLayoutMetrics();
          if (lastNumCols === numCols) return;
          renderBoards();
        }
      }, 150);
    });

    const area = boardsArea();
    if (!area) return;

    DragDropEngine.install(area);

    // Delegated from #boardsView, which is static markup, so the handlers
    // survive #boardsArea being re-created.
    const view = $("boardsView") || area;

    view.addEventListener("click", (e) => {
      const boardMenu = e.target.closest(".et-board-menu-btn");
      if (boardMenu) {
        e.stopPropagation();
        const board = BoardManager.find(
          boardMenu.closest(".et-board-card")?.dataset.id,
        );
        if (board) {
          const r = boardMenu.getBoundingClientRect();
          ContextMenu.showBoardMenu(r.left, r.bottom + 4, board);
        }
        return;
      }
      const addLink = e.target.closest(".et-board-add-link-btn");
      if (addLink) {
        e.stopPropagation();
        const acc = addLink.closest(".et-board-card");
        if (acc) showAddLinkPopup(acc.dataset.id);
        return;
      }

      const emptyAddLink = e.target.closest(".et-board-empty-btn");
      if (emptyAddLink) {
        e.stopPropagation();
        const acc = emptyAddLink.closest(".et-board-card");
        if (acc) showAddLinkPopup(acc.dataset.id);
        return;
      }

      // The whole header bar is the accordion's hit target, not just the
      // chevron - a 14px arrow is a needle to aim at, and every other
      // disclosure on the page opens from its title row.
      const header = e.target.closest(".et-board-card-header");
      // `e.detail > 1` is the second click of a double-click, which renames the
      // board - without this the card visibly flapped open and shut first.
      if (header && e.detail < 2 && !e.target.closest("button, a, input")) {
        toggleBoard(header.closest(".et-board-card"));
        return;
      }

      const chevron = e.target.closest(".et-board-chevron");
      if (chevron) {
        e.stopPropagation();
        toggleBoard(chevron.closest(".et-board-card"));
        return;
      }

      if (
        e.target.closest("#btnCreateFirstBoard") ||
        e.target.closest(".et-add-board-tile")
      ) {
        promptNewBoard();
        return;
      }

      // The pin sits inside the tile, so it has to claim the click before the
      // tile turns it into "open this link".
      const pinBtn = e.target.closest(".board-pin-badge");
      if (pinBtn) {
        e.preventDefault();
        e.stopPropagation();
        const acc = pinBtn.closest(".et-board-card");
        const now = BookmarkManager.togglePin(acc?.dataset.id, pinBtn.dataset.pin);
        if (now === null) {
          ToastSystem.error(
            "Home is full",
            4000,
            `Home holds ${BookmarkManager.PIN_LIMIT} pins. Unpin one to make room.`,
          );
        } else {
          renderBoards();
          HomeRenderer.renderPinned();
        }
        return;
      }

      const tile = e.target.closest(".et-board-tile");
      if (tile) {
        const acc = tile.closest(".et-board-card");
        if (acc) {
          const b = BoardManager.find(acc.dataset.id);
          const bm = b?.bookmarks.find((x) => x.id === tile.dataset.id);
          if (bm) followBoardLink(bm.url, e);
        }
      }
    });

    view.addEventListener("auxclick", (e) => {
      if (e.button !== 1) return;
      const tile = e.target.closest(".et-board-tile");
      const acc = tile?.closest(".et-board-card");
      const board = BoardManager.find(acc?.dataset.id);
      const bm = board?.bookmarks.find((x) => x.id === tile?.dataset.id);
      if (bm) {
        e.preventDefault();
        followBoardLink(bm.url, e);
      }
    });

    view.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const tile = e.target.closest(".et-board-tile");
      if (tile) {
        e.preventDefault();
        const acc = tile.closest(".et-board-card");
        const b = BoardManager.find(acc?.dataset.id);
        const bm = b?.bookmarks.find((x) => x.id === tile.dataset.id);
        if (bm) followBoardLink(bm.url, e);
        return;
      }
      const chevron = e.target.closest(".et-board-chevron");
      if (chevron) {
        e.preventDefault();
        chevron.click();
      }
    });

    view.addEventListener("dblclick", (e) => {
      if (!e.target.closest(".et-board-card-title")) return;
      const acc = e.target.closest(".et-board-card");
      const board = BoardManager.find(acc?.dataset.id);
      if (board)
        showPrompt("Rename board", "Board name:", board.name, (val) => {
          if (val) {
            BoardManager.rename(board.id, val);
            renderBoards();
            HomeRenderer.renderPinned();
          }
        });
    });

    view.addEventListener("contextmenu", (e) => {
      const tile = e.target.closest(".et-board-tile");
      const acc = e.target.closest(".et-board-card");
      if (tile && acc) {
        e.preventDefault();
        const b = BoardManager.find(acc.dataset.id);
        const bm = b?.bookmarks.find((x) => x.id === tile.dataset.id);
        if (bm) ContextMenu.show(e.clientX, e.clientY, b.id, bm);
      }
    });
  }

  let renderBoardsRAF = null;
  function renderBoards() {
    if (renderBoardsRAF) cancelAnimationFrame(renderBoardsRAF);
    // A background tab never services its rAF queue, so coalescing there
    // would leave the boards stale until the tab is looked at again.
    if (document.hidden) {
      renderBoardsRAF = null;
      paintBoards();
      return;
    }
    renderBoardsRAF = requestAnimationFrame(paintBoards);
  }

  function paintBoards() {
    {
      const boardsArea = $("boardsArea");
      if (!boardsArea) return;
      const boards = BoardManager.getAll();

      if (!boards || boards.length === 0) {
        setSafeHTML(
          boardsArea,
          `
          <div class="boards-empty">
            <img class="boards-empty-mark" src="icons/icon128.png" alt="EshaalTab" width="56" height="56" decoding="async" />
            <div class="boards-empty-title">No boards yet</div>
            <div class="boards-empty-body">Organize your bookmarks into custom boards. Pin the ones you use most to your Home page.</div>
            <button id="btnCreateFirstBoard" class="boards-empty-btn"><span>+</span> Add board</button>
          </div>`,
        );
        return;
      }

      const data = StorageManager.getData();
      if (
        !boardsMigrated &&
        Array.isArray(data.expandedBoards) &&
        !Array.isArray(data.collapsedBoards)
      ) {
        boardsMigrated = true;
        data.collapsedBoards = boards
          .filter((b) => !data.expandedBoards.includes(b.id))
          .map((b) => b.id);
        delete data.expandedBoards;
        StorageManager.saveImmediate();
      }
      // Self-healing: ids left behind by boards deleted before the prune in
      // BoardManager.deleteBoard existed would otherwise sit in storage forever.
      let collapsedBoards = Array.isArray(data.collapsedBoards)
        ? data.collapsedBoards
        : [];
      if (collapsedBoards.length) {
        const liveIds = new Set(boards.map((b) => b.id));
        const pruned = collapsedBoards.filter((id) => liveIds.has(id));
        if (pruned.length !== collapsedBoards.length) {
          collapsedBoards = pruned;
          data.collapsedBoards = pruned;
          StorageManager.save();
        }
      }

      const gridContainer = document.createElement("div");
      gridContainer.className = "et-board-grid";

      const { colW, numCols } = boardLayoutMetrics();
      gridContainer.style.setProperty("--board-col-w", `${colW}px`);

      const colElements = [];
      for (let i = 0; i < numCols; i++) {
        const colDiv = document.createElement("div");
        colDiv.className = "et-board-col";
        colDiv.dataset.col = String(i);
        colElements.push(colDiv);
        gridContainer.appendChild(colDiv);
      }

      // Height is estimated rather than measured: nothing is in the document
      // yet, and an estimate from the header plus the number of tile rows is
      // close enough to keep the columns level.
      const TILES_PER_ROW = 3;
      const HEADER_H = 46;
      const TILE_ROW_H = 68;
      const COL_GAP = 16;
      const estimateHeight = (board, isExpanded) => {
        if (!isExpanded) return HEADER_H;
        const n = (board.bookmarks || []).length;
        const rows = n ? Math.ceil(n / TILES_PER_ROW) : 1;
        return HEADER_H + rows * TILE_ROW_H;
      };

      // A board's column is persisted (`board.col`), not recomputed from
      // scratch on every render - that persistence is what lets "move up" and
      // "move left" mean something, and what stops a manually-arranged layout
      // from being silently reshuffled the next time a board is added.
      //
      // The window changing shape invalidates every column at once (there may
      // no longer be as many, or there is suddenly room for more), so that
      // case rebalances everything. Otherwise only the boards that genuinely
      // have nowhere to go - new ones, or ones an old layout never assigned -
      // are placed, into whichever real column is shortest right now; every
      // board that already had a home keeps it.
      // `lastNumCols` starts unknown at the top of every session, and
      // "unknown" must not be treated as "changed" - otherwise the very first
      // paint after opening the page would look like a resize and wipe out
      // whatever layout was persisted from last time.
      const colChanged = lastNumCols !== null && numCols !== lastNumCols;
      lastNumCols = numCols;

      const isPlaced = (b) => Number.isInteger(b.col) && b.col < numCols;
      const toPlace = colChanged ? boards : boards.filter((b) => !isPlaced(b));

      if (toPlace.length) {
        const colHeights = new Array(numCols).fill(0);
        if (!colChanged) {
          // Seed with the real height of what is already sitting in each
          // column, so a new board joins the shortest *actual* column instead
          // of restarting the estimate from zero.
          boards.filter(isPlaced).forEach((b) => {
            colHeights[b.col] +=
              estimateHeight(b, !collapsedBoards.includes(b.id)) + COL_GAP;
          });
        }
        const shortestCol = () => colHeights.indexOf(Math.min(...colHeights));
        const idToCol = new Map();
        toPlace.forEach((board) => {
          const isExp = !collapsedBoards.includes(board.id);
          const colIdx = shortestCol();
          colHeights[colIdx] += estimateHeight(board, isExp) + COL_GAP;
          idToCol.set(board.id, colIdx);
        });
        BoardManager.applyColumnLayout(idToCol);
      }

      // Deletes and sideways moves can leave a column with nothing in it, and
      // an empty column is a visible hole in the grid rather than an absence.
      if (BoardManager.compactColumns()) StorageManager.save();

      // `boardPositions` tells the "..." menu which of the four directions
      // are actually available for a given board, so it never offers a move
      // that would do nothing (or, as before, do something other than what
      // its label said).
      boardPositions.clear();
      const maxCol = Math.max(
        0,
        ...boards.map((b) => (Number.isInteger(b.col) ? b.col : 0)),
      );
      for (let col = 0; col < numCols; col++) {
        const colBoards = BoardManager.columnBoards(col);
        colBoards.forEach((board, i) => {
          boardPositions.set(board.id, {
            col,
            numCols,
            index: i,
            count: colBoards.length,
            maxCol,
          });
          const isExp = !collapsedBoards.includes(board.id);
          colElements[col].appendChild(
            createBoardAccordionElement(board, isExp),
          );
        });
      }

      // Boards with no valid column at all (should not happen once the
      // rebalance above has run, but a corrupt import is not impossible) fall
      // back to the first column rather than vanishing from the page.
      boards.forEach((board) => {
        if (boardPositions.has(board.id)) return;
        colElements[0].appendChild(
          createBoardAccordionElement(board, !collapsedBoards.includes(board.id)),
        );
      });

      const addTile = document.createElement("div");
      addTile.className = "et-add-board-tile";
      addTile.id = "btnColAddBoard";
      addTile.setAttribute("role", "button");
      addTile.setAttribute("tabindex", "0");
      // The plus is its own element so it can outrun the label - a sign at
      // the end of a column reads faster as a symbol than as punctuation.
      setSafeHTML(
        addTile,
        `<span class="et-add-board-plus" aria-hidden="true">+</span><span>Add board</span>`,
      );
      // Only columns that boards actually reach are candidates, plus the one
      // immediately past them. Anything further out would put "+ Add board"
      // across a gap from the grid it belongs to.
      const addLimit = Math.min(maxCol + 1, numCols - 1);
      let shortestNow = 0;
      for (let i = 1; i <= addLimit; i++) {
        if (colElements[i].children.length < colElements[shortestNow].children.length)
          shortestNow = i;
      }
      colElements[shortestNow].appendChild(addTile);

      wireFavicons(gridContainer);
      boardsArea.replaceChildren(gridContainer);
    }
  }

  /**
   * Slides a board card's body open or shut. The measuring, interruption
   * recovery and easing live in the shared `slideHeight` (js/core/platform.js)
   * now - the settings accordions use the exact same function, so the two
   * collapse/expand patterns in the app move identically instead of one being
   * a hand-tuned animation and the other a hard `display` toggle.
   */
  function slideBoard(body, open, fromHeight = null) {
    slideHeight(body, open, "is-animating", fromHeight);
  }

  /** Expands or collapses one board card and persists the new state. */
  function toggleBoard(acc) {
    if (!acc) return;
    const boardId = acc.dataset.id;
    const isExp = acc.classList.contains("is-expanded");
    const cardBody = acc.querySelector(".et-board-card-body");
    // Measured before the class flip below changes which CSS rule is active,
    // so the slide has a real starting height to animate from.
    const fromHeight = cardBody?.getBoundingClientRect().height ?? null;
    acc.classList.toggle("is-expanded", !isExp);

    const chevron = acc.querySelector(".et-board-chevron");
    if (chevron) {
      chevron.setAttribute("aria-expanded", String(!isExp));
      const name = BoardManager.find(boardId)?.name || "";
      chevron.setAttribute(
        "aria-label",
        `${isExp ? "Expand" : "Collapse"} board ${name}`,
      );
    }

    slideBoard(cardBody, !isExp, fromHeight);

    const data = StorageManager.getData();
    if (!Array.isArray(data.collapsedBoards)) data.collapsedBoards = [];
    if (isExp) {
      if (!data.collapsedBoards.includes(boardId))
        data.collapsedBoards.push(boardId);
    } else {
      data.collapsedBoards = data.collapsedBoards.filter((id) => id !== boardId);
    }
    StorageManager.save();
  }

  function createBoardAccordionElement(board, isExpanded) {
    const acc = document.createElement("div");
    acc.className = `et-board-card ${isExpanded ? "is-expanded" : ""}`;
    acc.setAttribute("data-id", board.id);
    acc.setAttribute("draggable", "true");
    // A board with no colour of its own inherits the theme accent, which is
    // what the CSS falls back to when the variable is absent.
    if (board.color) {
      acc.classList.add("has-own-color");
      acc.style.setProperty("--board-accent", boardTint(board.color));
      acc.style.setProperty("--board-title-ink", boardHeadingInk(board.color));
    }

    const linkCount = (board.bookmarks || []).length;

    setSafeHTML(
      acc,
      `
      <div class="et-board-card-header">
        <div class="et-board-card-left">
          <button class="et-board-chevron" aria-expanded="${isExpanded}"
                  aria-label="${isExpanded ? "Collapse" : "Expand"} board ${escapeHtml(board.name)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <span class="et-board-card-title">${escapeHtml(board.name)}</span>
          ${board.pinnedToHome ? `<span class="et-board-pinned" data-tooltip="Pinned to Home" role="img" aria-label="Pinned to Home">${icon("pinFilled", 12)}</span>` : ""}
          <span class="et-board-count" aria-hidden="true">${linkCount}</span>
        </div>
        <div class="et-board-card-right">
          <button class="et-board-add-link-btn" aria-label="Add link">+</button>
          <button class="et-board-menu-btn" aria-label="Options">&#8943;</button>
        </div>
      </div>
      <div class="et-board-card-body">
       <div class="et-board-card-body-inner">
        <div class="et-board-tiles">
          ${
            board.bookmarks && board.bookmarks.length > 0
              ? board.bookmarks
                  .map((bm) => {
                    const rawTitle = (bm.title || "").trim();
                    return `
              <div class="et-board-tile${bm.pinnedToHome ? " is-pinned" : ""}" data-id="${bm.id}" draggable="true" role="button" tabindex="0"
                   aria-label="${escapeHtml(rawTitle)}${bm.pinnedToHome ? ", pinned to Home" : ""}" title="${escapeHtml(bm.title)} (${escapeHtml(bm.url)})">
                <img class="et-board-tile-icon" ${faviconAttr(bm.url)} alt="" />
                <span class="et-board-tile-title" title="${escapeHtml(bm.title)}">${escapeHtml(rawTitle)}</span>
                <button type="button" class="board-pin-badge${bm.pinnedToHome ? " is-pinned" : ""}" data-pin="${bm.id}"
                        aria-pressed="${!!bm.pinnedToHome}"
                        title="${bm.pinnedToHome ? "Unpin from Home" : "Pin to Home"}"
                        aria-label="${bm.pinnedToHome ? "Unpin" : "Pin"} ${escapeHtml(rawTitle)} to Home">${icon("pinFilled", 13)}</button>
              </div>
            `;
                  })
                  .join("")
              : `
            <div class="et-board-empty">
              <button class="et-board-empty-btn" type="button" title="Add link">
                <img class="empty-btn-icon" src="icons/icon128.png" alt="" width="20" height="20" decoding="async" />
                <span>Add link</span>
              </button>
            </div>
          `
          }
        </div>
       </div>
      </div>
    `,
    );
    return acc;
  }

  function showAddLinkPopup(boardId) {
    showCustomModal(
      "Add link",
      `
      <div class="dialog-stack">
        <div class="dialog-field">
          <label class="dialog-label">Title</label>
          <input type="text" id="bmTitleInp" class="dialog-input" placeholder="Title" />
        </div>
        <div class="dialog-field">
          <label class="dialog-label">URL</label>
          <input type="text" id="bmUrlInp" class="dialog-input" placeholder="Website URL" />
        </div>
      </div>`,
      () => {
        const titleEl = $("bmTitleInp");
        const urlEl = $("bmUrlInp");
        const title = titleEl.value.trim();
        const url = urlEl.value.trim();
        if (!title || !url) {
          markInvalid(titleEl, !title);
          markInvalid(urlEl, !url);
          showModalError(
            !title && !url
              ? "Title and URL are required."
              : !title
                ? "Title is required."
                : "URL is required.",
          );
          return false;
        }
        let finalUrl = url;
        if (!/^https?:\/\//i.test(finalUrl)) finalUrl = "https://" + finalUrl;
        if (BookmarkManager.add(boardId, title, finalUrl, [])) {
          StorageManager.saveImmediate();
          renderBoards();
          HomeRenderer.renderPinned();
        }
        ToastSystem.success("Link added");
        return true;
      },
    );
  }

  function showEditLinkPopup(boardId, bm) {
    showCustomModal(
      "Edit Link",
      `
      <div class="dialog-stack">
        <div class="dialog-field">
          <label class="dialog-label">Title</label>
          <input type="text" id="bmTitleInp" class="dialog-input" value="${escapeHtml(bm.title)}" />
        </div>
        <div class="dialog-field">
          <label class="dialog-label">URL</label>
          <input type="text" id="bmUrlInp" class="dialog-input" value="${escapeHtml(bm.url)}" />
        </div>
        <div class="dialog-field">
          <label class="dialog-label">Tags (optional)</label>
          <input type="text" id="bmTagsInp" class="dialog-input" value="${(bm.tags || []).join(", ")}" />
        </div>
      </div>`,
      () => {
        const titleEl = $("bmTitleInp");
        const urlEl = $("bmUrlInp");
        const title = titleEl.value.trim();
        const url = urlEl.value.trim();
        if (!title || !url) {
          markInvalid(titleEl, !title);
          markInvalid(urlEl, !url);
          showModalError(
            !title && !url
              ? "Title and URL are required."
              : !title
                ? "Title is required."
                : "URL is required.",
          );
          return false;
        }
        const rawTags = $("bmTagsInp").value;
        let finalUrl = url;
        if (!/^https?:\/\//i.test(finalUrl)) finalUrl = "https://" + finalUrl;
        const tags = rawTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        BookmarkManager.edit(boardId, bm.id, title, finalUrl, tags);
        renderBoards();
        HomeRenderer.renderPinned();
        return true;
      },
    );
  }

  /** @returns {{col:number,numCols:number,index:number,count:number}|null} */
  /**
   * Brings one board into view, open, and briefly outlined - the landing for a
   * board picked from Ctrl+K.
   *
   * Boards paint on the next frame, so the card may not exist yet when this is
   * called. It waits two frames, with a timeout as the backstop for a tab that
   * is not being painted, and runs exactly once whichever fires first -
   * running twice would click the chevron twice and close the board again.
   */
  function reveal(boardId) {
    let done = false;
    const go = () => {
      if (done) return;
      const card = document.querySelector(
        `.et-board-card[data-id="${CSS.escape(String(boardId))}"]`,
      );
      if (!card) return;
      done = true;
      if (!card.classList.contains("is-expanded"))
        card.querySelector(".et-board-chevron")?.click();
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      card.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
      card.classList.remove("is-flash");
      void card.offsetWidth;
      card.classList.add("is-flash");
      card.querySelector(".et-board-chevron")?.focus({ preventScroll: true });
    };
    requestAnimationFrame(() => requestAnimationFrame(go));
    setTimeout(go, 150);
  }

  function getBoardPosition(boardId) {
    return boardPositions.get(boardId) || null;
  }

  /**
   * Moves a board one column left or right, at the height it sits on screen.
   *
   * The data move kept the board's row number, and a row number is not a
   * height: the second board in one column can sit a long way below the
   * second board in the next, under a tall first one. So "move left" dropped
   * the board lower than it was, even with room beside it. It now goes in
   * before the first board in the other column that reaches below its own top
   * edge - so it lands level with where it was, or higher beside a tall board,
   * but never further down.
   */
  function moveSideways(boardId, delta) {
    const board = BoardManager.find(boardId);
    const pos = boardPositions.get(boardId);
    if (!board || !pos) return false;
    const target = pos.col + delta;
    if (target < 0 || target >= pos.numCols) return false;
    const dest = BoardManager.columnBoards(target);
    // A lone board stepping into an empty column only slides the grid over.
    if (!dest.length && BoardManager.columnBoards(board.col).length < 2) return false;

    let index = dest.length;
    const area = boardsArea();
    const card = area?.querySelector(`.et-board-card[data-id="${CSS.escape(boardId)}"]`);
    const column = area?.querySelector(`.et-board-col[data-col="${target}"]`);
    if (card && column) {
      const top = card.getBoundingClientRect().top;
      const cards = [...column.querySelectorAll(":scope > .et-board-card")];
      const i = cards.findIndex((c) => c.getBoundingClientRect().bottom > top + 1);
      if (i >= 0) index = i;
    }
    if (!BoardManager.placeBoard(boardId, target, index)) return false;
    renderBoards();
    return true;
  }

  return {
    init,
    renderBoards,
    addBoardAtRight,
    showAddLinkPopup,
    showEditLinkPopup,
    getBoardPosition,
    moveSideways,
    reveal,
  };
})();

const ViewController = (() => {
  const views = { home: "homeView", boards: "boardsView", notes: "notesView" };

  function init() {
    $$(".et-main-tab").forEach((btn) => {
      btn.addEventListener("click", () => show(btn.dataset.tab));
    });
    $("addBoardTopBtn")?.addEventListener("click", () => {
      showPrompt("New Board", "Board name:", "Bookmarks", (val) => {
        if (val) {
          BoardRenderer.addBoardAtRight(val);
          HomeRenderer.renderPinned();
        }
      });
    });
    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && ["1", "2", "3"].includes(e.key)) {
        const tab = { 1: "home", 2: "boards", 3: "notes" }[e.key];
        e.preventDefault();
        show(tab);
      }
    });
    // Not "home": main.js already restores the persisted tab right after
    // this, and forcing Home first made every remote-sync repaint flash the
    // Home view before snapping back.
    show(TabManager.get());
  }

  // The view the user last asked for. A view transition runs its callback
  // asynchronously, and starting a second one aborts the first *after* its
  // callback is already queued - so two quick clicks could run their swaps out
  // of order and leave you on the earlier view. Every swap reads this instead
  // of the tab it was created with, so whichever callback runs last still
  // lands on the newest request.
  let requestedTab = null;

  // Views that have already been shown once this page. A transition is worth
  // one frame the first time a view appears, because that is the only moment
  // it carries information: something new arrived. Every visit after that is
  // a return to something already on screen a second ago, and animating it
  // just puts a delay between the click and the result. So the first visit
  // gets the motion and the rest are instant.
  const seenTabs = new Set();

  function show(tab) {
    if (!views[tab]) tab = "home";
    requestedTab = tab;

    const swap = () => applyTab(requestedTab);
    const firstVisit = !seenTabs.has(tab);
    seenTabs.add(tab);

    if (
      !firstVisit ||
      typeof document.startViewTransition !== "function" ||
      document.visibilityState !== "visible" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.body.classList.contains("performance-mode")
    ) {
      swap();
      return;
    }

    // A view transition cannot run its callback until the browser has captured
    // the outgoing frame, and a frame is exactly what a new tab page does not
    // reliably get: painting is throttled while the window is occluded,
    // minimised or still opening, even though `visibilityState` reads
    // "visible" (this is the same starvation `main.js` already guards the boot
    // reveal against). With the swap living only inside that callback, a click
    // on Boards or Notes in a page that is not being painted did nothing at
    // all - the view changed later, when the window finally drew, or not until
    // the next click. The swap is idempotent, so a short deadline that runs it
    // directly costs nothing but guarantees the button always responds.
    let swapped = false;
    const swapOnce = () => {
      if (swapped) return;
      swapped = true;
      swap();
    };
    const deadline = setTimeout(swapOnce, 120);

    try {
      const transition = document.startViewTransition(() => {
        clearTimeout(deadline);
        swapOnce();
      });
      // A transition started while another is still running is aborted, and
      // switching tabs quickly does exactly that. The abort is expected and
      // harmless - the view still swaps, because the callback has already run
      // - but its promises reject, and an unhandled rejection surfaces as an
      // "InvalidStateError: Transition was aborted" in the console. Settle
      // them here so a fast double-click stays silent.
      transition.ready?.catch(() => {});
      transition.finished?.catch(() => {});
      transition.updateCallbackDone?.catch(() => {});
    } catch {
      // Nothing about a decorative transition is worth failing a tab change
      // over, so an engine that refuses the call still gets the plain swap.
      clearTimeout(deadline);
      swapOnce();
    }
  }

  function applyTab(tab) {
    TabManager.set(tab);

    Object.entries(views).forEach(([name, id]) => {
      const el = $(id);
      if (el) el.classList.toggle("active", name === tab);
    });
    $$(".et-main-tab").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === tab),
    );

    // The active view on <body>, so CSS can scope rules to one page. The
    // topbar's corner clusters move around for the Home clock's benefit and
    // have no business doing that on Boards or Notes.
    Object.keys(views).forEach((name) =>
      document.body.classList.toggle(`view-${name}`, name === tab),
    );

    if (tab === "boards") BoardRenderer.renderBoards();
    else if (tab === "notes") NotesRenderer.render();
    else HomeRenderer.render();
  }

  return { init, show };
})();

function showPrompt(title, labelText, defaultVal, onSave) {
  showCustomModal(
    title,
    `
    <div class="dialog-field">
      <label class="dialog-label">${labelText}</label>
      <input type="text" id="dlgInput" class="dialog-input" value="${escapeHtml(defaultVal)}" />
    </div>`,
    () => {
      const val = $("dlgInput").value.trim();
      onSave(val);
      return true;
    },
  );
  $("dlgInput")?.select();
}

/* Glyphs for the icon a confirmation leads with. Same set the toasts use, so
   "this will destroy something" looks the same wherever it is said. */
const DIALOG_GLYPHS = {
  danger:
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  warning: '<path d="M12 8v5"/><path d="M12 17h.01"/>',
  info: '<path d="M12 16v-5"/><path d="M12 8h.01"/>',
};

/**
 * The pattern people already know from every OS and every app that asks before
 * throwing something away: a tone-coloured icon, the question under it, and the
 * choices under that - centred, in a card no wider than it needs to be, so the
 * eye lands on the icon, reads one line and then picks. The old layout put a
 * left-aligned heading across a 440px box with two buttons pushed into the
 * far corner, which is a lot of empty card for one short question.
 */
function showConfirm(title, messageText, onConfirm, opts = {}) {
  const tone = opts.tone || "danger";
  const glyph = DIALOG_GLYPHS[tone] || DIALOG_GLYPHS.danger;
  showCustomModal(
    title,
    `<p class="dialog-message">${escapeHtml(messageText)}</p>`,
    () => {
      onConfirm();
      return true;
    },
    opts.confirmLabel || (tone === "danger" ? "Delete" : "Continue"),
    tone === "danger",
    null,
    `<span class="dialog-icon is-${tone}" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
           stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>
    </span>`,
  );
}

/**
 * @param {string} [iconHtml] Optional status icon. Supplying one switches the
 *   card to the centred, icon-led layout confirmations use; without one the
 *   card stays the left-aligned form layout that prompts and settings dialogs
 *   need for their labelled fields.
 */
function showCustomModal(
  title,
  bodyHtml,
  onOk,
  okBtnText = "Save",
  danger = false,
  onCancel = null,
  iconHtml = "",
) {
  const returnFocusTo = document.activeElement;
  let overlay = $("appDynamicModal");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "appDynamicModal";
    overlay.className = "dialog-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "modalTitle");
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay && !gestureStartedIn(overlay.firstElementChild))
        close();
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.tagName === "INPUT") {
        e.preventDefault();
        $("modalOkBtn")?.click();
      } else if (e.key === "Escape") {
        e.stopPropagation();
        close();
      } else if (e.key === "Tab") trapFocus(e, overlay);
    });
  }
  setSafeHTML(
    overlay,
    `
    <div class="et-modal-card${iconHtml ? " is-centered" : ""}">
      ${iconHtml}
      <h3 class="dialog-modal-title" id="modalTitle">${escapeHtml(title)}</h3>
      <div class="modal-body-content">${bodyHtml}</div>
      <div class="dialog-modal-actions">
        <button id="modalCancelBtn" class="et-modal-btn">Cancel</button>
        <button id="modalOkBtn" class="et-modal-btn primary${danger ? " danger" : ""}">${escapeHtml(okBtnText)}</button>
      </div>
    </div>`,
  );
  function close() {
    overlay.remove();
    if (returnFocusTo && document.contains(returnFocusTo))
      returnFocusTo.focus();
  }
  $("modalCancelBtn").addEventListener("click", () => {
    if (onCancel) onCancel();
    close();
  });
  $("modalOkBtn").addEventListener("click", () => {
    if (onOk() !== false) close();
  });
  (
    overlay.querySelector("input, textarea, select") || $("modalOkBtn")
  )?.focus();
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapFocus(e, container) {
  const items = [...container.querySelectorAll(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null,
  );
  if (!items.length) return;
  const first = items[0],
    last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function markInvalid(el, isInvalid) {
  if (!el) return;
  el.style.borderColor = isInvalid ? "#ef4444" : "";
  if (isInvalid)
    el.addEventListener(
      "input",
      () => {
        el.style.borderColor = "";
        clearModalError();
      },
      { once: true },
    );
}

function showModalError(msg) {
  const body = document.querySelector("#appDynamicModal .modal-body-content");
  if (!body) return;
  let err = body.parentElement.querySelector(".modal-error-msg");
  if (!err) {
    err = document.createElement("div");
    err.className = "modal-error-msg";
    body.after(err);
  }
  err.textContent = msg;
}

function clearModalError() {
  const err = document.querySelector("#appDynamicModal .modal-error-msg");
  if (err) err.remove();
}
