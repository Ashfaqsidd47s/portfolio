# Mohammad Ashfaq — Portfolio

Personal portfolio and résumé site, built as an operating system in the browser.
The home page is a desktop: every project is an app icon that opens in a
draggable, resizable window and runs as a working demo on fake data. On phones
the same apps sit on a phone home screen and open full-screen. The layout takes
its cue from posthog.com's desktop site. See [`PLAN.md`](PLAN.md) for the
research and the build plan, chunk by chunk.

`/journey` is a scroll-driven pixel-art "game" of my developer journey: it boots
on a 3D CRT computer, dives into Turbo C++, and plays through fifteen stages from
2018 to today, several of them playable. The `/resume` page stays a clean,
printable document.

React + TypeScript + Vite, styled with Tailwind CSS v4, pixel components from
[8bitcn](https://8bitcn.com), animated with Motion.

## ⚠️ Before you deploy

Set your real domain in **[`.env`](.env)** — it drives canonical URLs, Open
Graph tags, `robots.txt` and `sitemap.xml`:

```bash
VITE_SITE_URL=https://your-real-domain.com   # no trailing slash
```

This file holds no secrets and is committed on purpose, so a fresh clone builds
with correct URLs.

**Host environment variables win over this file.** On Vercel or Netlify, set
`VITE_SITE_URL` in the project's environment-variable settings — and if you
create it there, give it a real value. The build falls back to
`http://localhost:5173` and prints a warning when it is unset or blank, so a
missing value degrades the metadata rather than breaking the build.

## Stack

| Area       | Choice                                       |
| ---------- | -------------------------------------------- |
| Framework  | React 19 + TypeScript, Vite                  |
| Styling    | Tailwind CSS v4 (CSS-first `@theme` tokens)  |
| Components | shadcn/ui primitives (Radix under the hood)  |
| Pixel UI   | 8bitcn components, vendored in `ui/8bit/`    |
| Fonts      | Press Start 2P, Pixelify Sans, VT323 — self-hosted via Fontsource |
| Animation  | Motion (`motion/react`), CSS 3D transforms   |
| State      | Zustand (window manager, settings, app data) |
| Routing    | React Router, with lazy secondary routes     |
| Icons      | lucide-react, plus local brand marks         |

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build to dist/
npm run preview  # serve the production build
npm run lint     # oxlint
npm test         # vitest (window manager)
```

## Editing content

Facts live in [`src/data/profile.ts`](src/data/profile.ts): experience,
projects, skills, education and contact details. Both the journey and the
résumé read from it, so a project link or stack edited there updates both.

The journey's timeline — each stage's year, title and stage-select blurb —
lives in [`src/data/journey.ts`](src/data/journey.ts). The narration itself is
written inline in each stage component under `src/components/journey/`.

To swap the downloadable PDF, replace `public/Mohammad_Ashfaq_Resume.pdf` and
update `profile.resumeFile` / `profile.resumeFileName` if the name changes.

## Structure

```
src/
├─ os/                        # the operating system
│  ├─ os.tsx                  # picks the desktop or phone shell, per-app page meta
│  ├─ registry/apps-meta.ts   # every app: id, name, window size (plain data, read by vite.config)
│  ├─ registry/apps.ts        # + icon, tint and lazy loader
│  ├─ store/windows.ts        # window manager: open/focus/min/max/snap/move/resize (+ tests)
│  ├─ store/settings.ts       # visitor preferences (wallpaper, icon layout, click mode, autopilot)
│  ├─ desktop/                # menu bar, icon grid (+ tests), context menu, windows,
│  │                          #   boot, screensaver, URL ⇄ window sync
│  ├─ wallpaper.tsx           # Doon hills, Night desk, Pixel era, Plain (colours in index.css)
│  ├─ mobile/phone-os.tsx     # status bar, home screen, dock, full-screen apps
│  ├─ app-host.tsx            # lazy-loads an app with its own error boundary
│  └─ kernel/                 # seeded randomness, crash-proof localStorage
├─ apps/                      # one folder per app, each its own chunk
│  ├─ trypnow/                # supplier + agent demo: builder, AI listing, bookings, marketplace
│  ├─ about/
│  └─ project-info/           # stand-in for projects whose demo isn't built yet
├─ data/profile.ts            # single source of truth for all content
├─ data/journey.ts            # stage order, years and titles
├─ components/
│  ├─ ui/                     # shadcn primitives (button, badge, card)
│  │  └─ 8bit/                # vendored 8bitcn components (MIT)
│  ├─ journey/                # the home-page game
│  │  ├─ hud.tsx              # top bar, XP bar, stage select
│  │  ├─ scene-intro.tsx      # 3D CRT desk, camera dive into the screen
│  │  ├─ era-shift.tsx        # CRT → 2020 laptop hardware upgrade between eras
│  │  ├─ companion.tsx        # pixel-me narrator, fixed bottom-left
│  │  ├─ stage-*.tsx          # one file per chapter of the story
│  │  ├─ app-window.tsx       # browser frame that boots a demo (terminal → app)
│  │  ├─ app-*.tsx            # TrypNow, SureGem, 11jobs and 11Matrix demos
│  │  ├─ primitives.tsx       # Stage, StageTitle, Dialogue, Achievement, PixelSprite
│  │  ├─ hooks.ts             # scroll-scene progress, typewriter
│  │  └─ sprites.ts           # pixel sprites as character grids
│  ├─ motion-primitives.tsx   # Reveal (résumé / footer)
│  ├─ nav.tsx, footer.tsx, icons.tsx   # chrome for /resume and 404
├─ pages/
│  ├─ home.tsx                # /journey — the pixel journey
│  ├─ resume.tsx              # /resume — web résumé + PDF download + print
│  └─ not-found.tsx           # catch-all
├─ hooks/
│  ├─ use-theme.tsx           # light/dark, no flash on first paint
│  └─ use-document-meta.ts    # per-route title/description/canonical
└─ index.css                  # design tokens, base layer, print styles
```

## Design notes

### The OS (`/`, `/apps/:id`)

- **URL is the source of truth.** Opening an app navigates to `/apps/<id>`;
  focusing or closing a window rewrites the URL to whatever is now on top. Deep
  links, reload and Back all work, and each app has its own title and canonical.
- **Windows** live in one Zustand store with dense z-order (1…n, like PostHog's
  `bringToFront`). Each window draws its geometry through Motion values: drags
  and resizes write to them directly and commit to the store on release, and
  the window glides to every committed rect. Drag limits are numbers taken
  from the store: passing a ref makes Motion move the window whenever its
  size changes.
- **Window manager**: resize from any edge, drop on a screen edge to snap
  (top maximises), drag a maximised window to pull it out, `Shift`+arrows /
  `W` / `X` / `` ` `` for the keyboard (list in `desktop/shortcuts.ts`).
  Windows grow out of their icon and shrink back into it.
- **History**: opening a window pushes an entry, so Back closes the newest
  window. "Copy link to this desktop" puts the whole layout in `?windows=`
  (percentages, so it fits any screen); the same format in `sessionStorage`
  survives a reload.
- **Apps get `isFocused` / `isVisible`** (not minimised, under 80% covered, tab
  shown) so they can pause work nobody can see. Apps with demo data set
  `resettable` and register a handler in `os/kernel/reset.ts` for the ↺ button.
- **Apps** use container queries (`@container`, `@3xl:`…), never viewport
  breakpoints, because a window can be narrow on a wide screen. The same
  component then works in a window, on the phone and inside the journey.
- **Adding an app**: add an entry to `src/os/registry/apps-meta.ts` and its icon
  and loader in `apps.ts`, then build it in `src/apps/<id>/`. It shows up on the
  desktop, the phone, the Windows menu and the sitemap.
- **Desktop icons** sit on a snap-to grid (`desktop/icon-grid.ts`). Visitors
  can drag them, rubber-band select them and walk them with the arrow keys;
  the arrangement is saved per grid size, and "Clean up icons" in the
  right-click menu resets it.
- **Wallpapers** are SVG/CSS scenes coloured by `--wp-*` tokens set per
  wallpaper and theme on the shell's `data-wallpaper` attribute.
- **Demo data** is seeded (same for every visitor), saved in the visitor's
  browser, and resettable from the app.

### The journey (`/journey`)

- **Eras** — each era of the story lives in the tools of its time. The pixel
  Turbo C++ era hands over to the Android Studio era through a camera pull-back:
  the CRT powers off, a laptop rises, opens, boots the IDE and the camera dives
  into its screen. The Android stage is a Darcula-style IDE (Gradle sync, code
  typing, build, emulator running the app, then the emulator crashing), all
  scrubbed by scroll. Later eras follow the same recipe.
- **Companion** — all narration is spoken by a pixel version of me parked
  bottom-left like a chat widget: he hops, blinks and talks while typing each
  line into a speech bubble. `<Dialogue>` marks where a line triggers; the full
  text stays in the DOM for screen readers and search.

- **Pinned scenes** — the intro, the Turbo C++ editor, HTML → CSS → JS, the boss
  fight and the 11Matrix hub are tall sections with a sticky viewport, scrubbed
  by scroll progress. Everything else animates in once as it enters the view.
- **Playable bits** — love calculator, snake (keyboard, swipe or D-pad),
  tic-tac-toe, the no-library drag-and-drop calculator, and the paper-trading
  sim where closing the tab shows the original target-check bug.
- **Product demos** — TrypNow's drag-and-drop package builder and prompt-to-form
  AI listing; SureGem's diamond search, detail drawer, cart and supplier upload;
  11jobs' MCP chat that builds a whole hiring workflow from one sentence (the
  prompt is parsed, so edits change the result) plus a proctored candidate view;
  11Matrix's KPI tiles, re-ranking store leaderboard and cross-store inventory.
  All data is fake and generated in the browser.
