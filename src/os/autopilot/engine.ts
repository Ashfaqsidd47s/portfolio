import { animate } from "motion/react"
import { windowsStore } from "@/os/store/windows"
import { createContext, type TourContext } from "./actions"
import { cursor } from "./pointer"
import { isAbort, runPlaylist, sleep } from "./run"
import { playlist } from "./scripts"
import { autopilotStore } from "./store"

let controller: AbortController | null = null

/** `?autopilot=debug` shows the current step and logs failures. */
export const DEBUG = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("autopilot") === "debug"

/** Where the visitor's real pointer last was, so the fake one appears there. */
export const lastPointer = { x: -1, y: -1 }

function showCursor() {
  if (cursor.opacity.get() === 0) {
    const fallback = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    cursor.x.set(lastPointer.x >= 0 ? lastPointer.x : fallback.x)
    cursor.y.set(lastPointer.y >= 0 ? lastPointer.y : fallback.y)
  }
  animate(cursor.opacity, 1, { duration: 0.25 })
}

function hideCursor() {
  cursor.pressed.set(0)
  animate(cursor.opacity, 0, { duration: 0.3 })
}

/** Start (or resume) the tour at playlist position `from`. */
export function startAutopilot(from = autopilotStore.getState().index) {
  if (controller) return
  const ctl = new AbortController()
  controller = ctl
  autopilotStore.setState({ status: "running", offering: false, caption: null, error: null })
  showCursor()

  runPlaylist<TourContext>(playlist, createContext(ctl.signal), {
    signal: ctl.signal,
    start: from,
    onTour: (index, tour) => autopilotStore.setState({ index, step: tour.name, caption: null }),
    onError: (tour, error) => {
      autopilotStore.setState({ error: `${tour.name}: ${error instanceof Error ? error.message : String(error)}` })
      if (DEBUG) console.warn("[autopilot]", tour.name, error)
      // Tours expect a clean desktop; don't leave a half-finished one behind.
      windowsStore.getState().closeAll()
    },
    between: async () => {
      autopilotStore.setState({ caption: "That's the tour. Touch anything to drive it yourself.", step: "between loops" })
      await sleep(3500, ctl.signal)
      windowsStore.getState().closeAll()
      autopilotStore.setState({ caption: null })
      await sleep(900, ctl.signal)
    },
  }).catch((e) => {
    if (!isAbort(e)) console.error("[autopilot]", e)
  })
}

/**
 * Stop driving right away — the visitor took over, the tab went away, or
 * they pressed pause. Whatever the tour opened stays open.
 */
export function pauseAutopilot() {
  if (!controller) return
  controller.abort()
  controller = null
  autopilotStore.setState({ status: "paused", caption: null })
  hideCursor()
}

/** Skip to the next app in the playlist. */
export function nextTour() {
  const { index } = autopilotStore.getState()
  pauseAutopilot()
  startAutopilot(index + 1)
}

/** Resume after a hand-over: the interrupted app is left as the visitor had it, so carry on with the next one. */
export function resumeAutopilot() {
  startAutopilot(autopilotStore.getState().index + 1)
}

export const isDriving = () => controller !== null
