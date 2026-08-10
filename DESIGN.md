---
name: EshaalTab
description: An all-in-one utility new tab — boards, notes, todo, pomodoro, clipboard, and unified search behind one user-personalized surface.
colors:
  accent:
    canonical: "var(--accent-color)"
  accent-contrast:
    canonical: "var(--accent-contrast)"
  surface-base-dark:
    canonical: "#0d1117"
  surface-base-light:
    canonical: "#f4f6f8"
  text-dark:
    canonical: "rgba(255,255,255,0.95)"
  text-light:
    canonical: "rgba(0,0,0,0.88)"
  text-dim-dark:
    canonical: "rgba(255,255,255,0.65)"
  text-dim-light:
    canonical: "rgba(0,0,0,0.5)"
  border-soft-dark:
    canonical: "rgba(255,255,255,0.12)"
  border-soft-light:
    canonical: "rgba(0,0,0,0.12)"
  danger:
    canonical: "#ef4444"
  success:
    canonical: "#22c55e"
  warning:
    canonical: "#f59e0b"
  scrollbar-thumb:
    canonical: "rgba(150,150,150,0.3)"
typography:
  display:
    fontFamily: "Orbitron, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "clamp(44px, 5.4vw, 76px)"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "inherit"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.1
  accent:
    fontFamily: "Caveat, cursive"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.1
rounded:
  sm: "8px"
  md: "14px"
  lg: "20px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-contrast}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  search-pill:
    backgroundColor: "var(--surface-2)"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "44px"
  board-card:
    backgroundColor: "var(--surface-card)"
    rounded: "{rounded.md}"
---

# Design System: EshaalTab

## Overview

**Creative North Star: "The Personal Instrument Panel"**

EshaalTab's chassis is deliberately neutral so the user's own choices are what
gives each installation its character. The structure — glass panels, layered
elevation, one accent color, a pill-shaped search bar — stays constant across
every install; what changes per user is the wallpaper, the accent color, and
the clock typeface. The system's job is to stay legible and out of the way no
matter what the user paints onto it, the way an instrument panel's layout
doesn't change even though the view out the window does.

This is a power-user utility, not a mood board: density and information
access (Ctrl+K search, board cards, popovers) take priority over decorative
flourish. Depth and glass exist to encode real hierarchy — what's foreground
vs. background — not just to look rich.

**Key Characteristics:**
- One user-customizable accent color, used sparingly, never as wallpaper
- Structural elevation: shadow weight tracks real stacking order (search pill → board cards → popovers/modals → command palette)
- Glass/blur panels over a solid or wallpaper background, never over another glass panel
- Two built-in themes (dark default, light) sharing one token set, not two hand-tuned designs
- No motion or color for its own sake; every visual cue answers "what is this, and is it above or below the current layer"

## Colors

The palette is intentionally near-monochrome at rest: one neutral surface family (dark or light) plus a single user-chosen accent. There is no secondary or tertiary brand color — the accent is the only color decision an install makes.

### Primary
- **Accent** (`var(--accent-color)`, default `#ffffff` on dark): The one color signal in the UI. Used for focus rings, the search pill's hover/focus border, primary button fill, active states, and panel tints (`--panel`, `--panel-border` are `color-mix()` blends of the accent into the surface). Fully user-customizable via a color picker or preset; the design must hold up at any hue the user picks, not just the default.
- **Accent Contrast** (`var(--accent-contrast)`, default `#14151a`): Text/icon color placed on top of accent fills. Computed opposite the accent so buttons stay legible regardless of the chosen accent's lightness.

### Neutral — Dark (default theme)
- **Void** (`#0d1117`, `--page-bg` / `--surface-base`): The base canvas.
- **Primary Text** (`rgba(255,255,255,0.95)`, `--text`)
- **Dim Text** (`rgba(255,255,255,0.65)`, `--text-dim`): Secondary labels, meta text, placeholders.
- **Faint Text** (`rgba(255,255,255,0.35)`, `--text-faint`): Tertiary/disabled.
- **Soft Border** (`rgba(255,255,255,0.12)`, `--border-soft`)

### Neutral — Light theme
- **Paper** (`#f4f6f8`, `--page-bg` in `body.theme-light`)
- **Primary Text** (`rgba(0,0,0,0.88)`, `--text`)
- **Dim Text** (`rgba(0,0,0,0.5)`, `--text-dim`)
- **Soft Border** (`rgba(0,0,0,0.12)`, `--border-soft`)

### Utility
- **Scrollbar Thumb** (`rgba(150,150,150,0.3)`, `0.5` on hover): theme-neutral gray, deliberately outside the accent/text token families since a scrollbar must stay visible and unobtrusive regardless of the active theme or accent color.

