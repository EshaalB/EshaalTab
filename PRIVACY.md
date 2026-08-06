# EshaalTab Privacy Policy

**Last updated:** 7 August 2026

**Applies to:** EshaalTab - New Tab & Bookmark Boards

**Provided by:** Eshaal B
**Contact:** eshaalrehamat@gmail.com

## Summary

EshaalTab has no user account, developer-operated server, advertising,
analytics, telemetry or crash reporting. The developer does not receive your
boards, links, notes, tasks, browsing activity, searches or settings.

EshaalTab handles the information needed to provide its new-tab features. Most
of that information remains in browser extension storage. A network request is
made only when you start a search, enable weather or remote favicons, or choose
a wallpaper hosted on the web. These cases are described below.

## Information stored in your browser

EshaalTab stores the following in `chrome.storage.local`:

- Boards, saved links, tags and pinned links
- Imported bookmark titles and URLs
- Titles and URLs of pages you deliberately save or stash
- Tab-stash entries until you delete them
- Notes, clipboard snippets, tasks and focus-session counts
- Appearance, layout, font and widget settings
- Uploaded wallpapers and downloaded wallpaper images
- An optional display name
- An optional weather city and recent forecast data

This information is used only to provide the features visible in EshaalTab. It
is not sent to the developer.

## Information read temporarily

- **Open tabs:** after optional tab access is granted, Ctrl+K can show matching
  tabs and the stash feature can save the tabs in the current window. Tab titles
  and URLs are stored only when you deliberately save or stash them.
- **Browsing history:** after optional history access is granted, Ctrl+K shows
  matching history results. Those results are processed locally and discarded.
- **Browser bookmarks:** after optional bookmark access is granted, the bookmark
  tree is read only when you confirm an import. EshaalTab does not edit or delete
  browser bookmarks.
- **AI-site controls:** when optional AI search submission is enabled, the
  content script locates the selected site's prompt field and Send control. It
  does not read existing conversations.

## Network features

The default new-tab view loads packaged files and makes no automatic network
request. Fonts are included in the extension package.

The following optional or user-initiated features contact third parties
directly. These requests do not pass through a developer-operated server.
Like ordinary web requests, the receiving service can see standard connection
information such as the user's IP address and browser headers.

### Weather

Weather is off by default. When you enter a city, its name is sent to
Open-Meteo's geocoding API. The returned coordinates are then sent to
Open-Meteo's forecast API. EshaalTab does not attach an account, advertising ID
or extension-generated user identifier. Open-Meteo's privacy policy applies to
its handling of the request.

### Remote favicons

Remote favicons are off by default. While disabled, Chrome's local favicon cache
or a packaged fallback is used. If enabled, saved domains may be sent to Google,
DuckDuckGo or the saved site itself to retrieve an icon.

### Wallpapers from a URL

When you provide a wallpaper URL, the browser contacts that address. Its host
can see the request. Images are stored locally when possible. Remote videos and
images that cannot be stored may be requested again on later new tabs.

### Search and AI search submission

When you submit a search, the query is sent to the browser's configured default
search provider or to the provider you explicitly selected. Available providers
include DuckDuckGo, YouTube, Brave, Perplexity, ChatGPT, Claude and Gemini.
Their respective privacy policies apply.

AI search submission is disabled by default. Enabling it produces one browser
permission request for the packaged content script and the three supported AI
sites. When the user initiates an AI search, EshaalTab enters and submits that
query. It does not read existing conversations, collect responses or continue
monitoring the site for another purpose. Disabling the setting unregisters the
content script and removes the optional permissions.

## Chrome Sync

A limited copy of appearance settings is written to `chrome.storage.sync` when
Chrome Sync is enabled. Boards, saved links, tab stashes, notes, tasks,
clipboard snippets and wallpapers are excluded. Sync is provided by the user's
browser account; EshaalTab operates no synchronisation server.

## Retention and deletion

Data remains in browser storage until the user deletes it or uninstalls the
extension. Individual items can be removed in the interface. Settings > Data >
Reset removes EshaalTab data and restores defaults. Export creates a local JSON
backup before a reset if the user chooses to do so.

## Information not used

EshaalTab does not request or use financial information, payment information,
health information, authentication credentials or advertising identifiers. It
does not sell user data, use it for advertising, determine creditworthiness, or
allow the developer or another human to read it.

## Limited Use

EshaalTab's use of information received from Chrome APIs complies with the
Chrome Web Store User Data Policy, including the Limited Use requirements. Data
obtained through Chrome APIs is used only to provide the user-facing features
described above. It is not transferred for advertising, profiling, data resale,
creditworthiness or any unrelated purpose.

## Children

EshaalTab is not directed at children and does not knowingly collect information
from children under 13.

## Changes

Material changes will be reflected in the date above and in the extension's
release history. Any new data practice will be disclosed before it is enabled.
