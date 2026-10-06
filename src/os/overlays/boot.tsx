import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { useSettings } from "@/os/store/settings"
import { useUi } from "@/os/store/ui"

const DURATION = 1500

const LINES = [
  "mounting /apps …",
  "starting window manager …",
  "seeding demo data …",
  "warming up TrypNow …",
  "ready",
]

/**
 * The first-visit boot: logo, a progress bar and a few terminal lines — the
 * journey's Turbo C++ boot, grown up. Any key or click skips it. It plays
 * once per visitor, and again from "Restart…".
 */
export function BootScreen() {
  const booting = useUi((s) => s.booting)
  return <AnimatePresence>{booting && <Boot />}</AnimatePresence>
}

function Boot() {
  const [progress, setProgress] = React.useState(0)
  const done = React.useRef(false)

  const finish = React.useCallback(() => {
    if (done.current) return
    done.current = true
    useSettings.getState().setBooted(true)
    useUi.getState().setBooting(false)
  }, [])

  React.useEffect(() => {
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION)
      setProgress(p)
      if (p < 1) raf = requestAnimationFrame(tick)
      else window.setTimeout(finish, 250)
    }
    raf = requestAnimationFrame(tick)
    const skip = (e: Event) => {
      e.preventDefault()
      finish()
    }
    window.addEventListener("keydown", skip)
    window.addEventListener("pointerdown", skip)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("keydown", skip)
      window.removeEventListener("pointerdown", skip)
    }
  }, [finish])

  const lines = LINES.slice(0, Math.ceil(progress * LINES.length))

  return (
    <motion.div
      role="status"
      aria-label="Starting Ashfaq OS"
      data-tour="boot"
      className="fixed inset-0 z-[1300] grid cursor-default place-items-center bg-[#0b0d12] text-white"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
    >
      <div className="flex w-64 flex-col items-center">
        <motion.span
          className="grid size-16 place-items-center rounded-2xl bg-white text-xl font-bold text-[#0b0d12]"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
        >
          MA
        </motion.span>
        <p className="mt-4 text-sm font-semibold tracking-tight">Ashfaq OS</p>
        <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-white" style={{ width: `${progress * 100}%` }} />
        </div>
        <ul aria-hidden className="mt-4 h-24 w-full font-mono text-[0.6875rem] leading-relaxed text-white/50">
          {lines.map((l, i) => (
            <li key={l} className={i === LINES.length - 1 ? "text-emerald-300" : undefined}>
              {i === LINES.length - 1 ? "✓ " : "› "}
              {l}
            </li>
          ))}
        </ul>
        <p className="text-[0.6875rem] text-white/40">Press any key to skip</p>
      </div>
    </motion.div>
  )
}
