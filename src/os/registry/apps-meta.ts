/**
 * Plain data about every app on the OS — no React, no imports — so the Vite
 * config can read it to build the sitemap. Icons and loaders live in
 * `apps.ts`, which spreads these entries.
 */

export type AppKind = "project" | "side-project" | "system"

export type WindowDefaults = {
  width: number
  height: number
  minWidth: number
  minHeight: number
}

export type AppMeta = {
  /** URL slug: the app lives at /apps/<id>. */
  id: string
  name: string
  /** One line, used for the page description and tooltips. */
  description: string
  kind: AppKind
  /** Which desktop icon column the app sits in. */
  column: "left" | "right"
  /** Name of the matching entry in `profile.projects` / `sideProjects`. */
  project?: string
  /** Opens a full page instead of a window (the journey, the printable résumé). */
  href?: string
  window: WindowDefaults
}

const PROJECT_WINDOW: WindowDefaults = { width: 1080, height: 720, minWidth: 420, minHeight: 420 }
const INFO_WINDOW: WindowDefaults = { width: 620, height: 600, minWidth: 360, minHeight: 360 }

export const appsMeta: AppMeta[] = [
  {
    id: "trypnow",
    name: "TrypNow",
    description: "B2B travel booking for DMCs and travel agents — build packages, list attractions with AI, take bookings.",
    kind: "project",
    column: "left",
    project: "TrypNow",
    window: PROJECT_WINDOW,
  },
  {
    id: "suregem",
    name: "SureGem",
    description: "Multi-vendor diamond and fine-jewelry marketplace.",
    kind: "project",
    column: "left",
    project: "SureGem",
    window: INFO_WINDOW,
  },
  {
    id: "11jobs",
    name: "11Jobs",
    description: "AI-driven hiring assessment platform with an MCP chatbot.",
    kind: "project",
    column: "left",
    project: "11Jobs",
    window: INFO_WINDOW,
  },
  {
    id: "11matrix",
    name: "11Matrix",
    description: "Unified commerce and analytics OS for multi-store Shopify brands.",
    kind: "project",
    column: "left",
    project: "11Matrix",
    window: INFO_WINDOW,
  },
  {
    id: "fujin",
    name: "Fujin",
    description: "Feature-first React registry and CLI.",
    kind: "side-project",
    column: "right",
    project: "Fujin",
    window: INFO_WINDOW,
  },
  {
    id: "bingo-master",
    name: "Bingo Master",
    description: "Real-time multiplayer Bingo over raw WebSockets.",
    kind: "side-project",
    column: "right",
    project: "Bingo Master",
    window: INFO_WINDOW,
  },
  {
    id: "gaming-era",
    name: "Gaming Era",
    description: "Social platform for gamers with real-time chat and WebRTC video.",
    kind: "side-project",
    column: "right",
    project: "Gaming Era",
    window: INFO_WINDOW,
  },
  {
    id: "file-scanner",
    name: "File Scanner",
    description: "Secure upload and asynchronous malware-scanning dashboard.",
    kind: "side-project",
    column: "right",
    project: "File Scanner",
    window: INFO_WINDOW,
  },
  {
    id: "about",
    name: "About me",
    description: "Who I am, what I work on, and how to reach me.",
    kind: "system",
    column: "right",
    window: { width: 640, height: 640, minWidth: 360, minHeight: 360 },
  },
  {
    id: "settings",
    name: "Settings",
    description: "Wallpaper, theme, how icons open, the screensaver, and resetting the demos.",
    kind: "system",
    column: "right",
    window: { width: 720, height: 640, minWidth: 380, minHeight: 420 },
  },
  {
    id: "resume",
    name: "Résumé",
    description: "Printable résumé with a PDF download.",
    kind: "system",
    column: "right",
    href: "/resume",
    window: INFO_WINDOW,
  },
  {
    id: "journey",
    name: "Journey.exe",
    description: "My developer journey from Turbo C++ to today, as a scroll-through pixel game.",
    kind: "system",
    column: "right",
    href: "/journey",
    window: INFO_WINDOW,
  },
]

/** Routes that render the OS with a window open — the sitemap lists these. */
export const windowAppPaths = appsMeta.filter((a) => !a.href).map((a) => `/apps/${a.id}`)
