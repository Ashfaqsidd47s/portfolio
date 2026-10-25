import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Gavel, ShieldCheck, Truck } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  YOU,
  currentBid,
  formatMoney,
  increment,
  isOpen,
  leader,
  nextMinimum,
  outcome,
  reserveMet,
  snapUp,
  type LotState,
} from "./auction"
import { LOTS, getLot, photoUrl, type CatalogueLot } from "./catalogue"
import { Footer } from "./home"
import { LotCard, StatusTag, WatchButton } from "./lots"
import { useShell } from "./shell"
import { bidderCity, bidderLabel, standing, useAuction } from "./store"
import { Countdown, EASE, Eyebrow, Odometer, Reveal, btn, useNow } from "./ui"

/** The gallery's views of a photo: the whole piece, then details at higher zoom. */
type GalleryView = { src: string; zoom: number; x: number; y: number }

function viewsFor(lot: CatalogueLot): GalleryView[] {
  const views: GalleryView[] = []
  lot.photos.forEach((p, i) => {
    const [fx, fy] = p.focus ?? [50, 50]
    views.push({ src: p.src, zoom: 1, x: fx, y: fy })
    if (i === 0) {
      views.push({ src: p.src, zoom: 1.9, x: fx - 8, y: fy - 10 })
      views.push({ src: p.src, zoom: 2.6, x: fx + 12, y: fy + 14 })
    }
  })
  return views
}

export function LotPage({ id }: { id: string }) {
  const lot = getLot(id)
  const state = useAuction((s) => s.lots[id])
  if (!lot || !state) return null
  const related = LOTS.filter((l) => l.id !== lot.id && l.category === lot.category).slice(0, 4)
  const more = related.length >= 2 ? related : LOTS.filter((l) => l.id !== lot.id).slice(0, 4)

  return (
    <div className="bg-eb-paper text-eb-ink">
      <div data-eb-tone="light" className="mx-auto max-w-[1400px] px-5 pb-24 pt-24 @3xl:px-12">
        <Crumbs lot={lot} />
        <div className="mt-8 grid gap-10 @4xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] @4xl:gap-16">
          <Gallery lot={lot} />
          <div>
            <Eyebrow className="text-eb-gold-deep">
              Lot {String(lot.number).padStart(3, "0")} · {lot.category}
            </Eyebrow>
            <motion.h1
              className="mt-4 font-eb-serif text-[clamp(2.2rem,4.6cqw,3.8rem)] font-medium leading-[0.98] tracking-[-0.01em]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: EASE, delay: 0.1 }}
            >
              <span className="block font-eb-sans text-[0.8rem] font-medium uppercase tracking-[0.28em] text-eb-taupe">{lot.maker}</span>
              <span className="mt-3 block">{lot.title}</span>
            </motion.h1>
            <p className="mt-4 font-eb-sans text-sm tracking-wide text-eb-taupe">{lot.subtitle}</p>
            <p className="mt-2 font-eb-sans text-sm text-eb-taupe">
              Estimate <span className="text-eb-ink">{formatMoney(lot.estimate[0])} – {formatMoney(lot.estimate[1])}</span>
            </p>
            <BidPanel lot={lot} state={state} />
            <History state={state} />
          </div>
        </div>

        <div className="mt-24 grid gap-14 border-t border-eb-ink/10 pt-14 @4xl:grid-cols-[1fr_1fr] @4xl:gap-20">
          <Reveal>
            <Eyebrow className="text-eb-gold-deep">Catalogue note</Eyebrow>
            <p className="mt-5 font-eb-serif text-[1.45rem] leading-[1.45] text-eb-ink/90 first-letter:float-left first-letter:mr-2 first-letter:font-eb-serif first-letter:text-6xl first-letter:leading-[0.85] first-letter:text-eb-gold-deep">
              {lot.description}
            </p>
            <Eyebrow className="mt-12 text-eb-gold-deep">Condition</Eyebrow>
            <p className="mt-4 font-eb-sans text-sm leading-relaxed text-eb-taupe">{lot.condition}</p>
            <Eyebrow className="mt-10 text-eb-gold-deep">Provenance</Eyebrow>
            <ul className="mt-4 grid gap-2 font-eb-sans text-sm text-eb-taupe">
              {lot.provenance.map((p) => (
                <li key={p} className="flex gap-3">
                  <span className="mt-2 h-px w-4 shrink-0 bg-eb-gold" />
                  {p}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <Eyebrow className="text-eb-gold-deep">Details</Eyebrow>
            <dl className="mt-5 divide-y divide-eb-ink/10 border-y border-eb-ink/10">
              {lot.details.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-4 py-3.5 font-eb-sans text-sm">
                  <dt className="text-eb-stone">{k}</dt>
                  <dd className="text-eb-ink">{v}</dd>
                </div>
              ))}
              <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-4 py-3.5 font-eb-sans text-sm">
                <dt className="text-eb-stone">Viewing</dt>
                <dd className="text-eb-ink">{lot.location}, by appointment</dd>
              </div>
            </dl>
            <div className="mt-8 grid gap-4 font-eb-sans text-sm text-eb-taupe">
              <p className="flex gap-3">
                <ShieldCheck className="size-5 shrink-0 text-eb-gold-deep" strokeWidth={1.25} />
                Authenticated by our specialists, with a lifetime guarantee of authenticity.
              </p>
              <p className="flex gap-3">
                <Truck className="size-5 shrink-0 text-eb-gold-deep" strokeWidth={1.25} />
                Fully insured, white-glove delivery worldwide, or collection from {lot.location}.
              </p>
            </div>
          </Reveal>
        </div>

        <section aria-labelledby="eb-more" className="mt-28">
          <h2 id="eb-more" className="font-eb-serif text-4xl">
            You may <em>also admire</em>
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-12 @md:grid-cols-2 @4xl:grid-cols-4">
            {more.map((l, i) => (
              <LotCard key={l.id} lot={l} index={i} />
            ))}
          </div>
        </section>
      </div>
      <Footer />
    </div>
  )
}

function Crumbs({ lot }: { lot: CatalogueLot }) {
  const shell = useShell()
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-3 font-eb-sans text-[0.66rem] uppercase tracking-[0.24em] text-eb-stone">
      <button type="button" onClick={shell.back} className="inline-flex items-center gap-2 text-eb-ink transition-colors hover:text-eb-gold-deep">
        <ArrowLeft className="size-3.5" strokeWidth={1.5} /> Back
      </button>
      <span aria-hidden>/</span>
      <button type="button" onClick={() => shell.go({ name: "lots", category: lot.category })} className="transition-colors hover:text-eb-ink">
        {lot.category}
      </button>
      <span aria-hidden>/</span>
      <span className="truncate text-eb-taupe">Lot {lot.number}</span>
    </nav>
  )
}

