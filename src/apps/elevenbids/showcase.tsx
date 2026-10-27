import * as React from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react"
import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { currentBid, formatShort } from "./auction"
import { LOTS, type CatalogueLot } from "./catalogue"
import { LotImage } from "./lots"
import { useShell } from "./shell"
import { useAuction } from "./store"
import { EASE, Eyebrow, MaskedLine } from "./ui"

/** How long each set of three holds the banner before it slides on. */
const HOLD = 6

const WORDS = [
  {
    word: "Provenance",
    body: "Every piece arrives with its story checked: who made it, who kept it, and how it reached our room.",
  },
  {
    word: "Rarity",
    body: "One of five hundred, one of one. The lots that rarely come to sale, and seldom twice in a lifetime.",
  },
  {
    word: "Confidence",
    body: "Examined by specialists, insured door to door. Bid as boldly as the pieces you're bidding on.",
  },
]

// The featured lots, three to a set; any shortfall is filled from the rest of the sale.
const featured = LOTS.filter((l) => l.featured)
const pool = [...featured, ...LOTS.filter((l) => !l.featured)]
const SLIDES: CatalogueLot[][] = WORDS.map((_, i) => pool.slice(i * 3, i * 3 + 3))

/**
 * A dark banner of three lots at staggered heights: they drift at their own
 * depths as you scroll and lean after the pointer, and the set turns over on
 * its own every few seconds.
 */
export function Showcase() {
  const shell = useShell()
  const ref = React.useRef<HTMLElement>(null)
  const [index, setIndex] = React.useState(0)
  const [hovering, setHovering] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const inView = useInView(ref, { root: shell.scroller, amount: 0.35 })
  const playing = !shell.reduced && shell.visible && inView && !hovering && !focused
  const compact = shell.width < 760

  // Scroll parallax: each card travels at its own depth through the section.
  const { scrollYProgress } = useScroll({ container: shell.scroller, target: ref, offset: ["start end", "end start"] })
  const smooth = useSpring(scrollYProgress, { stiffness: 110, damping: 28, mass: 0.4 })
  const progress = shell.reduced ? scrollYProgress : smooth
  const reach = Math.min(shell.height, 900) * (compact ? 0.06 : 0.12)
  const depth = [
    useTransform(progress, [0, 1], [reach * 0.6, -reach * 0.6]),
    useTransform(progress, [0, 1], [reach * 1.5, -reach * 1.5]),
    useTransform(progress, [0, 1], [reach * 0.3, -reach * 0.3]),
  ]
  const headY = useTransform(progress, [0, 1], [reach * 0.9, -reach * 0.9])

  // Pointer parallax: the whole set leans gently after the cursor.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 60, damping: 18, mass: 0.6 })
  const sy = useSpring(py, { stiffness: 60, damping: 18, mass: 0.6 })

  // The auto-slide's clock, which also fills the active dot.
  const clock = useMotionValue(0)
  const go = React.useCallback((next: number) => {
    clock.set(0)
    setIndex((next + SLIDES.length) % SLIDES.length)
  }, [clock])
  React.useEffect(() => {
    if (!playing) return
    const controls = animate(clock, 1, {
      duration: HOLD * (1 - clock.get()),
      ease: "linear",
      onComplete: () => go(index + 1),
    })
    return () => controls.stop()
  }, [playing, index, clock, go])

  const slide = SLIDES[index]
  const words = WORDS[index]

  return (
    <section
      ref={ref}
      aria-roledescription="carousel"
      aria-label="Highlights of the sale"
      className="relative overflow-hidden bg-eb-ink px-4 py-20 text-eb-ivory @3xl:px-12 @3xl:py-32"
    >
      {/* Soft gold light behind the panel, drifting with the pointer. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[70cqw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(201,169,110,0.16),transparent_62%)] blur-2xl"
        style={{ x: useTransform(sx, (v) => v * 60), y: useTransform(sy, (v) => v * 40) }}
      />
      <motion.div
        initial={{ opacity: 0, y: 60, rotateX: 8 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
        viewport={{ root: shell.scroller, once: true, amount: 0.2 }}
        transition={{ duration: 1.3, ease: EASE }}
        style={{ transformPerspective: 1600 }}
        className="relative mx-auto max-w-[1400px] overflow-hidden rounded-[clamp(1.25rem,2.4cqw,2.25rem)] border border-eb-ivory/10 bg-[#070605] shadow-[0_60px_140px_-40px_rgba(0,0,0,0.9)]"
        onPointerMove={(e) => {
          if (shell.reduced || e.pointerType !== "mouse") return
          const r = e.currentTarget.getBoundingClientRect()
          px.set(((e.clientX - r.left) / r.width) * 2 - 1)
          py.set(((e.clientY - r.top) / r.height) * 2 - 1)
        }}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHovering(true)}
        onPointerLeave={() => {
          setHovering(false)
          px.set(0)
          py.set(0)
        }}
        onFocus={() => setFocused(true)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(index + 1)
          if (e.key === "ArrowLeft") go(index - 1)
        }}
        onPanEnd={(_, info) => {
          if (Math.abs(info.offset.x) < 50 || Math.abs(info.offset.x) < Math.abs(info.offset.y)) return
          go(index + (info.offset.x < 0 ? 1 : -1))
        }}
      >
        {compact && (
          <div className="px-4 pt-6 text-right">
            <Headline word={words.word} compact />
          </div>
        )}
        <div className="relative grid grid-cols-3 gap-[clamp(0.6rem,2cqw,2rem)] p-[clamp(1rem,3.6cqw,3.5rem)] [touch-action:pan-y]">
          {/* Left: a card high up, then the dots and the copy at the foot. */}
          <div className="flex flex-col justify-between gap-8">
            <Card lot={slide[0]} y={depth[0]} px={sx} py={sy} lean={0.6} order={0} slideKey={index} />
            {!compact && <Copy body={words.body} slideKey={index} index={index} go={go} clock={clock} />}
          </div>

          {/* Middle: lower than its neighbours, and the fastest to drift. */}
          <div className="pt-[clamp(2.5rem,9cqw,8rem)]">
            <Card lot={slide[1]} y={depth[1]} px={sx} py={sy} lean={1.2} order={1} slideKey={index} />
          </div>

          {/* Right: the word for the set, then a card at the foot. */}
          <div className="flex flex-col justify-between gap-6">
            {!compact && (
              <motion.div style={{ y: headY }} className="text-right">
                <Headline word={words.word} />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={index}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE, delay: 0.25 } }}
                    exit={{ opacity: 0, y: -8, transition: { duration: 0.3 } }}
                    className="ml-auto mt-5 max-w-[22rem] font-eb-sans text-[0.66rem] uppercase leading-relaxed tracking-[0.18em] text-eb-ivory/65"
                  >
                    We represent the finest of the sale: bold, rare and unapologetically original, from private collections to
                    international rooms.
                  </motion.p>
                </AnimatePresence>
              </motion.div>
            )}
            <Card lot={slide[2]} y={depth[2]} px={sx} py={sy} lean={0.35} order={2} slideKey={index} />
          </div>
        </div>
        {compact && (
          <div className="px-4 pb-6">
            <Copy body={words.body} slideKey={index} index={index} go={go} clock={clock} />
          </div>
        )}
      </motion.div>
    </section>
  )
}

