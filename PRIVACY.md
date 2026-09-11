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

## Network features

The new-tab view loads packaged files, and fonts are included in the extension
package. The only automatic network request is for site icons while remote
favicons are on (see below); in Chrome most icons come from the browser's own
local cache instead. With remote favicons off, a new tab makes no network
request.

The following optional or user-initiated features contact third parties
directly. These requests do not pass through a developer-operated server.
Like ordinary web requests, the receiving service can see standard connection
information such as the user's IP address and browser headers.

### Weather

Weather is off by default. While you type in the city field, the text typed so
far is sent to Open-Meteo's geocoding API to suggest matching places - only after
two characters and a short pause. The coordinates of the place you pick are then
sent to Open-Meteo's forecast API. EshaalTab does not attach an account, advertising ID
or extension-generated user identifier. Open-Meteo's privacy policy applies to
its handling of the request.

### Remote favicons

Remote favicons are on by default, so link, pin and search-engine icons show up
on a fresh install. While on, the domains of your saved links and of the search
engines in the search bar may be sent to Google, DuckDuckGo or the site itself to
retrieve an icon. Turn off "Load icons from the web" under Settings, Privacy to
stop this; Chrome's local favicon cache or a packaged icon is then used instead.

### Wallpapers from a URL

When you provide a wallpaper URL, the browser contacts that address. Its host
can see the request. Images are stored locally when possible. Remote videos and
images that cannot be stored may be requested again on later new tabs.

### Search and AI providers

By default the search box hands your query to the browser's own configured
search provider, using the `search` permission. EshaalTab does not choose your
search engine and does not change it - whatever you have already set in your
browser is what answers.

You can send an individual search somewhere else by picking a provider in the
bar: Google, DuckDuckGo, Yandex, Yahoo, Brave, Perplexity, ChatGPT, Claude,
Gemini, YouTube, Reddit, Pinterest or Quora.
That choice is stored locally and applies only to searches you start from this
page. Their respective privacy policies apply.

## Chrome Sync

A limited copy of appearance settings is written to `chrome.storage.sync` when
Chrome Sync is enabled. Boards, saved links, tab stashes, notes, tasks,
clipboard snippets and wallpapers are excluded. Sync is provided by the user's
browser account; EshaalTab operates no synchronisation server.

## Retention and deletion

Data remains in browser storage until the user deletes it or uninstalls the
extension. Individual items can be removed in the interface. Settings > Privacy
& data > Factory reset removes EshaalTab data and restores defaults. Export
creates a local JSON backup, including locally stored wallpapers.

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
