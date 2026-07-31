# Chrome Web Store submission

Copy-paste source for the Developer Dashboard fields. Keep this in sync with
`manifest.json` and `PRIVACY.md` — reviewers compare them.

---

## Store listing tab

**Name** (matches `manifest.json` `name`; manifest limit is 75 characters)
```
EshaalTab — New Tab & Bookmark Boards
```

**Summary** (132 char max — must match `manifest.json` `description` exactly; currently 121)
```
A new tab built around your own boards: pin the links you use, save any page in one click, search everything with Ctrl+K.
```

**Category:** Workflow & Planning
**Language:** English (United States)

**Detailed description**
```
EshaalTab turns your new tab into something you built yourself.

Instead of a search box and a grid of sites you never asked for, you get boards
you organised, the five links you actually use pinned one click away, and a
command palette that searches everything you have open or saved.

━━━ WHAT IT DOES ━━━

BOARDS
Group your links into boards with custom colours and drag-and-drop ordering.
Right-click any link to pin it to your Home screen.

HOME AS A LAUNCHER
Up to five pinned links, each one click from opening. No folders to expand, no
hover menus to navigate.

COMMAND PALETTE — Ctrl+K
One search box across your open tabs, your saved links and your browsing
history. Jump straight to a tab you already have open. Type "/" for commands:
/focus, /mode, /new, /notes, /stash, /wall, /import, /widgets, /settings.

SAVE ANY PAGE IN ONE CLICK
Click the toolbar button, press Alt+Shift+S, or right-click any page and choose
"Save to EshaalTab". It lands in your Inbox board.

SEARCH WITH ANY ENGINE
Google, DuckDuckGo, YouTube, Perplexity and Brave — plus ChatGPT, Claude and
Gemini, where your prompt is submitted for you so you do not have to click
twice.

QUICK ACCESS GRID
A drawer of shortcuts to the Google services most people keep open, so they are
one click away without cluttering your boards.

FOCUS TIMER
A flip-clock Pomodoro with presets and session tracking that survives a refresh.

NOTES & SNIPPETS
A scratchpad with word count and .txt export, and a clipboard vault for the
commands you keep re-typing.

MAKE IT YOURS
Colour palettes generated from a single accent, image and video wallpapers,
custom cursors, corner radius and font controls. Share a look as a preset code.

━━━ PRIVACY ━━━

EshaalTab has no account, no server of ours, and no analytics or telemetry. We
receive no data about you.

Out of the box the new tab page makes no network requests at all. Fonts are
bundled with the extension rather than loaded from Google Fonts, so opening a
tab does not announce itself to anyone.

Three optional features can reach the network, none of them on by default:
• Weather — sends the city you type, and the coordinates the service returns for
  it, to Open-Meteo. Nothing identifies you.
• Remote favicons — off by default, because turning it on reveals your saved
  domains to Google and DuckDuckGo. Left off, icons come from your browser's own
  local cache.
• A wallpaper or cursor set from a URL — downloaded once, with your permission
  for that one site, then stored on your device.

Your boards, notes, to-dos and wallpapers stay in local browser storage. Only
appearance settings sync between your own devices, through your own Chrome
account.

Open source under the MIT License. Read every line before you trust it:
https://github.com/EshaalB/EshaalTab
```

**Privacy policy URL**
```
https://github.com/EshaalB/EshaalTab/blob/main/PRIVACY.md
```
> Verified publicly reachable (31 July 2026). Re-check in a logged-out browser
> before each submission — if the repo ever goes private, this 404s and the
> submission is rejected.

**Support URL**
```
https://github.com/EshaalB/EshaalTab/issues
```

**Homepage URL**
```
https://github.com/EshaalB/EshaalTab
```

**Assets still required** (not in this repo — produce before submitting)
- Store icon: 128×128 PNG — `icons/icon128.png` ✅ already present
- Screenshots: at least one, up to five, at 1280×800. Recommended: Home with
  pins, Boards view, `Ctrl+K` palette, Settings/themes.
- Small promo tile 440×280 — strongly recommended; without it the item is
  ineligible for most store placement.
- Marquee 1400×560 — optional.

> Capture screenshots in a **fresh Chrome profile** with seeded demo links. The
> palette screenshot will otherwise expose your real tabs and history. Avoid
> screenshotting the Quick Access grid open — a wall of Google product logos is
> the frame most likely to raise a branding question.

---

## Privacy practices tab

**Single purpose description**
```
EshaalTab replaces Chrome's new tab page with a customisable start page for
organising, launching and searching the links the user saves.
```

**Permission justifications** — one per permission:

