import * as React from "react"
import { motion, useAnimate } from "motion/react"
import { fontsReady } from "./cards"
import { useShell, type Shell } from "./shell"
import { EASE } from "./ui"

const LETTERS = [
  { ch: "1", italic: false },
  { ch: "1", italic: false },
  { ch: "b", italic: true },
  { ch: "i", italic: true },
  { ch: "d", italic: true },
  { ch: "s", italic: true },
]

type Phase = Shell["splash"]
const ORDER: Phase[] = ["text", "nav", "settle", "done"]

/**
 * The opening, a step at a time: "11bids" rises in the middle of the app,
 * shrinks to the logo's size, moves up to the header, the header unfolds out
 * of it, then it slides into the logo's place (as the first lot pours in)
 * and the logo takes over. A click skips to the end.
 */
export function Splash({ logo, phase, setPhase }: { logo: React.RefObject<HTMLElement | null>; phase: Phase; setPhase: (p: Phase) => void }) {
  const { reduced, width } = useShell()
  const [scope, animate] = useAnimate<HTMLParagraphElement>()
  const [ready, setReady] = React.useState(false)
  const [skip, setSkip] = React.useState(false)

  // Phases only move forward, whichever of the sequence or a skip gets there first.
  const advance = React.useEffectEvent((next: Phase) => {
    if (ORDER.indexOf(next) > ORDER.indexOf(phase)) setPhase(next)
  })

  React.useEffect(() => {
    let live = true
    void fontsReady().then(() => live && setReady(true))
    return () => {
      live = false
    }
  }, [])

  const run = React.useEffectEvent(async (isLive: () => boolean) => {
    const el = scope.current
    const dest = logo.current?.getBoundingClientRect()
    const from = el?.getBoundingClientRect()
    if (reduced || !el || !dest || !from?.width) {
      advance("settle")
      return advance("done")
    }
    // The letters have just risen; give them a beat.
    await new Promise((r) => window.setTimeout(r, 900))
    if (!isLive()) return
    const ease = EASE as [number, number, number, number]
    await animate(el, { scale: dest.width / from.width }, { duration: 0.4, ease })
    if (!isLive()) return
    const dy = dest.top + dest.height / 2 - (from.top + from.height / 2)
    await animate(el, { y: dy }, { duration: 0.4, ease })
    if (!isLive()) return
    advance("nav")
    await new Promise((r) => window.setTimeout(r, 320))
    if (!isLive()) return
    advance("settle")
    const dx = dest.left + dest.width / 2 - (from.left + from.width / 2)
    await animate(el, { x: dx }, { duration: 0.5, ease })
    if (isLive()) advance("done")
  })

  React.useEffect(() => {
    if (!ready) return
    let live = true
    void run(() => live)
    return () => {
      live = false
    }
  }, [ready])

  React.useEffect(() => {
    if (!skip) return
    advance("settle")
    advance("done")
  }, [skip])

  return (
    <div className="absolute inset-0 z-50 grid place-items-center" onClick={() => setSkip(true)} aria-hidden>
      <p
        ref={scope}
        className="font-eb-serif leading-none tracking-tight text-eb-ivory"
        // A dark halo, so the mark reads over the header as it unfolds beneath.
        style={{ fontSize: Math.min(width * 0.17, 210), textShadow: "0 0 0.3em #0b0a09, 0 0 0.12em #0b0a09" }}
      >
        {LETTERS.map((l, i) => (
          <motion.span
            key={i}
            className={l.italic ? "inline-block italic" : "inline-block"}
            initial={{ opacity: 0, y: "0.3em", filter: "blur(10px)" }}
            animate={ready ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
            transition={{ duration: reduced ? 0.01 : 0.55, ease: EASE, delay: reduced ? 0 : 0.05 + i * 0.045 }}
          >
            {l.ch}
          </motion.span>
        ))}
      </p>
    </div>
  )
}
