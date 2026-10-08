import * as React from "react"
import { motion, useReducedMotion } from "motion/react"
import { create } from "zustand"

const BOOTED_KEY = "os:booted:v1"
const LINES = ["Mounting projects…", "Loading apps…", "Starting desktop…"]

function hasBooted() {
  try {
    return window.localStorage.getItem(BOOTED_KEY) === "1"
  } catch {
    return true
  }
}

/**
 * Boots on the very first visit to the bare desktop; deep links go straight
 * to their app. Decided once at load, so later navigation never re-boots.
 */
export const useBoot = create<{ booting: boolean; start: () => void; finish: () => void }>()((set) => ({
  booting: typeof window !== "undefined" && window.location.pathname === "/" && !hasBooted(),
  start: () => set({ booting: true }),
  finish: () => {
    try {
      window.localStorage.setItem(BOOTED_KEY, "1")
    } catch {
      /* non-fatal: it just boots again next time */
    }
    set({ booting: false })
  },
}))

/**
 * The ~1.5s boot: logo, progress bar, a few status lines, then the desktop
 * fades in. Any click or key skips it. Shown on the first visit and when
 * the visitor picks Restart from the logo menu.
 */
export function BootScreen() {
  const reduced = useReducedMotion()
  const finish = useBoot((s) => s.finish)
  const duration = reduced ? 400 : 1500
  const [line, setLine] = React.useState(0)

  React.useEffect(() => {
    const done = window.setTimeout(finish, duration)
    const tick = window.setInterval(() => setLine((l) => Math.min(l + 1, LINES.length - 1)), duration / LINES.length)
    const skip = (e: Event) => {
      if (e instanceof KeyboardEvent && (e.metaKey || e.ctrlKey || e.altKey)) return
      finish()
    }
    window.addEventListener("pointerdown", skip)
    window.addEventListener("keydown", skip)
    return () => {
      window.clearTimeout(done)
      window.clearInterval(tick)
      window.removeEventListener("pointerdown", skip)
      window.removeEventListener("keydown", skip)
    }
  }, [finish, duration])

  return (
    <motion.div
      role="status"
      aria-label="Starting Ashfaq OS"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      className="fixed inset-0 z-[3000] grid cursor-default place-items-center bg-[#0b0a1f] text-[#f6eedd]"
    >
      <div className="flex w-56 flex-col items-center">
        <motion.span
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className="grid size-16 place-items-center rounded-2xl bg-[#f6eedd] text-xl font-bold text-[#0b0a1f]"
        >
          MA
        </motion.span>
        <p className="mt-4 text-sm font-semibold tracking-tight">Ashfaq OS</p>
        <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-white/15">
          <motion.div
            className="h-full origin-left rounded-full bg-[#3ee6ff]"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: duration / 1000, ease: [0.4, 0, 0.2, 1] }}
          />
        </div>
        <p className="mt-3 h-4 font-mono text-[0.6875rem] text-white/60">{LINES[line]}</p>
        <p className="mt-8 text-[0.6875rem] text-white/40">Press any key to skip</p>
      </div>
    </motion.div>
  )
}