- **Palette** — a fixed night palette scoped to `.pixel-world`, with each stage
  painting its own era (Borland blue, Android green, …). 8bitcn components read
  the same tokens.
- **Accessibility** — every typed-out line is also in the DOM in full for screen
  readers and search; under `prefers-reduced-motion` the pinned scenes collapse
  to one screen in their finished state and nothing types or scrubs.
- **Gotchas** — stages use `overflow-clip`, never `overflow-hidden`, which would
  break `position: sticky`. Scroll-linked opacity uses function transforms
  (`ramp` in `hooks.ts`) so Motion keeps it on the JS path.

### Résumé (`/resume`)

- **Palette** — cool neutral base with a single emerald accent, used sparingly
  (eyebrows, links, badges, the availability dot). Tokens are defined once on
  `:root` and redefined under `.dark`; nothing hardcodes a colour.
- **Contrast** — every foreground/background token pair clears WCAG AA (4.5:1)
  in both themes, including the 11px mono labels.
- **Theme** — an inline script in `index.html` applies the stored or system
  theme before first paint, so there is no flash of the wrong theme.
- **Motion** — entrance reveals are scroll-triggered and run once. Every
  animation is disabled under `prefers-reduced-motion: reduce`.
- **Print** — `/resume` has a dedicated print stylesheet: chrome is hidden,
  colours drop to ink, and sections avoid breaking across pages.

