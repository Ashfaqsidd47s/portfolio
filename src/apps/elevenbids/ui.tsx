import * as React from "react"
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatMoney } from "./auction"

export const EASE = [0.16, 1, 0.3, 1] as const

// ---------------------------------------------------------------------------
// One shared clock, so every countdown on the page ticks on the same second.

const listeners = new Set<() => void>()
let clockId = 0
let paused = false
let nowValue = Date.now()

function subscribeClock(fn: () => void) {
  listeners.add(fn)
  if (!clockId) {
    clockId = window.setInterval(() => {
      if (paused) return
      nowValue = Date.now()
      listeners.forEach((l) => l())
    }, 1000)
  }
  return () => {
    listeners.delete(fn)
    if (listeners.size === 0) {
      window.clearInterval(clockId)
      clockId = 0
    }
  }
}

/** Stops the second hand while the window can't be seen. */
export function pauseClock(value: boolean) {
  paused = value
  if (!value) {
    nowValue = Date.now()
    listeners.forEach((l) => l())
  }
}

export function useNow() {
  return React.useSyncExternalStore(subscribeClock, () => nowValue, () => nowValue)
}

// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0")

export function timeLeft(ms: number) {
  if (ms <= 0) return "Closed"
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m`
  return `${pad(h)}:${pad(m)}:${pad(s % 60)}`
}

export function Countdown({ endsAt, className }: { endsAt: number; className?: string }) {
  const now = useNow()
  const left = endsAt - now
  const urgent = left > 0 && left < 5 * 60_000
  return (
    <span
      className={cn("tabular-nums", urgent && "text-eb-red", className)}
      aria-live={urgent ? "polite" : undefined}
      aria-atomic
    >
      {urgent && <span className="mr-1.5 inline-block size-1.5 animate-pulse rounded-full bg-current align-middle" aria-hidden />}
      {timeLeft(left)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// The rolling price: every digit is a reel that spins to its new value.

function Reel({ digit, delay }: { digit: number; delay: number }) {
  const reduced = useReducedMotion()
  const y = useMotionValue(-digit)
  // The reel is ten digits tall, so a tenth of it is one digit.
  const shift = useTransform(y, (v) => `${v * 10}%`)
  React.useEffect(() => {
    if (reduced) {
      y.set(-digit)
      return
    }
    const controls = animate(y, -digit, { type: "spring", stiffness: 110, damping: 18, mass: 0.9, delay })
    return () => controls.stop()
  }, [digit, delay, reduced, y])
  return (
    // An invisible "0" sizes the window; the reel scrolls behind it.
    <span className="relative inline-block h-[1.15em] overflow-hidden leading-[1.15]">
      <span className="invisible">0</span>
      <motion.span className="absolute inset-x-0 top-0 flex flex-col text-center" style={{ y: shift }}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="block h-[1.15em] leading-[1.15]">
            {i}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

export function Odometer({ value, className }: { value: number; className?: string }) {
  const text = formatMoney(value)
  const prev = React.useRef(value)
  const [flash, setFlash] = React.useState(0)
  React.useEffect(() => {
    if (value > prev.current) setFlash((f) => f + 1)
    prev.current = value
  }, [value])
  // Reels are keyed from the right, so the units stay the units as the price grows.
  const chars = [...text]
  return (
    <span className={cn("relative inline-flex items-baseline tabular-nums", className)} aria-label={text} role="text">
      <span aria-hidden className="inline-flex">
        {chars.map((ch, i) => {
          const fromRight = chars.length - i
          return /\d/.test(ch) ? (
            <Reel key={`d${fromRight}`} digit={Number(ch)} delay={fromRight * 0.035} />
          ) : (
            <span key={`s${fromRight}`} className="inline-block leading-[1.15]">
              {ch}
            </span>
          )
        })}
      </span>
      <AnimatePresence>
        {flash > 0 && (
          <motion.span
            key={flash}
            aria-hidden
            className="pointer-events-none absolute -inset-x-3 -inset-y-1 rounded-sm bg-eb-gold/25"
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
    </span>
  )
}

// ---------------------------------------------------------------------------

export const btn = {
  base: "inline-flex items-center justify-center gap-2 whitespace-nowrap font-eb-sans text-[0.72rem] font-medium uppercase tracking-[0.22em] transition-[background-color,color,border-color,opacity,transform] duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eb-gold disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]",
  solidLight: "h-11 bg-eb-ivory px-6 text-eb-ink hover:bg-white",
  solidDark: "h-11 bg-eb-ink px-6 text-eb-ivory hover:bg-eb-ink-3",
  ghostLight: "h-11 border border-eb-ivory/30 px-6 text-eb-ivory hover:border-eb-ivory hover:bg-eb-ivory/5",
  ghostDark: "h-11 border border-eb-ink/25 px-6 text-eb-ink hover:border-eb-ink",
  gold: "h-12 bg-eb-gold px-7 text-eb-ink hover:bg-[#d8bb84]",
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("font-eb-sans text-[0.66rem] font-medium uppercase tracking-[0.32em]", className)}>{children}</p>
  )
}

/** A centred dialog over the app (not the whole page: the app may be a window). */
export function Dialog({
  open,
  onClose,
  label,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  label: string
  children: React.ReactNode
  className?: string
}) {
  const panel = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const id = window.setTimeout(() => {
      panel.current?.querySelector<HTMLElement>("input, button:not([data-close])")?.focus({ preventScroll: true })
    }, 60)
    return () => {
      window.clearTimeout(id)
      previous?.focus?.({ preventScroll: true })
    }
  }, [open])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation()
              onClose()
            }
          }}
        >
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            data-close
            className="absolute inset-0 cursor-default bg-eb-ink/70 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal
            aria-label={label}
            data-lenis-prevent
            className={cn(
              "relative max-h-full w-full max-w-md overflow-y-auto bg-eb-paper text-eb-ink shadow-[0_40px_120px_-20px_rgba(0,0,0,0.6)]",
              className
            )}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              data-close
              className="absolute right-3 top-3 z-10 grid size-9 place-items-center text-eb-taupe transition-colors hover:text-eb-ink"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Reveals its children once, as they scroll into the app's view. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 28,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={{ duration: 1.1, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

/** Splits a line into words that rise out of a mask, one after another. */
export function MaskedLine({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  return (
    <span className={cn("inline-block", className)} aria-label={text} role="text">
      {text.split(" ").map((word, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.12em] align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "110%" }}
            animate={{ y: "0%" }}
            exit={{ y: "-110%", transition: { duration: 0.5, ease: [0.7, 0, 0.84, 0], delay: i * 0.02 } }}
            transition={{ duration: 1, ease: EASE, delay: delay + i * 0.06 }}
          >
            {word}
            {" "}
          </motion.span>
        </span>
      ))}
    </span>
  )
}
