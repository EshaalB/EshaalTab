"use strict";

const NotesRenderer = (() => {
  let bound = false;
  let tabsBound = false;

  // True once the user has actually edited the textarea in this page. Until
  // then the textarea's value is not authoritative and must never be written
  // back over stored notes (see the sync guard in js/main.js).
  let dirty = false;

  let sessionStart = null;

  let historyIndex = -1;
  let draftBeforeHistory = null;

  function commitSessionToHistory() {
    if (sessionStart === null) return;
    const area = $("notesArea");
    if (area && sessionStart !== area.value)
      NotesManager.pushHistory(sessionStart);
    sessionStart = null;
  }

  function flushPending() {
    const area = $("notesArea");
    if (!area || !bound || !dirty) return;
    if (area.value !== NotesManager.get()) {
      NotesManager.set(area.value);
    }
    commitSessionToHistory();
  }

  // The textarea only holds real content once it has been rendered *and*
  // edited. Anything else is an empty placeholder that must not be persisted.
  function hasLiveEdits() {
    return bound && dirty;
  }

  // Rate-limited: `input` fires per keystroke, and once someone is sitting at
  // the cap every further character would otherwise raise its own toast.
  let truncWarnedAt = 0;
  function warnTruncated() {
    if (Date.now() - truncWarnedAt < 10000) return;
    truncWarnedAt = Date.now();
    ToastSystem.info(
      `Note is full at ${NotesManager.MAX_CHARS.toLocaleString()} characters — the rest was not saved.`,
    );
  }

  function updateStats(text) {
    const badge = $("notesStatsBadge");
    if (!badge) return;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    badge.textContent = `${words} word${words === 1 ? "" : "s"}`;
  }

  function markSaved(saved) {
    $("notesSaveBtn")?.classList.toggle("is-saved", saved);
  }

  // Commits whatever is in the textarea to the *current* note before the
  // active note changes underneath it, so switching tabs can't lose edits.
  function commitCurrent() {
    const area = $("notesArea");
    if (!area || !bound) return;
    if (area.value !== NotesManager.get()) NotesManager.setImmediate(area.value);
    commitSessionToHistory();
  }

  function switchTo(id) {
    if (id === NotesManager.getActiveId()) return;
    commitCurrent();
    NotesManager.setActive(id);
    const area = $("notesArea");
    if (area) {
      area.value = NotesManager.get();
      updateStats(area.value);
      markSaved(true);
    }
    historyIndex = -1;
    sessionStart = null;
    renderTabs();
  }

  function renderTabs() {
    const strip = $("notesTabs");
    if (!strip) return;
    const notes = NotesManager.list();
    const activeId = NotesManager.getActiveId();
    const atLimit = notes.length >= NotesManager.MAX_TABS;

    setSafeHTML(
      strip,
      notes
        .map(
          (n) => `
        <button
          type="button"
          class="et-notes-tab ${n.id === activeId ? "is-active" : ""}"
          role="tab"
          aria-selected="${n.id === activeId}"
          data-id="${escapeHtml(n.id)}"
          title="${escapeHtml(n.title)} — double-click to rename"
        >
          <span class="et-notes-tab-label">${escapeHtml(n.title)}</span>
          ${notes.length > 1 ? `<span class="et-notes-tab-close" role="button" aria-label="Delete ${escapeHtml(n.title)}">&times;</span>` : ""}
        </button>`,
        )
        .join("") +
        `<button type="button" class="et-notes-tab-add" id="notesTabAdd" ${atLimit ? "disabled" : ""} title="${atLimit ? `Limit is ${NotesManager.MAX_TABS} notes` : "New note"}">+</button>`,
    );

    if (!tabsBound) {
      tabsBound = true;

      strip.addEventListener("click", (e) => {
        if (e.target.closest("#notesTabAdd")) {
          // Must commit *before* adding: `add` makes the new note active, so
          // committing afterwards would write the old note's text into it.
          commitCurrent();
          const made = NotesManager.add();
          if (!made) {
            ToastSystem.info(`Notepad holds ${NotesManager.MAX_TABS} notes.`);
            return;
          }
          const area = $("notesArea");
          if (area) {
            area.value = "";
            updateStats("");
            markSaved(true);
            area.focus();
          }
          sessionStart = null;
          renderTabs();
          return;
        }

        const tab = e.target.closest(".et-notes-tab");
        if (!tab) return;
        const id = tab.dataset.id;

        if (e.target.closest(".et-notes-tab-close")) {
          e.stopPropagation();
          const note = NotesManager.list().find((n) => n.id === id);
          const doDelete = () => {
            const wasActive = id === NotesManager.getActiveId();
            if (wasActive) commitSessionToHistory();
            if (!NotesManager.remove(id)) return;
            const area = $("notesArea");
            if (wasActive && area) {
              area.value = NotesManager.get();
              updateStats(area.value);
              markSaved(true);
              sessionStart = null;
            }
            renderTabs();
            ToastSystem.info("Note deleted");
          };
          if (note && note.text.trim()) {
            showCustomModal(
              "Delete note?",
              `<p class="dialog-message">“${escapeHtml(note.title)}” has content. This cannot be undone.</p>`,
              () => {
                doDelete();
                return true;
              },
              "Delete",
            );
          } else {
            doDelete();
          }
          return;
        }

        switchTo(id);
      });

      strip.addEventListener("dblclick", (e) => {
        const tab = e.target.closest(".et-notes-tab");
        if (!tab) return;
        const id = tab.dataset.id;
        const note = NotesManager.list().find((n) => n.id === id);
        if (!note) return;
        showPrompt("Rename note", "Note name:", note.title, (val) => {
          if (val && val.trim() && NotesManager.rename(id, val)) renderTabs();
        });
      });
    }
  }

  function render() {
    const area = $("notesArea");
    if (!area) return;
    if (document.activeElement !== area) {
      area.value = NotesManager.get();
      updateStats(area.value);
      markSaved(true);
    }
    renderTabs();
    ClipboardRenderer.render();
    if (!bound) {
      bound = true;

      area.addEventListener("focus", () => {
        if (sessionStart === null) sessionStart = area.value;
      });

      area.addEventListener("input", () => {
        const val = area.value;
        dirty = true;
        updateStats(val);
        markSaved(false);
        historyIndex = -1;
        NotesManager.set(val);

        // A note over the cap is stored short. Saying so once, and pulling the
        // textarea back to what was actually kept, beats letting someone paste
        // a long document and only discover the missing tail later.
        if (NotesManager.lastWriteTruncated()) {
          area.value = NotesManager.get();
          updateStats(area.value);
          warnTruncated();
        }
      });

      area.addEventListener("blur", () => {
        // Write through immediately rather than via the 120ms debounce, so the
        // "saved" badge below is truthful and a fast tab-close can't drop it.
        NotesManager.setImmediate(area.value);
        markSaved(true);
        commitSessionToHistory();
      });

      area.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const start = area.selectionStart;
          const end = area.selectionEnd;
          area.value =
            area.value.substring(0, start) + "  " + area.value.substring(end);
          area.selectionStart = area.selectionEnd = start + 2;
          dirty = true;
          updateStats(area.value);
          markSaved(false);
          NotesManager.set(area.value);
          return;
        }

        const atStart = area.selectionStart === 0 && area.selectionEnd === 0;
        if (e.key === "ArrowUp" && atStart) {
          const hist = NotesManager.getHistory();
          if (!hist.length) return;
          e.preventDefault();
          if (historyIndex === -1) draftBeforeHistory = area.value;
          if (historyIndex < hist.length - 1) historyIndex++;
          area.value = hist[historyIndex];
          area.selectionStart = area.selectionEnd = 0;
          dirty = true;
          updateStats(area.value);
          markSaved(false);
        } else if (e.key === "ArrowDown" && historyIndex !== -1) {
          e.preventDefault();
          historyIndex--;
          area.value =
            historyIndex === -1
              ? (draftBeforeHistory ?? "")
              : NotesManager.getHistory()[historyIndex];
          area.selectionStart = area.selectionEnd = area.value.length;
          dirty = true;
          updateStats(area.value);
          markSaved(false);
        }
      });

      $("notesSaveBtn")?.addEventListener("click", () => {
        NotesManager.setImmediate(area.value);
        commitSessionToHistory();
        markSaved(true);
        ToastSystem.success("Notes saved");
      });

      // A note that was typed here stays authoritative for the life of the
      // page, so `dirty` is deliberately never reset — clearing it would
      // reopen the window where a remote sync overwrites local edits.

      $("notesExportBtn")?.addEventListener("click", () => {
        NotesManager.set(area.value);
        NotesManager.exportTxt();
        ToastSystem.success("Notes exported");
      });
    }
  }
  return { render, flushPending, hasLiveEdits, switchTo };
})();

