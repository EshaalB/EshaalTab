"use strict";

const WorkspaceWidget = (() => {
  const APPS = [
    ["Account", "https://myaccount.google.com"],
    ["Search", "https://www.google.com"],
    ["Maps", "https://maps.google.com"],
    ["YouTube", "https://www.youtube.com"],
    ["News", "https://news.google.com"],
    ["Gmail", "https://mail.google.com"],
    ["Meet", "https://meet.google.com"],
    ["Chat", "https://chat.google.com"],
    ["Contacts", "https://contacts.google.com"],
    ["Drive", "https://drive.google.com"],
    ["Calendar", "https://calendar.google.com"],
    ["Play", "https://play.google.com"],
    ["Translate", "https://translate.google.com"],
    ["Photos", "https://photos.google.com"],
    ["Shopping", "https://shopping.google.com"],
    ["Finance", "https://www.google.com/finance"],
    ["Docs", "https://docs.google.com"],
    ["Sheets", "https://sheets.google.com"],
    ["Slides", "https://slides.google.com"],
    ["Books", "https://books.google.com"],
    ["Blogger", "https://www.blogger.com"],
    ["Keep", "https://keep.google.com"],
    ["Earth", "https://earth.google.com"],
    ["Saved", "https://www.google.com/save"],
    ["Arts & Culture", "https://artsandculture.google.com"],
    ["Google Ads", "https://ads.google.com"],
    ["Travel", "https://www.google.com/travel"],
    ["Forms", "https://forms.google.com"],
    ["Classroom", "https://classroom.google.com"],
    ["Gemini", "https://gemini.google.com"],
    ["AI Studio", "https://aistudio.google.com"],
    ["NotebookLM", "https://notebooklm.google.com"],
    ["Wallet", "https://wallet.google.com"],
    ["Colab", "https://colab.research.google.com"],
    ["Scholar", "https://scholar.google.com"],
    ["Analytics", "https://analytics.google.com"],
    ["Search Console", "https://search.google.com/search-console"],
    ["Firebase", "https://console.firebase.google.com"],
    ["Passwords", "https://passwords.google.com"],
    ["Fonts", "https://fonts.google.com"],
    ["Tasks", "https://tasks.google.com"],
    ["Cloud", "https://cloud.google.com"],
    ["YouTube Music", "https://music.youtube.com"],
    ["Store", "https://store.google.com"],
  ];

  const APP_ICONS = {
    Account:
      "https://www.gstatic.com/images/branding/product/2x/avatar_square_blue_120dp.png",
    Search:
      "https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png",
    Maps: "https://www.gstatic.com/images/branding/product/2x/maps_2020q4_48dp.png",
    YouTube:
      "https://www.gstatic.com/images/branding/product/2x/youtube_48dp.png",
    News: "https://www.gstatic.com/images/branding/product/2x/news_48dp.png",
    Gmail:
      "https://www.gstatic.com/images/branding/product/2x/gmail_2020q4_48dp.png",
    Meet: "https://www.gstatic.com/images/branding/product/2x/meet_2020q4_48dp.png",
    Chat: "https://www.gstatic.com/images/branding/product/2x/chat_2020q4_48dp.png",
    Contacts:
      "https://www.gstatic.com/images/branding/product/2x/contacts_2022_48dp.png",
    Drive:
      "https://www.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png",
    Calendar:
      "https://www.gstatic.com/images/branding/product/2x/calendar_2020q4_48dp.png",
    Play: "https://www.gstatic.com/images/branding/product/2x/play_prism_48dp.png",
    Translate:
      "https://www.gstatic.com/images/branding/product/2x/translate_24dp.png",
    Photos:
      "https://www.gstatic.com/images/branding/product/2x/photos_48dp.png",
    Shopping:
      "https://www.gstatic.com/images/branding/product/2x/shopping_48dp.png",
    Finance:
      "https://www.gstatic.com/images/branding/product/2x/finance_48dp.png",
    Docs: "https://www.gstatic.com/images/branding/product/2x/docs_2020q4_48dp.png",
    Sheets:
      "https://www.gstatic.com/images/branding/product/2x/sheets_2020q4_48dp.png",
    Slides:
      "https://www.gstatic.com/images/branding/product/2x/slides_2020q4_48dp.png",
    Books: "https://www.gstatic.com/images/branding/product/2x/books_48dp.png",
    Blogger:
      "https://www.gstatic.com/images/branding/product/2x/blogger_48dp.png",
    Keep: "https://www.gstatic.com/images/branding/product/2x/keep_2020q4_48dp.png",
    Forms:
      "https://www.gstatic.com/images/branding/product/2x/forms_2020q4_48dp.png",
    Classroom:
      "https://www.gstatic.com/images/branding/product/2x/classroom_48dp.png",
    Gemini:
      "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d473d53066913e2f07f87.svg",
    "AI Studio":
      "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d473d53066913e2f07f87.svg",
    NotebookLM:
      "https://www.gstatic.com/images/branding/product/2x/notebooklm_48dp.png",
    Wallet:
      "https://www.gstatic.com/images/branding/product/2x/wallet_48dp.png",
    Colab: "https://colab.research.google.com/img/colab_favicon_256px.png",
    Scholar: "https://scholar.google.com/favicon.ico",
    Analytics:
      "https://www.gstatic.com/images/branding/product/2x/analytics_48dp.png",
    "Search Console":
      "https://www.gstatic.com/images/branding/product/2x/search_console_48dp.png",
    Firebase:
      "https://www.gstatic.com/mobilesdk/160503_mobilesdk/logo/2x/firebase_28dp.png",
    Passwords:
      "https://www.gstatic.com/images/branding/product/2x/password_manager_48dp.png",
    Fonts:
      "https://www.gstatic.com/images/branding/product/2x/google_fonts_48dp.png",
    Earth: "https://www.gstatic.com/images/branding/product/2x/earth_48dp.png",
    Saved:
      "https://www.gstatic.com/images/branding/product/2x/google_save_48dp.png",
    "Arts & Culture":
      "https://www.gstatic.com/images/branding/product/2x/arts_culture_48dp.png",
    "Google Ads":
      "https://www.gstatic.com/images/branding/product/2x/google_ads_48dp.png",
    Travel:
      "https://www.gstatic.com/images/branding/product/2x/travel_48dp.png",
    Tasks:
      "https://www.gstatic.com/images/branding/product/2x/tasks_2021_48dp.png",
    Cloud:
      "https://www.gstatic.com/images/branding/product/2x/google_cloud_48dp.png",
    "YouTube Music":
      "https://www.gstatic.com/images/branding/product/2x/youtube_music_48dp.png",
    Store:
      "https://www.gstatic.com/images/branding/product/2x/google_store_48dp.png",
  };

  let built = false;
  let activeView = "all";
  let filterQuery = "";

  function localAppIcon(name) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `icons/google-apps/${slug}.png`;
  }

  function getAppIconAttr(name, url) {
    const ext = extFaviconUrl(url);

    const chain = [localAppIcon(name)];
    if (ext) chain.push(ext);
    if (remoteFaviconsAllowed()) {
      if (APP_ICONS[name]) chain.push(APP_ICONS[name]);
      const remote = faviconSrcSet(url);
      chain.push(remote.src, ...remote.fallbacks);
    }
    const uniq = [...new Set(chain.filter(Boolean))];
    return `src="${uniq[0] || ""}" data-fav data-fav-url="${String(url).replace(/"/g, "&quot;")}" data-fav-fallbacks="${uniq.slice(1).join("|")}"`;
  }

  function getFavorites() {
    try {
      const s = StorageManager.getSettings();
      if (Array.isArray(s.workspaceFavorites)) return s.workspaceFavorites;
    } catch {}
    return [
      "Search",
      "Gmail",
      "Drive",
      "YouTube",
      "Gemini",
      "AI Studio",
      "NotebookLM",
    ];
  }

  function toggleFavorite(appName) {
    const favs = [...getFavorites()];
    const idx = favs.indexOf(appName);
    if (idx >= 0) {
      favs.splice(idx, 1);
    } else {
      favs.push(appName);
    }
    const settings = StorageManager.getSettings();
    settings.workspaceFavorites = favs;
    StorageManager.save();
    renderGrid();
  }

  function renderAppItem([name, url], isFav) {
    return `
      <div class="workspace-item" title="${escapeHtml(name)}">
        <button class="workspace-star-btn ${isFav ? "is-active" : ""}" data-app="${escapeHtml(name)}" title="${isFav ? "Unstar" : "Star"}" aria-label="${isFav ? "Remove " + escapeHtml(name) + " from starred apps" : "Star " + escapeHtml(name)}" aria-pressed="${isFav}">★</button>
        <a href="${escapeHtml(safeHref(url))}" class="workspace-link">
          <span class="workspace-icon" data-letter="${escapeHtml(name.charAt(0))}">
            <img ${getAppIconAttr(name, url)} alt="" decoding="async" width="40" height="40" />
          </span>
          <span class="workspace-label">${escapeHtml(name)}</span>
        </a>
      </div>`;
  }

  function renderGrid() {
    const grid = $("workspaceGrid");
    if (!grid) return;

    const favs = new Set(getFavorites());
    const query = filterQuery.trim().toLowerCase();

    const filteredApps = APPS.filter(
      ([name]) => !query || name.toLowerCase().includes(query),
    );

    if (filteredApps.length === 0) {
      setSafeHTML(
        grid,
        `<div class="workspace-no-results">No matching apps found</div>`,
      );
      return;
    }

    if (activeView === "fav") {
      const favApps = filteredApps.filter(([name]) => favs.has(name));
      if (favApps.length === 0) {
        setSafeHTML(
          grid,
          `<div class="workspace-no-results">No starred apps.<span class="workspace-no-results-hint">Star an app from the All view.</span></div>`,
        );
        return;
      }
      setSafeHTML(
        grid,
        favApps.map((app) => renderAppItem(app, true)).join(""),
      );
    } else {
      if (!query) {
        const favApps = APPS.filter(([name]) => favs.has(name));
        const otherApps = APPS.filter(([name]) => !favs.has(name));
        let html = "";
        if (favApps.length > 0) {
          html += `<div class="workspace-section-header">Starred</div>`;
          html += favApps.map((app) => renderAppItem(app, true)).join("");
        }
        if (otherApps.length > 0) {
          html += `<div class="workspace-section-header">All Apps</div>`;
          html += otherApps.map((app) => renderAppItem(app, false)).join("");
        }
        setSafeHTML(grid, html);
      } else {
        setSafeHTML(
          grid,
          filteredApps
            .map((app) => renderAppItem(app, favs.has(app[0])))
            .join(""),
        );
      }
    }

    wireFavicons(grid);
  }

  function build() {
    if (built) return;
    built = true;
    renderGrid();
  }

  let bound = false;

  function init() {
    const btn = $("workspaceBtn");
    const pop = $("workspacePopover");
    if (!btn || !pop || bound) return;
    bound = true;

    btn.addEventListener("click", () => toggle());

    const searchInput = $("workspaceSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        filterQuery = e.target.value;
        renderGrid();
      });
      searchInput.addEventListener("click", (e) => e.stopPropagation());
    }

    const tabAll = $("wsTabAll");
    const tabFav = $("wsTabFav");
    if (tabAll && tabFav) {
      tabAll.addEventListener("click", (e) => {
        e.stopPropagation();
        activeView = "all";
        tabAll.classList.add("is-active");
        tabFav.classList.remove("is-active");
        renderGrid();
      });
      tabFav.addEventListener("click", (e) => {
        e.stopPropagation();
        activeView = "fav";
        tabFav.classList.add("is-active");
        tabAll.classList.remove("is-active");
        renderGrid();
      });
    }

    const grid = $("workspaceGrid");
    if (grid) {
      grid.addEventListener("click", (e) => {
        const starBtn = e.target.closest(".workspace-star-btn");
        if (starBtn) {
          e.preventDefault();
          e.stopPropagation();
          const appName = starBtn.getAttribute("data-app");
          if (appName) toggleFavorite(appName);
          return;
        }
        const link = e.target.closest(".workspace-link");
        if (link) {
          close();
        }
      });
    }

    PopoverRegistry.register("workspace", () => $("workspacePopover"), close);
  }

  function toggle() {
    const pop = $("workspacePopover");
    if (!pop) return;
    pop.classList.contains("open") ? close() : open();
  }

  function open() {
    const pop = $("workspacePopover");
    const btn = $("workspaceBtn");
    if (!pop || !btn) return;
    PopoverRegistry.closeAll("workspace");
    build();
    renderGrid();
    PopoverRegistry.position(pop, btn, { align: "right" });
    pop.classList.add("open");
    btn.classList.add("is-active");
    setTimeout(() => $("workspaceSearchInput")?.focus(), 50);
  }

  function close() {
    $("workspacePopover")?.classList.remove("open");
    $("workspaceBtn")?.classList.remove("is-active");
  }

  return { init, open, close };
})();

