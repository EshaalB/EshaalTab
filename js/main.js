/* Entry point: loads state, applies theme/cursor/wallpaper, boots every renderer,
   flushes pending writes on hide, wires Escape-closes-everything, and re-syncs
   when another tab changes storage. */
'use strict';

async function repaintAll() {
  SettingsRenderer.applyPresetShell();
  SettingsRenderer.applyTheme();
  SettingsRenderer.applyCursor();
  const s = StorageManager.getSettings();
  if (s.backgroundType && s.backgroundValue) {
    await SettingsRenderer.applyWallpaper(s.backgroundType, s.backgroundValue, false);
  }
  WidgetsRenderer.applyWidgetVisibility();
  TodoWidget.render();
  ViewController.show(TabManager.get());
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { settings } = await StorageManager.load();

    SettingsRenderer.applyPresetShell();
    SettingsRenderer.applyTheme();
    SettingsRenderer.applyCursor();
    if (settings.backgroundType && settings.backgroundValue) {
      await SettingsRenderer.applyWallpaper(settings.backgroundType, settings.backgroundValue, false);
    }

    BoardRenderer.init();
    WidgetsRenderer.init();
    TodoWidget.init();
    WorkspaceWidget.init();
    HomeRenderer.init();
    SearchRenderer.init();
    SettingsRenderer.init();

    ViewController.init();

    PermissionManager.syncAiEnabled(settings.aiAutoSend === true).then(enabled => {
      if (settings.aiAutoSend && !enabled) {
        settings.aiAutoSend = false;
        StorageManager.saveSettings();
      }
    });

    if (!settings.onboardingSeen && HAS_EXT) {
      const finishOnboarding = () => {
        settings.onboardingSeen = true;
        StorageManager.saveSettings();
      };
      showCustomModal(
        'Enable browser features?',
        '<p class="dialog-message">Allow access to tabs, bookmarks and history for tab stashing, browser bookmark import, and combined search. Your data stays on this device. AI-site access is separate and remains off.</p>',
        () => {
          finishOnboarding();
          PermissionManager.requestRecommended().then(granted => {
            ToastSystem[granted ? 'success' : 'info'](granted ? 'Browser features enabled' : 'Permission request declined');
          });
          return true;
        },
        'Allow features',
        false,
        finishOnboarding
      );
    }
    const flushAll = () => { NotesRenderer.flushPending(); StorageManager.flush(); };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushAll();
    });
    /* pagehide + visibilitychange(hidden) cover navigation and tab-switch. A
       beforeunload listener adds nothing here and disqualifies the page from
       the back/forward cache just by existing. window 'blur' was removed because
       it overrides cross-tab sync when quickly switching tabs. */
    window.addEventListener('pagehide', flushAll);

    document.addEventListener('visibilitychange', () => {
      const v = $('video-bg');
      if (!v || !v.src) return;
      if (document.hidden) v.pause();
      else if (v.classList.contains('active')) v.play().catch(() => {});
    });

    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;

      const modal = $('appDynamicModal');
      if (modal) { modal.remove(); return; }
      if ($('pomodoroOverlay')?.classList.contains('open')) { PomodoroMode.exit(); return; }
      if (SearchRenderer.isOpen()) { SearchRenderer.close(); return; }
      if ($('sidesheetOverlay')?.classList.contains('open')) { SettingsRenderer.closeSideSheet(); return; }
      if ($('workspacePopover')?.classList.contains('open')) { WorkspaceWidget.close(); return; }
      if ($('todoPopover')?.classList.contains('open')) { TodoWidget.close(); return; }
      ContextMenu.hide();
    });

    if (HAS_EXT && EXT.storage && EXT.storage.onChanged) {
      let pendingSync = false;

      const applySync = async () => {
        pendingSync = false;
        NotesRenderer.flushPending();
        StorageManager.flush();

        const notesEl = $('notesArea');
        const dirtyNotes = notesEl && notesEl.value !== StorageManager.getData().notes
          ? notesEl.value : null;

        await StorageManager.load();

        if (dirtyNotes !== null) {
          StorageManager.getData().notes = dirtyNotes;
          StorageManager.save();
        }
        await repaintAll();
      };

      EXT.storage.onChanged.addListener((changes, area) => {
        try {
          if (area !== 'local') return;
          if (!changes.data && !changes.settings) return;
          /* Our own writes carry a stamp that starts with this page's writer id.
             Anything else -- the popup, the service worker, another new tab --
             is a genuine external change worth reloading for. */
          if (StorageManager.isOwnWriter(changes.writer?.newValue)) return;

          const ae = document.activeElement;
          const typing = ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
          if (typing) {
            if (!pendingSync) {
              pendingSync = true;
              const onBlur = () => { ae.removeEventListener('blur', onBlur); if (pendingSync) applySync(); };
              ae.addEventListener('blur', onBlur);
            }
            return;
          }
          applySync();
        } catch { }
      });
    }
  } catch (err) {
    console.error('Error initializing EshaalTab:', err);
  } finally {
    // Never strand the page hidden if an optional integration fails to start.
    document.body.classList.add('loaded');
    document.documentElement.classList.remove('boot-pending');
  }
});
