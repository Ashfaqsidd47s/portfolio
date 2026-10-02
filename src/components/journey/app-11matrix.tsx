import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { cn } from "@/lib/utils"
import { AppWindow, DemoNote } from "./app-window"

/* ------------------------------- demo data -------------------------------- */

type Range = "7d" | "30d" | "90d"
type Metric = "revenue" | "orders" | "conversion" | "aov" | "sessions"

const STORES = [
  { name: "Urban Thread", revenue: 48200, orders: 610, sessions: 21000 },
  { name: "Bloom & Co", revenue: 61500, orders: 540, sessions: 15800 },
  { name: "Peak Gear", revenue: 37900, orders: 290, sessions: 9400 },
  { name: "Nova Home", revenue: 52800, orders: 702, sessions: 30500 },
]

/** Per-range scale and per-store swing, so the leaderboard reshuffles. */
const RANGES: Record<Range, { scale: number; swing: number[]; delta: Record<string, number> }> = {
  "7d": { scale: 0.24, swing: [1.3, 0.8, 1.15, 0.85], delta: { revenue: 6.2, orders: 4.8, aov: 1.3, conversion: -0.2 } },
  "30d": { scale: 1, swing: [1, 1, 1, 1], delta: { revenue: 12.4, orders: 8.1, aov: 3.9, conversion: 0.3 } },
  "90d": { scale: 3.1, swing: [0.9, 1.18, 0.82, 1.06], delta: { revenue: 21.7, orders: 15.2, aov: 5.6, conversion: 0.5 } },
}

const METRICS: Array<{ key: Metric; label: string; format: (n: number) => string }> = [
  { key: "revenue", label: "Revenue", format: (n) => `$${Math.round(n).toLocaleString("en-US")}` },
  { key: "orders", label: "Orders", format: (n) => Math.round(n).toLocaleString("en-US") },
  { key: "conversion", label: "Conv. rate", format: (n) => `${n.toFixed(2)}%` },
  { key: "aov", label: "AOV", format: (n) => `$${n.toFixed(0)}` },
  { key: "sessions", label: "Sessions", format: (n) => Math.round(n).toLocaleString("en-US") },
]
const fmt = (m: Metric, n: number) => METRICS.find((x) => x.key === m)!.format(n)

function storeStats(range: Range) {
  const { scale, swing } = RANGES[range]
  return STORES.map((s, i) => {
    const revenue = s.revenue * scale * swing[i]
    const orders = s.orders * scale * swing[i] * (i % 2 ? 1.04 : 0.97)
    const sessions = s.sessions * scale * (i % 2 ? 0.95 : 1.05)
    return {
      name: s.name,
      revenue,
      orders,
      sessions,
      aov: revenue / orders,
      conversion: (orders / sessions) * 100,
    }
  })
}

type Sku = { sku: string; name: string; stock: number[] }
const INITIAL_SKUS: Sku[] = [
  { sku: "LS-SND-M", name: "Linen shirt · Sand · M", stock: [42, 3, 18, 0] },
  { sku: "HB-BLK-01", name: "Hiking boot · Black · 42", stock: [0, 6, 27, 2] },
  { sku: "VS-CRM-L", name: "Ceramic vase · Cream · L", stock: [11, 9, 1, 24] },
]
const LOW = 5

/* --------------------------------- pieces --------------------------------- */

