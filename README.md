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

**Nothing is ever sent to us.** Fonts are bundled with the extension rather than
pulled from Google Fonts. The one thing a fresh new tab fetches is the icons for
your pinned links: Chrome serves those from its own local icon cache, while
Firefox, which has no such cache, asks DuckDuckGo or Google. Turn off remote
favicons (below) and a new tab makes no network requests at all.

Network features:

- **Weather** (off until you set a city) - sends the city you type, and the
  coordinates returned for it, to [Open-Meteo](https://open-meteo.com/).
  EshaalTab adds no account or advertising identifier; Open-Meteo receives normal
  connection information for the request.
- **Remote favicons** (on by default) — fetches link and search-engine icons from
  Google/DuckDuckGo, which reveals those domains to them. Turn off "Load icons
  from the web" under Settings → Privacy and icons come from your browser's own
  local cache via the `favicon` permission instead.
- **A wallpaper set from a URL** - contacts the address you provide and stores
  the image locally when possible. The host can see the request. Remote videos
  and images that cannot be stored may be requested again on later new tabs.

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

**Home as a launcher** — Up to 5 pinned links, one click each, under the search
bar or down either side. Pin whole boards too: they open
from a board button at the end of your pinned links. Fresh installs start with an AI Tools board -
ChatGPT, Claude, Gemini, Perplexity, Grok, DeepSeek and more.

**Command palette (`Ctrl+K`)** — Search open tabs, bookmarks and history in one
list. Type `@` to search your boards, or `/` for commands: `/focus`, `/mode`,
`/new`, `/notes`, `/stash`, `/snapshot`, `/tasks`, `/pinned`, `/engines`, `/wall`, `/import`,
`/widgets`, `/settings`.

**One-click save** — Toolbar button, `Alt+Shift+S`, or right-click → "Save to
EshaalTab". Lands in your Inbox board.

**Multi-engine search** — your browser's own engine by default, or one search
at a time in Google, DuckDuckGo, Yandex, Yahoo, ChatGPT, Claude, Gemini,
Perplexity, Brave Research, YouTube, Reddit, Pinterest or
Quora. Pick which ones the menu offers under Settings → Search engines.

**Pomodoro timer** — Dark flip-clock focus timer with presets, an iPhone-style
duration wheel, hour/minute or minute/second entry, and session tracking.
Survives a refresh.

**Notepad & snippets** — Scratchpad with word count and `.txt` export, plus a
clipboard vault for commands you keep re-typing.

**Quick Settings & Customize** — Common Home visibility, preset, colour and
wallpaper actions are separated from detailed wallpaper, typography, clock,
search and weather controls. Includes saved wallpapers, shareable theme codes
and an optional performance mode.

---

## Install

### From the Chrome Web Store

[Install EshaalTab](https://chromewebstore.google.com/) — pending review.

### From source

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. **Load unpacked** → select the project folder.

The Chrome package works on current Chromium browsers. A separate Firefox
package uses Firefox's background-script format and supports Firefox 142+.
Safari has not been tested or packaged.

---

## Permissions

Each one is requested for a single, specific feature:

| Permission | Used for |
|---|---|
| `storage`, `unlimitedStorage` | Saving your data locally; the quota lift is for wallpapers. |
| `activeTab` | Reading the current page after the user opens the save popup. |
| `bookmarks` (optional) | Reading your bookmark tree **only** during an explicit import. Never modified. |
| `tabs` (optional) | Listing open tabs for `Ctrl+K` and "Stash all tabs". |
| `history` (optional) | Searching history from the command palette. Matched locally. |
| `favicon` | Site icons from the browser's local cache, avoiding third-party requests. |
| `contextMenus` | The "Save to EshaalTab" right-click item. |
| `search` | Sending searches to the provider you have already chosen in your browser, rather than picking one for you. |

---

## Development

No build step and no dependencies — it is plain HTML, CSS and JavaScript. Edit a
file, reload the extension.

```
js/core/      platform shim, storage, data managers
js/ui/        boards, widgets, search, settings
js/extension/ service worker, popup
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

This bumps the patch version in `manifest.json` and writes the Chrome package to
`release-zips/EshaalTab-v<version>.zip`. Run `build-firefox-zip.bat` for the
matching Firefox package.

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