### Status
- **Danger** (`#ef4444` / text `#f87171` on dark): destructive actions, delete confirmations.
- **Success** (`#22c55e` / text `#4ade80`): save confirmations, completed states.
- **Warning** (`#f59e0b` / text `#fbbf24`): non-blocking cautions (e.g. duplicate-save notices).

### Named Rules
**The One Signal Rule.** The accent color appears on focus states, hover borders, primary actions, and active toggles — never as a page background, a card fill, or body text. If a screen has more than one or two accent-colored elements visible at once, something has drifted from the system.

## Typography

**Body Font:** Inter (with `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` fallback)
**Display/Clock Font:** Orbitron (700/800) by default, user-selectable among a small set of clock-only font stacks — this is the one typographic choice exposed to the user, and it stays scoped to the clock.
**Accent/Handwritten Font:** Caveat (700) — reserved for decorative, non-critical text only (e.g. greeting flourishes), never body copy.

**Character:** Inter carries all functional UI text — dense, neutral, highly legible at small sizes. Orbitron exists only for the clock, where its geometric, slightly technical character reinforces the "instrument panel" idea without leaking into the rest of the interface.

### Hierarchy
- **Display** (700, `clamp(44px, 5.4vw, 76px)`, 1.2 line-height): The new-tab clock only.
- **Title/XL** (700, 28px `--fs-xl`): Section headers, modal titles.
- **Large** (600, 20px `--fs-lg`): Board card titles, prominent headings.
- **Body** (400, 15px `--fs-base`): Default UI text, search input.
- **Small** (400–500, 14px `--fs-sm`): Secondary body text, buttons.
- **Label** (500, 12px `--fs-xs`): Meta text, timestamps, field labels — the floor of the new-tab page's scale.
- **Micro** (400–600, 10–11px): Secondary hint text inside compact popovers and the toolbar popup only (e.g. the "hover to star" hint, todo time-tags, clipboard snippet titles, the toolbar popup's whole type scale). Never used for primary content or on the main new-tab page — this is a deliberately smaller register for the popup's fixed 320px shell and dense inline hints elsewhere.

### Named Rules
**Typography controls.** Clock typography uses `--clock-font`, while the
optional app-font setting changes the broader interface through `--font-app`.
Both retain system fallbacks so controls remain legible.

## Layout

Single-page app shell: a fixed top bar (`et-topbar`, icon-only action buttons), a centered search pill, a horizontally-scrolling board-card row, and slide-in side sheets (settings, notes, todo) that overlay rather than push content. No traditional grid/container breakpoints for marketing-style content — layout instead scales via `--ui-scale` (1 → 1.8 across four `min-width` steps from 1800px to 3400px), multiplying spacing and font-size tokens together so dense information stays proportionally sized on very large displays rather than just stretching.

Popup surfaces (the toolbar action popup) are a fixed 320px width, a separate, simpler layout register from the full new-tab page — compact single-column stacks, no side sheets or multi-panel layout.

Spacing rhythm follows an 4/8/12/16/20/24/32/48/64px scale (`--sp-1` … `--sp-16`); UI chrome (buttons, pills, tight lists) sits in the 4–16px range, and section-level gaps use 20px+.

## Elevation & Depth

Structural, not decorative: elevation encodes real z-stacking. Floating
new-tab surfaces may use the elevation tokens, while Settings uses flat solid
colours, borders and explicit stacking without decorative shadows. Blur is
reserved for surfaces that genuinely float over the wallpaper/page background.

### Shadow Vocabulary
- **e1** (`0 2px 8px rgba(0,0,0,0.18)` dark / `rgba(0,0,0,0.06)` light): Resting board cards, small popovers.
- **e2** (`0 4px 16px rgba(0,0,0,0.28)` / `0.10` light): Hovered cards, dropdowns.
- **e3** (`0 8px 24px rgba(0,0,0,0.38)` / `0.14` light): Modals, command palette.
- **e4** (`0 16px 42px rgba(0,0,0,0.52)` / `0.20` light): The highest layer — full-screen overlays.
- **e-sheet** (`-8px 0 32px rgba(0,0,0,0.45)`): Side sheets sliding in from the edge; directional, not radial, because the sheet enters from off-screen.
- **wp-shadow** (`text-shadow`, opacity/blur user-configurable via `--wp-shadow-opacity`/`--wp-shadow-blur`): Legibility shadow for text sitting directly on a photo/video wallpaper — functional (keeps text readable over unpredictable imagery), not aesthetic, and only active in wallpaper mode.

### Named Rules
**The Stack-Tells-The-Truth Rule.** A component's shadow step must match its actual DOM/interaction layer — don't reach for `--e4` on a resting card just to make it "pop"; that breaks the elevation cue everywhere else in the app relies on to read hierarchy at a glance.

## Shapes

Three-step radius scale, no sharp corners anywhere: `--r-sm` (8px, inputs, buttons, small chips), `--r-md` (14px, board cards, larger panels), `--r-lg` (20px, modals/large surfaces), `--r-pill` (999px, the search bar, pomodoro presets, tag chips). Borders are hairline (`--hair`, 1px) and low-contrast at rest (`--border-soft`), strengthening only on hover/focus/accent states (`--border-strong`, or the accent color itself).

The toolbar popup (`popup.html`) is its own fixed-size shell, not a new-tab surface, and carries one documented exception: its outer window corner is 12px, between `--r-sm` and `--r-md`, sized specifically for the browser's fixed 320px action-popup frame rather than any in-page component. Elements inside the popup otherwise follow the same `--r-sm`/`calc(radius - 2px)` pattern as the rest of the system.

## Components

### Buttons
- **Shape:** `--r-sm` (8px) as the default; pill (`--r-pill`) for compact icon/preset buttons like pomodoro duration presets.
- **Primary:** Accent-fill background, accent-contrast text, no gradient, no colored glow shadow — a neutral elevation shadow only (`0 2px 6px rgba(0,0,0,0.3)`), since a colored/tinted shadow reads as generic AI-UI polish rather than this system's restrained language.
- **Hover/Focus:** Subtle brightness/filter shift on hover; `focus-visible` always gets a 2px accent-colored outline with 2px offset — this is the one hard accessibility invariant already in the base stylesheet (`*:focus-visible`).
- **Secondary/Ghost:** Transparent background, soft border, dim text; border and text both promote to full-strength on hover.

### Search Pill
- **Style:** Pill radius, glass background (`--surface-2` + `--glass-lg` blur/saturate), hairline soft border.
- **State:** Border promotes to the accent color on hover or focus-within — the search bar is the one element expected to draw the eye first on a new tab, so it's the primary place the user's accent color does structural work.

### Board Cards
- **Corner Style:** `--r-md` (14px).
- **Background:** `--surface-card`, a low-opacity tint of the board's own color (`--board-rgb`/`--board-opacity`), so each board can read as a distinct "place" without needing a second brand color.
- **Shadow Strategy:** `e1` at rest, promotes on hover — see Elevation.
- **Border:** Soft at rest, defined by the board's own tint rather than the global accent.

### Inputs / Fields
- **Style:** `--field` background (subtle white/black tint), `--field-line` border, `calc(var(--radius) - 2px)` corner (slightly tighter than buttons so nested fields read as content, not chrome).
- **Focus:** 2px accent-colored outline (`focus-visible`), consistent with buttons — one focus treatment system-wide, never a glow or scale change.
- **Placeholder:** Always uses `--text-dim` at full opacity rather than a hardcoded low-opacity white — this was a real bug (placeholders vanishing in light mode) that the token system now prevents structurally.

### Side Sheets (Settings / Notes / Todo)
- **Style:** Slide in from the right edge, `--e-sheet` directional shadow, full-height, glass or solid fill depending on `solid-mode`.
- **Behavior:** Overlay the page rather than reflowing it — the new-tab layout underneath never shifts when a sheet opens.

## Do's and Don'ts

### Do:
- **Do** let the user's accent color and wallpaper be the only strongly personalized visual choices; keep every other token (spacing, radius, elevation, type scale) fixed across installs.
- **Do** match shadow step to real stacking order (see The Stack-Tells-The-Truth Rule).
- **Do** keep the clock as the sole surface where font-family is user-selectable.
- **Do** use neutral, non-tinted elevation shadows on interactive elements (buttons, cards) — depth communicates layer, not brand.
- **Do** gate wallpaper-legibility text-shadow (`--wp-shadow-*`) to wallpaper mode only; it must stay off in solid-color mode.

### Don't:
- **Don't** introduce a second brand/accent color — one accent, user-chosen, is the whole rule.
- **Don't** use a colored/glowing shadow on any button or card; that reads as generic AI-generated UI, not this system's restrained instrument-panel language.
- **Don't** let more than 2–3 distinct font sizes cluster within a few pixels of each other on one surface (a real, previously-flagged defect) — pick fewer steps with real contrast (≥1.25× ratio) instead.
- **Don't** stack glass-blur panels on top of other glass-blur panels; blur is reserved for the outermost floating layer over the page background.
- **Don't** ship an `<img>` with an empty `src` — hide it until JS supplies a real source, or omit the tag.
