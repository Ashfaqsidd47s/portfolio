import type { WallpaperId } from "@/os/store/settings"

/** The wallpapers on offer, in picker order. Each is drawn in `wallpaper.tsx`. */
export const WALLPAPERS: { id: WallpaperId; name: string; blurb: string }[] = [
  { id: "hills", name: "Doon hills", blurb: "The ridgeline from Dehradun to Mussoorie" },
  { id: "pixel", name: "Pixel era", blurb: "Where the journey started — Turbo C++ days" },
  { id: "blueprint", name: "Blueprint", blurb: "Graph paper and wireframes" },
  { id: "plain", name: "Plain", blurb: "Nothing but a calm colour" },
]
