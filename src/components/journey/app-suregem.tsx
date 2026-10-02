import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { cn } from "@/lib/utils"
import { AppWindow, DemoNote } from "./app-window"

/* ------------------------------- demo data -------------------------------- */

const SHAPES = ["Round", "Princess", "Oval", "Emerald", "Pear", "Cushion"] as const
const COLORS = ["D", "E", "F", "G", "H", "I", "J"] as const
const CLARITIES = ["IF", "VVS1", "VVS2", "VS1", "VS2", "SI1"] as const
const CUTS = ["EX", "VG", "GD"] as const
const LABS = ["GIA", "IGI"] as const
const CARATS = [
  { label: "0.3–0.7", min: 0.3, max: 0.7 },
  { label: "0.7–1", min: 0.7, max: 1 },
  { label: "1–1.5", min: 1, max: 1.5 },
  { label: "1.5–2", min: 1.5, max: 2 },
  { label: "2+", min: 2, max: 9 },
]
const CITIES = ["Surat", "Mumbai", "Antwerp", "Dubai", "New York", "Ramat Gan"]

type Shape = (typeof SHAPES)[number]
type Stone = {
  id: string
  shape: Shape
  carat: number
  color: (typeof COLORS)[number]
  clarity: (typeof CLARITIES)[number]
  cut: (typeof CUTS)[number]
  lab: (typeof LABS)[number]
  grown: boolean
  price: number
  city: string
  depth: number
  table: number
}

/** Deterministic PRNG so the inventory is the same on every visit. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const INVENTORY: Stone[] = (() => {
  const r = mulberry32(42)
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]
  return Array.from({ length: 96 }, (_, i) => {
    const carat = Math.round((0.3 + r() ** 1.6 * 2.6) * 100) / 100
    const color = pick(COLORS)
    const clarity = pick(CLARITIES)
    const cut = pick(CUTS)
    const grown = r() < 0.35
    const perCarat =
      (2400 + carat * 3800) *
      (1 + (COLORS.length - COLORS.indexOf(color)) * 0.09) *
      (1 + (CLARITIES.length - CLARITIES.indexOf(clarity)) * 0.08) *
      (cut === "EX" ? 1.12 : cut === "VG" ? 1 : 0.9) *
      (grown ? 0.22 : 1)
    return {
      id: `SG-${(48211 + i * 37).toString(36).toUpperCase()}`,
      shape: pick(SHAPES),
      carat,
      color,
      clarity,
      cut,
      lab: grown ? "IGI" : pick(LABS),
      grown,
      price: Math.round((perCarat * carat) / 10) * 10,
      city: pick(CITIES),
      depth: Math.round((59 + r() * 4) * 10) / 10,
      table: Math.round((54 + r() * 5) * 10) / 10,
    }
  })
})()

const usd = (n: number) => `$${n.toLocaleString("en-US")}`

/* --------------------------------- bits ----------------------------------- */

function ShapeIcon({ shape, className }: { shape: Shape; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6 }
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} aria-hidden>
      {shape === "Round" && <circle cx="12" cy="12" r="8" {...common} />}
      {shape === "Princess" && <rect x="5" y="5" width="14" height="14" {...common} />}
      {shape === "Oval" && <ellipse cx="12" cy="12" rx="6" ry="9" {...common} />}
      {shape === "Emerald" && <path d="M8 4h8l3 3v10l-3 3H8l-3-3V7z" {...common} />}
      {shape === "Pear" && <path d="M12 3c3 4 6 8 6 11a6 6 0 0 1-12 0c0-3 3-7 6-11z" {...common} />}
      {shape === "Cushion" && <rect x="5" y="5" width="14" height="14" rx="4" {...common} />}
    </svg>
  )
}

function Chip({
  on,
  onClick,
  children,
  className,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "border-2 px-2 py-1 text-xs font-semibold transition-colors",
        on
          ? "border-[#1b2a4a] bg-[#1b2a4a] text-white"
          : "border-[#d9d4c7] bg-white text-[#1b2a4a] hover:border-[#1b2a4a]",
        className
      )}
    >
      {children}
    </button>
  )
}

