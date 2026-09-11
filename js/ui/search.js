"use strict";

const SearchRenderer = (() => {
  const overlay = $("searchOverlay");
  const input = $("searchInput");
  const resultsContainer = $("searchResults");
  const searchSideBtn = $("searchSideBtn");
  let selIndex = -1;

  /** Puts the one highlight on `index`, optionally scrolling it into view. */
  function selectAt(items, index, scroll = true) {
    if (!items.length) return;
    selIndex = Math.max(0, Math.min(items.length - 1, index));
    items.forEach((it, i) => {
      const on = i === selIndex;
      it.classList.toggle("kb-active", on);
      it.setAttribute("aria-selected", String(on));
    });
    if (scroll) items[selIndex].scrollIntoView({ block: "nearest" });
  }

  function moveSel(items, dir) {
    if (!items.length) return;
    const next =
      selIndex < 0
        ? dir > 0
          ? 0
          : items.length - 1
        : (selIndex + dir + items.length) % items.length;
    selectAt(items, next);
  }

  function init() {
    // The list's key handling, reachable from outside the field as well.
    let onInputKey = () => {};

    if (searchSideBtn) {
      searchSideBtn.addEventListener("click", open);
    }

    if (input) {
      let deb = null;
      input.addEventListener("input", () => {
        clearTimeout(deb);
        deb = setTimeout(() => performSearch(input.value), 80);
      });

      onInputKey = (e) => {
        const items = [
          ...resultsContainer.querySelectorAll(".search-result-item"),
        ];
        if (e.key === "ArrowDown") {
          e.preventDefault();
          moveSel(items, 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          moveSel(items, -1);
        } else if (e.key === "PageDown" || e.key === "PageUp") {
          // A page at a time, without wrapping - wrapping on a jump lands
          // somewhere unrelated to where you were heading.
          e.preventDefault();
          if (items.length)
            selectAt(items, (selIndex < 0 ? 0 : selIndex) + (e.key === "PageDown" ? 5 : -5));
        } else if ((e.ctrlKey || e.metaKey) && (e.key === "Home" || e.key === "End")) {
          // Plain Home/End stay with the text field, where they move the caret.
          e.preventDefault();
          if (items.length) selectAt(items, e.key === "Home" ? 0 : items.length - 1);
        } else if (e.key === "Enter") {
          e.preventDefault();
          (items[selIndex] || items[0])?.dispatchEvent(
            new MouseEvent("click", {
              bubbles: true,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey,
              shiftKey: e.shiftKey,
            }),
          );
        }
      };
      input.addEventListener("keydown", (e) => onInputKey(e));
    }

    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay && !gestureStartedIn(overlay.firstElementChild))
          close();
      });
    }

    if (resultsContainer) {
      /* The pointer and the keyboard share one selection. Hover used to be a
         second, independent highlight, so after arrowing down and nudging the
         mouse two rows were lit and Enter went to the one you were not looking
         at. Moving over a row now selects it; no scroll, since the row is
         already under the pointer. */
      resultsContainer.addEventListener(
        "pointermove",
        (e) => {
          const row = e.target.closest?.(".search-result-item");
          if (!row) return;
          const items = [...resultsContainer.querySelectorAll(".search-result-item")];
          const i = items.indexOf(row);
          if (i >= 0 && i !== selIndex) selectAt(items, i, false);
        },
        { passive: true },
      );

      resultsContainer.addEventListener("auxclick", (e) => {
        if (e.button !== 1) return;
        const item = e.target.closest(".search-result-item[data-url]");
        if (!item) return;
        e.preventDefault();
        item.dispatchEvent(
          new MouseEvent("click", { bubbles: true, ctrlKey: true }),
        );
      });
    }

    window.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen()) close();
        else open();
      } else if (isOpen()) {
        // A click in the list moves focus off the field, and the arrow keys
        // used to stop working until the field was clicked again. They now
        // bring focus back and carry on moving through the results.
        if (
          input &&
          document.activeElement !== input &&
          ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Enter"].includes(e.key) &&
          !e.target.closest?.("button, a, input, textarea, select")
        ) {
          input.focus({ preventScroll: true });
          onInputKey(e);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        } else if (
          document.activeElement !== input &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey &&
          e.key.length === 1
        ) {
          if (input) {
            input.focus({ preventScroll: true });
          }
        }
      }
    });
  }

  function isOpen() {
    return (
      overlay &&
      (overlay.classList.contains("open") ||
        overlay.classList.contains("active"))
    );
  }

  function open() {
    if (!overlay) return;
    overlay.classList.add("open");
    overlay.classList.add("active");
    performSearch("");

    const doFocus = () => {
      if (input) {
        input.value = "";
        input.focus({ preventScroll: true });
      }
    };

    doFocus();
    requestAnimationFrame(doFocus);
    setTimeout(doFocus, 50);
  }

  function close() {
    if (overlay) {
      overlay.classList.remove("open");
      overlay.classList.remove("active");
    }
  }

  function performSearch(query) {
    if (!resultsContainer) return;
    selIndex = -1;

    const trimmed = query.trim();

    if (trimmed.startsWith("/")) {
      const COMMANDS = [
        {
          cmd: "/focus",
          label: "Start a focus session",
          desc: "Open the Pomodoro timer",
          action: () => {
            close();
            PomodoroMode.enter();
          },
        },
        {
          cmd: "/mode",
          label: "Switch colour mode",
          desc: "Toggle between light and dark",
          action: () => {
            close();
            const s = StorageManager.getSettings();
            const next = s.mode === "light" ? "dark" : "light";
            SettingsRenderer.setMode(next);
            ToastSystem.success(`${next === "light" ? "Light" : "Dark"} mode`);
          },
        },
        {
          cmd: "/new",
          label: "Create a board",
          desc: "Add a bookmark board",
          action: () => {
            close();
            ViewController.show("boards");
            showPrompt("New board", "Board name:", "Bookmarks", (val) => {
              if (val) BoardRenderer.addBoardAtRight(val);
            });
          },
        },
        {
          cmd: "/notes",
          label: "Open notes",
          desc: "Jump to your notepad",
          action: () => {
            close();
            ViewController.show("notes");
          },
        },
        {
          cmd: "/stash",
          label: "Stash open tabs",
          desc: "Save this window’s tabs to a board, then close them",
          action: async () => {
            close();
            await TabStash.stashCurrentWindow(true);
          },
        },
        {
          cmd: "/wall",
          label: "Change wallpaper",
          desc: "Open the wallpaper controls",
          action: () => {
            close();
            SettingsRenderer.openSideSheet("theme", "wallpaper");
          },
        },
        {
          cmd: "/import",
          label: "Import bookmarks",
          desc: "Import from Chrome or Raindrop",
          action: () => {
            close();
            SettingsRenderer.openSideSheet("data");
          },
        },
        {
          cmd: "/widgets",
          label: "Manage widgets",
          desc: "Choose what appears on Home",
          action: () => {
            close();
            SettingsRenderer.openSideSheet("widgets");
          },
        },
        {
          cmd: "/settings",
          label: "Open settings",
          desc: "Theme, widgets, data and help",
          action: () => {
            close();
            SettingsRenderer.openSideSheet(null);
          },
        },
        {
          cmd: "/home",
          label: "Go to Home",
          desc: "Clock, pinned links and tasks",
          action: () => {
            close();
            ViewController.show("home");
          },
        },
        {
          cmd: "/boards",
          label: "Go to Boards",
          desc: "Every board you have made",
          action: () => {
            close();
            ViewController.show("boards");
          },
        },
        {
          cmd: "/sessions",
          label: "Saved sessions",
          desc: "Windows and workspaces you saved",
          action: () => {
            close();
            SessionsRenderer.open();
          },
        },
        {
          cmd: "/snapshot",
          label: "Workspace snapshots",
          desc: "Save the tabs open now under a name, or restore a set",
          action: () => {
            close();
            SessionsRenderer.open("workspaces");
            document.getElementById("workspaceName")?.focus();
          },
        },
        {
          cmd: "/tasks",
          label: "All tasks",
          desc: "Every open task from your notes, in priority order",
          action: () => {
            close();
            HomeRenderer.openTodoModal();
          },
        },
        {
          cmd: "/pinned",
          label: "Pinned boards",
          desc: "Open the boards pinned to Home",
          action: () => {
            close();
            ViewController.show("home");
            PinnedBoards.open(true);
          },
        },
        {
          cmd: "/engines",
          label: "Search engines",
          desc: "Choose which engines the search bar offers",
          action: () => {
            close();
            SettingsRenderer.openSideSheet("search");
          },
        },
        {
          cmd: "/weather",
          label: "Set weather city",
          desc: "Show the weather on Home",
          action: () => {
            close();
            ViewController.show("home");
            document.getElementById("weatherWidget")?.click();
          },
        },
        {
          cmd: "/performance",
          label: "Toggle performance mode",
          desc: "Fewer effects on slower machines",
          action: () => {
            close();
            const s = StorageManager.getSettings();
            s.performanceMode = !s.performanceMode;
            StorageManager.saveSettings();
            SettingsRenderer.applyTheme();
            ToastSystem.success(`Performance mode ${s.performanceMode ? "on" : "off"}`);
          },
        },
        {
          cmd: "/export",
          label: "Export a backup",
          desc: "Save everything as a JSON file",
          action: async () => {
            close();
            await StorageManager.exportJSON();
          },
        },
        {
          cmd: "/keys",
          label: "Keyboard shortcuts",
          desc: "Every shortcut in one place",
          action: () => {
            close();
            SettingsRenderer.openSideSheet("help");
          },
        },
      ];

      const matchCmds = COMMANDS.filter(
        (c) =>
          c.cmd.toLowerCase().includes(trimmed.toLowerCase()) ||
          c.label.toLowerCase().includes(trimmed.toLowerCase()),
      );

      setSafeHTML(
        resultsContainer,
        matchCmds
          .map(
            (c) => `
        <div class="search-result-item command-item" data-cmd="${c.cmd}">
          <div class="sr-cmd-icon">/</div>
          <div class="sr-info">
            <div class="sr-title">${escapeHtml(c.label)}</div>
            <div class="sr-sub">${escapeHtml(c.desc)}</div>
          </div>
          <span class="sr-kbd">${c.cmd}</span>
        </div>
      `,
          )
          .join(""),
      );

      resultsContainer.querySelectorAll(".command-item").forEach((el, i) => {
        el.addEventListener("click", () => matchCmds[i].action());
      });
      const items = [
        ...resultsContainer.querySelectorAll(".search-result-item"),
      ];
      if (items.length) {
        selIndex = 0;
        items[0].classList.add("kb-active");
      }
      return;
    }

    if (trimmed === "#") {
      setSafeHTML(
        resultsContainer,
        `
        <div class="search-hint">
          Type a tag name after <strong class="cmd-chip">#</strong> to filter bookmarks.
        </div>
      `,
      );
      return;
    }

    if (!trimmed) {
      setSafeHTML(
        resultsContainer,
        `
        <div class="search-hint">
          Search tabs, boards, links, notes and history. Type <strong class="cmd-chip">/</strong> for commands, <strong class="cmd-chip">@</strong> to search only your boards, or <strong class="cmd-chip">#</strong> for a tag.
        </div>
      `,
      );
      return;
    }

    const token = ++searchToken;
    // `@` narrows the palette to boards and the links inside them - the
    // browser's tabs and history are left out, which is what makes it the
    // quick way to find something you saved rather than something you saw.
    if (trimmed.startsWith("@")) renderMixed(trimmed.slice(1).trim(), token, "boards");
    else renderMixed(trimmed, token);
  }

  let searchToken = 0;

  function rowHtml(it, kind) {
    const tabAttrs =
      kind === "tab"
        ? ` data-tabid="${it.tabId}" data-winid="${it.windowId}"`
        : "";
    const badge =
      kind === "tab"
        ? '<span class="sr-badge">Tab</span>'
        : kind === "history"
          ? '<span class="sr-badge sr-badge-dim">History</span>'
          : "";
    return `
      <div class="search-result-item" data-act="${kind}" data-url="${escapeHtml(safeHref(it.url))}"${tabAttrs}>
        <img class="sr-favicon" ${faviconAttr(it.url)} alt="" />
        <div class="sr-info">
          <div class="sr-title">${escapeHtml(it.title)}</div>
          <div class="sr-sub">${escapeHtml(it.subtitle || it.url)}</div>
        </div>
        ${badge}
      </div>`;
  }

  function actionRowHtml(it) {
    const glyph =
      it.kind === "url"
        ? '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>'
        : '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>';
    const urlAttr = it.url ? ` data-url="${escapeHtml(safeHref(it.url))}"` : "";
    const sub = it.subtitle || it.url;
    return `
      <div class="search-result-item" data-act="${it.kind}"${urlAttr}>
        <span class="sr-action-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg></span>
        <div class="sr-info">
          <div class="sr-title">${escapeHtml(it.title)}</div>
          ${sub ? `<div class="sr-sub">${escapeHtml(sub)}</div>` : ""}
        </div>
      </div>`;
  }

  function noteRowHtml(it) {
    return `
      <div class="search-result-item" data-act="note" data-note-id="${escapeHtml(it.id || "")}">
        <div class="sr-info">
          <div class="sr-title">${escapeHtml(it.title || "Notepad")}</div>
          <div class="sr-sub">${it.snippet}</div>
        </div>
        <span class="sr-badge sr-badge-dim">Note</span>
      </div>`;
  }
  function boardRowHtml(b) {
    const n = (b.bookmarks || []).length;
    const colour = /^#[0-9a-f]{6}$/i.test(b.color || "")
      ? b.color
      : "var(--accent-color)";
    return `
      <div class="search-result-item" data-act="board" data-board-id="${escapeHtml(b.id)}">
        <span class="sr-board-dot" style="background:${colour}" aria-hidden="true"></span>
        <div class="sr-info">
          <div class="sr-title">${escapeHtml(b.name)}</div>
          <div class="sr-sub">${n} link${n === 1 ? "" : "s"}</div>
        </div>
        <span class="sr-badge sr-badge-dim">Board</span>
      </div>`;
  }

  function sessionRowHtml(it) {
    const n = it.tabs.length;
    return `
      <div class="search-result-item" data-act="session" data-session-id="${escapeHtml(it.id)}">
        <div class="sr-info">
          <div class="sr-title">${escapeHtml(SessionManager.displayName(it))}</div>
          <div class="sr-sub">${n} tab${n === 1 ? "" : "s"} · ${escapeHtml(it.tabs.slice(0, 3).map((t) => t.title || t.url).join(", "))}</div>
        </div>
        <span class="sr-badge sr-badge-dim">Session</span>
      </div>`;
  }
  function buildSnippet(text, term) {
    const idx = text.toLowerCase().indexOf(term.toLowerCase());
    if (idx < 0) return escapeHtml(text.slice(0, 80));
    const start = Math.max(0, idx - 30);
    const end = Math.min(text.length, idx + term.length + 30);
    const before = escapeHtml(text.slice(start, idx));
    const match = escapeHtml(text.slice(idx, idx + term.length));
    const after = escapeHtml(text.slice(idx + term.length, end));
    return `${start > 0 ? "…" : ""}${before}<strong>${match}</strong>${after}${end < text.length ? "…" : ""}`;
  }

  async function renderMixed(trimmed, token, scope = "all") {
    const boardsOnly = scope === "boards";
    const [openTabs, hist] = boardsOnly
      ? [[], []]
      : await Promise.all([
          BrowserSearch.tabs(trimmed),
          BrowserSearch.history(trimmed),
        ]);
    if (token !== searchToken || !isOpen()) return;

    const bookmarks = trimmed ? BookmarkManager.searchAll(trimmed) : [];
    const q = trimmed.toLowerCase();
    const boardHits = BoardManager.getAll()
      .filter((b) => !q || b.name.toLowerCase().includes(q))
      .slice(0, boardsOnly ? 20 : 4);

    const seen = new Set([
      ...openTabs.map((t) => t.url),
      ...bookmarks.map((b) => b.url),
    ]);
    const history = hist.filter((h) => !seen.has(h.url));

    // Something to do with whatever was typed, even when nothing saved
    // matches: a web address can be opened and any text searched for. The
    // palette used to answer "github.com" with "No results", which left the
    // mouse and the browser's address bar as the only way on.
    const looksLikeUrl =
      !/\s/.test(trimmed) &&
      (/^https?:\/\//i.test(trimmed) ||
        /^localhost(:\d+)?(\/.*)?$/i.test(trimmed) ||
        /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/.*)?$/i.test(trimmed));
    const goItems =
      !boardsOnly && looksLikeUrl
        ? [
            {
              kind: "url",
              title: `Open ${trimmed}`,
              url: /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
            },
          ]
        : [];
    const webItems =
      !boardsOnly && trimmed
        ? [
            {
              kind: "web",
              title: `Search the web for "${trimmed}"`,
              subtitle: `With ${WidgetsRenderer.engineName()}`,
            },
          ]
        : [];

    // Search across every note tab, not just the active one.
    const noteHits =
      !boardsOnly && typeof NotesManager !== "undefined"
        ? NotesManager.list()
            .filter((n) =>
              (n.text || "").toLowerCase().includes(trimmed.toLowerCase()),
            )
            .map((n) => ({
              id: n.id,
              title: n.title,
              snippet: buildSnippet(n.text, trimmed),
            }))
        : [];
    const sections = [
      { label: "Go to", kind: "action", items: goItems },
      ...(boardsOnly ? [{ label: "Boards", kind: "board", items: boardHits }] : []),
      { label: "Open Tabs", kind: "tab", items: openTabs },
      {
        label: "Bookmarks",
        kind: "bookmark",
        items: bookmarks.map((b) => ({
          title: b.title,
          url: b.url,
          subtitle: `${b.boardName} • ${b.url}`,
        })),
      },
      ...(boardsOnly ? [] : [{ label: "Boards", kind: "board", items: boardHits }]),
      {
        label: "Sessions",
        kind: "session",
        items:
          !boardsOnly && typeof SessionManager !== "undefined"
            ? SessionManager.search(trimmed)
            : [],
      },
      {
        label: "Notes",
        kind: "note",
        items: noteHits,
      },
      { label: "History", kind: "history", items: history },
      { label: "Web", kind: "action", items: webItems },
    ].filter((s) => s.items.length);

    if (!sections.length) {
      setSafeHTML(
        resultsContainer,
        `<div class="search-no-results">No results for "${escapeHtml(trimmed)}"</div>`,
      );
      return;
    }

    setSafeHTML(
      resultsContainer,
      sections
        .map(
          (sec) =>
            `<div class="search-section-label">${sec.label}</div>` +
            sec.items
              .map((it) =>
                sec.kind === "action"
                  ? actionRowHtml(it)
                  : sec.kind === "board"
                  ? boardRowHtml(it)
                  : sec.kind === "note"
                  ? noteRowHtml(it)
                  : sec.kind === "session"
                    ? sessionRowHtml(it)
                    : rowHtml(it, sec.kind),
              )
              .join(""),
        )
        .join(""),
    );

    const items = [...resultsContainer.querySelectorAll(".search-result-item")];
    // The first result is selected on arrival. Enter already opened it, so the
    // highlight only makes visible what the key was going to do anyway - and
    // the first ArrowDown now moves to the second result instead of spending a
    // press on selecting the first.
    if (items.length) selectAt(items, selIndex < 0 ? 0 : selIndex, false);
    else selIndex = -1;

    wireFavicons(resultsContainer);
    resultsContainer.querySelectorAll(".search-result-item").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (el.dataset.act === "tab" && HAS_EXT && EXT.tabs) {
          const tabId = parseInt(el.dataset.tabid),
            winId = parseInt(el.dataset.winid);
          try {
            EXT.tabs.update(tabId, { active: true });
            if (!isNaN(winId) && EXT.windows)
              EXT.windows.update(winId, { focused: true });
          } catch {
            window.location.assign(el.dataset.url);
          }
        } else if (el.dataset.act === "note") {
          close();
          ViewController.show("notes");
          const noteId = el.dataset.noteId;
          if (noteId && noteId !== NotesManager.getActiveId())
            NotesRenderer.switchTo(noteId);
          const area = $("notesArea");
          if (area) {
            const idx = area.value.toLowerCase().indexOf(trimmed.toLowerCase());
            area.focus();
            if (idx >= 0) area.setSelectionRange(idx, idx + trimmed.length);
          }
          return;
        } else if (el.dataset.act === "board") {
          close();
          ViewController.show("boards");
          BoardRenderer.reveal(el.dataset.boardId);
          return;
        } else if (el.dataset.act === "session") {
          close();
          SessionsRenderer.open();
          return;
        } else if (el.dataset.act === "web") {
          close();
          WidgetsRenderer.searchWeb(trimmed, e.ctrlKey || e.metaKey || e.shiftKey);
          return;
        } else {
          if (e.ctrlKey || e.metaKey || e.shiftKey)
            window.open(el.dataset.url, "_blank", "noopener");
          else window.location.assign(el.dataset.url);
        }
        close();
      });
    });
  }

  return { init, open, close, isOpen };
})();