function Gallery({ lot }: { lot: CatalogueLot }) {
  const views = viewsFor(lot)
  const [active, setActive] = React.useState(0)
  const [lens, setLens] = React.useState<{ x: number; y: number } | null>(null)
  const [dir, setDir] = React.useState(1)
  const state = useAuction((s) => s.lots[lot.id])
  const now = useNow()
  const view = views[active]
  const go = (i: number) => {
    setDir(i > active ? 1 : -1)
    setActive((i + views.length) % views.length)
  }

  return (
    <div className="@4xl:sticky @4xl:top-24 @4xl:self-start">
      <div
        className="group relative aspect-[4/5] cursor-zoom-in overflow-hidden bg-eb-ink-3"
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return
          const r = e.currentTarget.getBoundingClientRect()
          setLens({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
        }}
        onPointerLeave={() => setLens(null)}
      >
        <AnimatePresence initial={false} custom={dir}>
          {view && (
            <motion.div
              key={active}
              custom={dir}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.06, filter: "blur(8px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.98, filter: "blur(6px)" }}
              transition={{ duration: 0.9, ease: EASE }}
            >
              <div
                className="size-full transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{
                  transformOrigin: lens ? `${lens.x}% ${lens.y}%` : `${view.x}% ${view.y}%`,
                  transform: `scale(${lens ? Math.max(view.zoom, 1) * 1.9 : view.zoom})`,
                }}
              >
                <img
                  src={photoUrl(view.src, 1600, 2000)}
                  alt={`${lot.maker} ${lot.title}, view ${active + 1} of ${views.length}`}
                  className="size-full object-cover"
                  draggable={false}
                  style={{ objectPosition: `${view.x}% ${view.y}%` }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {views.length === 0 && (
          <div className="absolute inset-0 grid place-items-center font-eb-serif text-3xl italic text-eb-ivory">{lot.title}</div>
        )}
        <div className="pointer-events-none absolute inset-x-4 top-4 flex justify-between">
          <StatusTag state={state} now={now} />
          <WatchButton lotId={lot.id} className="pointer-events-auto ml-auto" />
        </div>
        {views.length > 1 && (
          <div className="absolute inset-x-4 bottom-4 flex justify-between opacity-0 transition-opacity duration-300 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            <button type="button" aria-label="Previous view" onClick={() => go(active - 1)} className="grid size-10 place-items-center rounded-full bg-eb-paper/85 text-eb-ink backdrop-blur hover:bg-eb-paper">
              <ChevronLeft className="size-4" strokeWidth={1.5} />
            </button>
            <button type="button" aria-label="Next view" onClick={() => go(active + 1)} className="grid size-10 place-items-center rounded-full bg-eb-paper/85 text-eb-ink backdrop-blur hover:bg-eb-paper">
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>
      {views.length > 1 && (
        <div className="mt-3 flex gap-3" role="tablist" aria-label="Views">
          {views.map((v, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`View ${i + 1}`}
              onClick={() => go(i)}
              className={cn("relative aspect-square w-16 overflow-hidden bg-eb-ink-3 transition-opacity", i === active ? "opacity-100" : "opacity-50 hover:opacity-90")}
            >
              <img
                src={photoUrl(v.src, 200, 200)}
                alt=""
                className="size-full object-cover"
                style={{ transform: `scale(${v.zoom})`, transformOrigin: `${v.x}% ${v.y}%` }}
                draggable={false}
              />
              {i === active && <motion.span layoutId="eb-thumb" className="absolute inset-x-0 bottom-0 h-0.5 bg-eb-ink" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function BidPanel({ lot, state }: { lot: CatalogueLot; state: LotState }) {
  const shell = useShell()
  const account = useAuction((s) => s.account)
  const now = useNow()
  const open = isOpen(state, now)
  const min = nextMinimum(state)
  const mine = standing(state, now)
  const leading = leader(state) === YOU
  const [amount, setAmount] = React.useState(min)
  const [typed, setTyped] = React.useState<string | null>(null)
  const [maxOn, setMaxOn] = React.useState(false)
  const [maxTyped, setMaxTyped] = React.useState("")

  // Keep the chosen amount valid as the room moves.
  React.useEffect(() => {
    setAmount((a) => (a < min ? min : a))
  }, [min])

  const chips = [min, min + increment(min), snapUp(min + 3 * increment(min), min)]
  const parse = (v: string) => Number(v.replace(/[^\d]/g, "")) || 0
  const max = maxOn ? snapUp(parse(maxTyped), min) : undefined
  const maxError = maxOn && maxTyped && max !== undefined && max <= amount ? "Your maximum should be above your bid." : null

  const submit = () => {
    // If the room moves on before this reaches review, the review says so.
    const go = () => shell.reviewBid(lot.id, amount, maxOn && !maxError ? max : undefined)
    if (account) go()
    else shell.requireAccount(go)
  }

  const raise = () => {
    const go = () => shell.reviewBid(lot.id, snapUp((state.yourMax ?? currentBid(state)) + increment(currentBid(state)), min), undefined)
    if (account) go()
    else shell.requireAccount(go)
  }

  const result = outcome(state, now)

  return (
    <div className="mt-10 border border-eb-ink/12 bg-eb-ivory/60 p-6 @3xl:p-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-eb-sans text-[0.62rem] uppercase tracking-[0.28em] text-eb-stone">{open ? "Current bid" : result.status === "sold" ? "Sold for" : "Highest bid"}</p>
          <p className="mt-2 font-eb-serif text-[clamp(2.4rem,5cqw,3.4rem)] leading-none text-eb-ink">
            <Odometer value={currentBid(state)} />
          </p>
          <p className="mt-3 flex items-center gap-2 font-eb-sans text-xs text-eb-taupe">
            <span className={cn("size-1.5 rounded-full", reserveMet(state) ? "bg-eb-green" : "bg-eb-stone/60")} />
            {reserveMet(state) ? "Reserve met" : "Reserve not yet met"} · {state.bids.length} bids
          </p>
        </div>
        <div className="text-right">
          <p className="font-eb-sans text-[0.62rem] uppercase tracking-[0.28em] text-eb-stone">{open ? "Closes in" : "Closed"}</p>
          <p className="mt-2 font-eb-sans text-xl tracking-wider text-eb-ink">
            <Countdown endsAt={state.endsAt} />
          </p>
          <p className="mt-2 font-eb-sans text-xs text-eb-taupe">
            {new Date(state.endsAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {mine && (
          <motion.div
            key={mine}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="overflow-hidden"
          >
            <p
              className={cn(
                "mt-6 flex items-center gap-2 px-4 py-3 font-eb-sans text-sm",
                mine === "leading" || mine === "won" ? "bg-eb-green/10 text-eb-green" : mine === "outbid" ? "bg-eb-red/10 text-eb-red" : "bg-eb-ink/5 text-eb-taupe"
              )}
              role="status"
            >
              {mine === "leading" && (
                <>
                  <Check className="size-4" /> You're the highest bidder
                  {state.yourMax ? ` · your maximum ${formatMoney(state.yourMax)}` : ""}
                </>
              )}
              {mine === "outbid" && <>You've been outbid. Bid {formatMoney(min)} to take the lead.</>}
              {mine === "won" && (
                <>
                  <Gavel className="size-4" /> You won this lot. Our team will be in touch about payment and delivery.
                </>
              )}
              {mine === "lost" && <>This lot sold to another bidder.</>}
              {mine === "passed" && <>This lot closed below its reserve.</>}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {open && !leading && (
        <div className="mt-7">
          <p className="font-eb-sans text-[0.62rem] uppercase tracking-[0.28em] text-eb-stone">Your bid</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {chips.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setAmount(c)
                  setTyped(null)
                }}
                aria-pressed={amount === c && typed === null}
                className={cn(
                  "h-11 border font-eb-sans text-sm tabular-nums transition-colors",
                  amount === c && typed === null ? "border-eb-ink bg-eb-ink text-eb-ivory" : "border-eb-ink/20 text-eb-ink hover:border-eb-ink"
                )}
              >
                {formatMoney(c)}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center border-b border-eb-ink/20 focus-within:border-eb-ink">
            <span className="font-eb-serif text-xl text-eb-stone">$</span>
            <input
              inputMode="numeric"
              aria-label="Or enter an amount"
              placeholder={`Or enter ${min.toLocaleString("en-US")} or more`}
              value={typed ?? ""}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d,]/g, "")
                setTyped(v)
                const n = parse(v)
                if (n) setAmount(n)
              }}
              onBlur={() => {
                if (typed === null || typed === "") return setTyped(null)
                const snapped = snapUp(Math.max(parse(typed), min), min)
                setAmount(snapped)
                setTyped(snapped.toLocaleString("en-US"))
              }}
              className="h-12 w-full bg-transparent px-2 font-eb-serif text-xl tabular-nums text-eb-ink placeholder:font-eb-sans placeholder:text-sm placeholder:text-eb-stone focus:outline-none"
            />
          </label>
          {typed && parse(typed) > 0 && parse(typed) < min && (
            <p className="mt-2 font-eb-sans text-xs text-eb-red">The next bid must be at least {formatMoney(min)}.</p>
          )}

          <label className="mt-5 flex cursor-pointer items-start gap-3 font-eb-sans text-sm text-eb-ink">
            <input type="checkbox" checked={maxOn} onChange={(e) => setMaxOn(e.target.checked)} className="mt-0.5 size-4 accent-eb-ink" />
            <span>
              Set a maximum bid
              <span className="block text-xs text-eb-taupe">We'll bid for you, one increment at a time, only as far as you need.</span>
            </span>
          </label>
          <AnimatePresence initial={false}>
            {maxOn && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <label className="mt-3 flex items-center border-b border-eb-ink/20 focus-within:border-eb-ink">
                  <span className="font-eb-serif text-xl text-eb-stone">$</span>
                  <input
                    inputMode="numeric"
                    aria-label="Maximum bid"
                    placeholder="Your maximum"
                    value={maxTyped}
                    onChange={(e) => setMaxTyped(e.target.value.replace(/[^\d,]/g, ""))}
                    onBlur={() => maxTyped && setMaxTyped(snapUp(parse(maxTyped), min).toLocaleString("en-US"))}
                    className="h-12 w-full bg-transparent px-2 font-eb-serif text-xl tabular-nums text-eb-ink placeholder:font-eb-sans placeholder:text-sm placeholder:text-eb-stone focus:outline-none"
                  />
                </label>
                {maxError && <p className="mt-2 font-eb-sans text-xs text-eb-red">{maxError}</p>}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="button"
            disabled={amount < min || !!maxError || (maxOn && !maxTyped)}
            onClick={submit}
            className={cn(btn.base, btn.solidDark, "mt-7 h-14 w-full text-[0.74rem]")}
          >
            <Gavel className="size-4" strokeWidth={1.5} />
            {account ? `Place bid · ${formatMoney(Math.max(amount, min))}` : "Sign in to bid"}
          </button>
          <p className="mt-3 text-center font-eb-sans text-[0.68rem] text-eb-stone">
            Next increment {formatMoney(increment(currentBid(state) || state.startPrice))} · 25% buyer's premium applies
          </p>
        </div>
      )}

      {open && leading && (
        <button type="button" onClick={raise} className={cn(btn.base, btn.ghostDark, "mt-7 h-12 w-full")}>
          Raise my maximum
        </button>
      )}
    </div>
  )
}

function ago(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 10) return "just now"
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function History({ state }: { state: LotState }) {
  const now = useNow()
  const [expanded, setExpanded] = React.useState(false)
  const bids = [...state.bids].reverse()
  const shown = expanded ? bids : bids.slice(0, 6)
  return (
    <section aria-labelledby="eb-history" className="mt-10">
      <div className="flex items-baseline justify-between">
        <h2 id="eb-history" className="font-eb-sans text-[0.62rem] uppercase tracking-[0.28em] text-eb-stone">
          Bidding history
        </h2>
        {isOpen(state, now) && (
          <span className="flex items-center gap-2 font-eb-sans text-[0.62rem] uppercase tracking-[0.24em] text-eb-red">
            <span className="relative flex size-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-eb-red/60" />
              <span className="relative size-1.5 rounded-full bg-eb-red" />
            </span>
            Live
          </span>
        )}
      </div>
      <ol className="mt-4 border-t border-eb-ink/10" aria-live="polite">
        <AnimatePresence initial={false}>
          {shown.map((b, i) => (
            <motion.li
              key={b.id}
              layout
              initial={{ opacity: 0, height: 0, backgroundColor: "rgba(201,169,110,0.25)" }}
              animate={{ opacity: 1, height: "auto", backgroundColor: "rgba(201,169,110,0)" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.7, ease: EASE, backgroundColor: { duration: 1.6 } }}
              className="overflow-hidden border-b border-eb-ink/10"
            >
              <div className="flex items-center justify-between gap-4 py-3 font-eb-sans text-sm">
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full text-[0.6rem] tracking-wider",
                      b.bidder === YOU ? "bg-eb-ink text-eb-ivory" : "bg-eb-ink/5 text-eb-taupe"
                    )}
                  >
                    {b.bidder === YOU ? "You" : b.bidder.slice(1, 3)}
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block truncate", b.bidder === YOU ? "text-eb-ink" : "text-eb-taupe")}>
                      {bidderLabel(b.bidder)}
                      {b.auto && <span className="ml-2 text-[0.6rem] uppercase tracking-[0.2em] text-eb-gold-deep">Max bid</span>}
                    </span>
                    <span className="block text-xs text-eb-stone">
                      {bidderCity(b.bidder) ?? "Online"} · {ago(now - b.at)}
                    </span>
                  </span>
                </span>
                <span className={cn("font-eb-serif text-lg tabular-nums", i === 0 ? "text-eb-ink" : "text-eb-taupe")}>{formatMoney(b.amount)}</span>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      {bids.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-4 font-eb-sans text-[0.66rem] uppercase tracking-[0.24em] text-eb-ink underline-offset-4 hover:underline"
        >
          {expanded ? "Show fewer" : `Show all ${bids.length} bids`}
        </button>
      )}
    </section>
  )
}
