"use strict";

async function repaintAll() {
  SettingsRenderer.applyPresetShell();
  SettingsRenderer.applyTheme();
  SettingsRenderer.applyCursor();
  const s = StorageManager.getSettings();
  if (s.backgroundType && s.backgroundValue) {
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

    /* A fresh profile gets the packaged wallpaper before anything is painted,
       so the first new tab a new install ever opens already looks like the
       product rather than a flat colour that changes a second later. It
       returns false - immediately, without a request - on every subsequent
       launch, so this costs a boolean check for everyone else. */
    const tookPackaged = await SettingsRenderer.applyPackagedWallpaper();

    if (!tookPackaged && settings.backgroundType && settings.backgroundValue) {
      await SettingsRenderer.applyWallpaper(
        settings.backgroundType,
        settings.backgroundValue,
        false,
      );
      // A wallpaper set before the interface started reading brightness out of
      // it has no measurements stored, and without them every ink and shadow
      // decision falls back to "assume dark". Measured once, in the background,
      // leaving the accent the user is already on untouched.
      if (!settings.wpTone) {
        SettingsRenderer.autoExtractColor(
          await StorageManager.resolveMedia(settings.backgroundValue),
          settings.backgroundType === "video",
          true,
        );
      }
    }

    BoardRenderer.init();
    WidgetsRenderer.init();
    WorkspaceWidget.init();
    SessionsRenderer.init();
    HomeRenderer.init();
    SearchRenderer.init();
    SettingsRenderer.init();

    ViewController.init();

    // Asked before anything else on a first run. If it is showing, the
    // permissions prompt waits for another day rather than stacking a second
    // dialog on top of the first thing a new user ever sees.
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
      // The popovers keep their own list, so Escape does not need a rung per
      // widget here - it just dismisses whichever one is showing.
      if (PopoverRegistry.closeTop()) return;
      ContextMenu.hide();
    });

    if (HAS_EXT && EXT.storage && EXT.storage.onChanged) {
      let pendingSync = false;

      const applySync = async () => {
        pendingSync = false;
        NotesRenderer.flushPending();
        StorageManager.flush();

        // #notesArea exists from page load but stays empty until the Notes
        // view is opened, so its value is only authoritative once the user has
        // actually edited it. Without this guard a tab that never visited
        // Notes writes "" back over the stored note on every remote change.
        //
        // The note id is captured alongside the text: `load()` replaces the
        // whole data object, and the incoming copy can have a different note
        // active, so the text has to go back to the note it was typed in
        // rather than to whichever one happens to be active afterwards.
        const notesEl = $("notesArea");
        const dirty =
          notesEl &&
          NotesRenderer.hasLiveEdits() &&
          notesEl.value !== NotesManager.get()
            ? { id: NotesManager.getActiveId(), text: notesEl.value }
            : null;

        await StorageManager.load();

        if (dirty) {
          // Into the note tab itself, which is what the editor renders from.
          // Writing to `data.notes` only fed the legacy mirror, so the rescued
          // keystrokes were dropped on the next repaint.
          const note = StorageManager.getData().noteTabs.find(
            (n) => n.id === dirty.id,
          );
          if (note) {
            note.text = dirty.text;
            note.updatedAt = Date.now();
            if (StorageManager.getData().activeNoteId === dirty.id)
              StorageManager.getData().notes = dirty.text;
            StorageManager.save();
          }
        }
        await repaintAll();
      };

      EXT.storage.onChanged.addListener((changes, area) => {
        try {
          if (area !== "local") return;
          if (!changes.data && !changes.settings) return;

          if (StorageManager.isOwnWriter(changes.writer?.newValue)) return;

          // A tab in the background repaints once, when it is next looked
          // at, rather than on every write another tab makes meanwhile.
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
    // `boot-pending` holds the whole app at `visibility: hidden`, so every
    // line below sits directly on the time before a new tab shows anything.
    //
    // Waiting on `document.fonts.ready` outright meant the page stayed blank
    // until *every* face had settled - a gate with no ceiling on it, for a
    // font that is already preloaded and almost always there in time. It is
    // now a race against a short deadline: the common case still waits for the
    // font and paints with no reflow, and a slow one costs a few frames of
    // fallback text instead of holding the entire page back.
    try {
      if (document.fonts?.ready) {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 50)),
        ]);
      }
    } catch {}
    // One frame, not two - the second only bought insurance against a layout
    // that had already settled, at the cost of a frame spent looking at
    // nothing.
    //
    // The timeout is not belt-and-braces, it is the whole point:
    // `requestAnimationFrame` does not fire in a tab that is not being
    // painted, and a new tab page is very often opened in the background. With
    // rAF as the only way out, the callback never ran, `boot-pending` was
    // never removed, and the page sat at `visibility: hidden` until the moment
    // it was focused - which is exactly the "blank until I click it" and
    // "reload feels delayed" behaviour. Whichever fires first wins.
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

    // The home block reads itself in on arrival (see `et-home-rise`). It is a
    // first-impression flourish, not a transition: coming back to Home from
    // Boards should be instant, so the class that drives it is dropped once
    // the run is over and never comes back for the life of the page.
    document.body.classList.add("home-intro");
    // Just past the longest delay plus its duration (70 + 180). Held any
    // longer and a late repaint could restart the run; dropped any earlier and
    // it would cut the last element off mid-rise.
    setTimeout(() => document.body.classList.remove("home-intro"), 320);
  }
});
