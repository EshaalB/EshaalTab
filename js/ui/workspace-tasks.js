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
        <button class="workspace-star-btn ${isFav ? "is-active" : ""}" data-app="${escapeHtml(name)}" data-tooltip="${isFav ? "Unpin" : "Pin to top"}" aria-label="${isFav ? "Unpin " + escapeHtml(name) : "Pin " + escapeHtml(name) + " to the top"}" aria-pressed="${isFav}">★</button>
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

    const ordered = [
      ...filteredApps.filter(([name]) => favs.has(name)),
      ...filteredApps.filter(([name]) => !favs.has(name)),
    ];
    setSafeHTML(
      grid,
      ordered.map((app) => renderAppItem(app, favs.has(app[0]))).join(""),
    );

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
