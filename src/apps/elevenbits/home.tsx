import * as React from "react"
import { motion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react"
import { cn } from "@/lib/utils"
import { currentBid, formatShort, BUYERS_PREMIUM } from "./auction"
import { CATEGORIES, LOTS, type CatalogueLot } from "./catalogue"
import { Catalogue, LotImage } from "./lots"
import { useShell } from "./shell"
import { bidderCity, bidderLabel, useAuction } from "./store"
import { Stage } from "./stage"
import { Eyebrow, Reveal } from "./ui"

export function Home() {
  return (
    <>
      <Stage />
      <RoomTicker />
      <Collection />
      <section aria-labelledby="eb-sale" data-eb-tone="light" className="bg-eb-paper px-5 py-24 text-eb-ink @3xl:px-12 @3xl:py-32">
        <div className="mx-auto max-w-[1400px]">
          <Reveal className="mb-12 flex flex-col gap-4 @3xl:mb-16 @3xl:flex-row @3xl:items-end @3xl:justify-between">
            <div>
              <Eyebrow className="text-eb-gold-deep">The sale · {LOTS.length} lots</Eyebrow>
              <h2 id="eb-sale" className="mt-4 font-eb-serif text-[clamp(2.4rem,6cqw,4.6rem)] font-medium leading-[0.95] tracking-[-0.01em]">
                Now <em className="font-normal">accepting bids</em>
              </h2>
            </div>
            <p className="max-w-sm font-eb-sans text-sm leading-relaxed text-eb-taupe">
              Every lot is examined, authenticated and photographed by our specialists before it reaches the room. Bid live, or leave
              a maximum and let us bid for you.
            </p>
          </Reveal>
          <Catalogue compact />
        </div>
      </section>
      <HowItWorks />
      <Footer />
    </>
  )
}

/** The latest bids anywhere in the sale, drifting past. */
function RoomTicker() {
  const lots = useAuction((s) => s.lots)
  const recent = LOTS.flatMap((l) => (lots[l.id]?.bids ?? []).map((b) => ({ ...b, lot: l })))
    .sort((a, b) => b.at - a.at)
    .slice(0, 12)
  if (recent.length === 0) return null
  const items = [...recent, ...recent]
  return (
    <div className="relative overflow-hidden border-y border-eb-ivory/10 bg-eb-ink py-4 text-eb-ivory" aria-label="Latest bids in the room">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-eb-ink to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-eb-ink to-transparent" />
      <div className="flex w-max animate-[eb-marquee_60s_linear_infinite] gap-12 motion-reduce:animate-none">
        {items.map((b, i) => (
          <p key={`${b.id}-${i}`} className="flex shrink-0 items-baseline gap-3 font-eb-sans text-xs tracking-wide" aria-hidden={i >= recent.length}>
            <span className="size-1 self-center rounded-full bg-eb-gold" />
            <span className="text-eb-ivory/50">
              {bidderLabel(b.bidder)}
              {bidderCity(b.bidder) && ` · ${bidderCity(b.bidder)}`}
            </span>
            <span className="font-eb-serif text-base text-eb-ivory">{formatShort(b.amount)}</span>
            <span className="text-eb-ivory/40">on {b.lot.title}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

/**
 * Every lot in four columns that drift at their own speeds as you scroll,
 * so the sale seems to pass by at different depths.
 */
function Collection() {
  const shell = useShell()
  const ref = React.useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ container: shell.scroller, target: ref, offset: ["start end", "end start"] })
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 })
  const progress = shell.reduced ? scrollYProgress : smooth
  const columns = shell.width >= 760 ? 4 : 2
  const h = shell.height
  const speeds = columns === 4 ? [0.55, 1.35, 0.35, 1.0] : [0.6, 1.2]
  const y = [
    useTransform(progress, [0, 1], [0, h * speeds[0]]),
    useTransform(progress, [0, 1], [0, h * speeds[1]]),
    useTransform(progress, [0, 1], [0, h * (speeds[2] ?? 0)]),
    useTransform(progress, [0, 1], [0, h * (speeds[3] ?? 0)]),
  ]
  // Each column gets every lot once, rotated so neighbours differ.
  const cols = Array.from({ length: columns }, (_, c) => {
    const start = Math.floor((LOTS.length / columns) * c)
    return [...LOTS.slice(start), ...LOTS.slice(0, start)].slice(0, columns === 4 ? 6 : 7)
  })
  const offsets = columns === 4 ? ["-38%", "-72%", "-24%", "-58%"] : ["-30%", "-56%"]

  return (
    <section ref={ref} aria-labelledby="eb-collection" className="relative overflow-hidden bg-eb-ink text-eb-ivory" style={{ height: h * 2.1 }}>
      <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-6">
        <div className="text-center mix-blend-difference">
          <Eyebrow className="text-eb-ivory/70">The collection</Eyebrow>
          <h2 id="eb-collection" className="mt-4 font-eb-serif text-[clamp(3rem,11cqw,10rem)] font-medium leading-[0.9] tracking-[-0.02em] text-eb-ivory">
            Rare, <em className="font-normal">by nature</em>
          </h2>
        </div>
      </div>
      <div className="absolute inset-0 flex gap-[1.6cqw] px-[1.6cqw]">
        {cols.map((lots, c) => (
          <Column key={c} lots={lots} y={y[c]} top={offsets[c]} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-40 bg-gradient-to-b from-eb-ink to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-40 bg-gradient-to-t from-eb-ink to-transparent" />
    </section>
  )
}

function Column({ lots, y, top }: { lots: CatalogueLot[]; y: MotionValue<number>; top: string }) {
  const shell = useShell()
  const states = useAuction((s) => s.lots)
  return (
    <motion.div className="relative flex min-w-0 flex-1 flex-col gap-[1.6cqw]" style={{ y, top }}>
      {lots.map((lot) => (
        <button
          key={lot.id}
          type="button"
          onClick={() => shell.go({ name: "lot", id: lot.id })}
          className="group relative block w-full shrink-0 overflow-hidden text-left focus-visible:outline-2 focus-visible:outline-eb-gold"
          aria-label={`${lot.maker} ${lot.title}`}
        >
          <LotImage lot={lot} width={640} className="aspect-[4/5]" imgClassName="scale-[1.02] group-hover:scale-[1.08] grayscale-[0.25] group-hover:grayscale-0" />
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-eb-ink/85 via-eb-ink/0 to-transparent p-[clamp(0.75rem,1.4cqw,1.25rem)] opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100">
            <p className="font-eb-sans text-[0.58rem] uppercase tracking-[0.28em] text-eb-gold">{lot.maker}</p>
            <p className="mt-1 font-eb-serif text-[clamp(1rem,1.6cqw,1.4rem)] leading-tight text-eb-ivory">{lot.title}</p>
            {states[lot.id] && <p className="mt-1 font-eb-sans text-xs text-eb-ivory/70">{formatShort(currentBid(states[lot.id]))}</p>}
          </div>
        </button>
      ))}
    </motion.div>
  )
}

const STEPS = [
  {
    n: "I",
    title: "Register your paddle",
    body: "Create an account in a minute. Every bidder is verified before their first bid, so the room is only ever real buyers.",
  },
  {
    n: "II",
    title: "Bid, or leave a maximum",
    body: "Bid live as the clock runs, or tell us your ceiling: we'll bid for you one increment at a time, and never beyond it.",
  },
  {
    n: "III",
    title: "Win, and we deliver",
    body: `A late bid adds two minutes to the clock, so nobody is sniped. Winners pay the hammer plus a ${Math.round(BUYERS_PREMIUM * 100)}% premium; we insure and ship worldwide.`,
  },
]

function HowItWorks() {
  return (
    <section aria-labelledby="eb-how" className="bg-eb-ink px-5 py-24 text-eb-ivory @3xl:px-12 @3xl:py-32">
      <div className="mx-auto max-w-[1400px]">
        <Reveal>
          <Eyebrow className="text-eb-gold">How it works</Eyebrow>
          <h2 id="eb-how" className="mt-4 max-w-3xl font-eb-serif text-[clamp(2.2rem,5cqw,4rem)] font-medium leading-[1] tracking-[-0.01em]">
            An auction house, <em className="font-normal">without the gavel's distance.</em>
          </h2>
        </Reveal>
        <div className="mt-16 grid gap-px bg-eb-ivory/10 @3xl:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12} className="bg-eb-ink p-0 py-8 @3xl:p-10">
              <p className="font-eb-serif text-5xl italic text-eb-gold">{s.n}</p>
              <h3 className="mt-6 font-eb-serif text-2xl">{s.title}</h3>
              <p className="mt-3 font-eb-sans text-sm leading-relaxed text-eb-ivory/60">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  const shell = useShell()
  const [email, setEmail] = React.useState("")
  const [joined, setJoined] = React.useState(false)
  return (
    <footer data-eb-tone="dark" className="bg-eb-ink-2 px-5 pb-10 pt-20 text-eb-ivory @3xl:px-12">
      <div className="mx-auto grid max-w-[1400px] gap-14 @3xl:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-eb-serif text-5xl">
            11<em>bits</em>
          </p>
          <p className="mt-4 max-w-sm font-eb-sans text-sm leading-relaxed text-eb-ivory/55">
            Previews of every sale, results as they fall, and the occasional private offer. Once a week, never more.
          </p>
          <form
            className="mt-6 flex max-w-sm border-b border-eb-ivory/30 focus-within:border-eb-ivory"
            onSubmit={(e) => {
              e.preventDefault()
              if (/^\S+@\S+\.\S+$/.test(email)) setJoined(true)
            }}
          >
            <label className="flex-1">
              <span className="sr-only">Email</span>
              <input
                type="email"
                required
                value={email}
                disabled={joined}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="h-11 w-full bg-transparent font-eb-sans text-sm text-eb-ivory placeholder:text-eb-ivory/35 focus:outline-none"
              />
            </label>
            <button type="submit" disabled={joined} className="font-eb-sans text-[0.66rem] uppercase tracking-[0.28em] text-eb-gold disabled:opacity-100">
              {joined ? "Subscribed ✓" : "Subscribe"}
            </button>
          </form>
        </div>
        <FooterList
          title="Departments"
          items={CATEGORIES.map((c) => ({ label: c, onClick: () => shell.go({ name: "lots", category: c }) }))}
        />
        <FooterList
          title="The house"
          items={[
            { label: "All lots", onClick: () => shell.go({ name: "lots" }) },
            { label: "My bids", onClick: () => shell.go({ name: "account", tab: "bids" }) },
            { label: "Watchlist", onClick: () => shell.go({ name: "account", tab: "watch" }) },
          ]}
        />
      </div>
      <div className="mx-auto mt-20 flex max-w-[1400px] flex-col gap-2 border-t border-eb-ivory/10 pt-6 font-eb-sans text-[0.68rem] tracking-wide text-eb-ivory/40 @3xl:flex-row @3xl:justify-between">
        <p>© 2026 11bits Fine Auctions. A portfolio demo: lots, bidders and prices are fictional.</p>
        <p>Photography via Unsplash, used as placeholders.</p>
      </div>
    </footer>
  )
}

function FooterList({ title, items }: { title: string; items: { label: string; onClick: () => void }[] }) {
  return (
    <div>
      <Eyebrow className="text-eb-ivory/45">{title}</Eyebrow>
      <ul className="mt-5 grid gap-2.5">
        {items.map((it) => (
          <li key={it.label}>
            <button type="button" onClick={it.onClick} className={cn("font-eb-serif text-lg text-eb-ivory/85 transition-colors hover:text-eb-gold")}>
              {it.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

