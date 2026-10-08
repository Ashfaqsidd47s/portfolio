import * as React from "react"
import { AnimatePresence, motion, useTransform } from "motion/react"
import { DEBUG } from "./engine"
import { cursor, onRipple } from "./pointer"
import { useAutopilot } from "./store"

const BUBBLE_W = 260

function Ripples() {
  const [ripples, setRipples] = React.useState<{ id: number; x: number; y: number }[]>([])
  React.useEffect(
    () =>
      onRipple((r) => {
        setRipples((rs) => [...rs, r])
        window.setTimeout(() => setRipples((rs) => rs.filter((x) => x.id !== r.id)), 600)
      }),
    []
  )
  return ripples.map((r) => (
    <motion.span
      key={r.id}
      className="absolute size-8 rounded-full border-2 border-ring"
      style={{ left: r.x - 16, top: r.y - 16 }}
      initial={{ scale: 0.3, opacity: 0.9 }}
      animate={{ scale: 1.6, opacity: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    />
  ))
}

/**
 * The autopilot's pointer, ripples and caption, in a layer above the
 * windows that never catches events. The caption is also written to a
 * polite live region for screen readers.
 */
export function AutopilotCursor() {
  const caption = useAutopilot((s) => s.caption)
  const scale = useTransform(cursor.pressed, [0, 1], [1, 0.82])
  // Keep the caption on screen near the right and bottom edges.
  const bubbleX = useTransform(cursor.x, (x) => (x + 22 + BUBBLE_W > window.innerWidth ? x - BUBBLE_W - 8 : x + 22))
  const bubbleY = useTransform(cursor.y, (y) => Math.min(y + 26, window.innerHeight - 72))

  return (
    <div aria-hidden={!caption} className="pointer-events-none fixed inset-0 z-[2400] overflow-hidden">
      <Ripples />
      <motion.div className="absolute left-0 top-0" style={{ x: cursor.x, y: cursor.y, opacity: cursor.opacity }}>
        <motion.svg
          width="26"
          height="31"
          viewBox="0 0 22 26"
          style={{ scale, originX: 0, originY: 0 }}
          className="drop-shadow-[0_2px_3px_rgb(0_0_0/0.35)]"
        >
          <path d="M1.5 1.5 L1.5 20 L6.4 15.6 L9.6 23.2 L13 21.8 L9.9 14.4 L16.6 14.4 Z" fill="#0b0a1f" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
        </motion.svg>
      </motion.div>
      <AnimatePresence>
        {caption && (
          <motion.p
            key={caption}
            className="absolute left-0 top-0 rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium leading-snug text-background shadow-lg"
            style={{ x: bubbleX, y: bubbleY, maxWidth: BUBBLE_W, opacity: cursor.opacity }}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9, opacity: 0, transition: { duration: 0.12 } }}
          >
            {caption}
          </motion.p>
        )}
      </AnimatePresence>
      <p className="sr-only" aria-live="polite">
        {caption}
      </p>
      {DEBUG && <DebugOverlay />}
    </div>
  )
}

function DebugOverlay() {
  const s = useAutopilot((s) => s)
  return (
    <pre className="absolute bottom-2 left-2 rounded-md bg-black/80 p-2 font-mono text-[0.6875rem] leading-relaxed text-green-300">
      {`autopilot: ${s.status}\ntour #${s.index}: ${s.step}\noffering: ${s.offering}${s.error ? `\nlast error: ${s.error}` : ""}`}
    </pre>
  )
}
