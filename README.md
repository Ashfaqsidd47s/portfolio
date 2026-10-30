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
│  ├─ autopilot/              # the self-driving tour: engine, fake cursor, controls,
│  │                          #   run.ts (DOM-free playlist loop, + tests), scripts/
│  ├─ mobile/phone-os.tsx     # status bar, home screen, dock, full-screen apps
│  ├─ app-host.tsx            # lazy-loads an app with its own error boundary
│  └─ kernel/                 # seeded randomness, crash-proof localStorage
├─ apps/                      # one folder per app, each its own chunk
│  ├─ trypnow/                # supplier + agent demo: builder, AI listing, bookings, marketplace
│  ├─ elevenbids/             # 11bids, a luxury auction storefront: auction.ts (bid rules, + tests),
│  │                          #   store.ts (the live room, accounts), catalogue.ts (lots + photos),
│  │                          #   liquid.ts (WebGL melt + flowmap), stage, lots, lot page, dialogs,
│  │                          #   footer (the curtain reveal)
│  ├─ infinity-castle/        # Demon Slayer's Infinity Castle, first person (three.js + GLSL):
│  │                          #   castle.ts (lattice + Nakime's shifts + turned rooms, + tests),
│  │                          #   lines.ts (train paths, cars, great halls, + tests),
│  │                          #   orient.ts (quarter-turn orientations, + tests), physics.ts
│  │                          #   (any-axis gravity, + tests), world.ts (live blocks, strum
│  │                          #   timeline), game.ts, audio.ts (synth biwa), score.ts (chase music),
│  │                          #   render/ (kit, shaders, drop: the opening fall)
│  ├─ doon/                   # Doon Diorama: Dehradun, isometric pixel art (three.js):
│  │                          #   geo.ts (surveyed points, roads, places), env.ts (sun + weather),
│  │                          #   world/ (plan, landmarks, roads, props, fantasy, collision, + tests),
│  │                          #   render/ (view, pixel post pass, materials, ground, water, fx),
│  │                          #   actors/ (characters, traffic, markers), story.ts, game.ts,
│  │                          #   map.ts (parchment map + compass minimap), audio.ts
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
- **Autopilot**: a few seconds after boot (if nobody touches anything) a fake
  cursor tours the apps. It sends real pointer, mouse and input events, so it
  runs the actual demo code; those events are untrusted, which is how any
  real input hands control straight back. After 25 quiet seconds it offers
  to resume. Tours are async scripts over `data-tour` targets in
  `os/autopilot/scripts/` (`?autopilot=debug` shows the current step).
  **Adding an app's tour**: give its controls `data-tour` ids and add a
  `Tour` to the playlist.
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

### 11bids (`/apps/11bids`)

- **A storefront for a luxury auction house**: watches, handbags, jewels,
  motor cars, wine and collectibles, sold online lot by lot. Ink, ivory and
  champagne; Cormorant Garamond (with lining figures, so "11" never reads
  "II") over Jost.
- **The opening** (`splash.tsx`), a step at a time in about two and a half
  seconds: "11bids" rises in the middle of the app, shrinks to the logo's
  size, moves up to the header, the header unfolds sideways out of it, and
  it slides into the logo's place as the first lot pours in. A click skips
  to the end.
- **The stage** (`liquid.ts`) is one WebGL canvas, one screen tall. The
  first lot pours out from its own centre like water spreading over a
  floor. After that the featured lots take turns on their own, every 5.5 s,
  as if stood on a ring that turns about the stage's vertical axis: each
  pixel's ray is traced onto the two cards' planes in perspective, so the
  current piece swings back and away to one side as the next swings in
  from the other. Behind each photo the same photo, uncropped, fills the
  stage softly blurred and dimmed. The pointer stirs a flowmap (a 128²
  ping-pong buffer of velocity that fades each frame), so the photo drags
  after the cursor like water. Without WebGL it crossfades photos.
- **Below it** the room's latest bids drift past, then every lot in four
  columns that scroll at different speeds (parallax), then the catalogue
  with departments, search and sorting. Scrolling is Lenis, inside the
  app's own scroller, so it works in a window.