function toggle<T>(list: T[], v: T) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-[#7a7466]">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

/** A spinning faceted diamond, drawn as SVG. */
function DiamondArt() {
  return (
    <motion.svg
      viewBox="0 0 120 100"
      className="mx-auto w-40 drop-shadow-[0_8px_24px_rgb(91_141_239/0.45)]"
      animate={{ rotateY: [-28, 28], y: [0, -6, 0] }}
      transition={{ duration: 3, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      aria-hidden
    >
      <polygon points="20,30 40,10 80,10 100,30 60,95" fill="#cfe4ff" stroke="#1b2a4a" strokeWidth="2" />
      <polygon points="20,30 100,30 60,95" fill="#a8cdfb" stroke="#1b2a4a" strokeWidth="2" />
      <polygon points="40,10 60,30 80,10" fill="#eef6ff" stroke="#1b2a4a" strokeWidth="2" />
      <polyline points="40,30 60,95 80,30" fill="none" stroke="#1b2a4a" strokeWidth="1.5" />
      <rect x="44" y="14" width="5" height="5" fill="white" />
    </motion.svg>
  )
}

/* --------------------------------- views ---------------------------------- */

type Toast = { id: number; text: string }

function BuyerView({ onToast, cart, setCart }: {
  onToast: (t: string) => void
  cart: string[]
  setCart: React.Dispatch<React.SetStateAction<string[]>>
}) {
  const [shapes, setShapes] = React.useState<Shape[]>([])
  const [carats, setCarats] = React.useState<string[]>([])
  const [colors, setColors] = React.useState<string[]>([])
  const [clarities, setClarities] = React.useState<string[]>([])
  const [cuts, setCuts] = React.useState<string[]>(["EX"])
  const [labs, setLabs] = React.useState<string[]>([])
  const [grown, setGrown] = React.useState<"all" | "natural" | "lab">("all")
  const [sort, setSort] = React.useState<"price" | "carat">("price")
  const [open, setOpen] = React.useState<Stone | null>(null)

  const results = React.useMemo(() => {
    const ranges = CARATS.filter((c) => carats.includes(c.label))
    return INVENTORY.filter(
      (s) =>
        (!shapes.length || shapes.includes(s.shape)) &&
        (!ranges.length || ranges.some((c) => s.carat >= c.min && s.carat < c.max)) &&
        (!colors.length || colors.includes(s.color)) &&
        (!clarities.length || clarities.includes(s.clarity)) &&
        (!cuts.length || cuts.includes(s.cut)) &&
        (!labs.length || labs.includes(s.lab)) &&
        (grown === "all" || (grown === "lab") === s.grown)
    ).sort((a, b) => (sort === "price" ? a.price - b.price : b.carat - a.carat))
  }, [shapes, carats, colors, clarities, cuts, labs, grown, sort])

  const reset = () => {
    setShapes([])
    setCarats([])
    setColors([])
    setClarities([])
    setCuts([])
    setLabs([])
    setGrown("all")
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[17rem_1fr]">
      {/* Filters */}
      <aside className="flex flex-col gap-4 border-b-2 border-[#e8e3d6] bg-[#fbfaf6] p-4 lg:border-b-0 lg:border-r-2">
        <FilterGroup label="Shape">
          {SHAPES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={shapes.includes(s)}
              onClick={() => setShapes((x) => toggle(x, s))}
              className={cn(
                "flex w-[3.6rem] flex-col items-center gap-0.5 border-2 py-1 text-[0.625rem] font-semibold",
                shapes.includes(s)
                  ? "border-[#1b2a4a] bg-[#1b2a4a] text-white"
                  : "border-[#d9d4c7] bg-white text-[#1b2a4a] hover:border-[#1b2a4a]"
              )}
            >
              <ShapeIcon shape={s} />
              {s}
            </button>
          ))}
        </FilterGroup>
        <FilterGroup label="Carat">
          {CARATS.map((c) => (
            <Chip key={c.label} on={carats.includes(c.label)} onClick={() => setCarats((x) => toggle(x, c.label))}>
              {c.label}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup label="Color">
          {COLORS.map((c) => (
            <Chip key={c} on={colors.includes(c)} onClick={() => setColors((x) => toggle(x, c))} className="w-8">
              {c}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup label="Clarity">
          {CLARITIES.map((c) => (
            <Chip key={c} on={clarities.includes(c)} onClick={() => setClarities((x) => toggle(x, c))}>
              {c}
            </Chip>
          ))}
        </FilterGroup>
        <div className="grid grid-cols-2 gap-4">
          <FilterGroup label="Cut">
            {CUTS.map((c) => (
              <Chip key={c} on={cuts.includes(c)} onClick={() => setCuts((x) => toggle(x, c))}>
                {c}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Lab">
            {LABS.map((c) => (
              <Chip key={c} on={labs.includes(c)} onClick={() => setLabs((x) => toggle(x, c))}>
                {c}
              </Chip>
            ))}
          </FilterGroup>
        </div>
        <FilterGroup label="Origin">
          {(["all", "natural", "lab"] as const).map((g) => (
            <Chip key={g} on={grown === g} onClick={() => setGrown(g)}>
              {g === "all" ? "All" : g === "natural" ? "Natural" : "Lab-grown"}
            </Chip>
          ))}
        </FilterGroup>
      </aside>

      {/* Results */}
      <div className="relative min-w-0 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[#5c5648]" aria-live="polite">
            <span className="text-xl font-bold text-[#1b2a4a]">{results.length}</span> stones match
          </p>
          <div className="flex items-center gap-2 text-xs">
            <button type="button" onClick={reset} className="font-semibold text-[#5b8def] hover:underline">
              Reset
            </button>
            <span className="text-[#7a7466]">Sort</span>
            <Chip on={sort === "price"} onClick={() => setSort("price")}>Price ↑</Chip>
            <Chip on={sort === "carat"} onClick={() => setSort("carat")}>Carat ↓</Chip>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-[0.6875rem] uppercase tracking-wider text-[#7a7466]">
              <tr className="border-b-2 border-[#e8e3d6]">
                <th className="py-2 pr-2 font-bold">Stone</th>
                <th className="py-2 pr-2 font-bold">Carat</th>
                <th className="py-2 pr-2 font-bold">Col</th>
                <th className="py-2 pr-2 font-bold">Clar</th>
                <th className="py-2 pr-2 font-bold">Cut</th>
                <th className="py-2 pr-2 font-bold">Lab</th>
                <th className="py-2 pr-2 text-right font-bold">Price</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 8).map((s) => (
                <motion.tr
                  layout
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setOpen(s)}
                  className="cursor-pointer border-b border-[#efebe0] hover:bg-[#f1f5ff]"
                >
                  <td className="py-2 pr-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpen(s)
                      }}
                      className="flex items-center gap-2 font-semibold text-[#1b2a4a]"
                    >
                      <ShapeIcon shape={s.shape} className="size-5 text-[#5b8def]" />
                      {s.shape}
                      {s.grown && (
                        <span className="bg-[#e7f6ec] px-1 text-[0.625rem] font-bold text-[#1f7a43]">LAB</span>
                      )}
                    </button>
                  </td>
                  <td className="py-2 pr-2 tabular-nums">{s.carat.toFixed(2)}</td>
                  <td className="py-2 pr-2">{s.color}</td>
                  <td className="py-2 pr-2">{s.clarity}</td>
                  <td className="py-2 pr-2">{s.cut}</td>
                  <td className="py-2 pr-2">{s.lab}</td>
                  <td className="py-2 pr-2 text-right font-bold tabular-nums text-[#1b2a4a]">{usd(s.price)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {results.length === 0 && (
            <p className="py-10 text-center text-sm text-[#7a7466]">
              No stones. Your standards are higher than the inventory. Try fewer filters.
            </p>
          )}
          {results.length > 8 && (
            <p className="pt-3 text-xs text-[#7a7466]">+ {results.length - 8} more · click any row for details</p>
          )}
        </div>

        {/* Detail drawer */}
        <AnimatePresence>
          {open && (
            <motion.div
              className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l-4 border-night bg-white p-5 shadow-[-12px_0_0_rgb(0_0_0/0.08)]"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-[#7a7466]">{open.id} · {open.lab} certified</p>
                  <p className="text-lg font-bold text-[#1b2a4a]">
                    {open.carat.toFixed(2)}ct {open.shape} · {open.color} {open.clarity}
                  </p>
                </div>
                <button type="button" aria-label="Close details" onClick={() => setOpen(null)} className="px-2 text-xl">
                  ×
                </button>
              </div>
              <div className="my-3 [perspective:600px]">
                <DiamondArt />
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                {[
                  ["Cut", open.cut],
                  ["Depth", `${open.depth}%`],
                  ["Table", `${open.table}%`],
                  ["Origin", open.grown ? "Lab" : "Natural"],
                  ["Located", open.city],
                  ["$/ct", usd(Math.round(open.price / open.carat))],
                ].map(([k, v]) => (
                  <div key={k} className="bg-[#f6f4ee] p-2">
                    <dt className="text-[#7a7466]">{k}</dt>
                    <dd className="font-bold text-[#1b2a4a]">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-2xl font-bold text-[#1b2a4a]">{usd(open.price)}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
                <button
                  type="button"
                  disabled={cart.includes(open.id)}
                  onClick={() => {
                    setCart((c) => [...c, open.id])
                    onToast(`${open.id} added to cart`)
                  }}
                  className="col-span-2 bg-[#1b2a4a] py-2 text-white hover:bg-[#25396a] disabled:opacity-50"
                >
                  {cart.includes(open.id) ? "In cart ✓" : "Add to cart"}
                </button>
                <button
                  type="button"
                  onClick={() => onToast(`Hold requested on ${open.id} · supplier has 48h`)}
                  className="border-2 border-[#1b2a4a] py-1.5 text-[#1b2a4a] hover:bg-[#f1f5ff]"
                >
                  Hold 48h
                </button>
                <button
                  type="button"
                  onClick={() => onToast(`Inquiry sent to the ${open.city} supplier`)}
                  className="border-2 border-[#1b2a4a] py-1.5 text-[#1b2a4a] hover:bg-[#f1f5ff]"
                >
                  Inquire
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

const UPLOAD_STEPS = [
  "Parsing stock.csv … 1,284 rows",
  "Validating certificates … 5 missing cert #",
  "Pricing against market … done",
  "Listed 1,279 stones · 5 rejected",
]

function SupplierView() {
  const [step, setStep] = React.useState(-1)
  React.useEffect(() => {
    if (step < 0 || step >= UPLOAD_STEPS.length - 1) return
    const id = window.setTimeout(() => setStep((s) => s + 1), 700)
    return () => window.clearTimeout(id)
  }, [step])

  return (
    <div className="p-6">
      <p className="text-lg font-bold text-[#1b2a4a]">Supplier · Inventory</p>
      <p className="text-sm text-[#7a7466]">Drop your stock sheet. Buyers see it in seconds.</p>
      <button
        type="button"
        onClick={() => setStep(0)}
        className="mt-4 flex w-full flex-col items-center gap-1 border-4 border-dashed border-[#c9c2b0] bg-[#fbfaf6] py-8 text-[#1b2a4a] hover:border-[#5b8def]"
      >
        <span className="text-3xl">⬆</span>
        <span className="font-semibold">{step < 0 ? "Upload stock.csv" : "stock.csv"}</span>
        <span className="text-xs text-[#7a7466]">Excel, CSV or an API feed</span>
      </button>
      <ul className="mt-4 flex flex-col gap-1.5 font-mono text-sm" aria-live="polite">
        {UPLOAD_STEPS.slice(0, step + 1).map((s, i) => (
          <motion.li
            key={s}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={i === UPLOAD_STEPS.length - 1 ? "font-bold text-[#1f7a43]" : "text-[#5c5648]"}
          >
            {i === UPLOAD_STEPS.length - 1 ? "✓ " : "› "}
            {s}
          </motion.li>
        ))}
      </ul>
      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        {[
          ["Live stones", step >= 3 ? "1,279" : "0"],
          ["Holds", "3"],
          ["Inquiries", "12"],
        ].map(([k, v]) => (
          <div key={k} className="bg-[#f6f4ee] p-3">
            <p className="text-xl font-bold text-[#1b2a4a]">{v}</p>
            <p className="text-xs text-[#7a7466]">{k}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SureGemApp() {
  const [mode, setMode] = React.useState<"buyer" | "supplier">("buyer")
  const [cart, setCart] = React.useState<string[]>([])
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const toastId = React.useRef(0)
  const onToast = React.useCallback((text: string) => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, text }])
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }, [])

  const checkout = () => {
    onToast(`Order SG-${1000 + cart.length * 7} placed · ${cart.length} stone${cart.length > 1 ? "s" : ""} · suppliers notified`)
    setCart([])
  }

  return (
    <>
      <AppWindow
        name="SureGem"
        url="suregem.com/search"
        liveUrl="https://suregem.com"
        accent="#5b8def"
        bootLines={["indexing 96 stones … ok", "connecting suppliers: Surat, Antwerp, Dubai …"]}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#e8e3d6] bg-white px-4 py-3">
          <p className="flex items-center gap-2 text-lg font-bold tracking-tight text-[#1b2a4a]">
            <span className="text-[#5b8def]">◆</span> SureGem
          </p>
          <div className="flex border-2 border-[#1b2a4a] text-xs font-bold" role="group" aria-label="View as">
            {(["buyer", "supplier"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={cn("px-3 py-1.5 capitalize", mode === m ? "bg-[#1b2a4a] text-white" : "text-[#1b2a4a]")}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!cart.length}
            onClick={checkout}
            className="bg-[#5b8def] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          >
            Checkout ({cart.length})
          </button>
        </div>

        {mode === "buyer" ? <BuyerView onToast={onToast} cart={cart} setCart={setCart} /> : <SupplierView />}

        <div className="pointer-events-none absolute bottom-3 left-1/2 z-40 flex w-[min(24rem,90%)] -translate-x-1/2 flex-col gap-2" aria-live="polite">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.p
                key={t.id}
                className="bg-[#1b2a4a] px-3 py-2 text-center text-sm font-semibold text-white shadow-lg"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {t.text}
              </motion.p>
            ))}
          </AnimatePresence>
        </div>
      </AppWindow>
      <DemoNote>Demo data. The diamonds are fake, the prices are fake, the filters are very real.</DemoNote>
    </>
  )
}