function Kpi({ label, value, delta, unit = "%" }: { label: string; value: string; delta: number; unit?: string }) {
  const up = delta >= 0
  return (
    <div className="border-2 border-[#ebe4d6] bg-white p-3">
      <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-[#7a7060]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-[#1f1a14]">{value}</p>
      <p className={cn("mt-0.5 text-xs font-semibold", up ? "text-[#1f7a43]" : "text-[#b3261e]")}>
        {up ? "▲" : "▼"} {Math.abs(delta)}
        {unit} <span className="font-normal text-[#7a7060]">vs prev. period</span>
      </p>
    </div>
  )
}

function Leaderboard({ range }: { range: Range }) {
  const [metric, setMetric] = React.useState<Metric>("revenue")
  const [hover, setHover] = React.useState<string | null>(null)
  const stats = storeStats(range)
  const ranked = [...stats].sort((a, b) => b[metric] - a[metric])
  const max = ranked[0][metric]

  return (
    <div className="border-2 border-[#ebe4d6] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-[#1f1a14]">🏆 Store leaderboard</p>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Rank by">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={metric === m.key}
              onClick={() => setMetric(m.key)}
              className={cn(
                "px-2 py-1 text-[0.6875rem] font-bold",
                metric === m.key ? "bg-[#1f1a14] text-white" : "bg-[#f5f1e8] text-[#4a4237] hover:bg-[#ebe4d6]"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <ol className="mt-3 flex flex-col gap-2">
        {ranked.map((s, i) => (
          <motion.li
            key={s.name}
            layout
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="relative grid grid-cols-[1.75rem_6.5rem_1fr_auto] items-center gap-2 text-sm"
            onMouseEnter={() => setHover(s.name)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(s.name)}
            onBlur={() => setHover(null)}
            tabIndex={0}
          >
            <span className="text-center text-base">{["🥇", "🥈", "🥉"][i] ?? `#${i + 1}`}</span>
            <span className="truncate font-semibold text-[#1f1a14]">{s.name}</span>
            <span className="h-4 bg-[#f5f1e8]">
              <motion.span
                className="block h-full rounded-r-[4px] bg-[#e8890c]"
                animate={{ width: `${(s[metric] / max) * 100}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 26 }}
              />
            </span>
            <span className="w-20 text-right font-bold tabular-nums text-[#1f1a14]">{fmt(metric, s[metric])}</span>
            <AnimatePresence>
              {hover === s.name && (
                <motion.div
                  className="pointer-events-none absolute left-10 top-full z-20 mt-1 w-56 bg-[#1f1a14] p-2 text-xs text-white shadow-lg"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <p className="mb-1 font-bold">{s.name}</p>
                  {METRICS.map((m) => (
                    <p key={m.key} className="flex justify-between">
                      <span className="text-white/70">{m.label}</span>
                      <span className="tabular-nums">{fmt(m.key, s[m.key])}</span>
                    </p>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.li>
        ))}
      </ol>
    </div>
  )
}

function Inventory({ onToast }: { onToast: (t: string) => void }) {
  const [skus, setSkus] = React.useState(INITIAL_SKUS)
  const rebalance = () => {
    setSkus((list) =>
      list.map((s) => {
        const total = s.stock.reduce((a, b) => a + b, 0)
        const each = Math.floor(total / s.stock.length)
        return { ...s, stock: s.stock.map((_, i) => each + (i < total % s.stock.length ? 1 : 0)) }
      })
    )
    onToast("Rebalanced 3 SKUs across 4 stores · 0 stockouts")
  }
  const lowCount = skus.reduce((n, s) => n + s.stock.filter((x) => x <= LOW).length, 0)

  return (
    <div className="border-2 border-[#ebe4d6] bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-[#1f1a14]">📦 Inventory · every store, one table</p>
        <button
          type="button"
          onClick={rebalance}
          disabled={lowCount === 0}
          className="bg-[#1f1a14] px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
        >
          Rebalance stock
        </button>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-xs">
          <thead className="text-[0.625rem] uppercase tracking-wider text-[#7a7060]">
            <tr>
              <th className="py-1.5 pr-2 font-bold">SKU</th>
              {STORES.map((s) => (
                <th key={s.name} className="py-1.5 pr-2 text-right font-bold">
                  {s.name.split(" ")[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {skus.map((s) => (
              <tr key={s.sku} className="border-t border-[#f0eadf]">
                <td className="py-1.5 pr-2">
                  <span className="block font-semibold text-[#1f1a14]">{s.name}</span>
                  <span className="font-mono text-[#7a7060]">{s.sku}</span>
                </td>
                {s.stock.map((n, i) => (
                  <td key={i} className="py-1.5 pr-2 text-right tabular-nums">
                    <motion.span
                      key={n}
                      initial={{ scale: 1.4 }}
                      animate={{ scale: 1 }}
                      className={cn("inline-block font-bold", n <= LOW ? "text-[#b3261e]" : "text-[#1f1a14]")}
                    >
                      {n <= LOW && <span aria-hidden>⚠ </span>}
                      {n}
                      {n <= LOW && <span className="sr-only"> (low stock)</span>}
                    </motion.span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[0.6875rem] text-[#7a7060]">⚠ = 5 or fewer left · {lowCount} low right now</p>
    </div>
  )
}

/* ---------------------------------- app ----------------------------------- */

export function ElevenMatrixApp() {
  const [range, setRange] = React.useState<Range>("30d")
  const [toast, setToast] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(id)
  }, [toast])

  const stats = storeStats(range)
  const revenue = stats.reduce((n, s) => n + s.revenue, 0)
  const orders = stats.reduce((n, s) => n + s.orders, 0)
  const sessions = stats.reduce((n, s) => n + s.sessions, 0)
  const d = RANGES[range].delta

  return (
    <>
      <AppWindow
        name="11matrix"
        url="app.11matrix.co/overview"
        liveUrl="https://11matrix.co"
        accent="#ffd23f"
        command="docker compose up"
        bootLines={["gin: listening on :8080 · postgres ok", "sync: 4 Shopify stores · GA4 · Pinterest"]}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#ebe4d6] bg-white px-4 py-3">
          <p className="text-lg font-black tracking-tight text-[#1f1a14]">
            11<span className="text-[#e8890c]">matrix</span>
          </p>
          <div className="flex flex-wrap gap-1.5 text-[0.6875rem] font-semibold">
            {[...STORES.map((s) => `🛍 ${s.name}`), "📈 GA4", "📌 Pinterest"].map((c) => (
              <span key={c} className="bg-[#f5f1e8] px-2 py-1 text-[#4a4237]">
                <span className="text-[#1f7a43]">●</span> {c}
              </span>
            ))}
          </div>
          <div className="flex border-2 border-[#1f1a14] text-xs font-bold" role="group" aria-label="Date range">
            {(["7d", "30d", "90d"] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={range === r}
                onClick={() => setRange(r)}
                className={cn("px-2.5 py-1", range === r ? "bg-[#1f1a14] text-white" : "text-[#1f1a14]")}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 bg-[#faf7f0] p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Revenue · all stores" value={fmt("revenue", revenue)} delta={d.revenue} />
            <Kpi label="Orders" value={fmt("orders", orders)} delta={d.orders} />
            <Kpi label="AOV" value={fmt("aov", revenue / orders)} delta={d.aov} />
            <Kpi label="Conv. rate" value={fmt("conversion", (orders / sessions) * 100)} delta={d.conversion} unit="pt" />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[1.15fr_1fr]">
            <Leaderboard range={range} />
            <Inventory onToast={setToast} />
          </div>
        </div>

        <AnimatePresence>
          {toast && (
            <motion.p
              role="status"
              className="absolute bottom-3 left-1/2 z-40 w-[min(24rem,90%)] -translate-x-1/2 bg-[#1f1a14] px-3 py-2 text-center text-sm font-semibold text-white"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {toast}
            </motion.p>
          )}
        </AnimatePresence>
      </AppWindow>
      <DemoNote>Fake stores, fake money. Switch the range or the ranking metric and watch the leaderboard fight.</DemoNote>
    </>
  )
}