- **Bidding** (`auction.ts`, tested): a house increment table, a lowest
  next bid, proxy bids (leave a maximum and the house answers rivals for
  you, one step at a time; a tie goes to whoever got there first),
  anti-sniping (a bid in the last two minutes resets the clock to two
  minutes), reserves, and a 25% buyer's premium shown before you confirm.
- **The room** (`store.ts`): a dozen paddles bid on a timer while the app
  is visible, more often on lots about to close, and only up to a ceiling
  that warms up as the close nears. Outbids, auto-bids, extensions and wins
  arrive as toasts. Lots that closed half a day ago are put back up.
- **The footer** (`footer.tsx`) waits beneath every page: a clipped box
  holds a sticky panel, so the page lifts off it like a curtain. The
  panel drifts up into place and the gold "11bids" rises a letter at a
  time under a slow shimmer, beside the salerooms' local clocks. On a
  short screen it grows to fit and sticks by its bottom edge instead.
- **Accounts** live in the visitor's browser (a demo: the password is
  hashed, never sent anywhere), with a one-click demo account. Bids,
  maximums and the watchlist persist; the window's ↺ resets the sale.
- **Photos** are Unsplash placeholders, hot-linked by id in
  `catalogue.ts` (`photos[0]` is the hero; replace them with the house's
  own shots). A photo that won't load shows a drawn catalogue card instead.

### Infinity Castle (`/apps/infinity-castle`)

- **The way in is a fall.** Behind the title you drop, endlessly, down a
  well of stacked rooms with their floors cut away: shoji and fusuma walls,
  polished ledges, gold nail covers. It wraps round the camera. Its storeys
  keep turning a quarter and slamming their panels. Click in and the fall
  speeds up, the turning gets faster, and then a strum blows the well
  apart. You fall on through the open void past rooms tumbling every which
  way, and the castle shifts below you. The hall you're aimed at splits
  its ceiling and roof in four to take you, and closes over you once
  you've landed. The column you fall down is kept clear until then.
- **The castle is a lattice**: rooms on a 5 × 6 × 5 grid of nodes, joined by
  bridges, enclosed shoji corridors and long stairs in the gaps between them.
  Every room has a veranda, so passages land in lanes (bridges opposite the
  door, stairs to the right of the way they climb) and can never collide:
  any two neighbouring rooms can always be joined, which is what keeps the
  maze connected through every shift.
- **Nakime's biwa**: a strum comes every 30–48 m walked (or after 50 s, or
  on `F`). `Castle.shift` slides a few rooms to new nodes and re-wires the
  passages: a spanning tree that prefers the passages already there, so the
  castle changes around you rather than being replaced. Whatever you stand
  in, on or next to is locked, and no room slides through you. `World.play`
  turns the plan into a timeline: doors slam, passages fold away, rooms
  glide, new passages unfold, and doors all over the castle bang shut and fly
  open in a wave. Some strums open the trapdoor under you or turn your room
  over (gravity onto a wall or the ceiling) until the next strum.
- **Turned rooms**: a few full rooms sit upside down or on their side in
  empty nodes, with the nodes above and below them kept free. A bridge
  stretches from a hall beside one into whichever of its doors faces that
  way. Step through the door and its floor becomes the floor: the world
  rolls over, and you can walk its tatami with the castle hanging sideways
  or overhead outside. Step back onto the bridge and down is down again.
  Strums turn them over too, and their bridges fold away and unfold to
  match.
- **Not one kind of room.** Plain halls come in three styles: gold fusuma
  under a roof that can open, a lacquered pavilion hung with bamboo blinds,
  and a bright shoji room with a low table, cushions and a vase of
  branches.
