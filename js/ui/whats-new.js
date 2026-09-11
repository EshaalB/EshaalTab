"use strict";

/* Two jobs, both about surviving an extension update:
   1. A stale new tab page keeps running the previous build's code until it is
      reloaded, which is why an update can look like "nothing changed". When the
      extension context is torn down we reload the page ourselves, at a moment
      that will not eat what the user is typing.
   2. Once the fresh build boots, show a short note about what changed. Settings
      and data live in extension/local storage and are untouched by an update -
      only the seen-version marker moves. */
(function () {
  const EXT =
    typeof chrome !== "undefined" && chrome.runtime
      ? chrome
      : typeof browser !== "undefined" && browser.runtime
        ? browser
        : null;

  const SEEN_KEY = "et_seen_version";

  // Newest first. Keep it to the handful of lines a user actually cares about;
  // versions with no entry here update silently.
  const CHANGELOG = {
    "2.0.158": [
      "Fixed: dragging a board sideways onto a tall board no longer drops it underneath. It goes above, unless you let go near the bottom edge.",
    ],
    "2.0.157": [
      "The timer button no longer shows a count for your first session.",
      "Pinned icons are easier to recognise on pastel themes, and the pinned boards icon is bolder.",
      "The greeting capitalises your name.",
    ],
    "2.0.156": [
      "Fixed: moving a board left or right no longer drops it lower down. It lands level with where it was, or higher beside a tall board.",
      "Pinned boards open from a board button at the end of your pinned links.",
      "Ctrl+K: type a web address and press Enter to open it, or search the web for anything you type. The arrow keys keep working after a click in the list.",
      "Boards at 100% strength are fully solid.",
      "Colourful weather icons that are easy to see, with a moon at night.",
      "App launcher: no more All and Starred tabs. Starred apps simply come first.",
      "Workspaces: the board picker is gone. Use Save as new board to keep the open tabs as a board.",
      "Support page links to the project on GitHub.",
      "Simpler wording across Settings.",
      "Spotify and Wikipedia were removed from the search engines. The Pomodoro timer no longer shows a toast or a session count for your first session.",
    ],
    "2.0.155": [
      "Fixed: the gap between the clock and the greeting. The clock's box was held taller than its digits, and on large screens that empty space became most of the gap. The spacing is now measured from the letters in whatever font you use, so it is the same on every screen.",
      "Pinned boards open straight to a board and its links. Until you pin any, it shows your boards so there is always something to open.",
    ],
    "2.0.154": [
      "Fixed: the Pinned boards button stayed hidden until a board was pinned. It now shows whenever the setting is on, and lists your boards to pin with one click. New installs start with AI Tools pinned.",
    ],
    "2.0.153": [
      "New: Pinned boards. Pin any board from its menu, then open all its links from the round button in the corner of Home, one tab per board.",
      "New: choose where pinned links sit on Home: under the search bar, down the left or right side, or along the bottom.",
      "Ticking a task on Home now deletes it from its note. It stays struck through for three seconds with an Undo, in case you did not mean it.",
      "Home shows three tasks by default, or five if you pick that under Settings > Home page.",
      "The search engine menu is a grid of Search engines, AI assistants and Platforms, with an Edit button to choose which appear.",
      "Pastel and Neon themes use the colour their swatch shows, and accent colours stay vivid instead of turning dull when they are darkened for contrast.",
      "Pinned icons on a plain background keep their details: the accent now tints the dark parts of a logo instead of painting over the whole thing. The options button is a round chip on the corner of the icon.",
      "Fixed: dragging a board by its header did nothing.",
      "Fixed: with more than one new tab open, pages could keep refreshing each other, which made text shiver and clicks miss.",
      "Fixed: the weather city list was cut off inside its dialog.",
    ],
    "2.0.152": [
      "New: Workspace snapshots, a third tab under Saved sessions. Name the tabs you have open, link them to a board if you like, and restore the whole set later in this window or a new one. Taking a snapshot leaves your tabs open.",
      "New: a Search engines page in Settings. The search bar shows the engine as its icon, and Yandex, Yahoo, Wikipedia, Reddit, Pinterest, Spotify and Quora join the list. Default (Browser) still uses your browser's own search setting.",
      "Pick your weather city from a list of matching places as you type.",
      "Home shows up to five tasks, and +N more opens all of them. Drag a task, or press Alt+Up or Alt+Down, to choose what shows first. The tick boxes now line up.",
      "Pinned links are icons, with the name in a tooltip. Without a wallpaper they sit on white tiles, dark grey in dark mode, and icons that allow it are drawn in your accent colour until you point at them.",
      "New installs start with an AI Tools board: ChatGPT, Claude, Gemini, Perplexity, Grok, DeepSeek and more.",
      "Ctrl+K: type @ to search your boards, Page Up and Page Down move five results, and new commands include /snapshot, /tasks, /home, /boards and /weather.",
      "Pomodoro: Space starts and pauses the timer as soon as it opens.",
      "New clock font: Outfit. The greeting can be hidden under Settings > Home page.",
      "Boards without a wallpaper use softer colours and no drop shadow.",
      "Fixed: dropdown menus opened dark on light pages.",
      "Fixed: buttons shivered under the pointer and sometimes needed a second click.",
      "Fixed: moving a board left or right keeps its row instead of dropping it to the end of the column.",
      "Removed the toolbar and tab bar strength sliders, which changed nothing on screen.",
    ],
    "2.0.151": [
      "New: text colour and highlight in the notepad, under Colour in the toolbar. Seven colours each, plus a swatch to clear one - and they follow your theme, so a note coloured in dark mode is still readable in light mode.",
      "Fixed: notes that arrived with a colour of their own - pasted from a web page, or written before the notepad understood formatting - now show in your theme's text colour instead of whatever the source used.",
      "New: Tasks from notes can be switched off, under Settings > Home page.",
      "A long task on Home now runs the full width of the home column before it fades. Short ones no longer fade at all - the edge fade used to dissolve the last few characters of every task, including ones that fitted.",
      "Without a wallpaper, your accent colour now reaches the greeting, the date and the shortcut labels rather than stopping at the clock and the toolbar.",
      "The clock is larger, and AM/PM is sized against it instead of sitting beside it at toolbar size.",
      "New installs start on the included wallpaper.",
      "Uploaded wallpapers are stored as WebP - a 32 MB photo becomes about 300 KB, with no visible difference.",
      "Updates apply as soon as they arrive instead of waiting for the browser to close.",
    ],
    "2.0.149": [
      "Search goes back to your browser's own search provider by default. The previous build hardcoded Google, which changed your search settings without asking - that was wrong, and the Chrome Web Store was right to flag it. Google and the rest are still there to pick per search.",
      "Removed a remote font download. The handwriting option uses a font shipped with the extension, so it works offline.",
      "Dropped the alarms and notifications permissions, and the leftover reminder code they existed for. Reminders were removed in 2.0.141; the machinery had kept shipping.",
      "New: Darken edges, under Wallpaper - shades the corners and leaves the middle of the picture lit.",
      "The search bar takes the same frosted glass as the pinned tiles, and still follows your background-strength slider.",
      "Long to-do lines fade at the edge instead of being cut off mid-word.",
      "The three-dot menu on a pinned link sits on the corner of its hover plate, clear of the icon.",
      "Add board is full width again and easier to see. The app launcher star is larger with no drop shadow.",
      "Hovering the view you are already on no longer tints it with the accent.",
    ],
    "2.0.148": [
      "Removed a remote font download. The handwriting option now uses a font shipped with the extension, so it works offline and the extension no longer reaches out to Google Fonts.",
      "New: Darken edges, under Wallpaper. Shades the corners and leaves the middle of the picture lit, so text stays readable without dimming the whole wallpaper.",
      "The search bar picks up the same frosted glass as the pinned tiles, and still follows your background-strength slider.",
      "Long to-do lines fade out at the edge instead of being cut off mid-word.",
      "The three-dot menu on a pinned link sits inside the corner of its tile.",
      "Hovering the view you are already on no longer tints it with the accent.",
    ],
    "2.0.147": [
      "Fixed dropdown menus being cut off after two rows. An open settings section was still clipping its own contents, so a menu rendered at full height and then had most of it hidden.",
      "Dropdowns are opaque, taller, and no longer show a search box on short lists. The selected option is marked with a tick.",
      "Pinned link tiles are frosted glass now — they pick up the wallpaper behind them instead of sitting on a fixed grey that was too dark on bright photos.",
      "The to-do list has room between it and the pinned links.",
    ],
    "2.0.146": [
      "Pinned link tiles are solid again, weighted like Chrome's own shortcuts, so they read as tiles over a busy wallpaper instead of nearly disappearing.",
      "The three-dot menu on a pinned link sits in the corner of its tile rather than over the middle of the icon.",
      "Every dropdown — board options, search engines, all the settings selects — now uses one surface, border and corner radius instead of three different ones.",
      "Fixed “Copy my theme code”, which silently did nothing when the clipboard was blocked and reported success anyway. It now falls back to showing the code, and handles names with accents or emoji.",
      "The dot under the active view uses the page ink instead of the accent, which was often the same colour as the background behind it.",
      "The settings button lost its plate; the icon is bigger instead.",
      "Add board is a smaller tile with a larger label and plus sign.",
      "Settings reopens on the page you last had open.",
    ],
    "2.0.145": [
      "Settings is organised by subject now: Appearance, Themes, Presets, Wallpaper and Home page each hold everything for that subject, wherever it used to live. Search still jumps straight to any of them.",
      "Wallpaper settings are all in one place — the picker sits with the crop, dim and blur controls instead of a page away from them.",
      "Pinned link tiles use a light grey plate with a hint of your accent instead of a near-solid black square, so the icons on them are the brightest thing in the tile.",
      "The greeting under the clock is larger and easier to read.",
      "Hovering “Add board” turns the label your accent colour instead of making the tile look like it vanished.",
      "Switching between light and dark keeps your colours. A chosen base background used to come back as stock grey in light mode.",
    ],
    "2.0.144": [
      "Per-surface background strength is back. Removing it in the last build was a mistake — all six sliders and their Auto buttons work as before.",
      "Board colours no longer blend with the accent. A coloured board is built on a neutral ground now, so a red board looks red instead of turning purple next to a blue accent.",
      "A board's title, count and chevron take the board's own colour, lightened or darkened to stay readable in whichever theme you are on.",
      "Two-tone gradients keep more of your second colour. The old limit pulled it to within 45° of the first, which rendered the pair as one flat colour twice.",
      "Home, Boards and Notes now sit in the centre of the top bar. Sessions and the focus timer moved to the left; the command palette, app launcher and settings are on the right.",
      "The home page reads as one block: day and weather, then the clock, then the greeting.",
      "Weather shows the temperature and an icon only — the city is in the tooltip — and the icon takes the colour of the text beside it.",
      "Settings has a proper sidebar: every section named and grouped, with a search box that jumps straight to any of them.",
      "The settings button lost its coloured glow and now takes a plain outline that follows your corner-style setting.",
      "The command palette icon is a search field rather than the Mac command symbol, which meant nothing on Windows or Linux.",
      "Removed the slow pulsing glow behind the focus clock and the pop-in on the board menu.",
      "Hovering a view name lifts it slightly toward your accent colour, kept readable against whatever is behind it.",
      "Fixed the date going blank after changing the layout while the tab was in the background.",
      "Fixed the day and weather row holding a gap open when both were switched off.",
    ],
    "2.0.143": [
      "Search now goes to Google by default instead of “Default (Browser)”, and the extension no longer needs the search permission.",
      "A moved clock takes its date and weather with it: they stack together in the opposite corner, and the whole block sits properly in the corner instead of floating 50px below it.",
      "Where you put the clock now survives switching to Boards and Notes — the toolbar stays where you left it.",
      "Wallpaper softness is set as a percentage rather than a pixel radius, on a gentler curve, and no longer leaves a grey fringe around the screen at high settings.",
      "Icons, clock and date now read their colour from the wallpaper behind them, per strip of the picture, so a bright photo gets dark text and the shadow is only as heavy as it needs to be.",
      "Notices are cards with an icon, an explanation and a dismiss button instead of coloured bars.",
      "Deleting something now asks the way every other app does: icon, question, two buttons.",
      "The focus timer's presets, close and reset buttons are back — they were being hidden by a CSS rule that always applied.",
      "Board colours adapt to light and dark mode, and you can pick any colour you like from the board menu.",
      "Pins on a board are marked by the pin icon itself, which you can now click to pin and unpin.",
      "The notepad toolbar groups its buttons under headings, the way a word processor does.",
      "Corner style and app font name what they actually apply instead of offering “Default”.",
      "Wallpaper crop, dim and blur live in one place again (Customize) rather than being listed twice.",
      "Removed the per-surface strength sliders; one Interface background slider covers it.",
    ],
    "2.0.141": [
      "Open to-dos from your notes now show on the home page. Tick boxes in any note and the next few unfinished ones appear under the search bar; click one to jump straight to that note.",
      "Break reminders have been removed.",
      "The Support tab is now just the Discord and Instagram links.",
    ],
    "2.0.139": [
      "Settings sections now slide open instead of snapping, the same motion boards already had.",
      "Fixed board and settings-section opening not actually animating (it was silently skipping straight to the end).",
      "The board options menu fades in now instead of appearing instantly.",
      "Unified transition timing across tooltips, toasts, dropdowns and hover states that had each drifted to their own speed.",
    ],
    "2.0.137": [
      "The notepad toolbar now shows which formatting is active at the caret (Bold, a heading, a checklist), the way Word or Docs does.",
      "Fixed Select all in the notepad, which previously did nothing.",
      "The search bar's background strength is its own slider again, separate from the tab bar's.",
      "The Settings button now follows your corner-radius setting instead of always being a circle.",
    ],
    "2.0.136": [
      "Every slider's number can now be clicked and typed directly, not just dragged.",
      "Board colours use one consistent palette per board instead of nine independently-tinted pieces.",
      "Interface background strength now actually reaches panels, popovers and dialogs, with a fifth surface slider for them.",
      "Board move now offers only the directions that go somewhere, and up/down no longer jumps sideways.",
      "A board's own colour is fully solid by default; the strength slider fades it, not a second hidden transparency setting.",
      "Fixed the notepad and search bar overflowing off-screen on narrow windows.",
    ],
    "2.0.135": [
      "Your task list now lives in the notepad. Existing tasks moved into a Tasks note, tick boxes and all. Use the checklist button in the note toolbar to add more.",
      "Interface background strength can be set per surface: top bar, boards, notepad and widgets each have their own slider.",
      "Boards read as one interface again: the colour of a board now shows in its title and edge instead of washing the whole card.",
      "New Support tab in Settings.",
    ],
    "2.0.134": [
      "Updates now apply without reopening the tab, so your boards, notes and settings stay put.",
      "Notifications are now asked for only when you turn on a reminder, so updates no longer disable the extension.",
      "Reminders and focus sessions on the home page.",
      "Higher-contrast accent colours across dialogs and popovers.",
    ],
  };

  function currentVersion() {
    try {
      return EXT?.runtime?.getManifest?.().version || "";
    } catch {
      return "";
    }
  }

  /* ---- 1. reload a page whose extension context died under it ---- */

  function contextAlive() {
    try {
      return !!EXT?.runtime?.id;
    } catch {
      return false;
    }
  }

  function isTyping() {
    const el = document.activeElement;
    return !!(
      el &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable)
    );
  }

  function watchForUpdate() {
    if (!EXT?.runtime) return;
    let pending = false;

    const reloadWhenSafe = () => {
      if (!isTyping()) {
        location.reload();
        return;
      }
      if (pending) return;
      pending = true;
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) location.reload();
      });
      document.addEventListener(
        "blur",
        () => {
          if (!isTyping()) location.reload();
        },
        true,
      );
    };

    const check = () => {
      if (!contextAlive()) reloadWhenSafe();
    };

    /* Every thirty seconds, not every five.

       This is a poll for something that changes when the extension updates -
       roughly weekly at best - and it runs for the life of every open new tab.
       At five seconds that is twelve wake-ups a minute, per tab, forever, to
       read one property; on a pinned new tab it is pure battery.

       The frequency barely matters for how quickly a user notices, because
       `visibleInterval` also runs the check on every re-show, and the moment
       that actually counts is when someone returns to the tab. `focus` is
       added for the same reason: a window brought forward is about to be used.
       The interval is only the backstop for a tab left open and looked at. */
    visibleInterval(check, 30000);
    window.addEventListener("focus", check, { passive: true });
  }

  /* ---- 2. the what's-new note ---- */

  function showNotes(version, lines) {
    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "What's new in EshaalTab " + version);

    const card = document.createElement("div");
    card.className = "et-modal-card";

    const title = document.createElement("h3");
    title.className = "dialog-modal-title";
    title.textContent = "What's new in " + version;
    card.appendChild(title);

    const list = document.createElement("ul");
    list.className = "whats-new-list";
    for (const line of lines) {
      const li = document.createElement("li");
      li.textContent = line;
      list.appendChild(li);
    }
    card.appendChild(list);

    const actions = document.createElement("div");
    actions.className = "dialog-modal-actions";
    const ok = document.createElement("button");
    ok.className = "et-modal-btn primary";
    ok.textContent = "Got it";
    actions.appendChild(ok);
    card.appendChild(actions);
    overlay.appendChild(card);

    const close = () => overlay.remove();
    ok.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    });

    document.body.appendChild(overlay);
    ok.focus();
  }

  function maybeShowNotes() {
    const version = currentVersion();
    if (!version) return;
    let seen = null;
    try {
      seen = localStorage.getItem(SEEN_KEY);
    } catch {
      return;
    }
    try {
      localStorage.setItem(SEEN_KEY, version);
    } catch {}

    // No marker means a fresh install, or the first build that shipped this
    // check. Either way there is nothing useful to announce yet.
    if (!seen || seen === version) return;
    const lines = CHANGELOG[version];
    if (!lines || !lines.length) return;
    showNotes(version, lines);
  }

  watchForUpdate();
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", maybeShowNotes);
  else maybeShowNotes();
})();
