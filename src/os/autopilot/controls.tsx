import { AnimatePresence, motion } from "motion/react"
import { Pause, Play, SkipForward, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSettings } from "@/os/store/settings"
import { nextTour, pauseAutopilot, resumeAutopilot, startAutopilot } from "./engine"
import { autopilotStore, useAutopilot } from "./store"
import { OFFER_FOR } from "./use-autopilot"

const ICON_BUTTON = "grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"

/**
 * The autopilot's place in the menu bar: while it drives, a pill saying so
 * with pause / next / off; otherwise a button to start the tour.
 */
export function AutopilotControls() {
  const status = useAutopilot((s) => s.status)
  const setAutopilot = useSettings((s) => s.setAutopilot)

  if (status !== "running") {
    return (
      <button
        type="button"
        data-autopilot-controls
        onClick={() => {
          setAutopilot(true)
          if (status === "idle") startAutopilot(0)
          else resumeAutopilot()
        }}
        title="Let the autopilot show you around"
        className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium hover:bg-muted"
      >
        <Play className="size-3" aria-hidden /> {status === "idle" ? "Take the tour" : "Resume tour"}
      </button>
    )
  }

  return (
    <div
      data-autopilot-controls
      role="group"
      aria-label="Autopilot"
      className="flex h-7 items-center gap-1 rounded-full border border-border bg-surface pl-2.5 pr-1 text-xs"
    >
      <span className="relative mr-0.5 flex size-2" aria-hidden>
        <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative size-2 rounded-full bg-accent" />
      </span>
      <span className="font-medium">Autopilot</span>
      <span className="hidden text-muted-foreground xl:inline">· touch anything to take over</span>
      <button type="button" aria-label="Pause the tour" title="Pause" onClick={pauseAutopilot} className={cn(ICON_BUTTON, "ml-1")}>
        <Pause className="size-3" />
      </button>
      <button type="button" aria-label="Next app" title="Next app" onClick={nextTour} className={ICON_BUTTON}>
        <SkipForward className="size-3" />
      </button>
      <button
        type="button"
        aria-label="Turn the autopilot off"
        title="Turn off"
        onClick={() => {
          pauseAutopilot()
          setAutopilot(false)
        }}
        className={ICON_BUTTON}
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

/** "Resume the tour?" — resumes on click, or by itself when the bar runs out. */
export function ResumeOffer() {
  const offering = useAutopilot((s) => s.offering)
  return (
    <AnimatePresence>
      {offering && (
        <motion.div
          data-autopilot-controls
          role="status"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-6 left-1/2 z-[2300] w-80 -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-elevated shadow-lg"
        >
          <div className="flex items-center gap-3 p-3">
            <p className="flex-1 whitespace-nowrap text-sm font-medium">Resume the tour?</p>
            <button
              type="button"
              onClick={() => autopilotStore.setState({ offering: false, declined: true })}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              No thanks
            </button>
            <button
              type="button"
              onClick={resumeAutopilot}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              Resume
            </button>
          </div>
          <motion.div
            className="h-0.5 origin-left bg-accent"
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: OFFER_FOR / 1000, ease: "linear" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