- **Train paths** (`lines.ts`): two rows of nodes are kept clear for long
  decks, with rails, kerbs and lanterns, and rooms beside them get a bridge
  (a dock) onto the deck. The ring runs through the castle along x, meets a
  deck standing straight up at either end, and closes overhead in a deck
  hanging upside down above everything. Carriages, open pavilions and
  two-storey towers loop along the level decks and fold away into the
  corners; lifts shuttle up and down the standing ones. The z-line crosses
  it a level or more away, between two great halls of pillars (thirty
  metres of tatami, two tiers of walls, a balcony, a dais with a gold
  screen). One stands upright and takes the line through a torii gate. The
  other is turned on its side, so its floor is the wall the line runs into.
  A train shuttles between them with one carriage tipped on its side. Cars
  slide under your feet and scoop you aboard, then carry you.
- **Every building has its own gravity.** Each block knows which way is up
  for it: rooms and passages are upright, decks, cars and halls carry their
  own frames. Walk (or jump, or fall) into a surface that is another
  building's floor and gravity turns to it: walk off the end of the ring's
  floor into the standing deck and you walk up it; walk down it into the
  floor and down is down again; step from the line onto the turned hall's
  floor and you stand on what was a wall.
- **Falling is caught.** Fall for more than a second with nothing below and
  the biwa sounds: a hall rushes up out of the dark, takes you in through
  its open roof, closes over you and brakes, and then Nakime slides it into
  a free node beside the maze, where it becomes part of the castle with new
  passages unfolding into it.
- **Physics** is a box against axis-aligned boxes, with gravity along any of
  six axes, step-up and ground snapping for the stairs, substeps so a long
  fall can't tunnel, and moving floors that carry you. Every orientation is
  a quarter turn, so a turned room's collision boxes stay axis-aligned. Fall out of the
  castle and Nakime drops you into a room somewhere else.
- **Rendering**: each room or passage is one merged mesh. Its vertices carry
  a material id and a moving part (door, rail gate, trapdoor) that the vertex
  shader slides, so doors move without separate meshes. One uber-shader
  paints wood, tatami, shoji, fusuma (gold clouds, seigaiha, crimson), roof
  tiles, chōchin lanterns and the Upper Moons' rooms procedurally, lit by
  the block's own lanterns. Beyond reach, ~3,700 instanced rooms (some
  upside down or on their side) step to new places on every strum. Post:
  bloom, then a pass for the strum's shockwave, colour fringing, a zoom blur
  and anime speed lines while you fall, teal/amber grading, vignette and
  grain. While you fall, the distant castle shifts several times a second. Resolution adapts to hold the frame rate.
- **Goal**: Tanjiro's nose (an arrow round the crosshair) points to the
  nearest Upper Moon's room. Find Kokushibo's moon hall, Doma's lotus pond
  and Akaza's ring and Nakime's chamber unseals; reach her and the castle is
  dragged up into the dawn.
- **Sound** is synthesised: a Karplus–Strong biwa with a buzzing attack, a
  long echo, sliding fusuma, rumbling rooms, steps, wind and Nakime's melody,
  positioned where she sits. The biwa (the strums that reshape the castle,
  and her melody) has its own bus, set well under the rest, with its own
  mute (`B`) and volume. Music (`N`) and all sound (`M`) mute separately
  too; the volumes are in the sound panel (the sliders chip, or the pause
  screen) and are remembered.
- **Music**: an original chase score (`score.ts`), scheduled ahead on the
  audio clock: odaiko and shime drums, a staccato biwa riff and a low men's
  chorus chanting long "nooo" calls answered by quick "to-no-no-no"s, all in
  the in scale. A quiet chant waits during the drop; the drums and biwa come
  in once the chase starts, harder when you run, fall or the castle moves,
  and a drum roll carries the finale. It has its own on/off toggle. To use a
  recording instead, put it at `public/audio/infinity-castle.mp3` (a track
  you have the rights to publish); it replaces the synthesised score.
