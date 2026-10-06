# Portfolio OS — Build Plan

Turn the portfolio into a **desktop operating system in the browser**, modelled on
how posthog.com works: every project is an **app** with an icon on the desktop, it
opens in a draggable window, and it runs as a **fully working demo**. When nobody is
touching the page, an **autopilot cursor** drives the OS: it moves to an icon,
double-clicks it, plays with the app for a while, closes it, and moves on to the
next one. The moment the visitor moves the mouse, clicks, scrolls or types, the
autopilot hands over control.

On phones the same apps live on a **phone home screen** and open full-screen like
native mobile apps, with an autopilot finger that taps through them.

Work through this file in chunks: each phase ends in something that builds, runs
and can be merged on its own. Tick boxes as they land.

### Progress

| Chunk | State | Notes |
| ----- | ----- | ----- |
| 1 · Foundation | ✅ done | Plus early slices of chunks 2, 3 and 9 (a working desktop, windows and phone home screen), so the first app can be used. |
| First app · TrypNow | ✅ done | Full app: supplier + agent sides, dashboard, package builder, AI listing, bookings, marketplace. |
| 2 · Desktop shell | ✅ done | Plus, pulled forward: the Settings app (Phase 8), ⌘K search (Phase 10) and OS toasts. |
| 3 – 11 | ⏳ next | Items below marked _partly done_ have a basic version in place. |

---

## 0. Decisions to confirm before Phase 1

These are my defaults. Change any of them before we start and the plan adjusts.

- [x] **Look and feel.** A PostHog-*style* OS (warm wallpaper, top menu bar, icon
      columns on both edges, light windows with minimal chrome, light/dark modes),
      drawn with **our own** icons, wallpapers and copy. We do not copy PostHog's
      logo, hedgehogs, illustrations or icon set — that is their brand, and the
      portfolio should read as yours.
- [x] **The pixel journey stays** as an app (`Journey.exe`) instead of being the home
      page. It is the most personal thing on the site, so it gets a prominent icon.
- [ ] **`/resume` stays** a clean printable page *and* opens as a `Resume.pdf` window.
      _(The page stays; for now the Résumé icon opens it. The window comes in Phase 8.)_
- [x] **Stack stays** React 19 + Vite + Tailwind v4 + Motion. Add **Zustand** for the
      window store (see §1.3 for why). No Gatsby/Next migration.
- [x] **Every app has its own URL** (`/apps/trypnow` …) so a project link can be
      shared, and opening that URL boots the OS with that window already open.
- [x] **Breakpoint:** `< 768px` → phone OS, `≥ 768px` → desktop OS (same as PostHog).
      Tablets in landscape get the desktop.

---

## 1. Research: how posthog.com works

posthog.com is blocked from this build sandbox. This section comes from reading the
open-source code of PostHog's website (`github.com/PostHog/posthog.com`, a Gatsby 4 +
React 18 + Tailwind 3 + framer-motion site), cloned on 2026-10-06.

### 1.1 Layout — `components/Wrapper`

```
<AppContainer class="h-dvh flex flex-col p-2">
  <TaskBarMenu/>                        ← top menu bar (logo menu, nav menus, right-side tray)
  <div data-app="DesktopViewport" ref={constraintsRef}   ← drag bounds for every window
       class="flex-grow relative overflow-clip">
    <Desktop/>                          ← wallpaper + icon columns + context menu + screensaver
    <WindowList/>                       ← windows.map(w => <AppWindow item={w}/>)
  </div>
  <SearchOverlay/> <ChatOverlay/> <Toasts/>
</AppContainer>
```

- `WindowList` is memoised and is the **only** component subscribed to the windows
  array, so opening or dragging a window does not re-render the desktop or taskbar.
- Each page of the site is rendered *inside* a window. Navigating to a URL opens
  (or focuses) the window for that path; closing the focused window navigates to
  the next window underneath, or to `/`.

### 1.2 The window model — `context/Window.tsx`

Every open window is a plain object in one array:

```ts
{
  key, path, element, meta: { title },
  zIndex,                       // focus order; focused window = highest zIndex
  position, size,               // current geometry, px relative to the desktop
  previousPosition, previousSize, // restored after maximise / snap
  sizeConstraints: { min, max },
  minimized, expanded,          // expanded = maximised
  snapped: 'left' | 'right' | false,
  fixedSize,                    // dialogs that can't be resized
  fromOrigin,                   // icon position, so the window can "pop" out of it
  appSettings                   // per-route defaults (below)
}
```

Per-route defaults live in an `appSettings` registry keyed by path:
`size.min/max`, `fixed`, `autoHeight`, `position.center | topCenter |
getPositionDefaults(size, windows)`, `modal: standard | side | floating`,
`closeOnEscape`, `toolbar`. Defaults with no entry fall back to 20%–90% of the
viewport.

### 1.3 Window manager behaviour — `context/App.tsx` + `components/AppWindow`

- **Focus / z-order** — `bringToFront(item)` sets the item to `windows.length` and
  shifts every window above it down by one, so z-indexes stay dense (1…n).
