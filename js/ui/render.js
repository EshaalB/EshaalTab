"use strict";

const uiMode = () =>
  document.body.classList.contains("theme-light") ? "light" : "dark";

const boardPreset = (hex) => BoardManager.BOARD_PAINT[String(hex).toLowerCase()];
const boardTint = (hex) => boardPreset(hex)?.[uiMode()] || hex;

const mixRgb = (a, b, t) => ({
  r: a.r * t + b.r * (1 - t),
  g: a.g * t + b.g * (1 - t),
  b: a.b * t + b.b * (1 - t),
});

function boardBackdrop() {
  const s = StorageManager.getSettings();
  const root = getComputedStyle(document.documentElement);
  if (["image", "video"].includes(s.backgroundType) && s.wpTone) {
    const scrim = s.wallpaperOverlay ? (s.wallpaperOverlayOpacity ?? 35) / 100 : 0;
    return mixRgb(Contrast.toRgb(s.wpTone.middle || s.wpTone.overall), { r: 0, g: 0, b: 0 }, 1 - scrim);
  }
  return Contrast.toRgb(root.getPropertyValue("--page-bg").trim() || (uiMode() === "light" ? "#f7f8fa" : "#121318"));
}

function paintBoardInk(card) {
  const light = uiMode() === "light";
  const color = card.dataset.color;
  const root = getComputedStyle(document.documentElement);
  const alpha = parseFloat(root.getPropertyValue("--board-opacity"));
  const backdrop = boardBackdrop();
  const solid = color
    ? mixRgb(Contrast.toRgb(boardTint(color)), Contrast.toRgb(light ? "#f7f8fa" : "#18191f"), boardPreset(color) ? 1 : 0.9)
    : mixRgb(Contrast.toRgb(effectiveBoardAccent()), Contrast.toRgb(light ? "#ffffff" : "#17181e"), light ? 0.17 : 0.35);
  const ink = Contrast.ink(Contrast.toHex(mixRgb(solid, backdrop, Number.isFinite(alpha) ? alpha : 1)));
  card.classList.toggle("ink-dark", ink !== Contrast.INK_LIGHT);
  for (const v of ["--board-ink", "--board-title-ink", "--board-text"]) card.style.setProperty(v, ink);
  card.style.setProperty("--board-text-dim", `color-mix(in srgb, ${ink} 70%, transparent)`);
}

function repaintBoardInk() {
  document.querySelectorAll(".et-board-card").forEach(paintBoardInk);
}

const effectiveBoardAccent = () =>
  (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--accent-color")
      .trim() || "#6366f1"
  ).slice(0, 7);

