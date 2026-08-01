/* Boards UI: masonry columns of accordion cards with favicon tiles, delegated
   drag/drop (one listener set covers every card and tile), right-click menus,
   view switching, and the shared modal/prompt/confirm helpers. */
'use strict';

const ContextMenu = (() => {
  let menuEl = null;

  function init() {
    if (menuEl) return;
    menuEl = document.createElement('div');
    menuEl.className = 'board-menu';
    menuEl.style.display = 'none';
    document.body.appendChild(menuEl);
    document.addEventListener('click', hide);
    document.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
  }
  function hide() { if (menuEl) menuEl.style.display = 'none'; }

  function show(x, y, boardId, bm) {
    init();
    const pinned = !!bm.pinnedToHome;
    setSafeHTML(menuEl, `
      <div class="board-menu-item" data-act="open"><span class="board-menu-icon">${icon('link', 16)}</span><span class="board-menu-label">Open in new tab</span></div>
      <div class="board-menu-item" data-act="incognito"><span class="board-menu-icon">${icon('incognito', 16)}</span><span class="board-menu-label">Open in incognito</span></div>
      <div class="board-menu-item" data-act="copy"><span class="board-menu-icon">${icon('copy', 16)}</span><span class="board-menu-label">Copy URL</span></div>
      <div class="board-menu-sep"></div>
      <div class="board-menu-item" data-act="pin"><span class="board-menu-icon">${icon('pin', 16)}</span><span class="board-menu-label">${pinned ? 'Unpin from Home' : 'Pin to Home'}</span></div>
      <div class="board-menu-item" data-act="edit"><span class="board-menu-icon">${icon('edit', 16)}</span><span class="board-menu-label">Edit link</span></div>
      <div class="board-menu-item danger" data-act="delete"><span class="board-menu-icon">${icon('trash', 16)}</span><span class="board-menu-label">Delete link</span></div>
    `);
    menuEl.querySelectorAll('.board-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        hide();
        const act = item.dataset.act;
        const url = safeHref(bm.url);
        if (act === 'open') {
          window.open(url, '_blank');
        } else if (act === 'incognito') {
          let opened = false;
          if (HAS_EXT && EXT.windows) {
            try {
              Promise.resolve(EXT.windows.create({ url, incognito: true }))
                .catch(() => window.open(url, '_blank'));
              opened = true;
            } catch { opened = false; }
          }
          if (!opened) window.open(url, '_blank');
        } else if (act === 'copy') {
          if (navigator.clipboard) navigator.clipboard.writeText(bm.url).catch(() => {});
        } else if (act === 'pin') {
          const now = BookmarkManager.togglePin(boardId, bm.id);
          if (now === null) {
            ToastSystem.error(`Home holds ${BookmarkManager.PIN_LIMIT} pins. Unpin one first.`);
          } else {
            BoardRenderer.renderBoards();
            HomeRenderer.renderPinned();
            ToastSystem.success(now ? 'Pinned to Home' : 'Unpinned from Home');
          }
        } else if (act === 'edit') {
          BoardRenderer.showEditLinkPopup(boardId, bm);
        } else if (act === 'delete') {
          const board = BoardManager.find(boardId);
          const idx = board ? board.bookmarks.findIndex(x => x.id === bm.id) : -1;
          BookmarkManager.remove(boardId, bm.id);
          BoardRenderer.renderBoards();
          HomeRenderer.renderPinned();   // a deleted link must not survive as a pin
          ToastSystem.action('Link deleted', 'Undo', () => {
            BookmarkManager.insertAt(boardId, bm, idx);
            BoardRenderer.renderBoards();
            HomeRenderer.renderPinned();
          });
        }
      });
    });
    place(x, y);
  }

  function showBoardMenu(x, y, board) {
    init();
    setSafeHTML(menuEl, `
      <div class="board-menu-item" data-act="rename"><span class="board-menu-icon">${icon('edit', 16)}</span><span class="board-menu-label">Rename Board</span></div>
      <div class="board-menu-item" data-act="addlink"><span class="board-menu-icon">+</span><span class="board-menu-label">Add Link</span></div>
      <div class="board-menu-item" data-act="openall"><span class="board-menu-icon">${icon('grid', 16)}</span><span class="board-menu-label">Open all in tabs</span></div>
      <div class="board-menu-sep"></div>
      <div class="board-menu-item" data-act="moveup"><span class="board-menu-icon">↑</span><span class="board-menu-label">Move up</span></div>
      <div class="board-menu-item" data-act="movedown"><span class="board-menu-icon">↓</span><span class="board-menu-label">Move down</span></div>
      <div class="board-menu-sep"></div>
      <div class="board-menu-item danger" data-act="delete"><span class="board-menu-icon">${icon('trash', 16)}</span><span class="board-menu-label">Delete Board</span></div>
    `);
    menuEl.querySelectorAll('.board-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        hide();
        const act = item.dataset.act;
        if (act === 'rename') {
          showPrompt('Rename Board', 'Board name:', board.name, (val) => {
            if (val) { BoardManager.rename(board.id, val); BoardRenderer.renderBoards(); HomeRenderer.renderPinned(); }
          });
        } else if (act === 'addlink') {
          BoardRenderer.showAddLinkPopup(board.id);
        } else if (act === 'openall') {
          TabStash.openAll(board);
        } else if (act === 'moveup' || act === 'movedown') {
          if (BoardManager.shift(board.id, act === 'moveup' ? -1 : 1)) {
            BoardRenderer.renderBoards();
          }
        } else if (act === 'delete') {
          const idx = BoardManager.getAll().findIndex(b => b.id === board.id);
          BoardManager.deleteBoard(board.id);
          BoardRenderer.renderBoards();
          HomeRenderer.renderPinned();
          ToastSystem.action(`Board "${board.name}" deleted`, 'Undo', () => {
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
    menuEl.style.visibility = 'hidden';
    menuEl.style.display = 'block';
    const r = menuEl.getBoundingClientRect();
    menuEl.style.left = `${Math.max(8, Math.min(x, window.innerWidth - r.width - 8))}px`;
    menuEl.style.top = `${Math.max(8, Math.min(y, window.innerHeight - r.height - 8))}px`;
    menuEl.style.visibility = '';
  }

  return { show, showBoardMenu, hide };
})();

const DragDropEngine = (() => {
  let draggedType = null, draggedBoardId = null, draggedBmInfo = null;

  const clearMarkers = () =>
    $$('.et-board-card.drop-before, .et-board-card.drop-after').forEach(el => el.classList.remove('drop-before', 'drop-after'));

  function install(container) {
    container.addEventListener('dragstart', (e) => {
      const link = e.target.closest('.et-board-tile');
      if (link) {
        draggedType = 'bookmark';
        const board = link.closest('.et-board-card');
        draggedBmInfo = { boardId: board?.dataset.id, bmId: link.dataset.id };
        link.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();
        return;
      }
      const header = e.target.closest('.et-board-card-header');
      if (header && !e.target.closest('button')) {
        const board = header.closest('.et-board-card');
        if (board && !e.target.closest('textarea') && !e.target.closest('input')) {
          draggedType = 'board';
          draggedBoardId = board.dataset.id;
          board.classList.add('is-dragging');
          document.body.classList.add('dragging-board');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', draggedBoardId);
        }
      }
    });

    container.addEventListener('dragend', () => {
      $$('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
      document.body.classList.remove('dragging-board');
      clearMarkers();
      draggedType = null; draggedBoardId = null; draggedBmInfo = null;
    });

    container.addEventListener('dragover', (e) => {
      if (draggedType === 'bookmark') {
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      } else if (draggedType === 'board') {
        const board = e.target.closest('.et-board-card');
        if (!board || board.dataset.id === draggedBoardId) return;
        e.preventDefault(); e.dataTransfer.dropEffect = 'move';
        const rect = board.getBoundingClientRect();
        const after = e.clientY >= rect.top + rect.height / 2;
        board.classList.toggle('drop-before', !after);
        board.classList.toggle('drop-after', after);
      }
    });

    container.addEventListener('dragleave', (e) => {
      (e.target.closest('.et-board-card'))?.classList.remove('drop-before', 'drop-after');
    });

    container.addEventListener('drop', (e) => {
      const board = e.target.closest('.et-board-card');
      if (draggedType === 'bookmark' && draggedBmInfo && board) {
        e.preventDefault();
        const overLink = e.target.closest('.et-board-tile');
        if (overLink && overLink.dataset.id === draggedBmInfo.bmId) return;
        const beforeId = overLink ? overLink.dataset.id : null;
        BookmarkManager.move(draggedBmInfo.boardId, board.dataset.id, draggedBmInfo.bmId, beforeId);
        BoardRenderer.renderBoards();
        HomeRenderer.renderPinned();
      } else if (draggedType === 'board' && board && board.dataset.id !== draggedBoardId) {
        e.preventDefault();
        const after = board.classList.contains('drop-after');
        clearMarkers();
        BoardManager.reorder(draggedBoardId, board.dataset.id, after);
        BoardRenderer.renderBoards();
      }
    });
  }

  return { install };
})();

const BoardRenderer = (() => {
  const boardsArea = $('boardsArea');

  const promptNewBoard = (col = null) =>
    showPrompt('New Board', 'Board name:', 'Bookmarks', (val) => {
      if (val) { BoardManager.addBoard(val, col); renderBoards(); }
    });

  function init() {
    let resizeT = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => {
        if ($('boardsView')?.classList.contains('active')) renderBoards();
      }, 150);
    });

    if (!boardsArea) return;

    DragDropEngine.install(boardsArea);

    boardsArea.addEventListener('click', (e) => {
      const boardMenu = e.target.closest('.et-board-menu-btn');
      if (boardMenu) {
        e.stopPropagation();
        const board = BoardManager.find(boardMenu.closest('.et-board-card')?.dataset.id);
        if (board) { const r = boardMenu.getBoundingClientRect(); ContextMenu.showBoardMenu(r.left, r.bottom + 4, board); }
        return;
      }
      const addLink = e.target.closest('.et-board-add-link-btn');
      if (addLink) {
        e.stopPropagation();
        const acc = addLink.closest('.et-board-card');
        if (acc) showAddLinkPopup(acc.dataset.id);
        return;
      }

      const header = e.target.closest('.et-board-card-header');
      if (header) {
        const acc = header.closest('.et-board-card');
        if (acc) {
          const boardId = acc.dataset.id;
          const body = acc.querySelector('.et-board-card-body');
          const isExp = acc.classList.contains('is-expanded');
          acc.classList.toggle('is-expanded', !isExp);
          if (body) body.style.display = !isExp ? 'block' : 'none';

          const data = StorageManager.getData();
          if (!Array.isArray(data.collapsedBoards)) data.collapsedBoards = [];
          if (isExp) {
            if (!data.collapsedBoards.includes(boardId)) data.collapsedBoards.push(boardId);
          } else {
            data.collapsedBoards = data.collapsedBoards.filter(id => id !== boardId);
          }
          StorageManager.save();
        }
        return;
      }

      if (e.target.closest('#btnCreateFirstBoard') || e.target.closest('.et-add-board-tile')) {
        promptNewBoard();
        return;
      }

      const tile = e.target.closest('.et-board-tile');
      if (tile) {
        const acc = tile.closest('.et-board-card');
        if (acc) {
          const b = BoardManager.find(acc.dataset.id);
          const bm = b?.bookmarks.find(x => x.id === tile.dataset.id);
          if (bm) window.open(safeHref(bm.url), '_blank', 'noopener');
        }
      }
    });

    boardsArea.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const tile = e.target.closest('.et-board-tile');
      if (tile) {
        e.preventDefault();
        const acc = tile.closest('.et-board-card');
        const b = BoardManager.find(acc?.dataset.id);
        const bm = b?.bookmarks.find(x => x.id === tile.dataset.id);
        if (bm) window.open(safeHref(bm.url), '_blank', 'noopener');
        return;
      }
      const header = e.target.closest('.et-board-card-header');
      if (header) { e.preventDefault(); header.click(); }
    });

    boardsArea.addEventListener('dblclick', (e) => {
      if (!e.target.closest('.et-board-card-title')) return;
      const acc = e.target.closest('.et-board-card');
      const board = BoardManager.find(acc?.dataset.id);
      if (board) showPrompt('Rename Board', 'Board name:', board.name, (val) => {
        if (val) { BoardManager.rename(board.id, val); renderBoards(); HomeRenderer.renderPinned(); }
      });
    });

    boardsArea.addEventListener('contextmenu', (e) => {
      const tile = e.target.closest('.et-board-tile');
      const acc = e.target.closest('.et-board-card');
      if (tile && acc) {
        e.preventDefault();
        const b = BoardManager.find(acc.dataset.id);
        const bm = b?.bookmarks.find(x => x.id === tile.dataset.id);
        if (bm) ContextMenu.show(e.clientX, e.clientY, b.id, bm);
      }
    });
  }

  let renderBoardsRAF = null;
  function renderBoards() {
    if (renderBoardsRAF) cancelAnimationFrame(renderBoardsRAF);
    renderBoardsRAF = requestAnimationFrame(() => {
      if (!boardsArea) return;
      const boards = BoardManager.getAll();

      if (!boards || boards.length === 0) {
        setSafeHTML(boardsArea, `
          <div class="boards-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 24px; opacity: 0.8;"><rect x="3" y="3" width="20" height="20" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            <div class="boards-empty-title">No boards yet</div>
            <div class="boards-empty-body">Organize your bookmarks into custom boards. Pin the ones you use most to your Home page.</div>
            <button id="btnCreateFirstBoard" class="boards-empty-btn"><span>+</span> Add Board</button>
          </div>`);
        return;
      }

      const data = StorageManager.getData();
      if (Array.isArray(data.expandedBoards) && !Array.isArray(data.collapsedBoards)) {
        data.collapsedBoards = boards.filter(b => !data.expandedBoards.includes(b.id)).map(b => b.id);
        delete data.expandedBoards;
        StorageManager.save();
      }
      const collapsedBoards = Array.isArray(data.collapsedBoards) ? data.collapsedBoards : [];

      const gridContainer = document.createElement('div');
      gridContainer.className = 'et-board-grid';

      const uiScale = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--ui-scale')
      ) || 1;
      const colW = Math.round((StorageManager.getSettings().boardWidth || 270) * uiScale);
      gridContainer.style.setProperty('--board-col-w', `${colW}px`);

      const areaWidth = boardsArea.clientWidth || (window.innerWidth - 80) || 1200;
      const numCols = Math.max(1, Math.floor((areaWidth + 16) / (colW + 16)));

      const colElements = [];
      for (let i = 0; i < numCols; i++) {
        const colDiv = document.createElement('div');
        colDiv.className = 'et-board-col';
        colElements.push(colDiv);
        gridContainer.appendChild(colDiv);
      }

      boards.forEach((board, index) => {
        const isExp = !collapsedBoards.includes(board.id);
        const colIdx = (typeof board.col === 'number' && board.col >= 0 && board.col < numCols)
          ? board.col
          : (index % numCols);
        colElements[colIdx].appendChild(createBoardAccordionElement(board, isExp));
      });

      let minCol = 0;
      let minLen = colElements[0].children.length;
      for (let i = 1; i < colElements.length; i++) {
        if (colElements[i].children.length < minLen) {
          minLen = colElements[i].children.length;
          minCol = i;
        }
      }

      const addTile = document.createElement('div');
      addTile.className = 'et-add-board-tile';
      addTile.id = 'btnColAddBoard';
      addTile.setAttribute('role', 'button');
      addTile.setAttribute('tabindex', '0');
      setSafeHTML(addTile, `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        <span>+ Add Board</span>`);
      colElements[minCol].appendChild(addTile);

      wireFavicons(gridContainer);
      boardsArea.replaceChildren(gridContainer);
    });
  }

  function createBoardAccordionElement(board, isExpanded) {
    const acc = document.createElement('div');
    acc.className = `et-board-card ${isExpanded ? 'is-expanded' : ''}`;
    acc.setAttribute('data-id', board.id);
    acc.setAttribute('draggable', 'true');

    setSafeHTML(acc, `
      <div class="et-board-card-header" role="button" tabindex="0"
           aria-expanded="${isExpanded}" aria-label="Toggle board ${escapeHtml(board.name)}">
        <div class="et-board-card-left">
          <button class="et-board-chevron" tabindex="-1" title="Toggle Board">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <span class="et-board-card-title">${escapeHtml(board.name)}</span>
        </div>
        <div class="et-board-card-right">
          <button class="et-board-add-link-btn" title="Add Link">+</button>
          <button class="et-board-menu-btn" title="Options">&#8942;</button>
        </div>
      </div>
      <div class="et-board-card-body" style="display: ${isExpanded ? 'block' : 'none'};">
        <div class="et-board-tiles">
          ${board.bookmarks && board.bookmarks.length > 0 ? board.bookmarks.map(bm => `
              <div class="et-board-tile${bm.pinnedToHome ? ' is-pinned' : ''}" data-id="${bm.id}" draggable="true" role="button" tabindex="0"
                   aria-label="${escapeHtml(bm.title)}${bm.pinnedToHome ? ', pinned to Home' : ''}" title="${escapeHtml(bm.title)} (${escapeHtml(bm.url)})">
                <img class="et-board-tile-icon" ${faviconAttr(bm.url)} alt="" loading="lazy" />
                <span class="et-board-tile-title">${escapeHtml(bm.title)}</span>
                ${bm.pinnedToHome ? `<span class="board-pin-badge" aria-hidden="true">${icon('pin', 11)}</span>` : ''}
              </div>
            `).join('') : `
            <div class="et-board-empty">Add a link</div>
          `}
        </div>
      </div>
    `);
    return acc;
  }

  function showAddLinkPopup(boardId) {
    showCustomModal('Add Link', `
      <div class="dialog-stack">
        <div class="dialog-field">
          <label class="dialog-label">Title</label>
          <input type="text" id="bmTitleInp" class="dialog-input" placeholder="Title (e.g. GitHub)" />
        </div>
        <div class="dialog-field">
          <label class="dialog-label">URL</label>
          <input type="text" id="bmUrlInp" class="dialog-input" placeholder="https://github.com" />
        </div>
      </div>`, () => {
      const titleEl = $('bmTitleInp');
      const urlEl = $('bmUrlInp');
      const title = titleEl.value.trim();
      const url = urlEl.value.trim();
      if (!title || !url) {
        markInvalid(titleEl, !title); markInvalid(urlEl, !url);
        showModalError(!title && !url ? 'Title and URL are required.' : !title ? 'Title is required.' : 'URL is required.');
        return false;
      }
      let finalUrl = url;
      if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
      /* Tags are set from the Edit Link dialog instead -- adding a link is the
         hot path and the extra field slowed it down for something most links
         never use. */
      if (BookmarkManager.add(boardId, title, finalUrl, [])) {
        renderBoards();
        HomeRenderer.renderPinned();
      }
      ToastSystem.success('Link added');
      return true;
    });
  }

  function showEditLinkPopup(boardId, bm) {
    showCustomModal('Edit Link', `
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
          <label class="dialog-label">Tags (Optional)</label>
          <input type="text" id="bmTagsInp" class="dialog-input" value="${(bm.tags || []).join(', ')}" />
        </div>
      </div>`, () => {
      const titleEl = $('bmTitleInp');
      const urlEl = $('bmUrlInp');
      const title = titleEl.value.trim();
      const url = urlEl.value.trim();
      if (!title || !url) {
        markInvalid(titleEl, !title); markInvalid(urlEl, !url);
        showModalError(!title && !url ? 'Title and URL are required.' : !title ? 'Title is required.' : 'URL is required.');
        return false;
      }
      const rawTags = $('bmTagsInp').value;
      let finalUrl = url;
      if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl;
      const tags = rawTags.split(',').map(t => t.trim()).filter(Boolean);
      BookmarkManager.edit(boardId, bm.id, title, finalUrl, tags);
      renderBoards();
      HomeRenderer.renderPinned();
      return true;
    });
  }

  return { init, renderBoards, showAddLinkPopup, showEditLinkPopup };
})();

