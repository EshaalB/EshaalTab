# Chrome Web Store submission

Copy-paste source for the Developer Dashboard fields. Keep this in sync with
`manifest.json` and `PRIVACY.md` — reviewers compare them.

---

## Store listing tab

**Name** (45 char max)
```
EshaalTab — New Tab & Bookmark Boards
```

**Summary** (132 char max — must match `manifest.json` `description` exactly)
```
A new tab built around your own boards: pin the links you use, save any page in one click, search everything with Ctrl+K.
```

**Category:** Workflow & Planning
**Language:** English

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
One search box across your open tabs, your bookmarks and your history. Jump
straight to a tab you already have open. Type "/" for commands: /focus, /mode,
/new, /notes, /stash, /wall, /settings.

SAVE ANY PAGE IN ONE CLICK
Click the toolbar button, press Alt+Shift+S, or right-click any page and choose
"Save to EshaalTab". It lands in your Inbox board.

SEARCH WITH ANY ENGINE
Google, DuckDuckGo, YouTube, Perplexity and Brave Research — plus ChatGPT,
Claude and Gemini, where your prompt is submitted automatically so you do not
have to click twice.

FOCUS TIMER
A flip-clock Pomodoro with presets and session tracking that survives a refresh.

NOTES & SNIPPETS
A scratchpad with word count and .txt export, and a clipboard vault for the
commands you keep re-typing.

MAKE IT YOURS
Colour palettes generated from a single accent, image and video wallpapers,
custom cursors, corner radius and font controls. Share a look as a preset code.

━━━ PRIVACY ━━━

EshaalTab collects nothing. No account, no server, no analytics, no telemetry.

Out of the box the new tab page makes ZERO network requests. Fonts are bundled
with the extension rather than loaded from Google Fonts, so opening a tab does
not announce itself to anyone.

Three features can reach the network, none of them on by default:
• Weather — sends only the city name you type, to Open-Meteo.
• Remote favicons — off by default, because turning it on would reveal your
  bookmarked domains to a third party. Left off, icons come from your browser's
  own local cache.
• A wallpaper set from a URL — your browser refetches that link on every new tab,
  so the image host sees your IP. Upload the file instead to keep it fully local.

Your boards, notes, to-dos and wallpapers stay in local browser storage. Only
appearance settings sync between your own devices, through your own Chrome
account.

Open source under the MIT License. Read every line before you trust it:
https://github.com/eshaalrehamat/eshaaltab
```

**Privacy policy URL**
```
https://github.com/eshaalrehamat/eshaaltab/blob/main/PRIVACY.md
```
> Must be publicly reachable before submitting. A GitHub blob URL is accepted.

**Assets still required** (not in this repo — produce before submitting)
- Icon: 128×128 PNG — `icons/icon128.png` ✅ already present
- Screenshots: at least one at 1280×800 or 640×400. Recommended: Home with pins,
  Boards view, `Ctrl+K` palette, Settings/themes, Pomodoro.
- Optional: 440×280 small promo tile.

---

## Privacy practices tab

**Single purpose description**
```
EshaalTab replaces the browser's new tab page with a customisable start page for
organising and launching bookmarks.
```

**Permission justifications** — one per permission, required verbatim in the form:

| Field | Justification |
|---|---|
| `storage` | Stores the user's boards, bookmarks, notes, to-dos and appearance settings locally in the browser profile. |
| `unlimitedStorage` | Wallpaper images and videos the user uploads exceed the default 5 MB storage quota. |
| `bookmarks` | Lets the user import their existing browser bookmarks into boards, on explicit action from the Settings screen. Bookmarks are read only, never modified. |
| `tabs` | Lists the user's open tabs so the Ctrl+K command palette can search and switch to them, and so the "stash all tabs" feature can save the current window into a board. |
| `activeTab` | Reads the title and URL of the current page when the user clicks the toolbar button or presses the save shortcut, in order to bookmark it. |
| `history` | Lets the Ctrl+K command palette search the user's browsing history. Matching happens locally; no history data is stored or transmitted. |
| `favicon` | Displays site icons for saved bookmarks using the browser's local favicon cache, avoiding third-party icon requests. |
| `contextMenus` | Adds a "Save to EshaalTab" item to the page right-click menu. |
| Host permission `https://*/*` | Optional and not granted by default. Requested only if the user explicitly enables remote favicon fetching in Settings. |
| Remote code | No. All JavaScript is bundled in the package. The CSP is `script-src 'self'`; no code is fetched or evaluated at runtime. |

**Data usage disclosures** — tick nothing except as noted:

| Category | Collected? |
|---|---|
| Personally identifiable information | No |
| Health information | No |
| Financial and payment information | No |
| Authentication information | No |
| Personal communications | No |
| Location | No — the weather city is typed by the user, stored locally, and never associated with an identity |
| Web history | No — history is read locally to render search results and is never stored or transmitted |
| User activity | No |
| Website content | No |

**Required certifications** — all three apply and can be affirmed:
- Data is not sold to third parties
- Data is not used or transferred for purposes unrelated to the item's single purpose
- Data is not used or transferred to determine creditworthiness or for lending

---

## Reviewer notes

Worth pre-empting in the submission notes, since both draw questions:

> **Content scripts on chatgpt.com, claude.ai and gemini.google.com.**
> When the user picks one of these as their search engine, the extension opens
> the site with the query in the URL and `js/extension/ai-autosend.js` fills the
> prompt box and submits it, saving a second click. The script activates only
> when a query parameter is present, reads nothing else from the page, and
> transmits nothing. Source: `js/extension/ai-autosend.js` (~130 lines).

> **`history` and `tabs` permissions.**
> Both serve one feature: the Ctrl+K command palette, which searches open tabs,
> saved bookmarks and history in a single list. Matching is done in-page; no
> results leave the browser.

---

## Pre-submission checklist

- [ ] Load unpacked and confirm a clean console on the new tab page, the popup,
      and the service worker (`chrome://extensions` → "service worker")
- [ ] `PRIVACY.md` pushed and publicly reachable at the URL above
- [ ] Screenshots captured at 1280×800
- [ ] `manifest.json` version bumped and matching the git tag
- [ ] `manifest.json` `description` matches the store Summary exactly
- [ ] Package contains no `.zip`, `.github/`, `.claude/` or `build-zip.bat`
      (the release workflow builds from an allow-list — verify in its
      "Show package contents" step)
