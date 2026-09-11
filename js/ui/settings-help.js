"use strict";

(() => {
  const S = window.SettingsShared;

  function renderHelp() {
    const item = (title, body, kbd) => `
      <div class="help-item">
        <div class="help-item-head">
          <span class="help-item-title">${title}</span>
          ${kbd ? `<span class="help-kbd">${kbd}</span>` : ""}
        </div>
        <div class="help-item-body">${body}</div>
      </div>`;

    return `
      <div class="st-container">
        <div class="help-intro">
          EshaalTab puts your boards, notes, focus timer and quick save on one page.
          Here is how each part works.
        </div>

        <div class="st-group-title">Save a page from anywhere</div>
        <div class="st-card help-card">
          ${item("Instant save", "Press the shortcut on any site and the page goes straight into your <b>Inbox</b> board. No popup appears. A green tick flashes on the toolbar icon so you know it saved.", "Alt+Shift+S")}
          ${item("Right-click save", "Right-click any page or link and choose <b>Save to EshaalTab</b>.")}
          ${item("Choose a board", "Click the EshaalTab toolbar icon when you want to choose where the current page is saved.")}
          <div class="st-hint">You can rebind the shortcut at any time from <b>chrome://extensions/shortcuts</b>.</div>
        </div>

        <div class="st-group-title">Boards and bookmarks</div>
        <div class="st-card help-card">
          ${item("Add and organise", "Open the <b>Boards</b> tab, then use <b>+ Add link</b> or <b>+ Add board</b>. You can drag boards and links to rearrange them, including from one board to another.")}
          ${item("Pin to Home", "Right-click any link on a board and choose <b>Pin to Home</b>. You can also click <b>Add pin</b> on the Home screen to create a link and pin it in one step. Home holds up to five pins, and each one opens with a single click.")}
          ${item("Unpin", "Hover a pinned link on Home and click the small x, or right-click it. Either way you get an undo option.")}
          ${item("Open all in tabs", "A board menu has <b>Open all in tabs</b>, which reopens every link in that board at once. This is handy for getting back to a saved session.")}
          ${item("Reorder without dragging", "The same menu has <b>Move up</b> and <b>Move down</b> if you would rather not drag.")}
        </div>

        <div class="st-group-title">Quick search</div>
        <div class="st-card help-card">
          ${item("Open the palette", "Search your <b>open tabs</b>, <b>bookmarks</b> and <b>history</b> together in one list. Use the arrow keys to move and Enter to open.", "Ctrl / ⌘ + K")}
          ${item("Slash commands", "Type <b>/</b> to run a quick action: <b>/focus</b>, <b>/stash</b>, <b>/new</b>, <b>/notes</b>, <b>/mode</b>, <b>/wall</b>, <b>/import</b>, <b>/settings</b>.")}
          ${item("Stash your tabs", "<b>/stash</b> moves every open tab into a new board and closes them, which clears a crowded window in one step.")}
        </div>

        <div class="st-group-title">Focus, notes and tasks</div>
        <div class="st-card help-card">
          ${item("Pomodoro timer", "Click the timer icon on Home, or type <b>/focus</b>, to start a session. Choose a preset or use the wheel for a custom duration, switching between hour/minute and minute/second entry when needed. Space starts and pauses it, R resets it, and finished sessions are counted for the day.")}
          ${item("Notes and tasks", "The <b>Notes</b> tab is a scratchpad that saves as you type, and you can export it as a .txt file. Tasks live in your notes now: the checklist button in the note toolbar turns lines into tick boxes, and clicking a box marks it done.")}
        </div>

        <div class="st-group-title">Make it yours</div>
        <div class="st-card help-card">
          ${item("Quick Settings", "Control Home visibility, choose a preset, set Light, Dark or System mode, and add a wallpaper by upload or URL. Fresh installs begin with one AI Tools board - ChatGPT, Claude, Gemini, Perplexity, Grok, DeepSeek and more.")}
          ${item("Customize", "Adjust wallpaper fit and position, interface strength, fonts, clock and text appearance, search engines, weather and other detailed controls. Performance mode reduces motion and visual effects on slower devices.")}
          ${item("Accent colours", "The accent colours buttons, highlights and the tint behind your boards. Reset it any time to follow your base colour again.")}
        </div>

        <div class="st-group-title">Your data</div>
        <div class="st-card help-card">
          ${item("Backup and restore", "In <b>Privacy &amp; data</b> you can export a full JSON backup, including locally stored wallpapers, restore one, or import from Chrome or Raindrop. Duplicate cleanup keeps the first copy of a repeated URL.")}
          ${item("What leaves your browser", "Your boards and notes stay on your device. There is no EshaalTab account, analytics service or server. A search is sent only when you submit it to your chosen search or AI provider. A wallpaper URL contacts that site when you add it. <b>Load icons from the web</b> is off by default and contacts Google and DuckDuckGo when enabled. Weather contacts Open-Meteo after you set a city.")}
        </div>
      </div>`;
  }

  S.registerTab("help", { render: () => renderHelp(), bind: () => {} });
})();
