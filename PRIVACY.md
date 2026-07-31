# EshaalTab Privacy Policy

**Last updated:** 31 July 2026
**Applies to:** EshaalTab — New Tab & Bookmark Boards
**Provided by:** Eshaal B
**Contact:** eshaalrehamat@gmail.com

## Summary

EshaalTab has no user account, no server operated by us, no advertising, no
analytics and no telemetry. We do not receive any data about you or your
browsing, and we do not sell or share data with anyone.

Your data lives in your browser's own extension storage, on your device. Three
optional features, all off by default, send limited information directly from
your browser to a third party. Each one is listed in full below.

## What EshaalTab stores on your device

Held in `chrome.storage.local`, on your computer:

* Boards, saved links, tags and pinned links
* Bookmark titles and URLs, if you use the one-off "Import browser bookmarks"
* Titles and URLs of open tabs, if you use "Stash all open tabs" or save a page
* Notes, clipboard snippets, to-do items and Pomodoro session counts
* Appearance, layout and font settings
* Image and video wallpapers you upload, and images you set by URL
* An optional display name (24 characters maximum)
* An optional weather city, and the most recent forecast retrieved for it

None of this is sent to us.

## What EshaalTab reads but does not store

* **Browsing history.** The Ctrl+K palette asks your browser for entries
  matching what you type, shows them as results, and discards them. History is
  never written to our storage and never transmitted.
* **Open tabs.** The palette lists your open tabs so you can jump to one. Tab
  information is stored only if you deliberately save or stash a tab.
* **Bookmarks.** Read only during an explicit, confirmed import, and only to
  create matching boards. EshaalTab never creates, edits or deletes a bookmark.

## What leaves your browser

In its default configuration, EshaalTab makes no network requests at all. The
new tab page loads only files bundled inside the extension; the fonts it uses
are packaged with it rather than fetched from Google Fonts.

The following features can reach the network. Each is optional, and each sends
data directly from your browser to the named service — it never passes through
any server of ours.

**1. Weather (off by default)**
When you enter a city, EshaalTab sends that city name to Open-Meteo's geocoding
API to obtain coordinates, then sends those coordinates to Open-Meteo's forecast
API to retrieve the current conditions. No account, identifier or device
information is attached to either request. Open-Meteo's own privacy policy
governs what they do with it. Turn the widget off, or clear the city, and no
further requests are made.

**2. Remote favicons (off by default)**
By default, site icons come from your browser's own local favicon cache, so
displaying your saved links sends nothing anywhere. If you turn on remote
favicons, EshaalTab requests icons from Google and DuckDuckGo, which reveals the
domains you have saved to those services. That is precisely why it is off by
default.

**3. Wallpapers set from a URL**
If you paste an image URL, EshaalTab asks your permission for that one website,
downloads the image once, and stores it on your device, so it is not refetched
every time you open a new tab. If you decline, the URL is used directly, meaning
the image host sees a request from your browser on each new tab. Video
wallpapers set by URL always remain remote, because storing a large video file
locally costs more than the request it would save.

**4. Searching**
When you search from EshaalTab's search bar, your query goes to the search
engine you selected — Google, DuckDuckGo, YouTube, Brave, Perplexity, ChatGPT,
Claude or Gemini. This is the same as typing the query into that site yourself.
If you choose ChatGPT, Claude or Gemini, EshaalTab fills in the prompt box on
that site and submits it for you, so you do not have to click twice. It reads
nothing else from the page and transmits nothing of its own.

## Syncing between your devices

A trimmed copy of your **appearance settings only** is written to
`chrome.storage.sync`, which Chrome syncs through your own Google account, and
only if you have Chrome sync enabled. Wallpapers, boards, saved links,
notes and to-do items are explicitly excluded and never sync. We operate no
synchronisation server and cannot see synced data.

## Retention and deletion

EshaalTab keeps your data until you delete it. There is no server-side copy and
no retention period on our side, because we hold nothing.

* **Delete an individual item:** remove the link, board, note or task in the UI.
* **Delete everything:** Settings → Data → Reset clears all boards, links,
  notes, timers, wallpapers and settings back to defaults.
* **Delete everything by uninstalling:** removing the extension deletes its
  local and synced storage through Chrome's normal uninstall process.
* **Export first:** Settings → Data → Export writes a full JSON backup to your
  computer before you reset.

## Data we never handle

EshaalTab does not collect or transmit personally identifiable information
beyond an optional display name you type yourself, nor any health information,
financial or payment information, authentication credentials, personal
communications, or the content of the web pages you visit. It contains no
advertising, no analytics, no crash reporting and no fingerprinting.

## Children

EshaalTab is not directed at children and does not knowingly handle data from
children under 13.

## Changes to this policy

Material changes will be reflected in the "Last updated" date above and in the
extension's version history.