- **Drag** — framer-motion `drag` with `dragControls` (only the title bar starts a
  drag), `dragConstraints={constraintsRef}`. Position is committed on drag end.
  Dragging a maximised window first "un-maximises" it to its measured rect.
- **Snap** — while dragging, if the window's x goes past the left/right edge by
  50px (`snapThreshold = -50`) a translucent blue half-screen **snap indicator**
  appears; dropping there snaps the window to that half. Shift+← / Shift+→ do
  the same from the keyboard.
- **Resize** — drag handles on the edges; left-edge resizing also moves `x`.
  Width/height clamp to `sizeConstraints.min`.
- **Maximise** — `expandWindow` saves `previousSize/Position`, fills the desktop.
  Double-clicking the title bar toggles max size. Expanding a snapped window drops
  its snapped sibling.
- **Minimise** — the window animates towards the taskbar's "active windows" button
  and gets `minimized: true`; clicking it in the windows list restores it.
- **Open / close animations** — CSS keyframes `window-pop-in` / `window-pop-out`
  (and `slide-down/up` for fixed dialogs). The close animation's `animationend`
  removes the window from state, so nothing pops out abruptly.
- **Viewport resize** — windows that end up off-screen are clamped back inside.
- **Occlusion** — a window more than 80% covered by windows above it is marked
  not-in-view, so heavy content can pause.
- **Performance** — while dragging/animating, the window gets a compositor layer
  class; if an open animation takes over 700ms the site records it and can offer
  to turn animations off ("performance boost" setting).
