import * as React from "react"
import { useTheme } from "@/hooks/use-theme"
import { closeWindow } from "@/os/hooks"
import { useSettings } from "@/os/store/settings"
import { selectFocusedId, windowsStore } from "@/os/store/windows"

/** Typing in a field must never move windows around. */
function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return Boolean(el?.closest?.("input, textarea, select, [contenteditable=''], [contenteditable='true']"))
}

export const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "⇧W", action: "Close window" },
  { keys: "⇧↑", action: "Maximise" },
  { keys: "⇧↓", action: "Restore, then minimise" },
  { keys: "⇧← / ⇧→", action: "Snap to the left / right half" },
  { keys: "⇧`", action: "Cycle through windows" },
  { keys: "⇧X", action: "Close all windows" },
  { keys: "M", action: "Light / dark mode" },
  { keys: "\\", action: "Next wallpaper" },
]

/**
 * The desktop's keyboard shortcuts, posthog.com-style: Shift plus a key for
 * window actions, single keys for display toggles. Browser combos (⌘, Ctrl,
 * Alt) are left alone, and so is Shift+Tab, which moves focus backwards.
 */
export function useShortcuts() {
  const { toggle: toggleTheme } = useTheme()
  const cycleWallpaper = useSettings((s) => s.cycleWallpaper)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return
      const store = windowsStore.getState()
      const focused = selectFocusedId(store)
      const run = (fn: () => void) => {
        e.preventDefault()
        fn()
      }

      if (e.shiftKey) {
        if (e.code === "Backquote") return run(store.cycle)
        if (e.code === "KeyX") return run(store.closeAll)
        if (!focused) return
        switch (e.code) {
          case "KeyW":
            return run(() => closeWindow(focused))
          case "ArrowUp":
            return run(() => store.maximize(focused))
          case "ArrowDown":
            return run(() => store.restore(focused))
          case "ArrowLeft":
            return run(() => store.snap(focused, "left"))
          case "ArrowRight":
            return run(() => store.snap(focused, "right"))
        }
        return
      }
      if (e.key === "m" || e.key === "M") return run(toggleTheme)
      if (e.key === "\\") return run(cycleWallpaper)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggleTheme, cycleWallpaper])
}
