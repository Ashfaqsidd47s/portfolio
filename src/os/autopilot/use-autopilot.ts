import * as React from "react"
import { useReducedMotion } from "motion/react"
import { useSettings } from "@/os/store/settings"
import { lastPointer, pauseAutopilot, resumeAutopilot, startAutopilot } from "./engine"
import { autopilotStore } from "./store"

/** Quiet time after boot before the tour starts by itself. */
export const START_AFTER = 3000
/** Quiet time after a hand-over before offering to resume. */
export const OFFER_AFTER = 25_000
/** How long the offer waits before resuming on its own. */
export const OFFER_FOR = 10_000
/** Real pointer travel that counts as taking over (filters out sensor jitter). */
const MOVE_THRESHOLD = 4

const inControls = (e: Event) => Boolean((e.target as Element | null)?.closest?.("[data-autopilot-controls]"))

/**
 * Runs the autopilot on the desktop:
 * - starts it a few seconds after boot if nobody has touched anything (not
 *   on deep links, not with reduced motion, not if the visitor turned it off);
 * - hands over the instant a real person moves, clicks, scrolls or types —
 *   the engine's own events are untrusted, so they never count;
 * - offers to resume after a quiet spell, and resumes by itself if ignored.
 */
export function useAutopilotDriver({ ready, deepLink }: { ready: boolean; deepLink: boolean }) {
  const enabled = useSettings((s) => s.autopilot)
  const reduced = useReducedMotion()
  const touched = React.useRef(false)
  const lastActivity = React.useRef(0)

  // Hand-over, and noting that the visitor is here.
  React.useEffect(() => {
    lastActivity.current = Date.now()
    let anchor: { x: number; y: number } | null = null
    const onInput = (e: Event) => {
      if (!e.isTrusted) return
      if (e instanceof PointerEvent && e.type === "pointermove") {
        lastPointer.x = e.clientX
        lastPointer.y = e.clientY
        if (!anchor) {
          anchor = { x: e.clientX, y: e.clientY }
          return
        }
        if (Math.hypot(e.clientX - anchor.x, e.clientY - anchor.y) < MOVE_THRESHOLD) return
        anchor = { x: e.clientX, y: e.clientY }
      }
      touched.current = true
      lastActivity.current = Date.now()
      if (inControls(e)) return
      const { status, offering } = autopilotStore.getState()
      if (status === "running") pauseAutopilot()
      // Moving towards the offer is fine; doing something else turns it down for now.
      else if (offering && e.type !== "pointermove") autopilotStore.setState({ offering: false })
    }
    const types = ["pointermove", "pointerdown", "wheel", "keydown", "touchstart"] as const
    for (const t of types) window.addEventListener(t, onInput, { capture: true, passive: true })
    const onHidden = () => document.visibilityState === "hidden" && pauseAutopilot()
    document.addEventListener("visibilitychange", onHidden)
    return () => {
      for (const t of types) window.removeEventListener(t, onInput, { capture: true })
      document.removeEventListener("visibilitychange", onHidden)
    }
  }, [])

  // Turning the setting off stops a running tour.
  React.useEffect(() => {
    if (!enabled) {
      pauseAutopilot()
      autopilotStore.setState({ offering: false })
    }
  }, [enabled])

  // First start.
  React.useEffect(() => {
    if (!ready || !enabled || reduced || deepLink || autopilotStore.getState().status !== "idle") return
    const id = window.setTimeout(() => {
      if (!touched.current && document.visibilityState === "visible") startAutopilot(0)
    }, START_AFTER)
    return () => window.clearTimeout(id)
  }, [ready, enabled, reduced, deepLink])

  // Offer to resume after a quiet spell; resume if the offer is ignored.
  React.useEffect(() => {
    if (!enabled || reduced) return
    let offeredAt = 0
    const id = window.setInterval(() => {
      const s = autopilotStore.getState()
      if (s.status !== "paused" || s.declined || document.visibilityState !== "visible") return
      if (!s.offering && Date.now() - lastActivity.current > OFFER_AFTER) {
        offeredAt = Date.now()
        autopilotStore.setState({ offering: true })
      } else if (s.offering && Date.now() - offeredAt > OFFER_FOR) resumeAutopilot()
    }, 500)
    return () => window.clearInterval(id)
  }, [enabled, reduced])
}
