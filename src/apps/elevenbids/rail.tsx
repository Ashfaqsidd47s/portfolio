import * as React from "react"
import { motion, useScroll, useSpring, useTransform } from "motion/react"
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react"
import { currentBid, formatShort } from "./auction"
import { LOTS, type CatalogueLot } from "./catalogue"
import { LotImage } from "./lots"
import { useShell } from "./shell"
import { useAuction } from "./store"
import { Countdown, EASE, Eyebrow } from "./ui"

// The rail runs through every lot that isn't already on the showcase banner.
const RAIL = [...LOTS.filter((l) => !l.featured), ...LOTS.filter((l) => l.featured)].slice(0, 12)

/**
 * A rail of lots that pins to the screen and slides sideways as you scroll
 * down, and back again as you scroll up; the arrows step one card at a time.
 */
export function Rail() {
  const shell = useShell()
  const section = React.useRef<HTMLElement>(null)
  const track = React.useRef<HTMLDivElement>(null)
  const [travel, setTravel] = React.useState(0)

  // How far the track has to slide: its own width less what the screen shows.
  React.useLayoutEffect(() => {
    const el = track.current
    if (!el) return
    const measure = () => setTravel(Math.max(0, el.scrollWidth - el.clientWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { scrollYProgress } = useScroll({ container: shell.scroller, target: section, offset: ["start start", "end end"] })
  const smooth = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.35 })
  const progress = shell.reduced ? scrollYProgress : smooth
  const x = useTransform(progress, [0, 1], [0, -travel])

  /** Scrolls the page so the track moves by one card (each pixel down is a pixel across). */
  const step = (dir: 1 | -1) => {
    const scroller = shell.scroller.current
    const el = section.current
    const card = track.current?.querySelector<HTMLElement>("[data-rail-card]")
    if (!scroller || !el || !card) return
    const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop
    const gap = parseFloat(getComputedStyle(track.current!).columnGap) || 0
    const along = Math.min(travel, Math.max(0, scroller.scrollTop - top))
    const next = Math.min(travel, Math.max(0, along + dir * (card.offsetWidth + gap)))
    if (shell.lenis.current) shell.lenis.current.scrollTo(top + next, { duration: 1.1 })
    else scroller.scrollTo({ top: top + next, behavior: shell.reduced ? "auto" : "smooth" })
  }

  return (
    <section
      ref={section}
      aria-labelledby="eb-rail"
      data-eb-tone="light"
      className="relative bg-[#ece8e0] text-eb-ink"
      style={{ height: shell.height + travel }}
    >
      <div
        className="sticky top-0 flex flex-col justify-center overflow-hidden py-16"
        // Cards never grow taller than the pinned screen leaves room for.
        style={{ height: shell.height, "--rail-card": `${Math.max(200, (shell.height - 300) * 0.8)}px` } as React.CSSProperties}
      >
        <div className="mx-auto mb-[clamp(1.5rem,3cqw,2.75rem)] flex w-full max-w-[1400px] items-end justify-between gap-6 px-5 @3xl:px-12">
          <div>
            <Eyebrow className="text-eb-gold-deep">Curated for you</Eyebrow>
            <h2 id="eb-rail" className="mt-3 font-eb-serif text-[clamp(1.9rem,4.4cqw,3.6rem)] font-medium leading-[0.95] tracking-[-0.01em]">
              Personal picks for <em className="font-normal">a lasting collection</em>
            </h2>
          </div>
          <div className="flex shrink-0 gap-2">
            {([-1, 1] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => step(dir)}
                aria-label={dir < 0 ? "Previous lots" : "Next lots"}
                className="grid size-11 place-items-center rounded-full border border-eb-ink/15 bg-eb-paper/60 transition-[background-color,border-color,transform] duration-300 hover:border-eb-ink hover:bg-eb-paper active:scale-95"
              >
                {dir < 0 ? <ArrowLeft className="size-4" strokeWidth={1.4} /> : <ArrowRight className="size-4" strokeWidth={1.4} />}
              </button>
            ))}
          </div>
        </div>

        <motion.div
          ref={track}
          style={{ x }}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ root: shell.scroller, once: true, amount: 0.3 }}
          transition={{ duration: 1, ease: EASE }}
          className="flex w-full gap-[clamp(0.75rem,1.4cqw,1.25rem)] px-5 will-change-transform @3xl:px-[max(3rem,calc((100cqw_-_1400px)/2_+_3rem))]"
        >
          <Intro />
          {RAIL.map((lot) => (
            <RailCard key={lot.id} lot={lot} />
          ))}
        </motion.div>

        {/* How far along the rail you are. */}
        <div className="mx-auto mt-[clamp(1.5rem,3cqw,2.5rem)] w-full max-w-[1400px] px-5 @3xl:px-12">
          <div className="h-px w-full bg-eb-ink/10">
            <motion.div className="h-px origin-left bg-eb-ink" style={{ scaleX: progress }} />
          </div>
        </div>
      </div>
    </section>
  )
}