const TodoWidget = (() => {
  /**
   * Resolves a todo's reminder to a concrete hour and minute.
   *
   * Newer todos carry `remindH`/`remindM`, resolved against the wall clock at
   * the moment they were typed (so "2:20" typed at 1pm means 14:20). Todos
   * created before that existed fall back to a daytime assumption.
   */
  function taskReminder(t) {
    const parsed = ReminderKit.parseTime(t.text);
    if (!parsed) return null;

    if (Number.isInteger(t.remindH) && Number.isInteger(t.remindM))
      return { h: t.remindH, min: t.remindM };

    const h = ReminderKit.assumeDaytimeHour(parsed);
    return h === null ? null : { h, min: parsed.min };
  }

  // Everything currently awaiting a chime, with absolute due timestamps so the
  // scheduler can fire on "past due" instead of "exactly now".
  function collectReminders() {
    const today = todayKey();
    // Reminders older than this were settled elsewhere (e.g. a backup restore
    // brought them in already overdue) and must not chime now.
    const muted = StorageManager.getData().remindersMutedBefore || 0;
    const out = [];
    for (const t of TodoManager.getAll()) {
      if (t.done) continue;
      const r = taskReminder(t);
      if (!r) continue;
      const due = ReminderKit.timeOn(Date.now(), r.h, r.min);
      if (due < muted) continue;
      out.push({
        key: `todo_${t.id}_${today}_${r.h}:${r.min}`,
        due,
        fire: () => {
          ReminderKit.flashBadge("⏰");
          // Long-lived rather than the old 8s: a reminder you were not at the
          // keyboard for is exactly the one worth still being there.
          ToastSystem.show(`⏰ Reminder: ${t.text}`, "info", 30000);
          ReminderKit.chime();
        },
      });
    }
    return out;
  }

  let bound = false;

  function init() {
    if (bound) return;
    bound = true;
    const btn = $("todoWidgetBtn");
    const pop = $("todoPopover");
    const input = $("todoPopInput");
    const clearBtn = $("todoClearDone");
    btn?.addEventListener("click", () => toggle());
    input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && input.value.trim()) {
        TodoManager.add(input.value.trim());
        StorageManager.saveImmediate();
        input.value = "";
        render();
      }
    });
    clearBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      TodoManager.clearDone();
      render();
    });
    PopoverRegistry.register("todo", () => $("todoPopover"), close);
    render();

    ReminderKit.register(collectReminders);
  }
  function toggle() {
    const pop = $("todoPopover");
    if (!pop) return;
    pop.classList.contains("open") ? close() : open();
  }
  function open() {
    const pop = $("todoPopover");
    const btn = $("todoWidgetBtn");
    if (!pop || !btn) return;
    PopoverRegistry.closeAll("todo");
    render();
    PopoverRegistry.position(pop, btn, { width: 340 });
    pop.classList.add("open");
    btn.classList.add("is-active");
    $("todoPopInput")?.focus();
  }
  function close() {
    $("todoPopover")?.classList.remove("open");
    $("todoWidgetBtn")?.classList.remove("is-active");
  }
  function render() {
    const list = $("todoPopList");
    const badge = $("todoPopBadge");
    const clearBtn = $("todoClearDone");
    if (!list) return;
    const todos = TodoManager.getAll();
    const pendingCount = todos.filter((t) => !t.done).length;
    const doneCount = todos.filter((t) => t.done).length;

    if (badge) badge.textContent = pendingCount;
    if (clearBtn)
      clearBtn.style.display = doneCount > 0 ? "inline-block" : "none";

    setSafeHTML(
      list,
      todos.length
        ? ""
        : '<div class="todo-pop-empty"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.4; margin-bottom:8px;"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><br/>Add your first task below</div>',
    );
    todos.forEach((t, idx) => {
      const r = taskReminder(t);
      const timeHint = r
        ? ` <span style="opacity:0.5; font-size:11px;">⏰ ${escapeHtml(ReminderKit.formatTime(r.h, r.min))}</span>`
        : "";
      const row = document.createElement("div");
      row.className = `todo-pop-row ${t.done ? "done" : ""} ${t.pinned ? "pinned" : ""}`;
      setSafeHTML(
        row,
        `
        <button class="todo-pop-check" title="${t.done ? "Mark pending" : "Mark done"}">
          ${t.done ? icon("check", 16) : ""}
        </button>
        <span class="todo-pop-text" data-no-tooltip>${escapeHtml(t.text)}${timeHint}</span>
        <button class="todo-pop-move" data-dir="-1" title="Move up" aria-label="Move task up">↑</button>
        <button class="todo-pop-move" data-dir="1" title="Move down" aria-label="Move task down">↓</button>
        <button class="todo-pop-pin ${t.pinned ? "active" : ""}" title="${t.pinned ? "Unpin" : "Pin"}">
          ${icon("pin", 16)}
        </button>
        <button class="todo-pop-del" title="Delete task">&times;</button>`,
      );

      row.querySelector(".todo-pop-check").addEventListener("click", (e) => {
        e.stopPropagation();
        TodoManager.toggle(t.id);
        render();
      });
      row.querySelector(".todo-pop-pin").addEventListener("click", (e) => {
        e.stopPropagation();
        TodoManager.togglePin(t.id);
        render();
      });
      row.querySelectorAll(".todo-pop-move").forEach((mb) => {
        mb.addEventListener("click", (e) => {
          e.stopPropagation();
          if (TodoManager.shift(t.id, parseInt(mb.dataset.dir, 10))) render();
        });
      });

      const textEl = row.querySelector(".todo-pop-text");
      textEl.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        showPrompt("Edit Task", "Update task description:", t.text, (val) => {
          if (val && val.trim()) {
            TodoManager.edit(t.id, val.trim());
            render();
          }
        });
      });

      row.querySelector(".todo-pop-del").addEventListener("click", (e) => {
        e.stopPropagation();
        TodoManager.remove(t.id);
        render();
        ToastSystem.action("Task deleted", "Undo", () => {
          TodoManager.insertAt(t, idx);
          render();
        });
      });
      list.appendChild(row);
    });
  }
  return { init, render, open, close };
})();
