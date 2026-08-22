"use strict";

const SearchRenderer = (() => {
  const overlay = $("searchOverlay");
  const input = $("searchInput");
  const resultsContainer = $("searchResults");
  const searchSideBtn = $("searchSideBtn");
  let selIndex = -1;

  function moveSel(items, dir) {
    if (!items.length) return;
    selIndex =
      selIndex < 0
        ? dir > 0
          ? 0
          : items.length - 1
        : (selIndex + dir + items.length) % items.length;
    items.forEach((it, i) => it.classList.toggle("kb-active", i === selIndex));
    items[selIndex].scrollIntoView({ block: "nearest" });
  }

  function init() {
    if (searchSideBtn) {
      searchSideBtn.addEventListener("click", open);
    }

    if (input) {
      let deb = null;
      input.addEventListener("input", () => {
        clearTimeout(deb);
        deb = setTimeout(() => performSearch(input.value), 80);
      });

      input.addEventListener("keydown", (e) => {
        const items = [
          ...resultsContainer.querySelectorAll(".search-result-item"),
        ];
        if (e.key === "ArrowDown") {
          e.preventDefault();
          moveSel(items, 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          moveSel(items, -1);
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
      });
    }

    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay && !gestureStartedIn(overlay.firstElementChild))
          close();
      });
    }

    if (resultsContainer) {
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
          Type to search bookmarks or type <strong class="cmd-chip">/focus</strong>, <strong class="cmd-chip">/mode</strong>, <strong class="cmd-chip">/new</strong>, <strong class="cmd-chip">/notes</strong> for commands.
        </div>
      `,
      );
      return;
    }

    const token = ++searchToken;
    renderMixed(trimmed, token);
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
  function todoRowHtml(it) {
    return `
      <div class="search-result-item" data-act="todo" data-todo-id="${escapeHtml(it.id)}">
        <div class="sr-info">
          <div class="sr-title">${escapeHtml(it.text)}</div>
        </div>
        <span class="sr-badge sr-badge-dim">${it.done ? "Done" : "Todo"}</span>
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

  async function renderMixed(trimmed, token) {
    const [openTabs, hist] = await Promise.all([
      BrowserSearch.tabs(trimmed),
      BrowserSearch.history(trimmed),
    ]);
    if (token !== searchToken || !isOpen()) return;

    const bookmarks = BookmarkManager.searchAll(trimmed);

    const seen = new Set([
      ...openTabs.map((t) => t.url),
      ...bookmarks.map((b) => b.url),
    ]);
    const history = hist.filter((h) => !seen.has(h.url));

    // Search across every note tab, not just the active one.
    const noteHits =
      typeof NotesManager !== "undefined"
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
    const todoHits =
      typeof TodoManager !== "undefined"
        ? TodoManager.getAll()
            .filter((t) => t.text.toLowerCase().includes(trimmed.toLowerCase()))
            .slice(0, 5)
        : [];

    const sections = [
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
      { label: "Todos", kind: "todo", items: todoHits },
      {
        label: "Sessions",
        kind: "session",
        items:
          typeof SessionManager !== "undefined"
            ? SessionManager.search(trimmed)
            : [],
      },
      {
        label: "Notes",
        kind: "note",
        items: noteHits,
      },
      { label: "History", kind: "history", items: history },
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
                sec.kind === "todo"
                  ? todoRowHtml(it)
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
    if (selIndex >= items.length)
      selIndex = items.length ? items.length - 1 : -1;
    if (selIndex >= 0) items[selIndex]?.classList.add("kb-active");

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
        } else if (el.dataset.act === "todo") {
          close();
          TodoWidget.open();
          return;
        } else if (el.dataset.act === "session") {
          close();
          SessionsRenderer.open();
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
