# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Power browser users who run many tabs and bookmarks and want a fast, organized
home base for daily browsing — not casual users who just want a prettier new
tab. They open a new tab dozens of times a day and expect it to double as
their control center: jump to a saved link, search everything (open tabs,
history, bookmarks, notes, todos) with Ctrl+K, save the current page in one
click, or stash an entire window of tabs to clear clutter without losing them.

## Product Purpose

EshaalTab replaces the browser's default new-tab page with a personal
workspace built around user-defined "boards" of saved links, plus a cluster of
lightweight daily-use utilities (notes, clipboard snippets, to-do list,
Pomodoro timer, unified Ctrl+K search) and new-tab personalization
(wallpapers, accent colors, clock). Success is a user who no longer needs
separate extensions for bookmarking, quick notes, or a timer, because all of
it lives on the page they already see dozens of times a day.

## Positioning

An all-in-one utility new tab, not a theme extension with bookmarks bolted
on. Competing products (Toby, Momentum, etc.) each own one slice — link
organization, a nice wallpaper, or a daily quote — and expect the user to run
several extensions in parallel. EshaalTab's mechanism a neighbor can't
truthfully copy without becoming EshaalTab: boards + notes + todo + pomodoro +
clipboard + unified search + theming, all in one page, all local-only, with
zero added performance cost or account requirement. "Zero bloat" is a real
constraint, not just marketing — new utility features are only added when
they don't cost the extension performance or complexity (this shaped the
recent feature-selection process directly).

## Operating Context

- Runs as a Chrome/Firefox extension, overriding the new-tab page
  (`chrome_url_overrides.newtab`) and providing a toolbar popup
  (`action.default_popup`) for one-click save/stash of the current tab or
  window.
- The Ctrl+K command palette is the unified entry point across open tabs,
  browsing history, saved boards/links, notes, and todos.
- A background service worker handles background actions; no content scripts
  or host permissions are required for extension features.
- Distributed through the Chrome Web Store and Firefox AMO — both stores'
  review policies (Single Purpose, narrow permissions, accurate listing text)
  are a standing operating constraint on this project, not a one-time
  checklist.

## Capabilities and Constraints

- Boards: user-defined collections of saved links with tags; one-click save
  from the toolbar popup or a right-click context menu item.
- Tab stashing: save every open tab in the current window into a persistent,
  timestamped list inside the popup (not into boards), restorable or
  deletable individually, kept until the user deletes it.
- Utilities: notes (with undo-restore via up-arrow), clipboard snippets,
  to-do list, Pomodoro timer — all local-only.
- Personalization: quick Home visibility and theme choices, plus detailed
  image/video/URL wallpaper controls, saved wallpapers, accent presets, custom
  colors, interface and clock fonts, and configurable text-shadow color and
  opacity for wallpaper legibility.
- Performance mode: a saved reduction in motion, shadows and decorative
  processing for lower-powered devices.
- Search: Ctrl+K palette defers to the browser's actual configured default
  search engine (`chrome.search.query()` / `browser.search.search()`) rather
  than hardcoding a provider — required for Chrome Web Store Single Purpose
  compliance.
- No accounts, no login, no cloud sync, no server operated by the developer,
  no analytics, no telemetry, no ads. All data lives in
  `chrome.storage.local` on the user's device. This is a durable constraint:
  future work must never imply or add cloud accounts.
- Must stay functionally compatible across Chrome and Firefox (dual
  `background.service_worker`/`background.scripts` manifest fields exist
  specifically for Firefox AMO compatibility).

## Brand Commitments

- Name: "EshaalTab — New Tab & Bookmark Boards".
- Voice in store-facing copy: direct, specific, no inflated claims — written
  defensively after a real Chrome Web Store Single Purpose rejection, so
  listing text is held to a higher accuracy bar than typical marketing copy.

## Evidence on Hand

- Live, shipping product with real users (published on the Chrome Web Store;
  Firefox AMO submission in progress). Version history and manifest in this
  repo are the source of truth for current functionality — no fabricated
  testimonials, usage numbers, or press exist and none should be invented.
- `STORE_LISTING.md` documents the current store listing text and permission
  justifications; `PRIVACY.md` documents the actual data-handling behavior.

## Product Principles

1. Zero added complexity or performance cost per feature — every new utility
   must justify its cost against the "does this bloat the page" bar.
2. Local-first, always — no feature may require an account, login, or
   developer-operated backend.
3. Listing and in-product text must be literally true against the current
   code, not aspirational — this project has been burned by drift between
   claims and implementation before.
4. One page replaces several extensions — the new tab is the product; the
   popup is a fast secondary surface, not a separate app.

## Accessibility & Inclusion

No formal accessibility standard has been confirmed as a requirement, but the
codebase already carries `prefers-reduced-motion` handling and focus-visible
states — treat these as an existing floor to preserve, not a target to hit.