const CARD = "w-[min(clamp(15rem,24cqw,20rem),var(--rail-card))] shrink-0 rounded-[clamp(1rem,1.6cqw,1.4rem)]"

/** The opening card: a word from the specialists before the lots begin. */
function Intro() {
  const shell = useShell()
  return (
    <motion.button
      type="button"
      data-rail-card
      onClick={() => shell.requireAccount(() => shell.go({ name: "account", tab: "watch" }))}
      whileHover={shell.reduced ? undefined : { y: -6 }}
      transition={{ duration: 0.5, ease: EASE }}
      className={`${CARD} group relative flex aspect-[4/5] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#8d6f3a] via-[#5e4a2c] to-[#2a2117] p-[clamp(1rem,1.8cqw,1.5rem)] text-left text-eb-ivory shadow-[0_30px_60px_-30px_rgba(40,30,15,0.6)]`}
    >
      <Eyebrow className="text-[0.58rem] text-eb-ivory/70">Specialists on hand</Eyebrow>
      <span className="pointer-events-none absolute -right-10 top-10 font-eb-serif text-[11rem] italic leading-none text-eb-ivory/[0.07] transition-transform duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-x-4">
        11
      </span>
      <span className="relative">
        <span className="block font-eb-serif text-[clamp(1.5rem,2.3cqw,2rem)] leading-[1.05]">Need help finding the right piece?</span>
        <span className="mt-3 flex items-end justify-between gap-4">
          <span className="font-eb-sans text-xs leading-relaxed text-eb-ivory/70">
            Tell us what you collect and we'll watch the room for you.
          </span>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-eb-ivory/15 backdrop-blur-sm transition-[background-color,transform] duration-500 group-hover:translate-x-1 group-hover:bg-eb-ivory group-hover:text-eb-ink">
            <ArrowRight className="size-4" strokeWidth={1.4} />
          </span>
        </span>
      </span>
    </motion.button>
  )
}

function RailCard({ lot }: { lot: CatalogueLot }) {
  const shell = useShell()
  const state = useAuction((s) => s.lots[lot.id])
  const bid = state ? currentBid(state) : 0
  return (
    <article
      data-rail-card
      className={`${CARD} group relative flex aspect-[4/5] flex-col bg-eb-paper p-[clamp(0.9rem,1.5cqw,1.3rem)] shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-[box-shadow,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:shadow-[0_30px_60px_-30px_rgba(40,30,15,0.45)]`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-eb-serif text-[clamp(1.05rem,1.5cqw,1.3rem)] leading-tight">{lot.title}</p>
          <p className="mt-0.5 font-eb-sans text-xs text-eb-taupe">
            {bid ? `${formatShort(bid)} bid` : `Opens at ${formatShort(lot.startPrice)}`}
          </p>
        </div>
        {state && <Countdown endsAt={state.endsAt} className="shrink-0 font-eb-sans text-[0.62rem] tracking-wide text-eb-stone" />}
      </div>

      <button
        type="button"
        onClick={() => shell.go({ name: "lot", id: lot.id })}
        aria-label={`View ${lot.maker} ${lot.title}`}
        className="relative my-[clamp(0.6rem,1.2cqw,1rem)] min-h-0 flex-1 overflow-hidden rounded-[clamp(0.6rem,1cqw,0.9rem)] focus-visible:outline-2 focus-visible:outline-eb-gold"
      >
        <LotImage lot={lot} width={560} className="absolute inset-0" imgClassName="group-hover:scale-[1.07] duration-[1.1s]" />
        <span className="absolute left-2 top-2 rounded-full bg-eb-paper/85 px-2 py-0.5 font-eb-sans text-[0.55rem] uppercase tracking-[0.2em] text-eb-ink backdrop-blur-sm">
          {lot.maker}
        </span>
      </button>

      <button
        type="button"
        onClick={() => shell.go({ name: "lot", id: lot.id })}
        className="flex h-10 items-center justify-center gap-2 rounded-full border border-eb-ink/15 font-eb-sans text-[0.62rem] uppercase tracking-[0.22em] transition-[background-color,color,border-color] duration-300 hover:border-eb-ink hover:bg-eb-ink hover:text-eb-ivory"
      >
        Place a bid
        <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-px group-hover:translate-x-px" strokeWidth={1.4} />
      </button>
    </article>
  )
}