const ContextMenu = (() => {
  let menuEl = null;

  let invoker = null;

  function init() {
    if (menuEl) return;
    menuEl = document.createElement("div");
    menuEl.className = "board-menu";
    menuEl.setAttribute("role", "menu");
    menuEl.style.display = "none";
    document.body.appendChild(menuEl);
    document.addEventListener("click", () => hide());

    document.addEventListener("scroll", () => hide(), { capture: true, passive: true });
    window.addEventListener("resize", () => hide(), { passive: true });
    menuEl.addEventListener("keydown", onMenuKey);
  }

  function hide(restoreFocus = false) {
    if (!menuEl || menuEl.style.display === "none") return;
    menuEl.style.display = "none";
    menuEl.classList.remove("is-shown");
    if (restoreFocus && invoker?.isConnected) invoker.focus({ preventScroll: true });
    invoker = null;
  }

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

  function availableMoves(boardId) {
    const pos = BoardRenderer.getBoardPosition(boardId);
    if (!pos) return [];
    const moves = [];
    if (pos.index > 0) moves.push({ act: "moveup", icon: "↑", label: "Move up" });
    if (pos.index < pos.count - 1)
      moves.push({ act: "movedown", icon: "↓", label: "Move down" });
    if (pos.col > 0) moves.push({ act: "moveleft", icon: "←", label: "Move left" });

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
      <div class="board-menu-item board-menu-check" data-act="titles" role="menuitemcheckbox" aria-checked="${!board.hideTitles}"><span class="board-menu-icon">${icon(board.hideTitles ? "eyeOff" : "eye", 16)}</span><span class="board-menu-label">Show titles</span><span class="board-menu-tick" aria-hidden="true">${board.hideTitles ? "" : icon("check", 14)}</span></div>
      <div class="board-menu-item" data-act="pinboard"><span class="board-menu-icon">${icon("pin", 16)}</span><span class="board-menu-label">${board.pinnedToHome ? "Unpin from Home" : "Pin board to Home"}</span></div>
      <div class="board-menu-sep"></div>
      <div class="board-menu-swatches" role="group" aria-label="Board colour">
        <button class="board-swatch is-default${board.color ? "" : " active"}" data-color="" title="Theme colour" aria-label="Theme colour"></button>
        ${BoardManager.BOARD_COLORS.map(
          (c) =>
            `<button class="board-swatch${board.color === c ? " active" : ""}" data-color="${c}" style="--swatch: ${c}" title="Board colour" aria-label="Board colour ${c}"></button>`,
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
        } else if (act === "titles") {
          if (board.hideTitles) delete board.hideTitles;
          else board.hideTitles = true;
          StorageManager.save();
          BoardRenderer.renderBoards();
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
          BoardRenderer.commitPaintedLayout();
          const moved =
            act === "moveup"
              ? BoardManager.moveUp(board.id)
              : BoardManager.moveDown(board.id);
          if (moved) BoardRenderer.renderBoards();
        } else if (act === "moveleft" || act === "moveright") {
          BoardRenderer.moveSideways(board.id, act === "moveleft" ? -1 : 1);
        } else if (act === "delete") {
          const count = (board.bookmarks || []).length;

          const doDelete = () => {
            const token = BoardManager.deleteBoard(board.id);
            BoardRenderer.renderBoards();
            HomeRenderer.renderPinned();
            ToastSystem.action(`Board "${board.name}" deleted`, "Undo", () => {
              BoardManager.restoreBoard(token);
              BoardRenderer.renderBoards();
              HomeRenderer.renderPinned();
            });
          };

          if (count >= 3) {
            showConfirm(
              `Delete "${board.name}"?`,
              `This board holds ${count} ${count === 1 ? "link" : "links"}. They will be deleted with it.`,
              doDelete,
              { confirmLabel: "Delete board" },
            );
          } else {
            doDelete();
          }
        }
      });
    });
    place(x, y);
  }

  function place(x, y) {
    menuEl.classList.remove("is-shown");
    menuEl.style.visibility = "hidden";
    menuEl.style.display = "block";
    const r = menuEl.getBoundingClientRect();
    menuEl.style.left = `${Math.max(8, Math.min(x, window.innerWidth - r.width - 8))}px`;
    menuEl.style.top = `${Math.max(8, Math.min(y, window.innerHeight - r.height - 8))}px`;
    menuEl.style.visibility = "";

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
      ".et-board-card.drop-before, .et-board-card.drop-after, .et-board-card.is-drop-target, .et-board-card.is-swap-target, .et-board-col.drop-end, .et-board-tile.drop-before",
    ).forEach((el) =>
      el.classList.remove(
        "drop-before",
        "drop-after",
        "is-drop-target",
        "is-swap-target",
        "drop-end",
      ),
    );

  const lastCardIn = (col) =>
    [...col.querySelectorAll(":scope > .et-board-card")].pop() || null;

  function install(container) {
    let pressTarget = null;
    container.addEventListener(
      "pointerdown",
      (e) => {
        pressTarget = e.target;
      },
      true,
    );

    let hoverBoard = null;
    let hoverEdge = 0;
    let hoverTopEdge = 0;
    let hoverBottomEdge = 0;
    let hoverZone = null;
    let hoverCol = null;
    let hoverTile = null;
    let measureQueued = false;

    function forgetHover() {
      hoverBoard = null;
      hoverZone = null;
      hoverCol = null;
      hoverTile = null;
    }

    function measureHover() {
      if (!hoverBoard || !hoverBoard.isConnected) return;
      const rect = hoverBoard.getBoundingClientRect();

      hoverEdge = rect.bottom - Math.min(60, rect.height * 0.35);

      const strip = Math.max(10, Math.min(56, rect.height * 0.25));
      hoverTopEdge = rect.top + strip;
      hoverBottomEdge = rect.bottom - strip;
    }

    function zoneFor(card, clientY) {
      const dragged = BoardRenderer.getBoardPosition(draggedBoardId);
      const target = BoardRenderer.getBoardPosition(card.dataset.id);
      const sameCol = dragged && target && dragged.col === target.col;
      if (sameCol) return clientY >= hoverEdge ? "after" : "before";
      if (clientY <= hoverTopEdge) return "before";
      if (clientY >= hoverBottomEdge) return "after";
      return "swap";
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

      const zone = zoneFor(board, e.clientY);
      if (zone === hoverZone) return;
      hoverZone = zone;
      board.classList.toggle("drop-before", zone === "before");
      board.classList.toggle("drop-after", zone === "after");
      board.classList.toggle("is-swap-target", zone === "swap");
    });

    container.addEventListener("dragleave", (e) => {
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
        const swap = board.classList.contains("is-swap-target");
        const after = board.classList.contains("drop-after");
        clearMarkers();

        BoardRenderer.commitPaintedLayout();

        if (swap) {
          if (BoardManager.swapBoards(draggedBoardId, board.dataset.id))
            BoardRenderer.renderBoards();
          return;
        }

        const pos = BoardRenderer.getBoardPosition(board.dataset.id);
        const targetCol = pos
          ? pos.col
          : BoardManager.find(board.dataset.id)?.col;
        if (!Number.isInteger(targetCol)) return;

        const rest = BoardManager.columnBoards(targetCol).filter(
          (b) => b.id !== draggedBoardId,
        );
        const at =
          rest.findIndex((b) => b.id === board.dataset.id) + (after ? 1 : 0);
        BoardManager.placeBoard(draggedBoardId, targetCol, at);
        BoardRenderer.renderBoards();
        return;
      }

      if (!board) {
        const col = e.target.closest(".et-board-col");
        const colIdx = col ? Number(col.dataset.col) : NaN;
        clearMarkers();
        if (!Number.isInteger(colIdx)) return;
        e.preventDefault();
        BoardRenderer.commitPaintedLayout();
        BoardManager.placeBoard(draggedBoardId, colIdx, Infinity);
        BoardRenderer.renderBoards();
      }
    });
  }

  return { install };
})();