function Headline({ word, compact }: { word: string; compact?: boolean }) {
  return (
    <h2 className={cn("font-eb-serif font-medium uppercase leading-[0.9] tracking-[-0.01em]", compact ? "text-[clamp(1.8rem,10cqw,3.2rem)]" : "text-[clamp(2rem,3.9cqw,4.4rem)]")}>
      <AnimatePresence mode="wait" initial={false}>
        <MaskedLine key={word} text={word} />
      </AnimatePresence>
    </h2>
  )
}

function Copy({
  body,
  slideKey,
  index,
  go,
  clock,
}: {
  body: string
  slideKey: number
  index: number
  go: (i: number) => void
  clock: MotionValue<number>
}) {
  return (
    <div>
      <Dots index={index} go={go} clock={clock} />
      <div className="mt-5 min-h-[4.5em]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={slideKey}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE, delay: 0.3 } }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.3 } }}
            className="max-w-[22rem] font-eb-sans text-[0.66rem] uppercase leading-relaxed tracking-[0.18em] text-eb-ivory/65"
          >
            {body}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}

/** One dot per set; the active one stretches and fills as its time runs. */
function Dots({ index, go, clock }: { index: number; go: (i: number) => void; clock: MotionValue<number> }) {
  return (
    <div className="flex items-center gap-2" role="tablist" aria-label="Choose a set">
      {SLIDES.map((_, i) => {
        const active = i === index
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${WORDS[i].word}, set ${i + 1} of ${SLIDES.length}`}
            onClick={() => go(i)}
            className="group grid h-6 place-items-center"
          >
            <motion.span
              className="relative block h-1.5 overflow-hidden rounded-full bg-eb-ivory/25 transition-colors group-hover:bg-eb-ivory/50"
              animate={{ width: active ? 28 : 6 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              {active && <motion.span className="absolute inset-0 origin-left rounded-full bg-eb-ivory" style={{ scaleX: clock }} />}
            </motion.span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * A rounded card that drifts with the scroll (`y`) and the pointer (`px`,
 * `py`, scaled by `lean`), tilts towards the cursor on hover, and wipes to
 * its next lot when the set turns over.
 */
function Card({
  lot,
  y,
  px,
  py,
  lean,
  order,
  slideKey,
}: {
  lot: CatalogueLot
  y: MotionValue<number>
  px: MotionValue<number>
  py: MotionValue<number>
  lean: number
  order: number
  slideKey: number
}) {
  const shell = useShell()
  const state = useAuction((s) => s.lots[lot.id])
  const x = useTransform(px, (v) => v * 16 * lean)
  const ly = useTransform(py, (v) => v * 12 * lean)
  const tiltX = useMotionValue(0)
  const tiltY = useMotionValue(0)
  const rotateX = useSpring(tiltX, { stiffness: 180, damping: 18 })
  const rotateY = useSpring(tiltY, { stiffness: 180, damping: 18 })
  const glareX = useMotionValue(50)
  const glareY = useMotionValue(50)
  const glare = useTransform(
    [glareX, glareY],
    ([gx, gy]) => `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.22), transparent 55%)`
  )

  return (
    <motion.div style={{ y }} className="relative">
      <motion.div style={{ x, y: ly }}>
        <motion.button
          type="button"
          onClick={() => shell.go({ name: "lot", id: lot.id })}
          aria-label={`${lot.maker} ${lot.title}`}
          style={{ rotateX, rotateY, transformPerspective: 900 }}
          whileHover={shell.reduced ? undefined : { scale: 1.035, y: -6 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.6, ease: EASE }}
          onPointerMove={(e) => {
            if (shell.reduced || e.pointerType !== "mouse") return
            const r = e.currentTarget.getBoundingClientRect()
            const nx = (e.clientX - r.left) / r.width
            const ny = (e.clientY - r.top) / r.height
            tiltY.set((nx - 0.5) * 12)
            tiltX.set((0.5 - ny) * 10)
            glareX.set(nx * 100)
            glareY.set(ny * 100)
          }}
          onPointerLeave={() => {
            tiltX.set(0)
            tiltY.set(0)
          }}
          className="group relative block aspect-[4/5] w-full overflow-hidden rounded-[clamp(0.75rem,1.6cqw,1.5rem)] bg-eb-ink-3 text-left shadow-[0_30px_70px_-25px_rgba(0,0,0,0.85)] outline-none ring-1 ring-eb-ivory/10 transition-shadow duration-500 hover:shadow-[0_40px_90px_-20px_rgba(201,169,110,0.35)] hover:ring-eb-gold/40 focus-visible:ring-2 focus-visible:ring-eb-gold"
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={`${slideKey}-${lot.id}`}
              className="absolute inset-0"
              initial={{ clipPath: "inset(100% 0% 0% 0%)", scale: 1.25 }}
              animate={{
                clipPath: "inset(0% 0% 0% 0%)",
                scale: 1,
                transition: { duration: 1.2, ease: EASE, delay: 0.12 * order },
              }}
              exit={{
                clipPath: "inset(0% 0% 100% 0%)",
                scale: 1.08,
                transition: { duration: 0.9, ease: [0.7, 0, 0.3, 1], delay: 0.08 * order },
              }}
            >
              <LotImage
                lot={lot}
                width={720}
                eager
                className="size-full"
                imgClassName="scale-[1.04] group-hover:scale-[1.12] duration-[1.2s]"
              />
            </motion.div>
          </AnimatePresence>
          {/* The light catching the card as it tilts. */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 opacity-0 mix-blend-soft-light transition-opacity duration-500 group-hover:opacity-100"
            style={{ backgroundImage: glare }}
          />
          <span className="absolute inset-0 z-10 flex translate-y-3 flex-col justify-end bg-gradient-to-t from-eb-ink/90 via-eb-ink/10 to-transparent p-[clamp(0.6rem,1.5cqw,1.4rem)] opacity-0 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
            <Eyebrow className="text-[0.55rem] text-eb-gold">{lot.maker}</Eyebrow>
            <span className="mt-1 flex items-end justify-between gap-3">
              <span className="font-eb-serif text-[clamp(0.95rem,1.7cqw,1.5rem)] leading-tight text-eb-ivory">{lot.title}</span>
              <ArrowUpRight className="size-4 shrink-0 text-eb-ivory/80" strokeWidth={1.3} />
            </span>
            {state && <span className="mt-1 font-eb-sans text-xs text-eb-ivory/70">Current bid {formatShort(currentBid(state))}</span>}
          </span>
          <span
            className={cn(
              shell.width < 760 && "hidden",
              "absolute left-3 top-3 z-10 rounded-full bg-eb-ink/55 px-2.5 py-1 font-eb-sans text-[0.55rem] uppercase tracking-[0.24em] text-eb-ivory/85 backdrop-blur-md",
              "transition-opacity duration-500 group-hover:opacity-0"
            )}
          >
            Lot {String(lot.number).padStart(2, "0")}
          </span>
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
