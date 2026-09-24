"use strict";

(() => {
  const S = window.SettingsShared;
  const { applyTheme, applyPresetShell, applyCursor, applyWallpaper } = S;
  const renderSideSheetContent = (...a) => S.renderSideSheetContent(...a);

  function parseCsv(text) {
    const rows = [];
    let row = [],
      field = "",
      inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c !== '"') {
          field += c;
          continue;
        }
        if (text[i + 1] === '"') {
          field += '"';
          i++;
          continue;
        }
        inQuotes = false;
        continue;
      }
      if (c === '"') {
        inQuotes = true;
        continue;
      }
      if (c === ",") {
        row.push(field);
        field = "";
        continue;
      }
      if (c === "\r") continue;
      if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        continue;
      }
      field += c;
    }
    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  const splitTags = (raw) =>
    String(raw || "")
      .split(/[,|]/)
      .map((t) => t.trim())
      .filter(Boolean);

  function normalizeCollectionPath(raw) {
    const parts = String(raw || "")
      .split(/[\/>]|\s+›\s+/)
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.length ? parts.join(" / ") : "";
  }

  function folderResolver() {
    const byName = new Map(BoardManager.getAll().map((b) => [b.name, b]));
    return (name) => {
      const key = normalizeCollectionPath(name) || "Raindrop Imports";
      let board = byName.get(key);
      if (!board) {
        board = BoardManager.addBoard(key);
        byName.set(key, board);
      }
      return board;
    };
  }

  function importRaindropCsv(text) {
    const rows = parseCsv(text.replace(/^﻿/, ""));
    if (!rows.length) return 0;

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const col = (...names) => {
      for (const n of names) {
        const i = header.indexOf(n);
        if (i >= 0) return i;
      }
      return -1;
    };
    const iUrl = col("url", "link");
    if (iUrl < 0) return -1;
    const iTitle = col("title", "name");
    const iFolder = col("folder", "collection");
    const iTags = col("tags", "tag");

    const boardFor = folderResolver();
    let count = 0;
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r];
      const url = (cells[iUrl] || "").trim();
      if (!url || !/^https?:\/\//i.test(url)) continue;
      if (!Array.isArray(cells)) continue;
      const board = boardFor(iFolder >= 0 ? cells[iFolder] : "");
      const title = (iTitle >= 0 && (cells[iTitle] || "").trim()) || url;
      BookmarkManager.add(
        board.id,
        title,
        url,
        iTags >= 0 ? splitTags(cells[iTags]) : [],
      );
      count++;
    }
    return count;
  }

  function importRaindropJson(text) {
    const json = JSON.parse(text);
    const items = Array.isArray(json) ? json : json.items || [];
    const boardFor = folderResolver();
    let count = 0;
    items.forEach((item) => {
      if (!item || !item.url) return;
      const c = item.collection || {};
      const path =
        (Array.isArray(c.path) ? c.path.join("/") : c.path) ||
        (c.parent && c.parent.title
          ? `${c.parent.title}/${c.title || ""}`
          : "") ||
        c.title ||
        item.folder;
      const board = boardFor(path);
      const tags = Array.isArray(item.tags) ? item.tags : splitTags(item.tags);
      BookmarkManager.add(board.id, item.title || item.url, item.url, tags);
      count++;
    });
    return count;
  }

  function parseRaindropFile(file) {
    const reader = new FileReader();
    reader.onerror = () => ToastSystem.error("Could not read that file.");
    reader.onload = (e) => {
      const text = String(e.target.result || "");
      const isJson = /\.json$/i.test(file.name) || /^\s*[[{]/.test(text);
      let count;
      try {
        count = isJson ? importRaindropJson(text) : importRaindropCsv(text);
      } catch (err) {
        ToastSystem.error(
          `Couldn't parse that ${isJson ? "JSON" : "CSV"} file.`,
        );
        return;
      }
      if (count === -1) {
        ToastSystem.error(
          'No "url" column found. The CSV needs a url column.',
        );
        return;
      }
      if (!count) {
        ToastSystem.error("No bookmarks found in that file.");
        return;
      }
      StorageManager.saveImmediate();
      BoardRenderer.renderBoards();
      HomeRenderer.renderPinned();
      ToastSystem.success(
        `Imported ${count} bookmark${count === 1 ? "" : "s"} `,
      );
    };
    reader.readAsText(file);
  }

  function removeDuplicateBookmarks() {
    const seen = new Set();
    let removed = 0;
    BoardManager.getAll().forEach((b) => {
      b.bookmarks = b.bookmarks.filter((bm) => {
        const key = String(bm.url || "")
          .trim()
          .toLowerCase()
          .replace(/\/+$/, "");
        if (!key) return true;
        if (seen.has(key)) {
          removed++;
          return false;
        }
        seen.add(key);
        return true;
      });
    });
    if (removed) StorageManager.save();
    return removed;
  }

  const liveSettings = () =>
    new Proxy(
      {},
      {
        get: (_, k) => StorageManager.getSettings()[k],
        set: (_, k, v) => {
          StorageManager.getSettings()[k] = v;
          return true;
        },
        deleteProperty: (_, k) => {
          delete StorageManager.getSettings()[k];
          return true;
        },
        has: (_, k) => k in StorageManager.getSettings(),
        ownKeys: () => Reflect.ownKeys(StorageManager.getSettings()),
        getOwnPropertyDescriptor: (_, k) => {
          const d = Object.getOwnPropertyDescriptor(
            StorageManager.getSettings(),
            k,
          );
          return d ? { ...d, configurable: true } : undefined;
        },
      },
    );

  function bindDataEvents() {
    const settings = liveSettings();

    $("btnImportBrowser")?.addEventListener("click", () => {
      if (!(HAS_EXT && EXT.bookmarks)) {
        ToastSystem.error(
          "Bookmark import only works in the installed extension.",
        );
        return;
      }
      showConfirm(
        "Import browser bookmarks",
        "This adds a board for each bookmark folder. Links you already have are skipped. Continue?",
        () => {
          Promise.resolve(EXT.bookmarks.getTree())
            .then((tree) => {
              if (!tree || !tree.length) return;
              const rootNodes = tree[0].children || [];
              const existing = new Set();
              BoardManager.getAll().forEach((b) =>
                (b.bookmarks || []).forEach((bm) =>
                  existing.add(
                    String(bm.url || "")
                      .trim()
                      .toLowerCase()
                      .replace(/\/+$/, ""),
                  ),
                ),
              );

              let count = 0,
                skipped = 0;
              const walk = (nodes, boardName) => {
                let board = null;
                nodes.forEach((node) => {
                  if (node.url) {
                    const key = String(node.url)
                      .trim()
                      .toLowerCase()
                      .replace(/\/+$/, "");
                    if (existing.has(key)) {
                      skipped++;
                      return;
                    }
                    existing.add(key);
                    if (!board)
                      board = BoardManager.addBoard(boardName || "Imported");
                    if (
                      BookmarkManager.add(
                        board.id,
                        node.title || node.url,
                        node.url,
                        ["imported"],
                      )
                    )
                      count++;
                  } else if (node.children && node.children.length) {
                    walk(node.children, node.title || boardName || "Imported");
                  }
                });
              };
              rootNodes.forEach((folder) =>
                walk(folder.children || [], folder.title || "Imported"),
              );
              StorageManager.saveImmediate();
              BoardRenderer.renderBoards();
              HomeRenderer.renderPinned();
              ToastSystem.success(
                `Imported ${count} bookmark${count === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}` : ""}.`,
              );
            })
            .catch(() =>
              ToastSystem.error(
                "Could not read browser bookmarks. Check the extension has bookmark access.",
              ),
            );
        },
        { tone: "info", confirmLabel: "Import" },
      );
    });

    const rdBtn = $("btnRaindropTrigger");
    const rdFile = $("btnImportRaindropFile");
    if (rdBtn && rdFile) {
      rdBtn.onclick = () => rdFile.click();
      rdFile.onchange = (e) => {
        const file = e.target.files[0];
        if (file) parseRaindropFile(file);
        e.target.value = "";
      };
    }

    $("stDedupeBtn")?.addEventListener("click", () => {
      const before = JSON.parse(JSON.stringify(BoardManager.getAll()));
      const removed = removeDuplicateBookmarks();
      if (!removed) {
        ToastSystem.info("No duplicate bookmarks found.");
        return;
      }
      BoardRenderer.renderBoards();
      HomeRenderer.renderPinned();
      ToastSystem.action(
        `Removed ${removed} duplicate${removed === 1 ? "" : "s"}`,
        "Undo",
        () => {
          StorageManager.getData().boards = before;
          StorageManager.save();
          BoardRenderer.renderBoards();
          HomeRenderer.renderPinned();
          ToastSystem.info("Duplicates restored");
        },
      );
    });

    $("stRemoteFavicons")?.addEventListener("change", (e) => {
      settings.remoteFavicons = e.target.checked;

      settings.remoteFaviconsChoice = e.target.checked;
      StorageManager.saveSettings();
      BoardRenderer.renderBoards();
      HomeRenderer.renderPinned();

      if (typeof refreshFavicons === "function") refreshFavicons();
      ToastSystem.info(
        e.target.checked
          ? "Web icons enabled"
          : "Web icons off, using your browser cache only",
      );
    });

    const setBackup = (key, value) => {
      StorageManager.getSettings()[key] = value;
      BackupReminder.reschedule();
      renderSideSheetContent();
    };
    $("stBackupFreq")?.addEventListener("change", (e) => setBackup("backupFreq", e.target.dataset.value ?? e.target.value));
    $("stBackupDay")?.addEventListener("change", (e) => setBackup("backupDay", Number(e.target.dataset.value ?? e.target.value)));
    $("stBackupDate")?.addEventListener("change", (e) => setBackup("backupDate", Number(e.target.dataset.value ?? e.target.value)));

    $("stExportBtn")?.addEventListener("click", async () => {
      try {
        await StorageManager.exportJSON();
        ToastSystem.success("Full backup exported, including wallpapers");
      } catch (err) {
        ToastSystem.error(err?.message || "Could not export the backup");
      }
    });

    $("btnImportJsonFile")?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      showConfirm(
        "Restore backup",
        `This replaces all current boards, notes and settings with the contents of "${file.name}". Your current data will be exported first as a safety copy. Continue?`,
        () => {
          StorageManager.exportJSON()
            .then(() =>
              StorageManager.importJSON(file, (ok) => {
                if (ok) window.location.reload();
                else
                  ToastSystem.error(
                    "That file is not an EshaalTab backup. Export a new one from Backup.",
                  );
              }),
            )
            .catch(() =>
              ToastSystem.error(
                "Could not create the safety backup. Restore was cancelled.",
              ),
            );
        },
        { tone: "warning", confirmLabel: "Restore" },
      );
    });

    $("stClearBoardsBtn")?.addEventListener("click", () => {
      showConfirm(
        "Clear All Boards & Bookmarks?",
        "Are you sure you want to remove all bookmark boards and links? Your settings, notes, and wallpapers will stay intact.",
        () => {
          const before = JSON.parse(JSON.stringify(BoardManager.getAll()));
          StorageManager.getData().boards = [];
          StorageManager.saveImmediate();
          BoardRenderer.renderBoards();
          HomeRenderer.renderPinned();
          renderSideSheetContent();
          ToastSystem.action("All boards removed", "Undo", () => {
            StorageManager.getData().boards = before;
            StorageManager.saveImmediate();
            BoardRenderer.renderBoards();
            HomeRenderer.renderPinned();
            renderSideSheetContent();
            ToastSystem.info("Boards restored");
          });
        },
        { confirmLabel: "Clear boards" },
      );
    });

    $("stRepairMediaBtn")?.addEventListener("click", async (e) => {
      e.currentTarget.disabled = true;
      try {
        const result = await StorageManager.repairMedia();
        if (result.backgroundReset) {
          await applyWallpaper(
            "solid",
            StorageManager.getSettings().backgroundValue,
            false,
          );
        }
        renderSideSheetContent();
        const details = [];
        if (result.removed)
          details.push(
            `${result.removed} broken wallpaper${result.removed === 1 ? "" : "s"} removed`,
          );
        if (result.backgroundReset) details.push("background reset safely");
        ToastSystem.success(
          details.length ? details.join(", ") : "Wallpaper cache is healthy",
        );
      } catch {
        e.currentTarget.disabled = false;
        ToastSystem.error("Could not repair the wallpaper cache");
      }
    });

    $("stResetAllBtn")?.addEventListener("click", () => {
      showConfirm(
        "Reset Entire Extension?",
        "Are you sure? This will completely wipe all boards, bookmarks, notes, focus timers, wallpapers, and reset all settings to defaults. This action cannot be undone.",
        () => {
          StorageManager.resetAll();
          window.location.reload();
        },
        { confirmLabel: "Reset everything" },
      );
    });
  }

  function backupReminderHtml(settings) {
    const r = BackupReminder.schedule(settings);
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const last = settings.lastBackupAt
      ? `Last backup ${new Date(settings.lastBackupAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}.`
      : "No backup exported yet.";
    return `
              <div class="st-subgroup">
                <div class="st-subhead">Backup reminder</div>
                <div class="st-row">
                  <label class="st-label" for="stBackupFreq">Remind me</label>
                  ${CustomSelect.render({
                    id: "stBackupFreq",
                    value: r.freq,
                    options: [
                      { value: "off", label: "Never" },
                      { value: "daily", label: "Every day" },
                      { value: "weekly", label: "Every week" },
                      { value: "monthly", label: "Every month" },
                    ],
                    style: "width:180px;",
                  })}
                </div>
                <div class="st-row"${r.freq === "weekly" ? "" : " hidden"}>
                  <label class="st-label" for="stBackupDay">Day</label>
                  ${CustomSelect.render({ id: "stBackupDay", value: r.day, options: DAYS.map((label, value) => ({ value, label })), style: "width:180px;" })}
                </div>
                <div class="st-row"${r.freq === "monthly" ? "" : " hidden"}>
                  <label class="st-label" for="stBackupDate">Day of month</label>
                  ${CustomSelect.render({ id: "stBackupDate", value: r.date, options: Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: i + 1 === 31 ? "31 (or last day)" : String(i + 1) })), style: "width:180px;" })}
                </div>
                <div class="st-hint">Shows a reminder on your new tab when a backup is due. ${last}</div>
              </div>`;
  }

  function render(settings, data) {
    return `
        <div class="st-container">
          <div class="st-accordion is-expanded" data-page="backup" data-accordion-key="data management">
            <button class="st-accordion-header" type="button">
              <span class="st-group-title">Backup and import</span>
              <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="st-accordion-body">
              <div class="st-card st-data-stack">
              <div class="st-subhead">Backup</div>
              <div class="st-btn-grid">
                <button id="stExportBtn" class="st-action-btn primary st-icon-download">Export full backup</button>
                <label class="st-action-btn st-icon-upload" for="btnImportJsonFile">Restore backup</label>
              </div>
              <input type="file" id="btnImportJsonFile" accept=".json" aria-label="Restore from a JSON backup" style="display:none;" />
              ${backupReminderHtml(settings)}
              <div class="st-subgroup st-data-stack">
                <div class="st-subhead">Import bookmarks</div>
                <div class="st-btn-grid">
                  <button id="btnImportBrowser" class="st-action-btn st-icon-upload">Import Chrome</button>
                  <button id="btnRaindropTrigger" class="st-action-btn st-icon-upload">Import CSV or JSON</button>
                </div>
                <input type="file" id="btnImportRaindropFile" accept=".csv,.json" style="display:none;" />
              </div>
              </div>
            </div>
          </div>

          <div class="st-accordion is-expanded" data-page="maintenance">
            <button class="st-accordion-header" type="button">
              <span class="st-group-title">Maintenance</span>
              <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="st-accordion-body">
              <div class="st-card st-data-stack">
                <div class="st-data-action"><div class="st-data-action-copy"><div class="st-label">Duplicate links</div><div class="st-hint">Keeps the first copy of each URL.</div></div><button id="stDedupeBtn" class="st-action-btn st-icon-clean">Clean up</button></div>
                <div class="st-data-action"><div class="st-data-action-copy"><div class="st-label">Wallpaper storage</div><div class="st-hint">Removes broken and unused media.</div></div><button id="stRepairMediaBtn" class="st-action-btn st-icon-repair">Repair</button></div>
              </div>
            </div>
          </div>

          <div class="st-accordion is-expanded" data-page="reset">
            <button class="st-accordion-header" type="button">
              <span class="st-group-title">Danger zone</span>
              <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="st-accordion-body">
              <div class="st-card st-data-stack st-danger-card">
                <div class="st-data-action"><div class="st-data-action-copy"><div class="st-label">Remove all boards</div><div class="st-hint">Keeps settings, notes and wallpapers.</div></div><button id="stClearBoardsBtn" class="st-action-btn st-icon-trash" style="color:#ef4444; border-color:rgba(239, 68, 68, 0.4);">Remove</button></div>
                <div class="st-data-action"><div class="st-data-action-copy"><div class="st-label">Factory reset</div><div class="st-hint">Deletes all extension data.</div></div><button id="stResetAllBtn" class="st-reset-btn st-icon-reset">Reset</button></div>
              </div>
            </div>
          </div>

          <div class="st-accordion is-expanded" data-page="privacy">
            <button class="st-accordion-header" type="button">
              <span class="st-group-title">Privacy</span>
              <svg class="st-accordion-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="st-accordion-body">
              <div class="st-card" style="display:flex; flex-direction:column; gap:14px;">
                <div>
                  <div class="st-row">
                    <label class="st-label" for="stRemoteFavicons">Load icons from the web</label>
                    <input type="checkbox" id="stRemoteFavicons" ${settings.remoteFavicons ? "checked" : ""} />
                  </div>
                  <div class="st-hint">Shows real website icons. Only the site's name (like github.com) is sent to DuckDuckGo or Google. Turn off to keep everything on your device.</div>
                </div>
              </div>
            </div>
          </div>

        </div>
    `;
  }

  S.registerTab("data", { render, bind: bindDataEvents });
})();