const BoardRenderer = (() => {
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

  const boardPositions = new Map();

  let paintedColumns = [];

  function commitPaintedLayout() {
    if (!paintedColumns.length) return false;
    if (![...boardPositions.values()].some((pos) => pos.folded)) return false;
    const idToCol = new Map();
    paintedColumns.forEach((colBoards, col) => {
      colBoards.forEach((painted, i) => {
        idToCol.set(painted.id, col);

        const live = BoardManager.find(painted.id);
        if (live) live.order = i;
      });
    });
    BoardManager.applyColumnLayout(idToCol);
    StorageManager.save();
    return true;
  }

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

    const chrome = left.offsetWidth - title.getBoundingClientRect().width;

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
    const areaEl = boardsArea();
    const areaStyle = areaEl ? getComputedStyle(areaEl) : null;
    const realWidth = areaEl
      ? Math.max(
          0,
          areaEl.clientWidth -
            parseFloat(areaStyle.paddingLeft || "0") -
            parseFloat(areaStyle.paddingRight || "0"),
        )
      : 0;
    const areaWidth = realWidth || Math.max(240, window.innerWidth - 32) || 1200;
    const preferredWidth = Math.round(
      (StorageManager.getSettings().boardWidth || 270) * uiScale,
    );

    const floor = measureMinColW();
    const colW = Math.max(floor, Math.min(preferredWidth, areaWidth - 24));
    const numCols = Math.max(1, Math.floor((areaWidth + 16) / (colW + 16)));
    return { colW, numCols, measured: realWidth > 0 };
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

      const header = e.target.closest(".et-board-card-header");

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

      const moreBtn = e.target.closest(".et-board-tile-more");
      if (moreBtn) {
        e.preventDefault();
        e.stopPropagation();
        const acc = moreBtn.closest(".et-board-card");
        const b = BoardManager.find(acc?.dataset.id);
        const bm = b?.bookmarks.find((x) => x.id === moreBtn.dataset.more);
        if (b && bm) {
          const r = moreBtn.getBoundingClientRect();
          ContextMenu.show(r.left, r.bottom + 4, b.id, bm);
        }
        return;
      }

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

  let boardsDirty = false;
  let lastBoardsSignature = "";

  let renderBoardsTimer = null;

  function renderBoards() {
    if (renderBoardsRAF) cancelAnimationFrame(renderBoardsRAF);
    if (renderBoardsTimer) clearTimeout(renderBoardsTimer);
    renderBoardsRAF = null;
    renderBoardsTimer = null;

    const paint = () => {
      if (renderBoardsRAF) cancelAnimationFrame(renderBoardsRAF);
      if (renderBoardsTimer) clearTimeout(renderBoardsTimer);
      renderBoardsRAF = null;
      renderBoardsTimer = null;
      paintBoards();
    };

    if (document.hidden) {
      paint();
      return;
    }
    renderBoardsRAF = requestAnimationFrame(paint);
    renderBoardsTimer = setTimeout(paint, 32);
  }

  function flushBoards() {
    if (!boardsDirty) return;
    boardsDirty = false;
    renderBoards();
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

      const { colW, numCols, measured } = boardLayoutMetrics();
      if (!measured && !document.hidden) {
        boardsDirty = true;
        return;
      }
      boardsDirty = false;
      const signature = [
        numCols,
        colW,
        uiMode(),
        StorageManager.getSettings().remoteFavicons ? 1 : 0,
        JSON.stringify(collapsedBoards),
        JSON.stringify(boards),
      ].join("|");
      if (
        signature === lastBoardsSignature &&
        boardsArea.querySelector(".et-board-grid")
      )
        return;
      lastBoardsSignature = signature;
      gridContainer.style.setProperty("--board-col-w", `${colW}px`);

      const colElements = [];
      for (let i = 0; i < numCols; i++) {
        const colDiv = document.createElement("div");
        colDiv.className = "et-board-col";
        colDiv.dataset.col = String(i);
        colElements.push(colDiv);
        gridContainer.appendChild(colDiv);
      }

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

      lastNumCols = numCols;

      const isPlaced = (b) => Number.isInteger(b.col) && b.col >= 0;

      const toPlace = boards.filter((b) => !isPlaced(b));
      if (toPlace.length) {
        const colHeights = new Array(numCols).fill(0);

        boards.filter(isPlaced).forEach((b) => {
          const c = Math.min(b.col, numCols - 1);
          colHeights[c] +=
            estimateHeight(b, !collapsedBoards.includes(b.id)) + COL_GAP;
        });
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

      if (BoardManager.compactColumns()) StorageManager.save();

      const maxCol = Math.max(
        0,
        ...boards.map((b) => (Number.isInteger(b.col) ? b.col : 0)),
      );

      const folded = maxCol >= numCols;
      const displayCol = (col) => {
        const c = Number.isInteger(col) && col >= 0 ? col : 0;
        return c < numCols ? c : c % numCols;
      };

      boardPositions.clear();
      paintedColumns = Array.from({ length: numCols }, () => []);

      [...boards]
        .sort((a, b) => {
          const ca = Number.isInteger(a.col) ? a.col : 0;
          const cb = Number.isInteger(b.col) ? b.col : 0;
          return ca - cb || (a.order ?? 0) - (b.order ?? 0);
        })
        .forEach((board) => paintedColumns[displayCol(board.col)].push(board));

      paintedColumns.forEach((colBoards, col) => {
        colBoards.forEach((board, i) => {
          boardPositions.set(board.id, {
            col,
            numCols,
            index: i,
            count: colBoards.length,
            maxCol,
            folded,
          });
          const isExp = !collapsedBoards.includes(board.id);
          colElements[col].appendChild(
            createBoardAccordionElement(board, isExp),
          );
        });
      });

      const addTile = document.createElement("div");
      addTile.className = "et-add-board-tile";
      addTile.id = "btnColAddBoard";
      addTile.setAttribute("role", "button");
      addTile.setAttribute("tabindex", "0");

      setSafeHTML(
        addTile,
        `<span class="et-add-board-plus" aria-hidden="true">+</span><span>Add board</span>`,
      );

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

  function slideBoard(body, open, fromHeight = null) {
    slideHeight(body, open, "is-animating", fromHeight);
  }

  function toggleBoard(acc) {
    if (!acc) return;
    const boardId = acc.dataset.id;
    const isExp = acc.classList.contains("is-expanded");
    const cardBody = acc.querySelector(".et-board-card-body");

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
    acc.classList.toggle("hide-titles", !!board.hideTitles);

    if (board.color) {
      const preset = !!boardPreset(board.color);
      acc.classList.add("has-own-color");
      acc.classList.toggle("is-pastel", preset);
      acc.style.setProperty("--board-accent", boardTint(board.color));
      acc.dataset.color = board.color;
    }
    paintBoardInk(acc);

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
                    let host = bm.url;
                    try { host = new URL(bm.url).hostname.replace(/^www\./, ""); } catch {}
                    const name = rawTitle || host;
                    return `
              <div class="et-board-tile${bm.pinnedToHome ? " is-pinned" : ""}${rawTitle ? "" : " is-icon-only"}" data-id="${bm.id}" draggable="true" role="button" tabindex="0"
                   aria-label="${escapeHtml(name)}${bm.pinnedToHome ? ", pinned to Home" : ""}" title="${escapeHtml(name)} (${escapeHtml(bm.url)})">
                <button type="button" class="et-board-tile-more" data-more="${bm.id}"
                        tabindex="-1" aria-hidden="true"
                        title="More actions for ${escapeHtml(name)} (or right-click)">${icon("more", 12)}</button>
                <img class="et-board-tile-icon" ${faviconAttr(bm.url)} alt="" width="26" height="26" loading="lazy" />
                <span class="et-board-tile-title" title="${escapeHtml(rawTitle)}">${escapeHtml(rawTitle)}</span>
                <button type="button" class="board-pin-badge${bm.pinnedToHome ? " is-pinned" : ""}" data-pin="${bm.id}"
                        aria-pressed="${!!bm.pinnedToHome}"
                        title="${bm.pinnedToHome ? "Unpin from Home" : "Pin to Home"}"
                        aria-label="${bm.pinnedToHome ? "Unpin" : "Pin"} ${escapeHtml(name)} to Home">${icon("pinFilled", 13)}</button>
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
          <label class="dialog-label">Title (optional)</label>
          <input type="text" id="bmTitleInp" class="dialog-input" placeholder="Leave empty to show only the icon" />
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
        if (!url) {
          markInvalid(urlEl, true);
          showModalError("URL is required.");
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
          <label class="dialog-label">Title (optional)</label>
          <input type="text" id="bmTitleInp" class="dialog-input" placeholder="Leave empty to show only the icon" value="${escapeHtml(bm.title)}" />
        </div>
        <div class="dialog-field">
          <label class="dialog-label">URL</label>
          <input type="text" id="bmUrlInp" class="dialog-input" value="${escapeHtml(bm.url)}" />
        </div>
      </div>`,
      () => {
        const titleEl = $("bmTitleInp");
        const urlEl = $("bmUrlInp");
        const title = titleEl.value.trim();
        const url = urlEl.value.trim();
        if (!url) {
          markInvalid(urlEl, true);
          showModalError("URL is required.");
          return false;
        }
        let finalUrl = url;
        if (!/^https?:\/\//i.test(finalUrl)) finalUrl = "https://" + finalUrl;
        BookmarkManager.edit(boardId, bm.id, title, finalUrl, bm.tags || []);
        renderBoards();
        HomeRenderer.renderPinned();
        return true;
      },
    );
  }

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

  function moveSideways(boardId, delta) {
    const pos = boardPositions.get(boardId);
    if (!pos) return false;

    commitPaintedLayout();
    const board = BoardManager.find(boardId);
    if (!board) return false;
    const target = pos.col + delta;
    if (target < 0 || target >= pos.numCols) return false;
    const dest = BoardManager.columnBoards(target);

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
    commitPaintedLayout,
    flushBoards,
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

    show(TabManager.get());
  }

  let requestedTab = null;

  function show(tab) {
    if (!views[tab]) tab = "home";
    requestedTab = tab;
    applyTab(tab);
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

    Object.keys(views).forEach((name) =>
      document.body.classList.toggle(`view-${name}`, name === tab),
    );

    if (tab === "boards") {
      BoardRenderer.renderBoards();

      BoardRenderer.flushBoards();
    }
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
      <input type="text" id="dlgInput" class="dialog-input" value="${escapeHtml(defaultVal)}"
             maxlength="80" autocomplete="off" spellcheck="false" />
    </div>`,
    () => {
      const val = $("dlgInput").value.trim();
      onSave(val);
      return true;
    },
  );
  $("dlgInput")?.select();
}

const DIALOG_GLYPHS = {
  danger:
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  warning: '<path d="M12 8v5"/><path d="M12 17h.01"/>',
  info: '<path d="M12 16v-5"/><path d="M12 8h.01"/>',
};

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
