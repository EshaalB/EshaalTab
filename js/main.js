"use strict";

async function repaintAll() {
  SettingsRenderer.applyPresetShell();
  SettingsRenderer.applyTheme();
  SettingsRenderer.applyCursor();
  BackupReminder.check();
  const s = StorageManager.getSettings();

  if (
    (s.backgroundType === "image" || s.backgroundType === "video") &&
    s.backgroundValue
  ) {
    await SettingsRenderer.applyWallpaper(
      s.backgroundType,
      s.backgroundValue,
      false,
    );
  }
  WidgetsRenderer.applyWidgetVisibility();
  ViewController.show(TabManager.get());
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await window.SettingsReady;
    const { settings } = await StorageManager.load();

    SettingsRenderer.applyPresetShell();
    SettingsRenderer.applyTheme();
    SettingsRenderer.applyCursor();

    (async () => {
      const tookPackaged = await SettingsRenderer.applyPackagedWallpaper();
      const hasMedia =
        settings.backgroundType === "image" || settings.backgroundType === "video";
      if (tookPackaged || !hasMedia || !settings.backgroundValue) return;
      await SettingsRenderer.applyWallpaper(
        settings.backgroundType,
        settings.backgroundValue,
        false,
      );
      if (!settings.wpTone) {
        SettingsRenderer.autoExtractColor(
          await StorageManager.resolveMedia(settings.backgroundValue),
          settings.backgroundType === "video",
          true,
        );
      }
    })().catch(() => {});

    await StorageManager.drainInboxQueue();

    BoardRenderer.init();
    WidgetsRenderer.init();
    WorkspaceWidget.init();
    SessionsRenderer.init();
    HomeRenderer.init();
    SearchRenderer.init();
    SettingsRenderer.init();

    ViewController.init();
    BackupReminder.init();
    (window.requestIdleCallback || setTimeout)(() =>
      warmFavicons(BoardManager.getAll().flatMap((b) => (b.bookmarks || []).map((bm) => bm.url))),
    );

    const welcoming = WelcomeScreen.maybeShow();

    if (!welcoming && !settings.onboardingSeen && HAS_EXT) {
      const finishOnboarding = () => {
        settings.onboardingSeen = true;
        StorageManager.saveSettings();
      };
      showCustomModal(
        "Enable browser features?",
        '<p class="dialog-message">Allow access to tabs, bookmarks and history for tab stashing, browser bookmark import, and combined search. Your data stays on this device. AI-site access is separate and remains off.</p>',
        () => {
          finishOnboarding();
          PermissionManager.requestRecommended().then((granted) => {
            ToastSystem[granted ? "success" : "info"](
              granted
                ? "Browser features enabled"
                : "Permission request declined",
            );
          });
          return true;
        },
        "Allow features",
        false,
        finishOnboarding,
      );
    }
    const flushAll = () => {
      NotesRenderer.flushPending();
      StorageManager.flush();

      StorageManager.flushSync();
    };
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushAll();
    });

    window.addEventListener("pagehide", flushAll);

    document.addEventListener("visibilitychange", () => {
      const v = $("video-bg");
      if (!v || !v.src) return;
      if (document.hidden) v.pause();
      else if (
        v.classList.contains("active") &&
        !StorageManager.getSettings().performanceMode
      )
        v.play().catch(() => {});
    });

    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;

      const modal = $("appDynamicModal");
      if (modal) {
        modal.remove();
        return;
      }
      if ($("pomodoroOverlay")?.classList.contains("open")) {
        PomodoroMode.exit();
        return;
      }
      if (SearchRenderer.isOpen()) {
        SearchRenderer.close();
        return;
      }
      if ($("sidesheetOverlay")?.classList.contains("open")) {
        SettingsRenderer.closeSideSheet();
        return;
      }

      if (PopoverRegistry.closeTop()) return;
      ContextMenu.hide();
    });

    if (HAS_EXT && EXT.storage && EXT.storage.onChanged) {
      let pendingSync = false;
      let notesSyncTimer = null;

      const applySync = async () => {
        pendingSync = false;
        clearTimeout(notesSyncTimer);
        StorageManager.flush();

        const mine = new Map(
          (StorageManager.getData().noteTabs || []).map((n) => [
            n.id,
            { text: n.text, updatedAt: n.updatedAt || 0 },
          ]),
        );

        await StorageManager.load();

        const d = StorageManager.getData();
        let keptLocal = false;
        (d.noteTabs || []).forEach((n) => {
          const local = mine.get(n.id);
          if (local && local.updatedAt > (n.updatedAt || 0) && local.text !== n.text) {
            n.text = local.text;
            n.updatedAt = local.updatedAt;
            keptLocal = true;
          }
        });
        if (keptLocal) {
          const active = d.noteTabs.find((n) => n.id === d.activeNoteId);
          if (active) d.notes = active.text;
          StorageManager.save();
        }
        await repaintAll();
        NotesRenderer.syncFromStore();
      };

      EXT.storage.onChanged.addListener((changes, area) => {
        try {
          if (area !== "local") return;

          if (changes[StorageManager.UPDATE_PENDING_KEY]?.newValue) {
            NotesRenderer.flushPending();
            StorageManager.flush();
            StorageManager.flushSync();
            return;
          }

          if (changes[StorageManager.INBOX_QUEUE_KEY]?.newValue) {
            StorageManager.drainInboxQueue().then((added) => {
              if (!added) return;
              BoardRenderer.renderBoards();
              HomeRenderer.renderPinned();
              ToastSystem.success(
                added === 1 ? "Page saved to Inbox" : `${added} pages saved to Inbox`,
              );
            });
            return;
          }

          if (!changes.data && !changes.settings) return;

          if (StorageManager.isOwnWriter(changes.writer?.newValue)) return;

          if (document.visibilityState !== "visible") {
            if (!pendingSync) {
              pendingSync = true;
              const onVisible = () => {
                if (document.visibilityState !== "visible") return;
                document.removeEventListener("visibilitychange", onVisible);
                if (pendingSync) applySync();
              };
              document.addEventListener("visibilitychange", onVisible);
            }
            return;
          }

          const ae = document.activeElement;
          if (ae?.id === "notesArea") {
            const wait = 700 - (Date.now() - NotesRenderer.lastEditAt());
            if (wait > 0) {
              pendingSync = true;
              clearTimeout(notesSyncTimer);
              notesSyncTimer = setTimeout(() => {
                if (pendingSync) applySync();
              }, wait);
              return;
            }
            applySync();
            return;
          }
          const typing =
            ae &&
            (ae.tagName === "INPUT" ||
              ae.tagName === "TEXTAREA" ||
              ae.isContentEditable);
          if (typing) {
            if (!pendingSync) {
              pendingSync = true;
              const onBlur = () => {
                ae.removeEventListener("blur", onBlur);
                if (pendingSync) applySync();
              };
              ae.addEventListener("blur", onBlur);
            }
            return;
          }
          applySync();
        } catch {}
      });
    }
  } catch (err) {
    console.error("Error initializing EshaalTab:", err);
  } finally {
    try {
      if (document.fonts?.ready) {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 50)),
        ]);
      }
    } catch {}

    await new Promise((resolve) => {
      let settled = false;
      const reveal = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      requestAnimationFrame(reveal);
      setTimeout(reveal, 100);
    });

    document.body.classList.add("loaded");
    document.documentElement.classList.remove("boot-pending");

    document.body.classList.add("home-intro");

    setTimeout(() => document.body.classList.remove("home-intro"), 180);
  }
});
