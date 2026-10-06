import * as React from "react"
import { useSettings } from "@/os/store/settings"
import { useUi } from "@/os/store/ui"

export const IDLE_MS = 90_000

export const ACTIVITY = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const

/**
 * Turns the screensaver on after IDLE_MS with no input while the tab is
 * visible. (When the autopilot lands it takes this slot: an idle desktop
 * will demo itself instead.)
 */
export function useScreensaverTimer() {
  const enabled = useSettings((s) => s.screensaver)

  React.useEffect(() => {
    if (!enabled) return
    let timer = 0
    const arm = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        const ui = useUi.getState()
        if (document.hidden || ui.booting || ui.spotlightOpen || ui.aboutOpen) return arm()
        ui.setScreensaverOn(true)
      }, IDLE_MS)
    }
    arm()
    ACTIVITY.forEach((e) => window.addEventListener(e, arm, { passive: true }))
    document.addEventListener("visibilitychange", arm)
    return () => {
      window.clearTimeout(timer)
      ACTIVITY.forEach((e) => window.removeEventListener(e, arm))
      document.removeEventListener("visibilitychange", arm)
    }
  }, [enabled])
}
