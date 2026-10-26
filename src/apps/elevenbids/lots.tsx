import * as React from "react"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import { Heart, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { currentBid, isOpen, outcome, type LotState } from "./auction"
import { CATEGORIES, LOTS, photoUrl, type Category, type CatalogueLot } from "./catalogue"
import { useShell } from "./shell"
import { standing, useAuction } from "./store"
import { EASE, Eyebrow, Odometer, useNow } from "./ui"

const STANDING_LABEL = {
  leading: "You're leading",
  outbid: "Outbid",
  won: "Won",
  lost: "Sold",
  passed: "Passed",
} as const

/** A lot's photograph, with a quiet shimmer while it loads and a card if it can't. */
export function LotImage({
  lot,
  width,
  className,
  imgClassName,
  sizes,
  eager,
}: {
  lot: CatalogueLot
  width: number
  className?: string
  imgClassName?: string
  sizes?: string
  eager?: boolean
}) {
  const [loaded, setLoaded] = React.useState(false)
  const [broken, setBroken] = React.useState(false)
  const photo = lot.photos[0]
  const focus = photo?.focus ?? [50, 50]
  return (
    <div className={cn("relative overflow-hidden bg-eb-ink-3", className)}>
      {!loaded && !broken && <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-eb-ink-3 to-eb-ink-2" />}
      {photo && !broken ? (
        <img
          src={photoUrl(photo.src, width, Math.round(width * 1.25))}
          srcSet={`${photoUrl(photo.src, Math.round(width / 2), Math.round(width * 0.625))} ${Math.round(width / 2)}w, ${photoUrl(photo.src, width, Math.round(width * 1.25))} ${width}w`}
          sizes={sizes ?? `${width}px`}
          alt={`${lot.maker} ${lot.title}`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
          style={{ objectPosition: `${focus[0]}% ${focus[1]}%` }}
          className={cn(
            "size-full object-cover transition-[opacity,transform,filter] duration-[0.6s] ease-[cubic-bezier(0.16,1,0.3,1)]",
            loaded ? "opacity-100" : "opacity-0",
            imgClassName
          )}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div>
            <Eyebrow className="text-eb-gold">{lot.maker}</Eyebrow>
            <p className="mt-3 font-eb-serif text-2xl italic text-eb-ivory">{lot.title}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export function WatchButton({ lotId, className, tone = "dark" }: { lotId: string; className?: string; tone?: "dark" | "light" }) {
  const watching = useAuction((s) => s.watch.includes(lotId))
  const toggle = useAuction((s) => s.toggleWatch)
  return (
    <button
      type="button"
      aria-pressed={watching}
      aria-label={watching ? "Remove from watchlist" : "Add to watchlist"}
      onClick={(e) => {
        e.stopPropagation()
        toggle(lotId)
      }}
      className={cn(
        "grid size-9 place-items-center rounded-full backdrop-blur-md transition-colors",
        tone === "dark" ? "bg-eb-ink/40 text-eb-ivory hover:bg-eb-ink/70" : "bg-eb-paper/80 text-eb-ink hover:bg-eb-paper",
        className
      )}
    >
      <motion.span key={String(watching)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
        <Heart className={cn("size-4", watching && "fill-eb-gold text-eb-gold")} strokeWidth={1.5} />
      </motion.span>
    </button>
  )
}

export function StatusTag({ state, now, className }: { state: LotState; now: number; className?: string }) {
  const mine = standing(state, now)
  const open = isOpen(state, now)
  const closing = open && state.endsAt - now < 60 * 60_000
  const label = mine ? STANDING_LABEL[mine] : !open ? (outcome(state, now).status === "sold" ? "Sold" : "Passed") : closing ? "Closing soon" : null
  if (!label) return null
  const tone =
    mine === "leading" || mine === "won"
      ? "bg-eb-green text-white"
      : mine === "outbid"
        ? "bg-eb-red text-white"
        : closing
          ? "bg-eb-ivory text-eb-ink"
          : "bg-eb-ink/70 text-eb-ivory"
  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 font-eb-sans text-[0.6rem] font-medium uppercase tracking-[0.2em]", tone, className)}>
      {label}
    </span>
  )
}

/** The catalogue card. */
export function LotCard({ lot, index = 0 }: { lot: CatalogueLot; index?: number }) {
  const shell = useShell()
  const state = useAuction((s) => s.lots[lot.id])
  const now = useNow()
  if (!state) return null
  const open = isOpen(state, now)
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.18, ease: "easeIn" } }}
      // Quick on a change of department: a short stagger, and cards that stay glide straight to their new places.
      transition={{ duration: 0.45, ease: EASE, delay: Math.min(index, 6) * 0.03, layout: { duration: 0.4, ease: EASE } }}
      className="group relative"
    >
      <button
        type="button"
        onClick={() => shell.go({ name: "lot", id: lot.id })}
        className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-eb-gold"
        aria-label={`Lot ${lot.number}: ${lot.maker} ${lot.title}`}
      >
        <LotImage lot={lot} width={720} className="aspect-[4/5]" imgClassName="group-hover:scale-[1.045]" sizes="(min-width: 900px) 25vw, 50vw" />
        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Eyebrow className="truncate text-eb-taupe">
              {String(lot.number).padStart(3, "0")} · {lot.maker}
            </Eyebrow>
            <h3 className="mt-1.5 font-eb-serif text-[1.35rem] leading-tight text-eb-ink transition-colors group-hover:text-eb-gold-deep">{lot.title}</h3>
          </div>
        </div>
        <div className="mt-3 flex items-end justify-between gap-2 border-t border-eb-ink/10 pt-3 font-eb-sans">
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.24em] text-eb-stone">{open ? "Current bid" : "Final bid"}</p>
            <p className="mt-0.5 font-eb-serif text-xl text-eb-ink">
              <Odometer value={currentBid(state)} />
            </p>
          </div>
          <p className="text-right text-[0.6rem] uppercase tracking-[0.24em] text-eb-stone">{state.bids.length} bids</p>
        </div>
        <LotTimer endsAt={state.endsAt} now={now} />
      </button>
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between">
        <StatusTag state={state} now={now} />
        <WatchButton lotId={lot.id} className="pointer-events-auto ml-auto opacity-90" />
      </div>
    </motion.article>
  )
}

const UNITS = [
  { label: "Days", ms: 86_400_000, of: Infinity },
  { label: "Hrs", ms: 3_600_000, of: 24 },
  { label: "Min", ms: 60_000, of: 60 },
  { label: "Sec", ms: 1000, of: 60 },
] as const

/**
 * The strip along the foot of a card: time left as four desk-calendar
 * pages (a dark header band, the figure below with a fold across it), each
 * turning over as its figure changes. Red when the lot is about to close.
 */
function LotTimer({ endsAt, now }: { endsAt: number; now: number }) {
  const left = endsAt - now
  const closing = left > 0 && left < 60 * 60_000
  if (left <= 0) {
    const date = new Date(endsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    return (
      <div className="mt-3 flex items-center justify-between bg-eb-ink/[0.04] px-3 py-2.5 font-eb-sans text-[0.6rem] uppercase tracking-[0.24em] text-eb-stone">
        <span>Bidding closed</span>
        <span>{date}</span>
      </div>
    )
  }
  const figures = UNITS.map((u) => ({ label: u.label, value: String(Math.floor(left / u.ms) % u.of).padStart(2, "0") }))
  return (
    <div className="mt-3 flex items-center gap-3 bg-eb-ink/[0.04] p-2 font-eb-sans" role="timer" aria-label={`Closes in ${figures.map((f) => `${f.value} ${f.label}`).join(" ")}`}>
      <p className={cn("w-12 shrink-0 pl-1 text-[0.55rem] uppercase leading-snug tracking-[0.22em]", closing ? "text-eb-red" : "text-eb-stone")}>
        {closing ? "Closing soon" : "Closes in"}
      </p>
      <div className="grid flex-1 grid-cols-4 gap-1.5" aria-hidden>
        {figures.map((f) => (
          <div key={f.label} className="overflow-hidden rounded-[3px] bg-eb-paper text-center shadow-[0_1px_0_rgba(11,10,9,0.08)] ring-1 ring-eb-ink/10">
            <div className={cn("py-[3px] text-[0.5rem] uppercase tracking-[0.2em] text-eb-ivory/85", closing ? "bg-eb-red" : "bg-eb-ink")}>{f.label}</div>
            <div className="relative h-7 overflow-hidden font-eb-serif text-lg leading-7 text-eb-ink">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={f.value}
                  className="block"
                  initial={{ y: "-60%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: "60%", opacity: 0 }}
                  transition={{ duration: 0.35, ease: EASE }}
                >
                  {f.value}
                </motion.span>
              </AnimatePresence>
              <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-eb-ink/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type Sort = "closing" | "price-high" | "price-low" | "bids" | "number"

const SORTS: { id: Sort; label: string }[] = [
  { id: "closing", label: "Closing soonest" },
  { id: "price-high", label: "Highest bid" },
  { id: "price-low", label: "Lowest bid" },
  { id: "bids", label: "Most bids" },
  { id: "number", label: "Lot number" },
]

/** Every lot in the sale, with filters. Used on the landing page and as its own view. */
export function Catalogue({ category: initial, compact }: { category?: Category; compact?: boolean }) {
  const lots = useAuction((s) => s.lots)
  const watch = useAuction((s) => s.watch)
  const now = useNow()
  const [category, setCategory] = React.useState<Category | "All" | "Watchlist">(initial ?? "All")
  const [sort, setSort] = React.useState<Sort>("closing")
  const [query, setQuery] = React.useState("")
  const [showAll, setShowAll] = React.useState(!compact)

  React.useEffect(() => {
    if (initial) setCategory(initial)
  }, [initial])

  const q = query.trim().toLowerCase()
  const list = LOTS.filter((l) => lots[l.id])
    .filter((l) => (category === "All" ? true : category === "Watchlist" ? watch.includes(l.id) : l.category === category))
    .filter((l) => !q || `${l.maker} ${l.title} ${l.subtitle} ${l.category}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const sa = lots[a.id]
      const sb = lots[b.id]
      // Closed lots sink to the end.
      const oa = isOpen(sa, now) ? 0 : 1
      const ob = isOpen(sb, now) ? 0 : 1
      if (oa !== ob) return oa - ob
      if (sort === "closing") return sa.endsAt - sb.endsAt
      if (sort === "price-high") return currentBid(sb) - currentBid(sa)
      if (sort === "price-low") return currentBid(sa) - currentBid(sb)
      if (sort === "bids") return sb.bids.length - sa.bids.length
      return a.number - b.number
    })
  const shown = showAll ? list : list.slice(0, 8)
  const tabs: (Category | "All" | "Watchlist")[] = ["All", ...CATEGORIES, "Watchlist"]

  return (
    <div>
      <div className="flex flex-col gap-5 border-b border-eb-ink/10 pb-5 @4xl:flex-row @4xl:items-end @4xl:justify-between">
        <LayoutGroup id="eb-tabs">
          <div className="-mx-1 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Category">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={category === t}
                onClick={() => setCategory(t)}
                className={cn(
                  "relative shrink-0 px-3 py-2 font-eb-sans text-[0.68rem] uppercase tracking-[0.2em] transition-colors",
                  category === t ? "text-eb-ink" : "text-eb-stone hover:text-eb-ink"
                )}
              >
                {t}
                {t === "Watchlist" && watch.length > 0 && <span className="ml-1.5 text-eb-gold-deep">{watch.length}</span>}
                {category === t && (
                  <motion.span layoutId="eb-tab-line" className="absolute inset-x-3 -bottom-px h-px bg-eb-ink" transition={{ duration: 0.3, ease: EASE }} />
                )}
              </button>
            ))}
          </div>
        </LayoutGroup>
        <div className="flex items-center gap-3">
          <label className="relative flex-1 @4xl:w-56 @4xl:flex-none">
            <span className="sr-only">Search lots</span>
            <Search className="pointer-events-none absolute left-0 top-1/2 size-3.5 -translate-y-1/2 text-eb-stone" strokeWidth={1.5} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the sale"
              className="h-9 w-full border-b border-eb-ink/20 bg-transparent pl-6 font-eb-sans text-sm text-eb-ink placeholder:text-eb-stone focus:border-eb-ink focus:outline-none"
            />
          </label>
          <label className="shrink-0">
            <span className="sr-only">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="h-9 cursor-pointer border-b border-eb-ink/20 bg-transparent pr-1 font-eb-sans text-xs uppercase tracking-[0.14em] text-eb-ink focus:border-eb-ink focus:outline-none"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className="mt-5 font-eb-sans text-xs tracking-wide text-eb-stone" aria-live="polite">
        {list.length} {list.length === 1 ? "lot" : "lots"}
        {category === "Watchlist" && list.length === 0 && " — tap the heart on any lot to follow it here."}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-12 @md:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {shown.map((lot, i) => (
            <LotCard key={lot.id} lot={lot} index={i} />
          ))}
        </AnimatePresence>
      </div>

      {!showAll && list.length > shown.length && (
        <div className="mt-14 flex justify-center">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="group inline-flex items-center gap-3 font-eb-sans text-[0.7rem] uppercase tracking-[0.3em] text-eb-ink"
          >
            <span className="h-px w-10 bg-eb-ink transition-all duration-500 group-hover:w-16" />
            View all {list.length} lots
            <span className="h-px w-10 bg-eb-ink transition-all duration-500 group-hover:w-16" />
          </button>
        </div>
      )}
    </div>
  )
}
