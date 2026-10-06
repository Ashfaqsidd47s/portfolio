import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { useClock } from "@/os/hooks"
import { useSettings } from "@/os/store/settings"
import { useUi } from "@/os/store/ui"
import { ACTIVITY } from "./idle"

const TINTS = ["#ff4d8d", "#2dd4bf", "#fbbf24", "#a78bfa", "#60a5fa", "#4ade80"]

/** The MA tile drifting and bouncing off the edges, recolouring on every bounce. */
function Bouncer() {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    let x = window.innerWidth * 0.3
    let y = window.innerHeight * 0.3
    let vx = 1.6
    let vy = 1.2
    let tint = 0
    let raf = 0
    const step = () => {
      const w = el.offsetWidth
      const h = el.offsetHeight
      x += vx
      y += vy
      let bounced = false
      if (x <= 0 || x + w >= window.innerWidth) {
        vx = -vx
        bounced = true
      }
      if (y <= 0 || y + h >= window.innerHeight) {
        vy = -vy
        bounced = true
      }
      if (bounced) {
        tint = (tint + 1) % TINTS.length
        el.style.setProperty("--tint", TINTS[tint])
      }
      el.style.transform = `translate(${x}px, ${y}px)`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      ref={ref}
      className="absolute left-0 top-0 flex items-center gap-3 [--tint:#ff4d8d]"
      style={{ transform: "translate(30vw, 30vh)" }}
    >
      <span className="grid size-14 place-items-center rounded-2xl bg-[var(--tint)] text-lg font-bold text-black/80 transition-colors duration-500">
        MA
      </span>
      <span className="text-lg font-semibold tracking-tight text-white/80">Ashfaq OS</span>
    </div>
  )
}

export function Screensaver() {
  const on = useUi((s) => s.screensaverOn)
  return <AnimatePresence>{on && <Saver />}</AnimatePresence>
}

function Saver() {
  const now = useClock()

  React.useEffect(() => {
    // Ignore the tail of whatever input was in flight when it appeared.
    const armedAt = performance.now()
    const wake = () => {
      if (performance.now() - armedAt < 400) return
      // Wake once: the overlay keeps listening while it fades out.
      ACTIVITY.forEach((e) => window.removeEventListener(e, wake))
      const ui = useUi.getState()
      ui.setScreensaverOn(false)
      if (!useSettings.getState().screensaver) return
      ui.toast(
        {
          title: "Screensaver dismissed",
          description: "Want it off for good?",
          action: {
            label: "Turn off",
            onClick: () => {
              useSettings.getState().setScreensaver(false)
              useUi.getState().toast({ title: "Screensaver off", description: "Turn it back on in Settings." })
            },
          },
        },
        8000
      )
    }
    ACTIVITY.forEach((e) => window.addEventListener(e, wake))
    return () => ACTIVITY.forEach((e) => window.removeEventListener(e, wake))
  }, [])

  return (
    <motion.div
      role="dialog"
      aria-label="Screensaver. Move the mouse or press a key to wake."
      data-tour="screensaver"
      className="fixed inset-0 z-[1200] cursor-none overflow-hidden bg-black/90"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <Bouncer />
      <p className="absolute bottom-10 left-1/2 -translate-x-1/2 text-center text-white/60">
        <span className="block text-5xl font-semibold tabular-nums tracking-tight text-white/85">
          {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className="mt-1 block text-xs">Move the mouse or press a key</span>
      </p>
    </motion.div>
  )
}
