import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { delay } from "@/os/kernel/rng"
import { money, useTrypNow, type Kind, type Listing, type Package } from "./data"

const KIND_LABEL: Record<Kind, string> = { hotel: "Hotels", attraction: "Attractions", transfer: "Transfers" }

type Placed = { key: number; item: Listing }

/**
 * Drag inventory into days to build a package, then publish it to the
 * marketplace. Built with container queries, so it fits a narrow window, a
 * phone, and the journey's full-width browser frame alike.
 */
export function PackageBuilder({ onPublished }: { onPublished: (pkg: Package) => void }) {
  const listings = useTrypNow((s) => s.listings)
  const publishPackage = useTrypNow((s) => s.publishPackage)
  const [kind, setKind] = React.useState<Kind>("attraction")
  // Start with a half-built package so there's something to see.
  const [days, setDays] = React.useState<Placed[][]>(() =>
    [["t1", "h1"], ["a1"], []].map((ids, d) =>
      ids.flatMap((id, i) => {
        const item = listings.find((l) => l.id === id)
        return item ? [{ key: d * 10 + i, item }] : []
      })
    )
  )
  const [name, setName] = React.useState("Dubai Getaway")
  const [active, setActive] = React.useState(2)
  const [hover, setHover] = React.useState<number | null>(null)
  const [publishing, setPublishing] = React.useState(false)
  const zones = React.useRef<(HTMLDivElement | null)[]>([])
  const nextKey = React.useRef(10)
  const dragged = React.useRef(false)

  const zoneAt = (x: number, y: number) =>
    zones.current.findIndex((z) => {
      const r = z?.getBoundingClientRect()
      return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
    })

  const add = (d: number, item: Listing) => {
    setDays((ds) => ds.map((list, i) => (i === d ? [...list, { key: ++nextKey.current, item }] : list)))
    setActive(d)
  }
  const remove = (d: number, key: number) =>
    setDays((ds) => ds.map((list, i) => (i === d ? list.filter((p) => p.key !== key) : list)))

  const total = days.flat().reduce((n, p) => n + p.item.price, 0)
  const nights = days.length - 1

  const publish = async () => {
    setPublishing(true)
    await delay(650)
    const highlights = [...new Set(days.flat().map((p) => p.item.name))].slice(0, 4)
    const pkg = publishPackage({
      name: name.trim() || "Untitled package",
      city: "Dubai",
      nights,
      pricePerPax: total,
      highlights,
      emoji: "🧳",
    })
    setPublishing(false)
    onPublished(pkg)
  }

  // Its own container: the builder sizes itself to the space it's given, not the window.
  return (
    <div className="@container">
      <div className="grid grid-cols-[minmax(0,1fr)] @3xl:grid-cols-[15rem_minmax(0,1fr)]">
        {/* Inventory */}
        <aside className="border-b border-tn-line bg-tn-bg p-3 @3xl:border-b-0 @3xl:border-r">
          <div className="flex gap-1 rounded-md bg-white p-0.5 ring-1 ring-tn-line" role="tablist" aria-label="Inventory type">
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                data-tour={`tn-kind-${k}`}
                onClick={() => setKind(k)}
                className={cn(
                  "flex-1 rounded px-1 py-1 text-[0.6875rem] font-semibold",
                  kind === k ? "bg-tn-teal text-white" : "text-tn-ink hover:bg-tn-mint"
                )}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[0.6875rem] text-tn-muted">Drag into a day — or tap to add to Day {active + 1}.</p>
          <ul className="mt-2 grid gap-2 @md:grid-cols-2 @3xl:grid-cols-1">
            {listings
              .filter((i) => i.kind === kind)
              .map((item) => (
                <li key={item.id}>
                  <motion.button
                    type="button"
                    drag
                    dragSnapToOrigin
                    dragElastic={0.9}
                    whileDrag={{ scale: 1.05, rotate: -2, zIndex: 50, boxShadow: "0 12px 24px rgb(15 59 56 / 0.25)" }}
                    onDragStart={() => {
                      dragged.current = true
                    }}
                    onDrag={(_, info) => {
                      const z = zoneAt(info.point.x - window.scrollX, info.point.y - window.scrollY)
                      setHover(z === -1 ? null : z)
                    }}
                    onDragEnd={(_, info) => {
                      setHover(null)
                      const z = zoneAt(info.point.x - window.scrollX, info.point.y - window.scrollY)
                      if (z !== -1) add(z, item)
                    }}
                    onClick={() => {
                      if (dragged.current) {
                        dragged.current = false
                        return
                      }
                      add(active, item)
                    }}
                    data-tour={`tn-item-${item.id}`}
                    aria-label={`Add ${item.name} to day ${active + 1}`}
                    className="relative flex w-full cursor-grab touch-none items-center gap-2 rounded-md border border-tn-line-2 bg-white p-2 text-left active:cursor-grabbing"
                  >
                    <span className="text-xl">{item.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 truncate text-sm font-semibold text-tn-ink">
                        <span className="truncate">{item.name}</span>
                        {item.ai && <Sparkles className="size-3 shrink-0 text-tn-teal" aria-label="Created with AI" />}
                      </span>
                      <span className="block text-[0.6875rem] text-tn-muted">{item.meta}</span>
                    </span>
                    <span className="text-sm font-bold text-tn-teal">${item.price}</span>
                  </motion.button>
                </li>
              ))}
          </ul>
        </aside>

        {/* Itinerary */}
        <div className="@container min-w-0 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Package name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-tour="tn-package-name"
                className="w-full max-w-xs rounded-md border border-transparent bg-transparent px-1 py-0.5 text-lg font-bold text-tn-ink outline-none hover:border-tn-line-2 focus:border-tn-teal"
              />
              <span className="block px-1 text-xs text-tn-muted">
                Dubai · {nights}N/{days.length}D
              </span>
            </label>
            <p className="text-sm text-tn-muted">
              <span className="text-xl font-bold text-tn-ink">{money(total)}</span> / person
            </p>
          </div>
          <div className="mt-3 grid gap-3 @md:grid-cols-2 @3xl:grid-cols-4">
            {days.map((list, d) => (
              <div
                key={d}
                ref={(el) => {
                  zones.current[d] = el
                }}
                data-tour={`tn-day-${d}`}
                className={cn(
                  "flex min-h-36 flex-col rounded-md border-2 border-dashed p-2 transition-colors",
                  hover === d
                    ? "border-tn-teal bg-tn-mint"
                    : active === d
                      ? "border-tn-teal/60 bg-white"
                      : "border-tn-line-2 bg-white"
                )}
              >
                <button
                  type="button"
                  onClick={() => setActive(d)}
                  className="mb-2 flex items-center justify-between text-left text-xs font-bold uppercase tracking-wider text-tn-teal"
                >
                  Day {d + 1}
                  {active === d && <span className="text-[0.625rem] font-medium normal-case text-tn-muted">tap target</span>}
                </button>
                <ul className="flex flex-1 flex-col gap-1.5">
                  <AnimatePresence initial={false}>
                    {list.map((p) => (
                      <motion.li
                        key={p.key}
                        layout
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex items-center gap-1.5 rounded bg-tn-soft px-2 py-1 text-xs text-tn-ink"
                      >
                        <span>{p.item.emoji}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold">{p.item.name}</span>
                        <button
                          type="button"
                          aria-label={`Remove ${p.item.name} from day ${d + 1}`}
                          onClick={() => remove(d, p.key)}
                          className="px-1 text-tn-muted hover:text-[#b3261e]"
                        >
                          ×
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                  {list.length === 0 && <li className="m-auto text-xs text-tn-faint">drop stuff here</li>}
                </ul>
              </div>
            ))}
            {days.length < 4 && (
              <button
                type="button"
                onClick={() => {
                  setDays((ds) => [...ds, []])
                  setActive(days.length)
                }}
                className="min-h-36 rounded-md border-2 border-dashed border-tn-line-2 text-sm font-semibold text-tn-muted hover:border-tn-teal hover:text-tn-teal"
              >
                + Add day
              </button>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={total === 0 || publishing}
              onClick={publish}
              data-tour="tn-publish"
              className="rounded-md bg-tn-teal px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d6961] disabled:opacity-40"
            >
              {publishing ? "Publishing…" : "Publish package"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
