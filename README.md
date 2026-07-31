# EshaalTab : New Tab & Bookmark Boards

Replace the new tab page with boards you actually built: pin the links you use,
save any page in one click, and search every open tab, bookmark and history entry
with `Ctrl+K`.

Built to open instantly and stay out of the way. No account, no server, no
telemetry.

---

## Privacy

There is no account, no backend of ours, and no analytics. We receive no data
about you.

**Out of the box, the new tab page makes zero network requests.** Fonts are
bundled with the extension rather than pulled from Google Fonts, so opening a tab
does not tell anyone, us included, that you opened it.

Three optional features can reach the network, none of them on by default:

- **Weather** — sends the city you type, and the coordinates returned for it, to
  [Open-Meteo](https://open-meteo.com/). Nothing identifies you.
- **Remote favicons** — fetches icons from Google/DuckDuckGo, which reveals your
  bookmarked domains to them. Left off, icons come from your browser's own local
  cache via the `favicon` permission.
- **A wallpaper or cursor set from a URL** — EshaalTab asks for access to that
  one site, downloads the image once, and stores it locally, so it is not
  refetched on every new tab. Decline, and the URL is used directly, meaning the
  host sees your IP each time you open a tab. Video wallpapers always stay
  remote.

Everything else — boards, notes, to-dos, wallpapers — stays in
`chrome.storage.local` on your device. A settings-only subset (theme, colours,
layout) mirrors through `chrome.storage.sync` if you have Chrome sync on, so your
look follows you between your own devices. Bookmarks, notes and wallpapers never
sync.

Full detail: **[PRIVACY.md](PRIVACY.md)**

---

## Features

**Boards** — Organise links into drag-and-drop boards with custom colours and
layouts. Right-click any link to pin it to Home.

**Home as a launcher** — Up to 5 pinned links, one click each. No folders, no
hover menus.

**Command palette (`Ctrl+K`)** — Search open tabs, bookmarks and history in one
list, or type `/` for commands: `/focus`, `/mode`, `/new`, `/notes`, `/stash`,
`/wall`, `/import`, `/widgets`, `/settings`.

**One-click save** — Toolbar button, `Alt+Shift+S`, or right-click → "Save to
EshaalTab". Lands in your Inbox board.

**Multi-engine search** — Google, DuckDuckGo, YouTube, Perplexity, Brave
Research, plus ChatGPT, Claude and Gemini with automatic prompt submission.

**Pomodoro timer** — Flip-clock focus timer with presets and session tracking.
Survives a refresh.

**Notepad & snippets** — Scratchpad with word count and `.txt` export, plus a
clipboard vault for commands you keep re-typing.

**Themes & wallpapers** — HSL-derived palettes, image/video wallpapers, custom
cursors, corner-radius and font controls. Shareable preset codes.

---

## Install

### From the Chrome Web Store

[Install EshaalTab](https://chromewebstore.google.com/) — pending review.

### From source

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. **Load unpacked** → select the project folder.

Works on Chrome, Edge, Brave, Opera and Vivaldi (Chromium 104+, for the `favicon`
permission).

> **Firefox and Safari are not supported.** Firefox does not implement
> `chrome_url_overrides.newtab`, so the extension cannot function as a new tab
> page there.

---

## Permissions

Each one is requested for a single, specific feature:

| Permission | Used for |
|---|---|
| `storage`, `unlimitedStorage` | Saving your data locally; the quota lift is for wallpapers. |
| `bookmarks` | Reading your bookmark tree **only** during an explicit import. Never modified. |
| `tabs` | Listing open tabs for `Ctrl+K` and "Stash all tabs". |
| `history` | Searching history from the command palette. Matched locally. |
| `favicon` | Site icons from the browser's local cache, avoiding third-party requests. |
| `contextMenus` | The "Save to EshaalTab" right-click item. |
| `https://*/*` (optional) | Never requested wholesale. When you paste an image URL for a wallpaper or cursor, access to **that one origin** is requested so the image can be downloaded once and stored locally. |

---

## Development

No build step and no dependencies — it is plain HTML, CSS and JavaScript. Edit a
file, reload the extension.

```
js/core/      platform shim, storage, data managers
js/ui/        boards, widgets, search, settings
js/extension/ service worker, popup, AI content script
css/          tokens → layout → components → settings → overrides
fonts/        bundled Caveat (SIL OFL 1.1)
```

To preview outside the extension host, serve the folder and open `index.html`.
Extension APIs are absent there, so it falls back to `localStorage` — good enough
for UI work, but **always verify changes as a loaded unpacked extension** before
release, since `chrome.storage`, tab/bookmark/history search and the service
worker are only exercised there.

Build a release zip locally:

```bash
./build-zip.bat
```

This bumps the patch version in `manifest.json` and writes `EshaalTab-v<version>.zip`.

### Releasing

Tagging `v<version>` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml),
which verifies the tag matches `manifest.json`, packages an explicit allow-list of
files, and uploads to the Web Store. Run the workflow manually with
`publish: false` to upload a draft instead of shipping to users.

---

## Credits

[Caveat](https://fonts.google.com/specimen/Caveat) by Pablo Impallari, bundled
under the [SIL Open Font License 1.1](https://openfontlicense.org/).
Weather by [Open-Meteo](https://open-meteo.com/).

## License

[MIT](LICENSE).
