import { create } from "zustand"
import { persist } from "zustand/middleware"
import { safeStorage } from "@/os/kernel/storage"
import type { Layout } from "@/os/desktop/icon-grid"

export const WALLPAPERS = [
  { id: "hills", name: "Doon hills" },
  { id: "desk", name: "Night desk" },
  { id: "pixel", name: "Pixel era" },
  { id: "plain", name: "Plain" },
] as const

export type WallpaperId = (typeof WALLPAPERS)[number]["id"]

/**
 * Visitor preferences for the OS. Theme stays in `use-theme` (it has to apply
 * before first paint, from index.html); everything else lives here.
 */
type Settings = {
  /** Open desktop icons with one click or two. */
  clickMode: "single" | "double"
  /** Let the autopilot cursor demo the apps when nobody is driving. */
  autopilot: boolean
  wallpaper: WallpaperId
  /** Where the visitor dragged desktop icons, per grid size (`gridKey`). */
  iconLayouts: Record<string, Layout>
  setClickMode: (mode: Settings["clickMode"]) => void
  setAutopilot: (on: boolean) => void
  setWallpaper: (id: WallpaperId) => void
  cycleWallpaper: () => void
  setIconLayout: (gridKey: string, layout: Layout) => void
  /** "Clean up": forget the dragged positions for this grid size. */
  resetIconLayout: (gridKey: string) => void
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      clickMode: "double",
      autopilot: true,
      wallpaper: "hills",
      iconLayouts: {},
      setClickMode: (clickMode) => set({ clickMode }),
      setAutopilot: (autopilot) => set({ autopilot }),
      setWallpaper: (wallpaper) => set({ wallpaper }),
      cycleWallpaper: () =>
        set((s) => {
          const i = WALLPAPERS.findIndex((w) => w.id === s.wallpaper)
          return { wallpaper: WALLPAPERS[(i + 1) % WALLPAPERS.length].id }
        }),
      setIconLayout: (gridKey, layout) => set((s) => ({ iconLayouts: { ...s.iconLayouts, [gridKey]: layout } })),
      resetIconLayout: (gridKey) =>
        set((s) => {
          const { [gridKey]: _, ...rest } = s.iconLayouts
          return { iconLayouts: rest }
        }),
    }),
    {
      name: "os:settings:v1",
      storage: safeStorage(),
      // An unknown wallpaper id (renamed, removed) falls back to the default.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Settings>
        const wallpaper = WALLPAPERS.some((w) => w.id === p.wallpaper) ? p.wallpaper! : current.wallpaper
        return { ...current, ...p, wallpaper }
      },
    }
  )
)
