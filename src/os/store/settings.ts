import { create } from "zustand"
import { persist } from "zustand/middleware"
import { safeStorage } from "@/os/kernel/storage"

/**
 * Visitor preferences for the OS. Theme stays in `use-theme` (it has to apply
 * before first paint, from index.html); everything else lives here.
 */
type Settings = {
  /** Open desktop icons with one click or two. */
  clickMode: "single" | "double"
  /** Let the autopilot cursor demo the apps when nobody is driving. */
  autopilot: boolean
  setClickMode: (mode: Settings["clickMode"]) => void
  setAutopilot: (on: boolean) => void
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      clickMode: "double",
      autopilot: true,
      setClickMode: (clickMode) => set({ clickMode }),
      setAutopilot: (autopilot) => set({ autopilot }),
    }),
    { name: "os:settings:v1", storage: safeStorage() }
  )
)