- **Controls**: WASD / mouse (pointer lock, or drag where it's refused),
  Shift, Space, F, and B / N / M for the biwa, music and all sound. On touch: a floating joystick on the left (push far to
  run), drag on the right to look, tap to jump. Esc or losing focus pauses.

### Doon Diorama (`/apps/doon-diorama`)

- **One corner of Dehradun, walkable**: from the ISBT at Majra, past Shimla
  Bypass Chowk, down Turner Road to Clement Town Cantonment, its lake, and
  Mindrolling Monastery's Great Stupa. Pixel art in three.js, with an
  isekai-anime fantasy layer: the town floats on an island over a sea of
  cloud (`world/fantasy.ts`: rock tiers, hanging teeth, roots, waterfalls,
  drifting islets), warp crystals stand at the fast-travel points, magic
  motes and blossom petals drift by, pink kachnar and purple jacaranda
  are always in bloom, and a pillar of gold light stands on the quest.
- **The map is in metres** (`geo.ts`). It's anchored on published
  coordinates: the ISBT (30.28782, 77.99803), Raj Kumar Sweet Shop at 1
  Turner Road (30.28633, 77.99577) and Clement Town. The roads between them
  follow the real bearings and lengths (Saharanpur Road runs 29° off north
  past the ISBT; ISBT to the cantonment is about 2 km). Cake House is at
  81/2 Turner Road opposite Velmed; the lake is on the right inside the gate.
  Other positions (the lake's exact shape, the monastery's layout, where
  the side lanes go) are approximations, and every building between the
  landmarks is generated. Every point is one line in `geo.ts`, so correcting
  the map means moving a number; the world rebuilds from it.
- **Streamed in 64 m chunks** (`world/plan.ts`): the whole town is a seeded
  list of pieces (≈15,000) with collision known up front. Each chunk's
  pieces are merged into one mesh as you approach and freed behind you.
  Houses are Doon houses: plastered boxes, sunshades over the windows,
  balconies, black Sintex tanks, stair towers, washing lines, rebar left
  for the next floor, bougainvillea over compound walls, shop boards in
  English and Hindi.
- **The camera** orbits you like a third-person camera: drag (mouse, or the
  right half of a touch screen) to turn it round and tilt it from a low view
  to nearly top-down. The minimap is a compass that turns with it, showing
  your friend, the quest star and the warp crystals.
- **The pixel look** (`render/`): the scene is rendered small, a whole
  number of screen pixels to each scene pixel. The camera is snapped to
  that grid and the post pass shifts by the sub-pixel remainder, so it moves
  smoothly with no shimmer. The cloud sea is ray-cast in the post pass, so
  it stays put as the camera turns. Toon shading in bands, violet ink outlines where
  depth jumps, halos round lamps and crystals, an ordered dither. Anything
  between you and the camera dissolves in a dither.
- **Day, night and weather** (`env.ts`): the sun follows real solar geometry
  for 30.28° N on December 21st (it sets about 5:20 pm), so the red winter
  evening comes at the hour it does in Dehradun. Clear, cloudy, rain (pixel
  streaks, splashes, ripples, wet ground, lightning and thunder) and winter
  fog blend into each other. In Auto they change every few game hours, or
  you can set them from the time & weather panel. Street lights, windows,
  the lake fountain and the stupa's strings of bulbs come on at dusk.
- **Two people**, drawn as chibi anime adventurers (`actors/character.ts`):
  you in a traveller's cloak with a wooden sword, just off the bus, and your
  friend in a long coat with a red bow, waiting on a bench by the lake
  (`story.ts`; her name is a constant). Cape, scarf and long hair stream
  out behind when you run. She wants Cake House's
  patties; then the two of you walk to the Great Stupa. Lines change with
  the hour and the weather. Buses, Vikrams, cars and scooters keep left and
  stop for you.
- **Sound** is synthesised: rain, wind, birds by day, crickets at night,
  thunder, horns near the big roads, a singing bowl near the monastery.
- **Controls**: WASD / arrows, Shift to run, drag to look around, E to talk,
  buy or warp, wheel to zoom, M for the map and fast travel, T for time and
  weather. On touch: drag the left half to walk, the right half to look,
  tap Use.
- **Multiplayer** (other people roaming, friends) needs a WebSocket backend;
  this is the frontend only.

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