| Field | Justification |
|---|---|
| `storage` | Stores the user's own boards, saved links, notes, to-do items and appearance settings in the browser profile, so they are still there on the next new tab. Nothing is sent to us. |
| `unlimitedStorage` | Wallpaper images and videos the user uploads are stored on the device as encoded data and routinely exceed the default storage quota. Without it, setting a video wallpaper fails with a quota error. |
| `bookmarks` | Requested so the user can click "Import browser bookmarks" in Settings and confirm the dialog. The bookmark tree is read once to create matching boards. Bookmarks are never created, edited or deleted, and are never transmitted. |
| `tabs` | Required for three user-initiated actions: the Ctrl+K palette lists the titles and URLs of open tabs so the user can jump to one; "Stash all open tabs" saves the current window into a board; and the toolbar button and Alt+Shift+S read the current tab's title and URL to save it as a bookmark. Tab data is never stored unless the user saves it, and is never transmitted. |
| `favicon` | Renders the site icon next to each saved link using the browser's own local favicon cache, so that displaying a bookmark list does not send the user's saved domains to a third-party icon service. |
| `history` | Lets the Ctrl+K command palette include browsing-history entries alongside open tabs and saved links. Entries matching what the user typed are shown as results and then discarded; nothing is stored or transmitted. |
| `contextMenus` | Adds a single "Save to EshaalTab" item to the page and link right-click menus, so the user can save a page without opening the popup. |

**Host permission justification**
```
EshaalTab requests no host permissions at install. The optional https://*/*
entry is never requested wholesale. When the user pastes an image URL to set a
wallpaper or a custom mouse cursor, the extension asks for access to that one
origin only, downloads the image once, and stores it on the device — so the
image is not refetched from that host on every new tab. If the user declines,
the feature falls back to using the URL directly.
```

**Content script host access** (chatgpt.com, claude.ai, gemini.google.com)
```
When the user selects ChatGPT, Claude or Gemini as their search engine,
EshaalTab opens the site with the query as a URL parameter and fills in the
prompt box, saving a second click. The script exits immediately if no query
parameter is present, reads nothing else from the page, stores nothing, and
transmits nothing.
```

**Remote code** — select **"No, I am not using remote code"**
```
All JavaScript is included in the package. The content security policy is
"script-src 'self'; object-src 'self'; base-uri 'none'". There is no eval, no
new Function, no string-argument timers, and no script loaded from any URL.
Fonts are bundled in the package rather than loaded from Google Fonts.
```

**Data usage disclosures**

| Category | Collected? |
|---|---|
| Personally identifiable information | No — only an optional 24-character display name, stored locally and never transmitted |
| Health information | No |
| Financial and payment information | No |
| Authentication information | No |
| Personal communications | No |
| **Location** | **Yes** — see the explanation below |
| Web history | No — history is read into memory to render Ctrl+K results and discarded; never stored, never transmitted |
| User activity | No |
| Website content | No — the content script reads only its own query parameter |

**Location — data usage explanation**
```
The city the user types into the weather widget, and the latitude and longitude
Open-Meteo returns for that city, are sent to Open-Meteo's public API to fetch
the current forecast. The weather widget is off by default and does nothing
until the user enters a city. No account, identifier, device ID or IP-derived
location is attached. EshaalTab does not receive this data; it goes directly
from the user's browser to Open-Meteo.
```

**Required certifications** — all three apply and can be truthfully affirmed:
- Data is not sold to third parties
- Data is not used or transferred for purposes unrelated to the item's single purpose
- Data is not used or transferred to determine creditworthiness or for lending

---

## Distribution tab

| Field | Value | Why |
|---|---|---|
| Visibility | **Unlisted** for the first approved version, then switch to Public | Gets a real approval decision and an installable link without shipping to search results before the assets are settled. Switching to Public later does not require a fresh package review. |
| Regions | All regions | No geo-restricted functionality. Open-Meteo is globally available. |
| Pricing | Free | No payment code exists. |
| Staged rollout | Not applicable to the initial submission | Percentage rollouts apply only to updates of an already-published item. |

---

## Reviewer notes

Paste into the submission notes field — both of these otherwise draw questions:

```
Notes for review:

1. Content script on chatgpt.com, claude.ai and gemini.google.com
   (js/extension/ai-autosend.js, ~130 lines, unminified). When the user picks
   one of these as their search engine, EshaalTab opens the site with the query
   as a URL parameter, and this script fills the prompt box and clicks Send,
   saving one click. It exits immediately if no "q" or "prompt" parameter is
   present, reads nothing else from the page, stores nothing, and transmits
   nothing.

2. The "tabs" and "history" permissions serve one feature between them: the
   Ctrl+K command palette, which searches open tabs, saved links and history in
   a single list. "tabs" additionally supplies the current page's title and URL
   when the user saves it. Matching is done in the page; no result leaves the
   browser.

3. The only outbound network request the extension itself makes is to
   Open-Meteo, for the optional weather widget, which is off by default. It
   carries a city name and coordinates, and nothing else.

4. There is no build step. The uploaded package is the source, unminified.
```

---

## Pre-submission checklist

- [ ] Load unpacked and confirm a clean console on the new tab page, the popup,
      and the service worker (`chrome://extensions` → "service worker")
- [ ] Confirm the install dialog's permission warnings match expectations on a
      fresh profile
- [ ] `PRIVACY.md` reachable at the URL above in a logged-out browser
- [ ] Screenshots captured at 1280×800 in a clean profile, no private data
- [ ] `manifest.json` version bumped and matching the git tag
- [ ] `manifest.json` `description` matches the store Summary exactly
- [ ] Package contains no `.zip`, `.github/`, `.claude/`, `dev/` or
      `build-zip.bat` (the release workflow builds from an allow-list — verify
      in its "Show package contents" step)
