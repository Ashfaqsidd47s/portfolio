import * as React from "react"
import { motion, useReducedMotion } from "motion/react"
import { useClock } from "@/os/hooks"

const ACTIVITY = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const

/**
 * True after `ms` without input while the tab is visible. Any input, or the
 * tab coming back into view, starts the count again.
 */
export function useIdle(ms: number, enabled: boolean) {
  const [idle, setIdle] = React.useState(false)

  React.useEffect(() => {
    if (!enabled) return
    let timer = 0
    const arm = () => {
      window.clearTimeout(timer)
      if (document.visibilityState === "visible") timer = window.setTimeout(() => setIdle(true), ms)
    }
    const wake = () => {
      setIdle(false)
      arm()
    }
    wake()
    for (const type of ACTIVITY) window.addEventListener(type, wake, { passive: true })
    document.addEventListener("visibilitychange", wake)
    return () => {
      window.clearTimeout(timer)
      for (const type of ACTIVITY) window.removeEventListener(type, wake)
      document.removeEventListener("visibilitychange", wake)
    }
  }, [ms, enabled])

  return idle && enabled
}

/** A badge that drifts and bounces off the edges, written straight to the DOM each frame. */
function Bouncer() {
  const ref = React.useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  React.useEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent || reduced) return
    let x = parent.clientWidth * 0.3
    let y = parent.clientHeight * 0.3
    let vx = 1.4
    let vy = 1.1
    let hue = 180
    let frame = 0
    const step = () => {
      const maxX = parent.clientWidth - el.offsetWidth
      const maxY = parent.clientHeight - el.offsetHeight
      x += vx
      y += vy
      if (x <= 0 || x >= maxX) {
        vx = -vx
        hue = (hue + 67) % 360
      }
      if (y <= 0 || y >= maxY) {
        vy = -vy
        hue = (hue + 67) % 360
      }
      x = Math.min(Math.max(x, 0), maxX)
      y = Math.min(Math.max(y, 0), maxY)
      el.style.transform = `translate(${x}px, ${y}px)`
      el.style.backgroundColor = `hsl(${hue} 90% 65%)`
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [reduced])

  return (
    <div
      ref={ref}
      className="absolute left-0 top-0 grid size-20 place-items-center rounded-2xl bg-[#3ee6ff] text-2xl font-bold text-[#0b0a1f]"
      style={reduced ? { left: "calc(50% - 2.5rem)", top: "30%" } : undefined}
    >
      MA
    </div>
  )
}

/**
 * Shown after a while with nobody at the desk. Once the autopilot (Phase 4)
 * is running it becomes the screensaver, so the shell only enables this
 * when the autopilot isn't driving.
 */
export function Screensaver() {
  const now = useClock()
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.8 } }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      className="fixed inset-0 z-[2500] overflow-hidden bg-[#0b0a1f] text-[#f6eedd]"
    >
      <Bouncer />
      <div className="absolute inset-x-0 bottom-12 text-center">
        <p className="text-5xl font-light tabular-nums">
          {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </p>
        <p className="mt-2 text-xs text-white/50">Move the mouse or press a key to wake</p>
      </div>
    </motion.div>
  )
}
