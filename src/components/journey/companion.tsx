import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { CompanionContext, type Line, type Tone } from "./companion-context"
import { useTypewriter } from "./hooks"
import { PixelSprite } from "./primitives"
import { COMPANION } from "./sprites"

/**
 * Pixel-me, parked bottom-left like a chat widget. Every line of narration on
 * the page is delivered by him: sections call `say()` as they scroll into
 * view, he hops, and types it into his speech bubble.
 */

type Message = Line & { id: number }

const TONE: Record<Tone, string> = {
  pink: "bg-px-pink",
  cyan: "bg-px-cyan",
  yellow: "bg-px-yellow",
  green: "bg-px-green",
}

const GREETING: Line = {
  speaker: "PIXEL ASHFAQ",
  text: "Hey, I'm pixel-me. Scroll and I'll narrate. Click me if you miss a line.",
  tone: "pink",
}

export function CompanionProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = React.useState<Message | null>(null)
  const [open, setOpen] = React.useState(true)
  const nextId = React.useRef(0)

  const say = React.useCallback((line: Line) => {
    setMessage((m) => (m && m.text === line.text ? m : { ...line, id: ++nextId.current }))
    setOpen(true)
  }, [])

  // Say hello once the intro has had a moment.
  React.useEffect(() => {
    const id = window.setTimeout(() => say(GREETING), 1400)
    return () => window.clearTimeout(id)
  }, [say])

  return (
    <CompanionContext.Provider value={say}>
      {children}
      <Companion message={message} open={open} setOpen={setOpen} />
    </CompanionContext.Provider>
  )
}

function Bubble({ message, onClose }: { message: Message; onClose: () => void }) {
  const { shown, done } = useTypewriter(message.text, true, 55)
  const [skipped, setSkipped] = React.useState(false)
  const text = skipped ? message.text : shown
  const finished = skipped || done

  // Step out of the way once the line has had time to be read.
  React.useEffect(() => {
    if (!finished) return
    const id = window.setTimeout(onClose, Math.max(6000, message.text.length * 55))
    return () => window.clearTimeout(id)
  }, [finished, message.text.length, onClose])

  return (
    <motion.div
      className="pointer-events-auto relative mb-6 w-[min(24rem,calc(100vw-5.5rem))] sm:mb-8"
      initial={{ opacity: 0, scale: 0.8, x: -12 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9, x: -8 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      style={{ transformOrigin: "0% 100%" }}
    >
      <span
        className={cn(
          "retro absolute -top-3 left-4 z-10 px-2 py-1 text-[0.5rem] text-night",
          TONE[message.tone ?? "pink"]
        )}
      >
        {message.speaker}
      </span>
      <button
        type="button"
        onClick={() => setSkipped(true)}
        className="px-frame-shadow block w-full bg-ink/95 px-4 pb-4 pt-5 text-left backdrop-blur-sm"
        aria-label={finished ? "Narration" : "Show the whole line"}
      >
        <p aria-hidden className="relative text-pretty font-pixel-sans text-base leading-snug text-cream sm:text-lg">
          <span className="invisible">{message.text}</span>
          <span className="absolute inset-0">{text}</span>
        </p>
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Hide narration"
        className="retro absolute -right-2 -top-2 grid size-6 place-items-center bg-night text-[0.5rem] text-lilac outline outline-2 outline-cream hover:text-cream"
      >
        ×
      </button>
      {/* Tail pointing down-left at the character */}
      <span aria-hidden className="absolute -bottom-3 left-2 h-3 w-3 bg-cream" />
      <span aria-hidden className="absolute -bottom-6 -left-1 h-3 w-3 bg-cream" />
    </motion.div>
  )
}

function Companion({
  message,
  open,
  setOpen,
}: {
  message: Message | null
  open: boolean
  setOpen: (v: boolean) => void
}) {
  const reduced = useReducedMotion()
  const [blink, setBlink] = React.useState(false)
  const [mouth, setMouth] = React.useState(false)
  const talking = open && !!message

  // Blink every few seconds.
  React.useEffect(() => {
    if (reduced) return
    let t: number
    const loop = () => {
      t = window.setTimeout(() => {
        setBlink(true)
        t = window.setTimeout(() => {
          setBlink(false)
          loop()
        }, 140)
      }, 2600 + Math.random() * 2400)
    }
    loop()
    return () => window.clearTimeout(t)
  }, [reduced])

  // Flap the mouth while a new line is arriving.
  React.useEffect(() => {
    if (!talking || reduced) return
    const id = window.setInterval(() => setMouth((m) => !m), 130)
    const stop = window.setTimeout(() => {
      window.clearInterval(id)
      setMouth(false)
    }, Math.min(6000, (message?.text.length ?? 0) * 18 + 300))
    return () => {
      window.clearInterval(id)
      window.clearTimeout(stop)
    }
  }, [talking, message, reduced])

  const sprite = blink
    ? mouth
      ? COMPANION.blinkTalk
      : COMPANION.blink
    : mouth
      ? COMPANION.talk
      : COMPANION.idle

  const close = React.useCallback(() => setOpen(false), [setOpen])

  return (
    <div className="pointer-events-none fixed bottom-3 left-3 z-30 flex items-end gap-1 sm:bottom-5 sm:left-5">
      <motion.button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Hide narration" : "Show the last line again"}
        aria-expanded={open}
        className="pointer-events-auto relative shrink-0"
        key={message?.id ?? 0}
        animate={reduced ? undefined : { y: [0, -14, 0] }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <span className={cn("block", !reduced && "animate-bob")}>
          <PixelSprite sprite={sprite} className="w-11 drop-shadow-[3px_3px_0_rgb(0_0_0/0.5)] sm:w-14" />
        </span>
        <span aria-hidden className="mx-auto mt-1 block h-1.5 w-9 rounded-[50%] bg-black/40 sm:w-11" />
        {!open && message && (
          <span className="retro absolute -right-2 -top-2 grid size-5 animate-bounce place-items-center bg-px-yellow text-[0.5rem] text-night">
            !
          </span>
        )}
      </motion.button>
      <AnimatePresence mode="wait">
        {open && message && <Bubble key={message.id} message={message} onClose={close} />}
      </AnimatePresence>
    </div>
  )
}