const ClipboardRenderer = (() => {
  let bound = false;

  function render() {
    const listEl = $("clipList");
    const badgeEl = $("clipCountBadge");
    if (!listEl) return;

    const snippets = ClipboardManager.getAll();
    if (badgeEl) badgeEl.textContent = `${snippets.length} saved`;

    if (snippets.length === 0) {
      setSafeHTML(
        listEl,
        `
        <div class="et-clip-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          <span>No snippets saved yet. Paste a command or link above to save!</span>
        </div>`,
      );
    } else {
      setSafeHTML(
        listEl,
        snippets
          .map(
            (item) => `
        <div class="et-clip-item" data-id="${item.id}">
          <div class="et-clip-item-main" style="display:flex; flex-direction:column; gap:2px; flex:1; overflow:hidden;">
            ${item.title ? `<span class="et-clip-item-title" style="font-weight:600; color:var(--text); font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(item.title)}</span>` : ""}
            <span class="et-clip-item-text" style="font-size:12px; color:var(--text-dim); font-family:monospace; word-break:break-all;">${escapeHtml(item.text)}</span>
          </div>
          <div class="et-clip-item-actions">
            <button class="et-clip-copy-btn" data-no-tooltip aria-label="Copy snippet ${escapeHtml(item.title || item.label || item.text)}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="16" height="16" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy</span>
            </button>
            <button class="et-clip-del-btn" title="Delete snippet" aria-label="Delete snippet ${escapeHtml(item.title || item.label || item.text)}">&times;</button>
          </div>
        </div>
      `,
          )
          .join(""),
      );
    }

    if (!bound) {
      bound = true;
      const titleInp = $("clipTitleInput");
      const textInp = $("clipTextInput");
      const addBtn = $("clipAddBtn");

      function handleAdd() {
        if (!textInp) return;
        const text = textInp.value.trim();
        const title = titleInp ? titleInp.value.trim() : "";
        if (text) {
          ClipboardManager.add(text, title, title);
          StorageManager.saveImmediate();
          textInp.value = "";
          if (titleInp) titleInp.value = "";
          render();
          ToastSystem.success("Snippet added");
        }
      }

      addBtn?.addEventListener("click", handleAdd);
      textInp?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleAdd();
      });
      titleInp?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") textInp?.focus();
      });

      listEl.addEventListener("click", (e) => {
        const copyBtn = e.target.closest(".et-clip-copy-btn");
        if (copyBtn) {
          const itemEl = copyBtn.closest(".et-clip-item");
          const snippets = ClipboardManager.getAll();
          const found = snippets.find((s) => s.id === itemEl.dataset.id);
          if (found) {
            ClipboardManager.copy(found.text);
            copyBtn.classList.add("copied");
            const txt = copyBtn.querySelector("span");
            if (txt) txt.textContent = "Copied!";
            setTimeout(() => {
              copyBtn.classList.remove("copied");
              if (txt) txt.textContent = "Copy";
            }, 1500);
            ToastSystem.success("Copied to clipboard");
          }
          return;
        }

        const delBtn = e.target.closest(".et-clip-del-btn");
        if (delBtn) {
          const itemEl = delBtn.closest(".et-clip-item");
          ClipboardManager.remove(itemEl.dataset.id);
          render();
          ToastSystem.info("Snippet deleted");
        }
      });
    }
  }

  return { render };
})();

const HomeRenderer = (() => {
  function init() {
    renderPinned();
  }
  function render() {
    WidgetsRenderer.applyWidgetVisibility();
    renderPinned();
  }
  function showAddPinModal() {
    const boards = BoardManager.getAll();
    if (!boards.length) {
      ToastSystem.info("Create a board first, then pin links to Home.");
      ViewController.show("boards");
      return;
    }

    showCustomModal(
      "Pin a link to Home",
      `
      <div class="dialog-stack">
        <div class="dialog-field">
          <label class="dialog-label" for="pinTitleInp">Title</label>
          <input type="text" id="pinTitleInp" class="dialog-input" placeholder="Title" />
        </div>
        <div class="dialog-field">
          <label class="dialog-label" for="pinUrlInp">URL</label>
          <input type="text" id="pinUrlInp" class="dialog-input" placeholder="Website URL" />
        </div>
      </div>`,
      () => {
        const titleEl = $("pinTitleInp");
        const urlEl = $("pinUrlInp");
        const title = titleEl.value.trim();
        const url = urlEl.value.trim();
        if (!url) {
          markInvalid(urlEl, true);
          showModalError("URL is required.");
          return false;
        }
        // Silently use the first board — no need to expose board selector
        const boardId = boards[0]?.id;
        const bm = BookmarkManager.add(boardId, title || url, url, []);
        if (!bm) {
          markInvalid(urlEl, true);
          showModalError("That does not look like a valid link.");
          return false;
        }
        if (BookmarkManager.togglePin(boardId, bm.id) === null) {
          ToastSystem.error(
            `Home holds ${BookmarkManager.PIN_LIMIT} pins. Unpin one first.`,
          );
        } else {
          ToastSystem.success("Pinned to Home");
        }
        StorageManager.saveImmediate();
        renderPinned();
        BoardRenderer.renderBoards();
        return true;
      },
      "Pin",
    );
  }

  function renderPinned() {
    const wrap = $("homePinned");
    if (!wrap) return;
    const settings = StorageManager.getSettings();
    if (settings.hidePinnedOnHome) {
      wrap.style.display = "none";
      return;
    }
    const pinned = BookmarkManager.getPinned();
    setSafeHTML(wrap, "");
    wrap.style.display = "flex";

    pinned.forEach((bm) => {
      const cell = document.createElement("div");
      cell.className = "dock-pin-wrap";
      cell.draggable = true;
      cell.dataset.id = bm.id;

      cell.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", bm.id);
        cell.style.opacity = "0.5";
      });
      cell.addEventListener("dragend", () => (cell.style.opacity = ""));
      cell.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        cell.style.transform = "scale(1.05)";
      });
      cell.addEventListener("dragleave", () => (cell.style.transform = ""));
      cell.addEventListener("drop", (e) => {
        e.preventDefault();
        cell.style.transform = "";
        const draggedId = e.dataTransfer.getData("text/plain");
        if (draggedId && draggedId !== bm.id) {
          const arr = Array.from(wrap.children)
            .filter((c) => c.dataset.id)
            .map((c) => c.dataset.id);
          const fromIdx = arr.indexOf(draggedId);
          const toIdx = arr.indexOf(bm.id);
          if (fromIdx > -1 && toIdx > -1) {
            arr.splice(fromIdx, 1);
            arr.splice(toIdx, 0, draggedId);
            BookmarkManager.reorderPinned(arr);
            renderPinned();
          }
        }
      });

      const a = document.createElement("a");
      a.className = "dock-pin";
      a.href = safeHref(bm.url);
      a.setAttribute("data-id", bm.id);
      a.title = `${bm.title}
${bm.url}`;
      setSafeHTML(
        a,
        `
        <span class="dock-pin-icon"><img class="dock-pin-fav" ${faviconAttr(bm.url)} alt="" /></span>
        <span class="dock-pin-label">${escapeHtml(bm.title)}</span>
      `,
      );
      wireFavicons(a);

      const menuBtn = document.createElement("button");
      menuBtn.type = "button";
      menuBtn.className = "dock-pin-menu-btn";
      menuBtn.setAttribute("aria-label", `Options for ${bm.title}`);
      menuBtn.setAttribute("title", "Options");
      menuBtn.textContent = "⋮";

      const showMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const r = menuBtn.getBoundingClientRect();
        if (typeof ContextMenu !== "undefined") {
          ContextMenu.show(
            e.clientX || r.left,
            e.clientY || r.bottom + 4,
            bm.boardId,
            bm,
          );
        }
      };

      a.addEventListener("contextmenu", showMenu);
      menuBtn.addEventListener("click", showMenu);

      cell.append(a, menuBtn);
      wrap.appendChild(cell);
    });

    if (pinned.length >= BookmarkManager.PIN_LIMIT) return;

    const add = document.createElement("button");
    add.type = "button";
    add.className = "dock-pin dock-pin-add";
    add.setAttribute("aria-label", "Add a link and pin it to Home");
    setSafeHTML(
      add,
      `
      <span class="dock-pin-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </span>
      <span class="dock-pin-label">${pinned.length ? "Add pin" : "Pin a link"}</span>
    `,
    );
    add.addEventListener("click", showAddPinModal);
    wrap.appendChild(add);
  }
  return { init, render, renderPinned };
})();