- **Keyboard shortcuts** (global `keydown`): `Shift+W` close, `Shift+↑` maximise,
  `Shift+↓` restore, `Shift+←/→` snap, `Shift+X` close all, `m` toggle theme,
  `\` cycle wallpaper, `,` display options, `/` or `⌘K` search.

### 1.4 Desktop — `components/Desktop`

- Two icon **columns**, primary links on the left, "apps" on the right
  (About, Changelog, Handbook, Store, Careers, **Trash**). Columns wrap into extra
  columns on short screens (`flex-col flex-wrap`; the right side uses
  `wrap-reverse` so it stays pinned to the edge).
- **Rubber-band selection box** on empty desktop: pointer-down on the background,
  a decorative box follows the pointer by writing styles directly (no React
  re-render per move).
- **Right-click context menu** on the desktop (About, Display options).
- **Wallpapers** (several themed scenes, light and dark variants) — icon hover
  glow colour follows the wallpaper.
- **Screensaver** after inactivity (`useInactivityDetection`, different timeouts
  for focused and unfocused tab), dismissible, with a toast offering to disable it.
- **Desktop badges** — notification counts on icons.
- **Confetti** and other easter eggs; a playable "hedgehog mode".

### 1.5 Top menu bar — `components/TaskBarMenu`

- Left: logo menu + menus built with Radix `Menubar` (Products, Docs, Company …),
  with nested submenus.
- Right: search, theme, notifications, an **active-windows** button (list of open
  windows, minimise targets, "close all"), account.
- **Mobile**: under 768px all menus collapse into the logo menu, nesting is
  flattened to two levels, and items can declare `mobileDestination` (turn a
  submenu into a link, or hide it on mobile).

### 1.6 Settings, persistence and sharing

- `siteSettings` in `localStorage`: colour mode, wallpaper, cursor size, click
  behaviour (**single vs double click to open**), reduce transparency,
  screensaver off, performance boost, scrollbars.
- **Shareable desktop URL**: the open windows (path, position and size as
  **percentages** of the viewport, z-order) are serialised into
  `?windows=[…]`; opening that URL restores the exact layout.
- A "boring mode" / compact mode renders pages without the OS (used in iframes and
  as a fallback).

### 1.7 What we take, what we change

| PostHog does | We do |
| --- | --- |
| One React context for all window state, later split into four contexts to stop re-render churn | One Zustand store with selectors from day one — same isolation, less code |
| Pages are routes; each route opens a window | Same: `/apps/:id` opens that app's window |
| Content is marketing pages and docs | Content is **live, interactive product demos** |
| Static desktop that waits for the visitor | **Autopilot cursor** demos the OS until the visitor takes over |
| Mobile = same site, simplified menus | Mobile = a **phone OS** with a home screen and full-screen apps |

---

## 2. Target architecture

```
src/
├─ os/
│  ├─ store/
│  │  ├─ windows.ts           # Zustand: windows[], open/close/focus/min/max/snap/resize
│  │  ├─ settings.ts          # wallpaper, theme, click mode, autopilot on/off, reduced motion
│  │  └─ autopilot.ts         # state machine: idle | running | paused | handed-over
│  ├─ registry/
│  │  ├─ apps.ts              # THE app registry (see §2.1)
│  │  └─ icons/               # our own app icons (SVG)
│  ├─ desktop/                # ≥768px shell
│  │  ├─ os-desktop.tsx       # layout: menubar + viewport + windows + overlays
│  │  ├─ menubar.tsx          # top bar, menus, tray, clock, active-windows
│  │  ├─ desktop-icons.tsx    # icon columns, selection box, keyboard nav
│  │  ├─ window.tsx           # chrome, drag, resize handles, snap indicator
│  │  ├─ window-list.tsx      # memoised list subscribed to the store
│  │  ├─ dock.tsx             # optional bottom dock (decide in Phase 3)
│  │  ├─ spotlight.tsx        # ⌘K launcher
│  │  ├─ context-menu.tsx
│  │  └─ wallpapers/
│  ├─ mobile/                 # <768px shell
│  │  ├─ phone-os.tsx         # status bar + pages + dock + home indicator
│  │  ├─ home-screen.tsx      # paged app grid, widgets, page dots
│  │  ├─ app-screen.tsx       # full-screen app container, zoom-from-icon
│  │  ├─ app-switcher.tsx     # recent-apps cards
│  │  └─ lock-screen.tsx      # first-load "slide to unlock" (skippable)
│  ├─ autopilot/
│  │  ├─ cursor.tsx           # fake pointer (desktop) / finger (mobile)
│  │  ├─ engine.ts            # runs scripts, handles hand-over and resume
│  │  ├─ actions.ts           # moveTo, click, dblclick, type, drag, scroll, wait, say
│  │  └─ scripts/             # one tour script per app
│  ├─ kernel/
│  │  ├─ fake-server.ts       # in-browser mock API: latency, errors, seeded data
│  │  ├─ rng.ts               # seeded PRNG so demos look the same each visit
│  │  ├─ persist.ts           # per-app localStorage with "reset demo"
│  │  └─ bus.ts               # BroadcastChannel for cross-tab multiplayer demos
│  └─ boot/                   # boot screen, first-visit hint
├─ apps/                      # one folder per app, each lazy-loaded
│  ├─ trypnow/  suregem/  eleven-jobs/  eleven-matrix/
│  ├─ fujin/  bingo-master/  gaming-era/  file-scanner/
│  ├─ about/  resume/  contact/  terminal/  settings/
│  ├─ files/  journey/  trash/  readme/
└─ data/profile.ts            # unchanged single source of truth
```

### 2.1 The app registry (single source of truth for both shells)

```ts
type AppDef = {
  id: string                    // "trypnow" → URL /apps/trypnow
  name: string                  // "TrypNow"
  icon: React.FC                // our SVG icon
  kind: "project" | "side-project" | "system" | "game"
  project?: string              // key into profile.projects for blurb, stack, links
  load: () => Promise<{ default: React.ComponentType<AppProps> }>  // lazy chunk
  window: { size, minSize, maxSize?, position?: "center" | "cascade", fixed?, toolbar? }
  mobile: { statusBarTint, fullscreen?, orientation?: "portrait" | "any" }
  desktop: { column: "left" | "right", order: number }
  phone: { page: number, order: number, dock?: boolean }
  tour?: () => Promise<TourScript>  // autopilot script, lazy
  liveUrl?: string; repo?: string
}
```

`AppProps` gives each app `{ windowId, isMobile, isFocused, isAutopilot, setTitle }`
so an app can adapt its layout and pause work when unfocused or covered.

---

## Phase 1 — Foundation  ·  _chunk 1_

Goal: the new shell renders behind a route, the old site still works.

- [x] Add `zustand`. Create `os/store/windows.ts` with actions:
      `open(appId, opts?)`, `close(id)`, `focus(id)`, `minimize(id)`,
      `toggleMaximize(id)`, `snap(id, side)`, `move(id, pos)`, `resize(id, size, pos?)`,
      `closeAll()`; dense z-order exactly like PostHog's `bringToFront`.
      _(Also `setBounds`, which keeps windows on screen when the desktop resizes.)_
- [x] Unit-test the store (Vitest): z-order stays 1…n, close focuses the next window,
      maximise→restore returns the previous rect, snap saves the previous rect.
- [x] `os/store/settings.ts` persisted to `localStorage` (try/catch, safe defaults).
      _Has click mode and autopilot now. Theme stays in `use-theme` because it must
      apply before first paint. Wallpaper, sounds and reduce-transparency arrive
      with the Settings app._
- [x] `os/registry/apps.ts` with entries for every project app, plus About,
      Résumé and Journey. Projects without a demo yet open a project-info window
      (what it is, what I built, stack, links). Plain data lives in
      `apps-meta.ts` so the Vite config can read it.
- [x] Routing: `/` → OS shell; `/apps/:id` → OS shell + that window open and focused;
      `/resume` → printable page (unchanged). Unknown app id → back to `/`
      (the "App not found" dialog comes with Phase 10's error window).
- [ ] `?windows=` restores a shared layout — moved to Phase 3 (shareable layout).
- [x] `useIsPhone()` — `matchMedia("(max-width: 767px)")`, hydrated before first
      paint, switches between `<DesktopOS/>` and `<PhoneOS/>`.
- [x] Each app is `React.lazy` + `Suspense`. The window opens at full size
      straight away with an "Opening…" state inside, so nothing jumps while it
      loads. Each app also has an error boundary with a Reopen button.
- [x] The pixel journey moved to `/journey`, unchanged and now lazy-loaded (the
      entry bundle dropped from 228 KB to 92 KB). Its icon opens it as a full
      page, `/apps/journey` redirects there, and its HUD has a "◀ Desktop" button.
      It moves into a scrolling window in Phase 8.
- [x] Update `vite.config.ts` `ROUTES` (sitemap) with every `/apps/:id`.

**Done when:** `npm run build` + `npm run lint` pass, `/apps/journey` plays the old
journey inside a placeholder shell, store tests pass. ✅ Build, lint and 12 store
tests pass. A Playwright pass on desktop (1440×900) and phone (390×844) drove
every TrypNow flow with no console errors.

---

## Phase 2 — Desktop shell  ·  _chunk 2_

- [x] **Layout** like §1.1: `h-dvh` column, menubar, desktop viewport with
      `overflow-clip` that is the drag-constraints ref.
- [x] **Wallpapers** — four original scenes, all SVG/CSS with no image downloads:
      "Doon hills", "Pixel era" (a stepped pixel sunset, BGI-blue at night), "Blueprint"
      (graph paper and wireframes) and "Plain". Each has day/night colours from
      `--wp-*` tokens and an icon-hover glow colour.
- [x] **Desktop icons** — left column: work projects (TrypNow, SureGem, 11Jobs,
      11Matrix). Right column: side projects + system (Fujin, Bingo Master, Gaming
      Era, File Scanner, About me, Résumé, Contact, Terminal, Journey, Trash).
      Columns wrap into extra columns on short screens (`flex-col flex-wrap`,
      `wrap-reverse` on the right).
- [x] Icon interactions: single-click selects, double-click (or single-click when
      the setting says so) opens; Enter opens the selected icon; arrow keys move
      selection; labels truncate to two lines with full name in a tooltip.
- [x] Icons are **draggable** on the desktop and the positions persist. Instead of
      one layout per viewport size, icons snap to a grid anchored to the nearer
      edge (`icon-layout.ts`, unit-tested), so a layout survives resizing. Dropping
      on another icon swaps the two.
- [x] **Rubber-band selection** on empty desktop (direct style writes, no re-render
      per pointer move — PostHog's trick).
- [x] **Right-click context menu** (Radix): on the desktop — Change wallpaper ▸,
      Clean up icons, Settings…, About Ashfaq OS; on an icon — Open, Open live
      site, View source.
- [x] **Menubar** (Radix Menubar, arrow keys across menus) — logo menu (About,
      Settings, Search, Download résumé, Restart → replays boot); *Projects*,
      *Side projects*, *Apps*, *Contact* (email, copy email, GitHub, LinkedIn,
      résumé); right: Windows menu with count, search (⌘K), theme, clock with
      a Dehradun-time tooltip. The autopilot toggle arrives with the autopilot
      (Phase 4).
- [x] **Boot sequence** (first visit only, skippable, ~1.5s, skipped under reduced motion): logo → progress bar →
      desktop fades in. Reuse the terminal-boot idea from `app-window.tsx`.
- [x] **Screensaver** after 90s idle: the MA tile bounces around and changes colour
      at each wall, with a big clock. Waking it offers a "Turn off" toast;
      Settings has a switch and a Preview. Until the autopilot lands it runs
      whenever it's switched on; in Phase 4 the autopilot takes over idle time.

**Done when:** the desktop renders with icons, menus, wallpaper switching and theme
toggle; double-clicking an icon logs `open(appId)`. ✅ 26 Playwright checks cover
boot, the context menu, icon drag/persist/swap/clean-up, rubber band, arrow keys,
the menubar, search, Settings, About, Restart, the screensaver (fake clock) and
the phone, with no console errors. Phase 1's checks still pass.

---

## Phase 3 — Window manager  ·  _chunk 3_

- [ ] _Partly done: icon, title, Live site link, – □ ×. The reset button lives inside each app for now._ `window.tsx` chrome: title bar (icon, title, ↺ "reset demo", ↗ "open live
      site", – □ ×), body, optional toolbar slot the app can fill.
- [ ] **Open animation** scales up from the icon's rect (`fromOrigin`), close
      animation scales back down; minimise flies to the active-windows button.
      All three collapse to a fade under `prefers-reduced-motion`.
- [x] **Placement**: centre the first window, cascade the next ones (+32px, +32px),
      wrap back when they would leave the viewport; respect per-app default sizes.
- [x] **Drag** by title bar only (Motion `dragControls`), constrained to the desktop.
- [ ] _Partly done: right, bottom and the bottom-right corner._ **Resize** from all 8 edges/corners, clamped to min/max; left/top handles
      move the origin too. Use pointer events + `requestAnimationFrame`; commit to the
      store on pointer-up only.
- [ ] **Snap** left/right half with the translucent indicator at a 50px threshold;
      top edge → maximise. Double-click title bar → maximise/restore.
- [ ] Dragging a maximised window restores it under the pointer.
- [x] **Focus**: pointer-down anywhere in a window brings it to front; the focused
      window gets a stronger shadow and coloured title; others dim slightly.
- [ ] **Keyboard shortcuts**: `Shift+W` close, `Shift+↑/↓` maximise/restore,
      `Shift+←/→` snap, `Shift+X` close all, `Alt+Tab`-style cycling with
      `Shift+Tab` (avoid browser-reserved combos), `Esc` closes dialogs, `⌘K` / `/`
      spotlight, `m` theme, `\` wallpaper. Shortcuts are ignored while typing in
      inputs.
- [x] **Active-windows panel** in the menubar: list, restore, close, close all.
- [ ] _Partly done: open pushes, focus/close replace, deep links and reload work, Back refocuses or reopens the previous app. "Back closes the newest window" still to do._ **URL sync**: focusing a window replaces the URL with `/apps/:id` (no history
      spam: `replace` on focus, `push` on open); closing the last window → `/`.
      Browser Back closes the most recently opened window.
- [ ] **Shareable layout**: "Copy link to this desktop" serialises open windows
      as viewport percentages (PostHog's `?windows=` format).
- [x] Clamp windows back into view on viewport resize.
- [ ] **Occlusion/visibility**: pass `isFocused` and `isVisible` (not minimised, < 80%
      covered) to apps so timers, canvases and fake live feeds pause when hidden.
- [ ] _Partly done: `role="dialog"` + `aria-labelledby`, labelled buttons, minimised windows are `inert`._ A11y: each window is `role="dialog"` with `aria-labelledby` its title; focus
      moves into a window on open and back to its icon on close; window buttons
      have labels; drag/resize have keyboard equivalents (the shortcuts above).

Lessons from chunk 1, worth keeping:
- Pass Motion **numeric** `dragConstraints` (from the store's bounds), not a ref.
  With a ref, Motion rescales the window's position inside the bounds every time
  the window changes size, and it drifts off its stored spot.
- React Router's `navigate` changes identity on every navigation. The "focus →
  URL" effect therefore checks the focused id really changed, compares against
  the last URL it *requested*, and tags its own rewrites (`state.fromFocus`) so
  the "URL → window" effect never reopens a window that was just closed.
- Title-bar buttons are `data-no-focus`, so closing a background window doesn't
  bring it to the front first.

**Done when:** placeholder apps can be opened, dragged, resized, snapped, maximised,
minimised and closed with mouse and keyboard; layout survives reload via URL.

---

## Phase 4 — Autopilot cursor  ·  _chunk 4_

The signature feature. The OS demos itself until a human takes over.

### 4.1 Behaviour

- [ ] Starts **3s after boot** if the visitor hasn't interacted, and only when the tab
      is visible (`visibilitychange`). Never starts under `prefers-reduced-motion`
      (shows a "▶ Take the tour" button instead).
- [ ] A small banner/pill in the menubar: **"Autopilot · touch anything to take
      over"** with ⏸ / ⏭ (next app) / ✕ (turn off) controls.
- [ ] **Hand-over**: any real `pointermove` beyond a few px, `pointerdown`, `wheel`,
      `keydown` or `touchstart` → autopilot pauses *immediately*, the fake cursor
      fades out where it is, nothing the tour opened is closed. Synthetic events from
      the engine are flagged so they don't trigger hand-over.
- [ ] **Resume**: after 25s of no interaction, a toast "Resume the tour?" appears;
      it resumes on click, or on its own after another 10s. Off if the visitor turned
      autopilot off (persisted).
- [ ] **Loop**: walk the tour playlist (projects first, then side projects, then
      About / Contact), then start over with windows closed.

### 4.2 Engine

- [ ] `cursor.tsx` — an SVG pointer in a fixed layer above everything
      (`pointer-events: none`), moved with a Motion spring along a slightly curved
      path (quadratic Bézier with random control point, duration from distance —
      Fitts-like), with a click ripple and a press "squish".
- [ ] Targets are found by `data-tour="…"` attributes, never by CSS classes, so
      restyling never breaks tours. The engine waits (with timeout) for the target
      to exist and be visible, scrolls it into view inside its window first.
- [ ] Actions: `moveTo(target)`, `click`, `dblclick`, `type(text, {wpm})` (sets the
      value through the native setter + dispatches `input` so React state updates),
      `press(key)`, `drag(from, to)` (pointer events), `scroll(target, by)`,
      `wait(ms)`, `say(text)` (caption bubble next to the cursor, e.g. "Drag a hotel
      into the package"), `openApp(id)`, `closeWindow(id)`, `arrange(layout)`.
- [ ] Clicks dispatch real events (`element.click()` / pointer sequence) so the tour
      exercises the actual demo code — no fake "video" playback.
- [ ] Each script is an async function using those actions; the engine runs it with
      an `AbortSignal` so hand-over cancels mid-step cleanly.
- [ ] Captions are also written to an `aria-live="polite"` region.
- [ ] Analytics-free; a tiny debug overlay (`?autopilot=debug`) shows the current step.

### 4.3 Default tour (desktop)

1. Move to **TrypNow** → double-click → drag two hotels and an attraction into a
   package → type a prompt into the AI listing form → close.
2. **SureGem** → filter by shape + carat → open a stone → add to cart → close.
3. **11Jobs** → type "Hire a senior React dev with a 45-min test" into the MCP chat
   → watch the workflow build → minimise.
4. **11Matrix** → watch KPIs tick → re-rank the leaderboard → snap left; open
   **File Scanner** → upload a sample → snap right (shows snapping).
5. **Bingo Master** → play three moves against the bot.
6. Open **About me** and **Contact** → end on the contact form, then close all.

**Done when:** a fresh visit with no input plays the whole tour, and any input
stops it instantly without breaking the open app.

---

## Phase 5 — Kernel for working demos  ·  _chunk 5_

Shared plumbing so every demo behaves like a real product without a backend.

- [ ] _Partly done: `os/kernel/rng.ts` (mulberry32, int, pick, chance, delay). Generators live in each app for now._ `rng.ts` — seeded PRNG (mulberry32) + generators for names, cities, prices,
      dates, avatars (initials), so data is realistic and stable between visits.
- [ ] `fake-server.ts` — `createApi(app, routes)` returning `get/post/patch/delete`
      with 150–600ms latency, pagination, filtering, sorting, and an occasional
      configurable error so loading/error states are real.
- [ ] _Partly done: `os/kernel/storage.ts` (localStorage that never throws). TrypNow persists to `os:trypnow:v1` and has its own Reset._ `persist.ts` — each app's data lives in `localStorage` under `os:<app>:v1`;
      the window's ↺ button and Settings → "Reset all demos" restore seed data.
- [ ] `bus.ts` — `BroadcastChannel` wrapper so multiplayer demos (Bingo, Gaming Era
      chat) work **between two tabs** of the site, with a bot opponent when alone.
- [ ] Shared UI kit for apps (table with sort/filter/pagination, drawer, toast,
      empty state, skeleton) on top of the existing shadcn primitives.
- [ ] _Partly done (TrypNow)._ Every demo shows a small **"Demo data"** badge and a link to the live product
      / repo, so nobody mistakes it for the real service.

---

## Phase 6 — Port the existing product demos  ·  _chunk 6_

The four demos already exist in `src/components/journey/app-*.tsx`. Move each into
`src/apps/<id>/`, make it fill a resizable window, and widen it into a fuller app.

- [x] **TrypNow** (`app-trypnow.tsx`, 383 lines) → `src/apps/trypnow/`
  - [x] Supplier and Agent views switchable from a sidebar.
  - [x] Drag-and-drop package builder (existing) + live price total + publish.
  - [x] Prompt → attraction listing (existing), saved into inventory and usable in
        the builder.
  - [x] Bookings table: search, filter by status, sort, paginate, booking drawer
        with confirm / decline / cancel.
  - [x] Supplier dashboard (KPI tiles, approvals, top packages, activity) and agent
        marketplace (search, country filter, booking form). The loop works end to
        end: publish as supplier → book as agent → confirm as supplier.
  - [x] The journey's TrypNow stage now reuses the same builder and AI listing.
  - [ ] Tour script for the autopilot (Phase 4). The `data-tour` targets are in place.
- [ ] **SureGem** (`app-suregem.tsx`, 552 lines)
  - [ ] Search + filters (shape, carat, colour, clarity, price), grid/list toggle.
  - [ ] Stone detail drawer (existing), cart, inquiry form, supplier upload (existing).
- [ ] **11Jobs** (`app-11jobs.tsx`, 446 lines)
  - [ ] MCP chat that parses the prompt into a workflow (existing) — show the tool
        calls as expandable steps.
  - [ ] Assessment builder, candidate list, proctored candidate view (existing) with
        a fake webcam tile and "tab switch detected" flags.
- [ ] **11Matrix** (`app-11matrix.tsx`, 304 lines)
  - [ ] KPI tiles, re-ranking leaderboard, cross-store inventory (existing).
  - [ ] Store switcher, date range, a ticket inbox generated from low-stock events.
- [ ] For each: responsive inside the window (`@container` queries, since window
      width ≠ viewport width), `data-tour` targets, tour script, mobile layout.
- [ ] Delete the journey's copies only after the journey app imports the new ones
      (the journey keeps showing them in its stages).

---

## Phase 7 — New demos for side projects  ·  _chunk 7_

- [ ] **Fujin** — a registry browser: search features, preview a feature's files in
      a code viewer with tabs, and a fake terminal running `npx fujin add auth` that
      prints the install steps and a file tree diff.
- [ ] **Bingo Master** — playable 5×5 game: randomised boards, turn timer, win
      detection (5 lines), bot opponent; open a second tab to play yourself via
      `BroadcastChannel`. "Room code" UI mirrors the real one.
- [ ] **Gaming Era** — chat rooms with simulated users typing, presence dots, a
      "video call" panel that uses the visitor's camera **only on explicit click**
      (falls back to an avatar), OAuth sign-in screen mocked as "Continue as guest".
- [ ] **File Scanner** — drag a file in (or pick a sample), watch it go through
      queued → scanning → clean / infected on a live dashboard; the "worker" is a
      timer on the fake server. Nothing is uploaded anywhere — say so in the UI.

---

## Phase 8 — System apps  ·  _chunk 8_

- [ ] _Partly done: bio, skills, links, résumé download. Photo and timeline still to do._ **About me** — photo/avatar, short bio, skills from `profile.ts`, timeline.
- [ ] **Résumé.pdf** — renders the `/resume` page in a window with Download / Print.
- [ ] **Contact** — mail-compose window (To prefilled, Subject, Body) that opens
      `mailto:` on Send; buttons for LinkedIn/GitHub/email copy.
- [ ] **Terminal** — commands: `help`, `ls`, `cd projects`, `open <app>`, `cat
      about.txt`, `whoami`, `skills`, `contact`, `theme dark`, `clear`, `sudo
      hire-me` (easter egg). Tab completion and history.
- [ ] **Files** — a Finder-style explorer: folders *Projects*, *Side projects*,
      *Documents* (résumé) — double-click opens the app. Doubles as the index for
      people who prefer lists.
- [ ] _Partly done (built in chunk 2): wallpaper picker with live thumbnails, theme, click mode, clean up icons, screensaver switch + preview, restart, reset all demo data. Autopilot, sounds and reduced transparency still to come._ **Settings** — wallpaper, theme, click mode, autopilot on/off + speed, sounds,
      reduce motion/transparency, reset all demos.
- [ ] **Journey.exe** — the existing pixel journey, scrolling inside its window
      (switch its scroll container from `window` to the window body — the
      `useScroll` calls in `journey/hooks.ts` need a `container` ref).
- [ ] **Trash** — "old projects" with a joke or two; "Empty trash" plays confetti.
- [ ] **README.txt** — first window on first visit: what this is, how to drive it,
      shortcuts list.

---

## Phase 9 — Phone OS  ·  _chunk 9_

Under 768px the site becomes a phone. Same registry, same app components.

### 9.1 Home screen

- [ ] _Partly done: time, signal, wifi, battery icons, safe areas._ **Status bar**: time, "5G" + signal, battery (real level via Battery API when
      available, else 87%), safe-area insets (`env(safe-area-inset-*)`).
- [x] **Widget** at the top of page 1: name, role, "open to work" dot, location.
- [ ] _Partly done: 4-column grid in "Work" and "Side projects" cards on one scrolling page._ **App grid** 4 columns, icons with labels; page 1 = work projects, page 2 =
      side projects + system apps. Horizontal swipe between pages with **page dots**
      (scroll-snap so it's native-feeling and cheap).
- [ ] _Partly done: About, Résumé, Journey._ **Dock** (4 apps): About, Résumé, Contact, Terminal.
- [ ] Long-press an icon → quick-actions sheet (Open, Open live site, View code);
      long-press empty space → "jiggle" mode (just for fun, no persistence needed).
- [ ] Optional **lock screen** on first visit: clock + "swipe up to unlock" (tap works
      too); skipped on later visits and on deep links.

### 9.2 Apps

- [x] Opening **zooms the app out of its icon** (shared-element scale from the icon
      rect to full screen); closing zooms back into the icon.
- [ ] _Partly done: Home back button, title, live-site link._ Apps are full-screen with their own top bar (title, back chevron, "•••" menu
      with Reset demo / Open live site) and respect the safe areas.
- [ ] _Partly done: tap to go home._ **Home indicator** at the bottom: swipe up (or tap) to go home; swipe up and
      hold → **app switcher** with cards of recent apps (swipe a card up to close).
- [x] Hardware back button / browser Back closes the app (history entry per open).
- [ ] Every demo gets a **mobile layout** (bottom tabs instead of sidebars, sheets
      instead of drawers, tables become cards). Drag-and-drop demos support touch.
- [x] `/apps/:id` on a phone opens that app straight away over the home screen.

### 9.3 Autopilot on mobile

- [ ] Instead of a cursor, a semi-transparent **finger dot** with tap ripples,
      swipe trails and long-press rings.
- [ ] Shorter tour: swipe pages → tap TrypNow → one interaction → go home → tap
      SureGem → … Each app ≤ 12s.
- [ ] Any touch hands over immediately (same engine as Phase 4).

**Done when:** on a 390×844 viewport everything is usable with touch only, no
horizontal page scroll, no text under 14px, tap targets ≥ 44px.

---

## Phase 10 — Polish & delight  ·  _chunk 10_

- [ ] Optional UI sounds (off by default): click, window open/close, error.
- [ ] Notification toasts from apps ("New booking in TrypNow", "Scan finished").
- [ ] Desktop badges on icons fed by those notifications.
- [ ] _Partly done (built in chunk 2): ⌘K / Ctrl+K / "/" search over apps (name, description, tech stack) and OS actions (theme, wallpapers, résumé, email, settings, restart). Terminal commands come with the Terminal app._ Spotlight (⌘K) searches apps, projects, skills and terminal commands.
- [ ] Easter eggs: Konami code → pixel mode skin from the journey; `sudo hire-me`.
- [ ] Custom 404 as an "error dialog" window.
- [ ] Copy pass: every app has a one-line "what this is / what I built" header
      linking to the case study in About.

---

## Phase 11 — Performance, accessibility, SEO, QA  ·  _chunk 11_

### Performance budgets
- [ ] _Note from chunk 2: Radix menus + floating-ui add ~38 KB gzip, split into a cached `menus` chunk. The entry chunk is 39 KB gzip; react 70 + motion 44 + menus 38 still need trimming to meet this._ Initial JS for the shell ≤ 120 KB gzip (apps lazy, prefetched on icon hover
      and by the autopilot one step ahead).
- [ ] LCP < 2.0s on mid-range mobile, CLS < 0.05, no long tasks > 100ms while dragging.
- [ ] Windows get `will-change: transform` only while dragging/animating; apps pause
      timers when hidden (Phase 3 visibility flags).
- [ ] Wallpapers responsive-sized; fonts subset; vendor chunk split kept.

### Accessibility
- [ ] All OS controls reachable by keyboard; visible focus rings; skip link to a
      plain list of projects ("Files" view) for screen-reader users.
- [ ] `prefers-reduced-motion`: no autopilot auto-start, fades instead of zooms.
- [ ] Colour contrast AA in both themes on every wallpaper (text sits on solid
      surfaces, never directly on the wallpaper).

### SEO / sharing
- [ ] _Partly done: title, description, canonical. OG images still to do._ Per-app `<title>`, description, canonical and OG image (`useDocumentMeta`).
- [ ] Pre-render static HTML for `/` and each `/apps/:id` at build (small script
      with the pre-installed Playwright, or `vite-plugin-ssr`-style prerender) so
      crawlers and link previews see real content. `<noscript>` lists projects.
- [x] Sitemap includes every app route.

### Testing
- [ ] Vitest: window store, autopilot engine (hand-over, abort, resume), fake server.
- [ ] Playwright (Chromium is pre-installed): desktop smoke (open/drag/snap/close
      each app), autopilot hand-over, phone viewport smoke, `/apps/:id` deep links.
- [ ] Manual pass on Safari iOS, Chrome Android, Firefox desktop.

### Ship
- [ ] Update README (new structure, how to add an app + tour script).
- [ ] Vercel/Netlify rewrites cover `/apps/*`.

---

## How to add a new project later (target workflow)

1. Add the project to `src/data/profile.ts`.
2. Create `src/apps/<id>/index.tsx` (the demo) and `tour.ts` (autopilot script).
3. Add one entry to `src/os/registry/apps.ts` (icon, sizes, desktop/phone slots).
4. It now appears on the desktop, the phone, the menubar, Files, Spotlight, the
   sitemap and the autopilot playlist.

---

## Suggested order of chunks

| # | Chunk | Ships |
| - | ----- | ----- |
| 1 | Foundation | store, registry, routing, journey moved |
| 2 | Desktop shell | wallpaper, icons, menubar, boot |
| 3 | Window manager | drag / resize / snap / min / max / shortcuts / URL |
| 4 | Autopilot | cursor engine + tour with placeholder apps |
| 5 | Kernel | fake server, seeded data, persistence, cross-tab bus |
| 6 | Port 4 product demos | TrypNow, SureGem, 11Jobs, 11Matrix as full apps + tours |
| 7 | Side-project demos | Fujin, Bingo Master, Gaming Era, File Scanner |
| 8 | System apps | About, Résumé, Contact, Terminal, Files, Settings, Journey, Trash |
| 9 | Phone OS | home screen, full-screen apps, switcher, finger autopilot |
| 10 | Polish | sounds, notifications, spotlight, easter eggs |
| 11 | Perf / a11y / SEO / tests | budgets, prerender, Playwright, README |

Chunks 1→3 must go in order. After 3, chunks 4, 5 and 9 can run in parallel, and
6–8 can be split per app.

---

## Sources

- PostHog website source: <https://github.com/PostHog/posthog.com>
  (`src/components/Wrapper`, `src/components/AppWindow`, `src/components/Desktop`,
  `src/components/TaskBarMenu` incl. its README, `src/context/App.tsx`,
  `src/context/Window.tsx`, `src/hooks/useInactivityDetection.ts`)

Found by search but not readable from the build sandbox. Only their search
summaries were used: Gatsby + React context providers, a Wrapper / Desktop /
AppWindow / Taskbar split, drag-resize-snap-minimise, and a "boring" non-OS mode
for mobile. Worth reading in a normal browser:

- PostHog handbook — PostHog.com site architecture:
  <https://posthog.com/handbook/engineering/posthog-com/technical-architecture>
- "I went everywhere on PostHog's new website so you don't have to":
  <https://developerled.substack.com/p/i-went-everywhere-on-posthogs-new>
- "PostHog turned their website into a desktop":
  <https://peerlist.io/scroll/post/ACTH7B8D68M9RENJ626BP89PDO6MEL>
