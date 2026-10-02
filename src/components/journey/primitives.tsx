import * as React from "react"
import { motion, useInView, useReducedMotion } from "motion/react"
import { stageById } from "@/data/journey"
import { cn } from "@/lib/utils"
import { useSay, type Tone } from "./companion-context"
import { EASE } from "./hooks"
import { TROPHY } from "./sprites"

/* ------------------------------------------------------------------------- */

export function Stage({
  id,
  className,
  children,
}: {
  id: string
  className?: string
  children: React.ReactNode
}) {
  const stage = stageById(id)
  return (
    <section
      id={id}
      data-stage={id}
      aria-label={`Stage ${stage.n}: ${stage.title} (${stage.year})`}
      className={cn("relative scroll-mt-16", className)}
    >
      {children}
    </section>
  )
}

/**
 * Anime-style stage title card: speed lines burst behind a chunky pixel
 * headline, the year stamped on the side.
 */
export function StageTitle({
  id,
  kicker,
  className,
  tone = "light",
  variant = "pixel",
}: {
  id: string
  kicker?: string
  className?: string
  tone?: "light" | "dark"
  /** "ide": the post-pixel look — code comment eyebrow, clean sans headline. */
  variant?: "pixel" | "ide"
}) {
  const stage = stageById(id)
  const reduced = useReducedMotion()
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const show = reduced || inView

  if (variant === "ide") {
    return (
      <div ref={ref} className={cn("relative mx-auto max-w-5xl px-4 py-16 sm:py-24", className)}>
        <motion.p
          className="font-mono text-xs text-[#808080] sm:text-sm"
          initial={reduced ? false : { opacity: 0 }}
          animate={show ? { opacity: 1 } : undefined}
        >
          {"// "}stage {String(stage.n).padStart(2, "0")} · {stage.year}
        </motion.p>
        <motion.h2
          className="mt-3 font-sans text-[clamp(2rem,6vw,4rem)] font-semibold leading-[1.05] tracking-tight text-[#e8eaed]"
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={show ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, ease: EASE }}
        >
          {stage.title}
          <span className="text-[#3ddc84]">.</span>
        </motion.h2>
        {kicker && (
          <motion.p
            className="mt-4 max-w-xl text-pretty font-sans text-lg text-[#a9b7c6] sm:text-xl"
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={show ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
          >
            {kicker}
          </motion.p>
        )}
      </div>
    )
  }

  return (
    <div
      ref={ref}
      className={cn(
        "relative mx-auto flex max-w-5xl flex-col items-center px-4 py-16 text-center sm:py-24",
        className
      )}
    >
      <motion.div
        aria-hidden
        className="speedlines pointer-events-none absolute left-1/2 top-1/2 size-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
        initial={reduced ? false : { scale: 0.3, opacity: 0, rotate: -20 }}
        animate={show ? { scale: 1, opacity: 1, rotate: 0 } : undefined}
        transition={{ duration: 0.9, ease: EASE }}
      />
      <motion.p
        className={cn(
          "retro relative text-[0.625rem] tracking-[0.3em] sm:text-xs",
          tone === "light" ? "text-px-yellow" : "text-tc-blue"
        )}
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={show ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.5, ease: EASE }}
      >
        STAGE {String(stage.n).padStart(2, "0")} · {stage.year}
      </motion.p>
      <motion.h2
        className={cn(
          "retro pixel-text-shadow relative mt-5 text-balance text-[clamp(1.4rem,5.2vw,3.25rem)] leading-[1.2]",
          tone === "light" ? "text-cream" : "text-night"
        )}
        initial={reduced ? false : { opacity: 0, scale: 1.6, filter: "blur(6px)" }}
        animate={show ? { opacity: 1, scale: 1, filter: "blur(0px)" } : undefined}
        transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
      >
        {stage.title}
      </motion.h2>
      {kicker && (
        <motion.p
          className={cn(
            "relative mt-5 max-w-xl text-pretty font-pixel-sans text-lg sm:text-xl",
            tone === "light" ? "text-lilac" : "text-night/80"
          )}
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={show ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.6, ease: EASE, delay: 0.3 }}
        >
          {kicker}
        </motion.p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------------- */

/**
 * A line of narration. Nothing renders in the flow except a screen-reader copy;
 * when this spot reaches the middle of the viewport, the companion says it.
 */
export function Dialogue({
  speaker,
  children,
  tone = "pink",
}: {
  speaker: string
  children: string
  /** Kept for call-site compatibility; the line no longer takes up layout. */
  className?: string
  tone?: Tone
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: "-40% 0px -40% 0px" })
  const say = useSay()

  React.useEffect(() => {
    if (inView) say({ speaker, text: children, tone })
  }, [inView, say, speaker, children, tone])

  return (
    <div ref={ref} className="h-px w-full">
      <p className="sr-only">
        {speaker}: {children}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------------- */

/** "Achievement unlocked" toast that slides in when scrolled into view. */
export function Achievement({
  title,
  detail,
  className,
}: {
  title: string
  detail?: string
  className?: string
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className={cn(
        "px-frame-shadow mx-auto flex w-fit max-w-full items-center gap-4 bg-night px-4 py-3 [--px-frame:var(--color-px-yellow)]",
        className
      )}
      initial={reduced ? false : { opacity: 0, x: 60, scale: 0.9 }}
      whileInView={{ opacity: 1, x: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.8 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
    >
      <PixelSprite sprite={TROPHY} className="w-8 shrink-0 animate-bob" />
      <div className="min-w-0">
        <p className="retro text-[0.5rem] text-px-yellow sm:text-[0.5625rem]">
          ACHIEVEMENT UNLOCKED
        </p>
        <p className="mt-1.5 font-pixel-sans text-lg leading-tight text-cream">{title}</p>
        {detail && <p className="font-pixel-sans text-sm text-lilac">{detail}</p>}
      </div>
    </motion.div>
  )
}

/** Big anime sound-effect lettering that pops in. Decorative only. */
export function Sfx({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const reduced = useReducedMotion()
  return (
    <motion.span
      aria-hidden
      className={cn(
        "pointer-events-none absolute select-none font-black italic tracking-tighter [-webkit-text-stroke:2px_var(--color-night)] [paint-order:stroke_fill]",
        className
      )}
      initial={reduced ? false : { opacity: 0, scale: 0.2, rotate: -25 }}
      whileInView={{ opacity: 1, scale: 1, rotate: -8 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ type: "spring", stiffness: 400, damping: 12, delay }}
    >
      {children}
    </motion.span>
  )
}

/* ------------------------------------------------------------------------- */

export type Sprite = { rows: string[]; palette: Record<string, string> }

/** Renders a character-grid sprite as crisp SVG pixels. */
export function PixelSprite({
  sprite,
  className,
  title,
}: {
  sprite: Sprite
  className?: string
  title?: string
}) {
  const { rows, palette } = sprite
  const w = Math.max(...rows.map((r) => r.length))
  const h = rows.length
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      shapeRendering="crispEdges"
      className={cn("block h-auto", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) =>
          palette[ch] ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={palette[ch]} />
          ) : null
        )
      )}
    </svg>
  )
}