const ViewController = (() => {
  const views = { home: 'homeView', boards: 'boardsView', notes: 'notesView' };

  function init() {
    $$('.et-main-tab').forEach(btn => {
      btn.addEventListener('click', () => show(btn.dataset.tab));
    });
    $('addBoardTopBtn')?.addEventListener('click', () => {
      showPrompt('New Board', 'Board name:', 'Bookmarks', (val) => {
        if (val) {
          BoardManager.addBoard(val);
          BoardRenderer.renderBoards();
          HomeRenderer.renderPinned();
        }
      });
    });
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && ['1', '2', '3'].includes(e.key)) {
        const tab = { '1': 'home', '2': 'boards', '3': 'notes' }[e.key];
        e.preventDefault();
        show(tab);
      }
    });
    show('home');
  }

  function show(tab) {
    if (!views[tab]) tab = 'home';
    TabManager.set(tab);

    Object.entries(views).forEach(([name, id]) => {
      const el = $(id);
      if (el) el.classList.toggle('active', name === tab);
    });
    $$('.et-main-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

    if (tab === 'boards') BoardRenderer.renderBoards();
    else if (tab === 'notes') NotesRenderer.render();
    else HomeRenderer.render();
  }

  return { init, show };
})();

function showPrompt(title, labelText, defaultVal, onSave) {
  showCustomModal(title, `
    <div class="dialog-field">
      <label class="dialog-label">${labelText}</label>
      <input type="text" id="dlgInput" class="dialog-input" value="${escapeHtml(defaultVal)}" />
    </div>`, () => {
    const val = $('dlgInput').value.trim();
    onSave(val);
    return true;
  });
  $('dlgInput')?.select();
}