## SEO & production

- Canonical URL, Open Graph and Twitter card tags, plus JSON-LD `Person`
  structured data in [`index.html`](index.html).
- `robots.txt` and `sitemap.xml` are **generated at build time** from
  `VITE_SITE_URL` by a small plugin in [`vite.config.ts`](vite.config.ts) — add
  a route to its `ROUTES` array and the sitemap follows.
- Per-route `<title>`, description and canonical via `useDocumentMeta`.
- A `<noscript>` fallback carries the name, pitch, and contact links.
- Social preview image at `public/og-image.png` (1200×630).
- Icon set: `favicon.svg`, `icon-192.png`, `icon-512.png`,
  `apple-touch-icon.png`, and a web manifest.

### Bundle

Vendor code is split so the entry chunk stays small. Every app, the journey,
`/resume` and the 404 page are lazy-loaded:

```
index     ~92 kB  (31 kB gzip)   the OS shell
react    ~221 kB  (71 kB gzip)   react + react-dom + router
motion   ~143 kB  (47 kB gzip)   animation runtime
home     ~162 kB  (48 kB gzip)   the journey, on demand
trypnow   ~51 kB  (15 kB gzip)   on demand (app + shared builder)
resume    ~10 kB   (3 kB gzip)   on demand
```

## Deployment

Static SPA — build and serve `dist/`.

- **Vercel** — [`vercel.json`](vercel.json) covers SPA rewrites, security
  headers, and cache policy (immutable for `/assets/*`, revalidate for HTML).
- **Netlify** — [`netlify.toml`](netlify.toml) plus `public/_headers` and
  `public/_redirects` do the same.
- **Anything else** — serve `dist/`, point all unmatched routes at
  `index.html`, and mirror the cache headers from `public/_headers`.
