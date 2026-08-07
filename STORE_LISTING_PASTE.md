# Chrome Web Store copy-paste fields

## Summary

Organise bookmarks, search open tabs, and keep quick notes from a personal new
tab page.

## Detailed description

EshaalTab replaces Chrome's New Tab page with a personal start page.

Use it to:

- Organise links into boards and pin frequently used links to Home.
- Save the current page from the toolbar, keyboard shortcut or context menu.
- Stash the tabs in a window and reopen them later.
- Find saved links with Ctrl+K and, after optional permission, find open tabs
  and matching history results.
- Search with Chrome's current default engine or a provider you select.
- Keep short notes, tasks and reusable clipboard snippets.
- Use a focus timer, weather widget and quick links to common web services.
- Choose colours, local fonts, layouts, and image or video wallpapers.

AI search submission is optional and disabled by default. Installation access
is limited to ChatGPT, Claude and Gemini. The packaged content script exits
immediately while the feature is disabled. EshaalTab submits only a query
started from its new-tab search bar and does not read existing conversations.

Boards, notes, tasks, stashes, settings and uploaded wallpapers are stored in
the browser. EshaalTab has no account, advertising, analytics or
developer-operated server. See the privacy policy for optional network features.

Source code:
https://github.com/EshaalB/EshaalTab

## Single purpose

EshaalTab's single purpose is to provide a personal new-tab start page for
organising and reopening the links and short-term work items used during
browsing. Boards, saved pages, tab stashes, search, notes, tasks, snippets,
weather, focus controls and appearance settings all support that start-page
workflow. The toolbar popup saves the current page and manages tab stashes for
the same start page; the context-menu and keyboard actions save pages to its
Inbox. AI submission remains off until the user enables it and only submits a
search initiated from EshaalTab.

## Permission justifications

### storage

Stores boards, links, tab stashes, notes, tasks, snippets and settings in the
browser so they remain available on later new tabs.

### unlimitedStorage

Allows user-selected image and video wallpapers to be stored locally when they
exceed Chrome's normal extension storage quota.

### activeTab

Lets the toolbar popup read the current page's title and URL after the user
opens it, so that page can be saved to EshaalTab.

### contextMenus

Adds one "Save to EshaalTab" right-click option for saving the current page or
a selected link to the new-tab Inbox.

### favicon

Loads icons for saved links from Chrome's local favicon cache, avoiding an
external icon request while remote favicons are disabled.

### search

Uses `chrome.search.query()` when the user selects Default, ensuring the query
uses Chrome's current default search provider. EshaalTab does not change that
provider.

### bookmarks (optional)

Reads the browser bookmark tree only after the user confirms an import. It
creates EshaalTab boards and never edits or transmits browser bookmarks.

### tabs (optional)

Allows Ctrl+K to find open tabs and allows the user to stash and later reopen
tabs. Titles and URLs are stored only when the user deliberately saves or
stashes them and are not sent to the developer.

### history (optional)

Allows Ctrl+K to display matching history entries. Results are processed
locally, discarded after use and not sent to the developer.

## Host permission justification

Host access is limited to ChatGPT, Claude and Gemini. It supports the extension's
AI query submission feature and avoids broad access to other websites. The
packaged content script exits immediately unless AI auto-send is enabled
and the page URL contains an EshaalTab query. It then enters and submits only
that query and does not read existing conversations or collect responses.

## Remote code declaration

Select: **No, I am not using remote code.**

All JavaScript is packaged with the extension. No remote script, `eval`, `new
Function`, external module or string-based timer is used. Network responses are
used only as data, such as weather JSON, wallpaper media and favicon images.

## Data usage disclosures

Use the closest labels displayed in the current dashboard and keep the
explanations below. Local processing still counts as handling data.

| Category | Selection | Explanation |
|---|---|---|
| Personally identifiable information | No | An optional display name remains local and is never sent to the developer. |
| Health information | No | Not requested or used. |
| Financial and payment information | No | Not requested or used. |
| Authentication information | No | Credentials and cookies are not read. |
| Personal communications | Yes | An AI query is handled only when the user explicitly submits it to the selected AI service. Existing conversations and responses are not read. |
| Location | Yes | A user-entered city and the returned coordinates are sent directly to Open-Meteo when weather is enabled. |
| Web history / browsing activity | Yes | Open-tab and history URLs are processed locally for Ctrl+K; titles and URLs are stored only when the user saves or stashes them. |
| User activity | No | EshaalTab does not track clicks, keystrokes, browsing behaviour or usage analytics. |
| Website content | Yes | The optional AI script locates the prompt field and Send control solely to submit the user's chosen query. It does not collect conversations or page content. |

## Required certifications

Truthfully affirm all applicable Limited Use certifications:

- Data is not sold to third parties.
- Data is not used or transferred for purposes unrelated to the single purpose.
- Data is not used or transferred for creditworthiness or lending.
- Humans are not allowed to read Chrome API user data.

## Reviewer notes

EshaalTab is a personal new-tab start page. Its boards, saved pages, tab
stashes, Ctrl+K retrieval, notes, tasks, snippets, focus controls, weather and
appearance settings are presented within that page. The action popup supports
the same workflow by saving the current page and managing tab stashes. The
context menu and Alt+Shift+S command only save a page to the new-tab Inbox.

For default web searches, EshaalTab calls `chrome.search.query()` and does not
change the browser's search provider. Named providers are used only after the
user explicitly selects one in the engine picker.

Bookmarks, tabs and history are optional permissions requested from the
first-run explanation screen. Their data is processed locally for import,
retrieval and tab stashing. AI site access is limited at installation to the
exact ChatGPT, Claude and Gemini origins. AI submission is disabled by default;
the packaged content script exits immediately unless the user enables it and
opens an EshaalTab query on one of those sites.

The AI content script is packaged and unminified. It enters and submits only a
query initiated from EshaalTab and does not read existing conversations or
responses. No remote code, analytics, advertising or developer server exists.

## Test instructions

No account or API key is required for the local features. Load the extension
and open a new tab. Boards, saved links, notes, snippets, tasks, focus controls
and appearance settings work locally. Use the first-run Allow button to test
open-tab search, history results, bookmark import and tab stashing. Weather
requires a city and network connection. AI submission requires enabling it in
Settings, accepting the single optional permission prompt, and being able to
use the selected AI website.
