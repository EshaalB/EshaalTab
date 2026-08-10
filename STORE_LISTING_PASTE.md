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

AI search submission is optional and disabled by default. If enabled, Chrome
asks for access to ChatGPT, Claude, and Gemini. EshaalTab submits only the query
you entered from its new-tab search bar. It does not read conversations.

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
the same new-tab start page. Optional AI-site access only submits a search the
user started from EshaalTab and is disabled until the user grants permission.

## Permission justifications

### storage

Stores the user's boards, links, notes, tasks, and settings so they remain
available when a new tab is opened.

### unlimitedStorage

Allows user-uploaded image and video wallpapers to be stored locally without failing when they exceed the normal extension storage limit.

### activeTab

Lets the toolbar button read the current page's title and URL after the user clicks it, so that page can be saved to EshaalTab.

### scripting

Used only for the optional AI search integration. After the user enables it and grants site access, EshaalTab submits the query the user entered to the selected
AI website.

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

## Optional host permission justification

Access to ChatGPT, Claude, and Gemini is used only for optional AI search
submission. It is disabled by default. When the user enables it, Chrome asks for
permission before EshaalTab can submit the query entered on the new-tab page.
The extension does not read conversations or collect page content.