function showConfirm(title, messageText, onConfirm) {
  showCustomModal(title, `<p class="dialog-message">${escapeHtml(messageText)}</p>`, () => {
    onConfirm();
    return true;
  }, 'Confirm', true);
}

function showCustomModal(title, bodyHtml, onOk, okBtnText = 'Save', danger = false) {
  const returnFocusTo = document.activeElement;
  let overlay = $('appDynamicModal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'appDynamicModal';
    overlay.className = 'dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'modalTitle');
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); $('modalOkBtn')?.click(); }
      else if (e.key === 'Escape') { e.stopPropagation(); close(); }
      else if (e.key === 'Tab') trapFocus(e, overlay);
    });
  }
  setSafeHTML(overlay, `
    <div class="et-modal-card">
      <h3 class="dialog-modal-title" id="modalTitle">${escapeHtml(title)}</h3>
      <div class="modal-body-content">${bodyHtml}</div>
      <div class="dialog-modal-actions">
        <button id="modalCancelBtn" class="et-modal-btn">Cancel</button>
        <button id="modalOkBtn" class="et-modal-btn primary${danger ? ' danger' : ''}">${escapeHtml(okBtnText)}</button>
      </div>
    </div>`);
  function close() {
    overlay.remove();
    if (returnFocusTo && document.contains(returnFocusTo)) returnFocusTo.focus();
  }
  $('modalCancelBtn').addEventListener('click', close);
  $('modalOkBtn').addEventListener('click', () => { if (onOk() !== false) close(); });
  (overlay.querySelector('input, textarea, select') || $('modalOkBtn'))?.focus();
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapFocus(e, container) {
  const items = [...container.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function markInvalid(el, isInvalid) {
  if (!el) return;
  el.style.borderColor = isInvalid ? '#ef4444' : '';
  if (isInvalid) el.addEventListener('input', () => { el.style.borderColor = ''; clearModalError(); }, { once: true });
}

function showModalError(msg) {
  const body = document.querySelector('#appDynamicModal .modal-body-content');
  if (!body) return;
  let err = body.parentElement.querySelector('.modal-error-msg');
  if (!err) {
    err = document.createElement('div');
    err.className = 'modal-error-msg';
    body.after(err);
  }
  err.textContent = msg;
}

function clearModalError() {
  const err = document.querySelector('#appDynamicModal .modal-error-msg');
  if (err) err.remove();
}
