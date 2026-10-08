import { createStore, useStore } from "zustand"

/**
 * - `idle`: never started this visit.
 * - `running`: driving the OS.
 * - `paused`: the visitor took over; may offer to resume.
 */
export type AutopilotStatus = "idle" | "running" | "paused"

type State = {
  status: AutopilotStatus
  /** Index into the playlist of the tour being played (or to play next). */
  index: number
  /** Name of the tour and step, for the debug overlay. */
  step: string
  /** Caption bubble next to the cursor, if any. */
  caption: string | null
  /** The "Resume the tour?" prompt is showing. */
  offering: boolean
  /** The visitor said no to resuming; don't ask again this visit. */
  declined: boolean
  /** The last tour that failed and why (debug overlay). */
  error: string | null
}

export const autopilotStore = createStore<State>()(() => ({
  status: "idle",
  index: 0,
  step: "",
  caption: null,
  offering: false,
  declined: false,
  error: null,
}))

export function useAutopilot<T>(selector: (s: State) => T): T {
  return useStore(autopilotStore, selector)
}
