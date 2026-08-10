# Chrome Web Store listing

## Summary

Organise bookmarks, search open tabs, and keep quick notes from a personal new
tab page.

## Detailed description

EshaalTab replaces Chrome's New Tab page with a personal start page.

Use it to:

- Organise links into bookmark boards.
- Pin frequently used links to the Home view.
- Save the current page from the toolbar, keyboard shortcut, or context menu.
- Find saved links with Ctrl+K.
- Find open tabs and history results after granting optional permission.
- Search with Chrome's default search engine or a provider you select.
- Keep short notes and tasks and use a focus timer.
- Choose colours, fonts, layouts, and image or video wallpapers.
- Use Quick Settings for common changes or Customize for detailed wallpaper,
  clock, search and weather controls, with an optional performance mode.

Boards, notes, tasks, settings, and uploaded wallpapers are stored in the
browser. EshaalTab has no account, advertising, analytics, or developer server.
See the privacy policy for details about optional network features.

Source code:
https://github.com/EshaalB/EshaalTab

## Single purpose

EshaalTab replaces Chrome's New Tab page with a personal start page for
organising and opening links and short-term work items. Users can save links,
find saved or recently used pages, search the web, and keep notes and tasks from
that page. The toolbar and context-menu actions only save the current page to
the same new-tab start page.

## Permission justifications

### storage

Stores the user's boards, links, notes, tasks, and settings so they remain
available when a new tab is opened.

### unlimitedStorage

Allows user-uploaded image and video wallpapers to be stored locally without failing when they exceed the normal extension storage limit.

### activeTab

Lets the toolbar button read the current page's title and URL after the user clicks it, so that page can be saved to EshaalTab.

### contextMenus

Adds a "Save to EshaalTab" option to the right-click menu for saving the current page or a selected link to the new-tab Inbox.

### favicon

Loads icons for saved links from Chrome's local favicon cache. This avoids contacting an external icon service when remote favicons are disabled.

### search

Sends a search through Chrome's current default search engine when the user chooses the Default option. EshaalTab does not change the default engine.

### bookmarks (optional)

Allows the user to import existing browser bookmarks into EshaalTab. Access is
requested before import and bookmarks are not changed or transmitted.

### tabs (optional)

Allows Ctrl+K to find open tabs and lets the user stash open tabs. Access is requested from the user and tab information is not transmitted.

### history (optional)

Allows Ctrl+K to show matching pages from browser history. Access is requested from the user and results are used only inside the search panel.
