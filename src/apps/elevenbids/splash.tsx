import * as React from "react"
import { motion } from "motion/react"
import { fontsReady } from "./cards"
import { useShell } from "./shell"
import { EASE } from "./ui"

const LETTERS = [
  { ch: "1", italic: false },
  { ch: "1", italic: false },
  { ch: "b", italic: true },
  { ch: "i", italic: true },
  { ch: "d", italic: true },
  { ch: "s", italic: true },
]

/**
 * The opening: "11bids" rises a letter at a time in the middle of the app,
 * holds, then flies up and shrinks into the header's logo, which takes over
 * as it lands. A click skips the wait.
 */
export function Splash({ logo, onFly, onDone }: { logo: React.RefObject<HTMLElement | null>; onFly: () => void; onDone: () => void }) {
  const { reduced, width } = useShell()
  const ref = React.useRef<HTMLParagraphElement>(null)
  const [ready, setReady] = React.useState(false)
  const [to, setTo] = React.useState<{ x: number; y: number; scale: number } | null>(null)
  const [skip, setSkip] = React.useState(false)

  React.useEffect(() => {
    let live = true
    void fontsReady().then(() => live && setReady(true))
    return () => {
      live = false
    }
  }, [])

  const fly = React.useEffectEvent(() => {
    const from = ref.current?.getBoundingClientRect()
    const dest = logo.current?.getBoundingClientRect()
    onFly()
    if (!from || !dest || !from.width || reduced) return onDone()
    setTo({ x: dest.left - from.left, y: dest.top - from.top, scale: dest.width / from.width })
  })

  React.useEffect(() => {
    if (!ready || to) return
    const id = window.setTimeout(fly, skip ? 0 : reduced ? 900 : 2300)
    return () => window.clearTimeout(id)
  }, [ready, to, skip, reduced])

  return (
    <div className="absolute inset-0 z-50 grid place-items-center" onClick={() => setSkip(true)} aria-hidden>
      <motion.p
        ref={ref}
        className="font-eb-serif leading-none tracking-tight text-eb-ivory"
        style={{ fontSize: Math.min(width * 0.17, 210), transformOrigin: "0 0" }}
        animate={to ?? { x: 0, y: 0, scale: 1 }}
        transition={{ duration: 1.1, ease: EASE }}
        onAnimationComplete={() => to && onDone()}
      >
        {LETTERS.map((l, i) => (
          <motion.span
            key={i}
            className={l.italic ? "inline-block italic" : "inline-block"}
            initial={{ opacity: 0, y: "0.3em", filter: "blur(10px)" }}
            animate={ready ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
            transition={{ duration: reduced ? 0.01 : 1, ease: EASE, delay: reduced ? 0 : 0.15 + i * 0.09 }}
          >
            {l.ch}
          </motion.span>
        ))}
      </motion.p>
    </div>
  )
}
