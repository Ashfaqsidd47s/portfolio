import { create } from "zustand"
import { persist } from "zustand/middleware"
import { safeStorage } from "@/os/kernel/storage"

export type WallpaperId = "hills" | "pixel" | "blueprint" | "plain"

/** Where the visitor dropped an icon: a grid cell counted from the left or right edge. */
export type IconCell = { side: "left" | "right"; col: number; row: number }

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
  /** Show the screensaver after a while with no input. */
  screensaver: boolean
  /** The boot sequence has played once; later visits skip it. */
  booted: boolean
  /** Icons the visitor moved. Anything missing sits in its default spot. */
  iconCells: Record<string, IconCell>
  setClickMode: (mode: Settings["clickMode"]) => void
  setAutopilot: (on: boolean) => void
  setWallpaper: (id: WallpaperId) => void
  setScreensaver: (on: boolean) => void
  setBooted: (booted: boolean) => void
  /** Pin icons to cells — several at once, so a swap is one update. */
  placeIcons: (cells: Record<string, IconCell>) => void
  cleanUpIcons: () => void
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      clickMode: "double",
      autopilot: true,
      wallpaper: "hills",
      screensaver: true,
      booted: false,
      iconCells: {},
      setClickMode: (clickMode) => set({ clickMode }),
      setAutopilot: (autopilot) => set({ autopilot }),
      setWallpaper: (wallpaper) => set({ wallpaper }),
      setScreensaver: (screensaver) => set({ screensaver }),
      setBooted: (booted) => set({ booted }),
      placeIcons: (cells) => set((s) => ({ iconCells: { ...s.iconCells, ...cells } })),
      cleanUpIcons: () => set({ iconCells: {} }),
    }),
    {
      name: "os:settings:v1",
      storage: safeStorage(),
      partialize: ({ clickMode, autopilot, wallpaper, screensaver, booted, iconCells }) => ({
        clickMode,
        autopilot,
        wallpaper,
        screensaver,
        booted,
        iconCells,
      }),
    }
  )
)
