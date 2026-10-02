import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { AppWindow, DemoNote } from "./app-window"

/* ------------------------------ package builder --------------------------- */

type Kind = "hotel" | "attraction" | "transfer"
type Item = { id: string; kind: Kind; name: string; meta: string; price: number; emoji: string }

const LIBRARY: Item[] = [
  { id: "h1", kind: "hotel", name: "Palm Resort ★5", meta: "per night", price: 420, emoji: "🏨" },
  { id: "h2", kind: "hotel", name: "Downtown Inn ★3", meta: "per night", price: 95, emoji: "🏨" },
  { id: "a1", kind: "attraction", name: "Desert Safari + BBQ", meta: "6h · adult", price: 60, emoji: "🐪" },
  { id: "a2", kind: "attraction", name: "Skyscraper Top Deck", meta: "1h · adult", price: 45, emoji: "🏙️" },
  { id: "a3", kind: "attraction", name: "Dhow Dinner Cruise", meta: "2h · adult", price: 55, emoji: "⛵" },
  { id: "a4", kind: "attraction", name: "Museum of Tomorrow", meta: "2h · adult", price: 40, emoji: "🛸" },
  { id: "t1", kind: "transfer", name: "Airport pickup", meta: "private · 1 way", price: 35, emoji: "🚐" },
  { id: "t2", kind: "transfer", name: "Car + driver", meta: "full day", price: 120, emoji: "🚗" },
]

const KIND_LABEL: Record<Kind, string> = { hotel: "Hotels", attraction: "Attractions", transfer: "Transfers" }

type Placed = { key: number; item: Item }

function PackageBuilder({ onToast }: { onToast: (t: string) => void }) {
  const [kind, setKind] = React.useState<Kind>("attraction")
  const [days, setDays] = React.useState<Placed[][]>([
    [{ key: 1, item: LIBRARY[6] }, { key: 2, item: LIBRARY[0] }],
    [{ key: 3, item: LIBRARY[2] }],
    [],
  ])
  const [active, setActive] = React.useState(2)
  const [hover, setHover] = React.useState<number | null>(null)
  const zones = React.useRef<(HTMLDivElement | null)[]>([])
  const nextKey = React.useRef(10)
  const dragged = React.useRef(false)

  const zoneAt = (x: number, y: number) =>
    zones.current.findIndex((z) => {
      const r = z?.getBoundingClientRect()
      return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
    })

  const add = (d: number, item: Item) => {
    setDays((ds) => ds.map((list, i) => (i === d ? [...list, { key: ++nextKey.current, item }] : list)))
    setActive(d)
  }
  const remove = (d: number, key: number) =>
    setDays((ds) => ds.map((list, i) => (i === d ? list.filter((p) => p.key !== key) : list)))

  const total = days.flat().reduce((n, p) => n + p.item.price, 0)
  const nights = days.length - 1

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[16rem_1fr]">
      {/* Inventory */}
      <aside className="border-b-2 border-[#e3ecea] bg-[#f6fbfa] p-3 lg:border-b-0 lg:border-r-2">
        <div className="flex gap-1" role="tablist">
          {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={cn(
                "flex-1 px-1 py-1.5 text-[0.6875rem] font-bold",
                kind === k ? "bg-[#0f766e] text-white" : "bg-white text-[#0f3b38] hover:bg-[#e3f3f0]"
              )}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[0.6875rem] text-[#5b7370]">Drag into a day — or tap to add to Day {active + 1}.</p>
        <ul className="mt-2 flex flex-col gap-2">
          {LIBRARY.filter((i) => i.kind === kind).map((item) => (
            <li key={item.id}>
              <motion.button
                type="button"
                drag
                dragSnapToOrigin
                dragElastic={0.9}
                whileDrag={{ scale: 1.06, rotate: -3, zIndex: 50, boxShadow: "8px 10px 0 rgb(0 0 0 / 0.25)" }}
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
                aria-label={`Add ${item.name} to day ${active + 1}`}
                className="relative flex w-full cursor-grab touch-none items-center gap-2 border-2 border-[#cfe3df] bg-white p-2 text-left active:cursor-grabbing"
              >
                <span className="text-xl">{item.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[#0f3b38]">{item.name}</span>
                  <span className="block text-[0.6875rem] text-[#5b7370]">{item.meta}</span>
                </span>
                <span className="text-sm font-bold text-[#0f766e]">${item.price}</span>
              </motion.button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Itinerary */}
      <div className="min-w-0 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-lg font-bold text-[#0f3b38]">
            Dubai Getaway · {nights}N/{days.length}D
          </p>
          <p className="text-sm text-[#5b7370]">
            <span className="text-xl font-bold text-[#0f3b38]">${total}</span> / person
          </p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {days.map((list, d) => (
            <div
              key={d}
              ref={(el) => {
                zones.current[d] = el
              }}
              className={cn(
                "flex min-h-40 flex-col border-2 border-dashed p-2 transition-colors",
                hover === d
                  ? "border-[#0f766e] bg-[#e3f3f0]"
                  : active === d
                    ? "border-[#0f766e]/60 bg-white"
                    : "border-[#cfe3df] bg-white"
              )}
            >
              <button
                type="button"
                onClick={() => setActive(d)}
                className="mb-2 flex items-center justify-between text-left text-xs font-bold uppercase tracking-wider text-[#0f766e]"
              >
                Day {d + 1}
                {active === d && <span className="text-[0.625rem] normal-case text-[#5b7370]">tap target</span>}
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
                      className="flex items-center gap-1.5 bg-[#f1f8f7] px-2 py-1 text-xs text-[#0f3b38]"
                    >
                      <span>{p.item.emoji}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{p.item.name}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${p.item.name} from day ${d + 1}`}
                        onClick={() => remove(d, p.key)}
                        className="px-1 text-[#5b7370] hover:text-[#b3261e]"
                      >
                        ×
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
                {list.length === 0 && <li className="m-auto text-xs text-[#9ab3af]">drop stuff here</li>}
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
              className="min-h-40 border-2 border-dashed border-[#cfe3df] text-sm font-bold text-[#5b7370] hover:border-[#0f766e] hover:text-[#0f766e]"
            >
              + Add day
            </button>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={total === 0}
            onClick={() => onToast(`Published "Dubai Getaway ${nights}N/${days.length}D" at $${total}/pax · agents can book it now`)}
            className="bg-[#0f766e] px-4 py-2 text-sm font-bold text-white hover:bg-[#0d6961] disabled:opacity-40"
          >
            Publish package
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- AI listing ------------------------------- */

const DEFAULT_PROMPT =
  "Desert safari in Dubai. 6 hours, dune bashing, camel ride, BBQ dinner. Hotel pickup at 3pm. AED 180 per adult, AED 140 per child. Free cancellation up to 24h before."

function extract(prompt: string) {
  const sentences = prompt.split(/\.\s+/)
  const title = (sentences[0] ?? "New attraction").replace(/\.$/, "")
  const city = prompt.match(/\bin ([A-Z][a-zA-Z]+)/)?.[1] ?? "—"
  const duration = prompt.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/i)?.[1]
  const pickup = prompt.match(/pick-?up[^.]*?(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i)?.[1]
  const currency = prompt.match(/\b(AED|USD|INR|EUR)\b|\$|₹/)?.[0] ?? "AED"
  const adult = prompt.match(/(\d+)\s*(?:per\s+)?adult/i)?.[1]
  const child = prompt.match(/(\d+)\s*(?:per\s+)?(?:child|kid)/i)?.[1]
  const cancel = prompt.match(/free cancell?ation[^.]*/i)?.[0]
  const inclusions = (sentences.find((s) => /,/.test(s) && !/pickup|adult|child/i.test(s)) ?? "")
    .split(/,\s*/)
    .filter((x) => x && !/^\d+\s*(hours?|hrs?|h)$/i.test(x.trim()))
    .map((x) => x.trim().replace(/\.$/, ""))
  const category = /safari|desert|dune|skydiv|zipline/i.test(prompt)
    ? "Adventure"
    : /museum|heritage|tour/i.test(prompt)
      ? "Culture"
      : /cruise|dhow|boat|yacht/i.test(prompt)
        ? "Cruise"
        : "Experience"

  return [
    { label: "Title", value: title.charAt(0).toUpperCase() + title.slice(1) },
    { label: "City", value: city },
    { label: "Category", value: category },
    { label: "Duration", value: duration ? `${duration} hours` : "—" },
    { label: "Pickup", value: pickup ? `Hotel pickup · ${pickup}` : "—" },
    { label: "Inclusions", value: inclusions.length ? inclusions.join(" · ") : "—" },
    { label: "Adult price", value: adult ? `${currency} ${adult}` : "—" },
    { label: "Child price", value: child ? `${currency} ${child}` : "—" },
    { label: "Cancellation", value: cancel ?? "Non-refundable" },
    {
      label: "Description",
      value: `${duration ? `${duration}-hour ` : ""}${title.charAt(0).toLowerCase() + title.slice(1)}${
        inclusions.length ? ` with ${inclusions.slice(0, 3).join(", ")}` : ""
      }.${pickup ? ` Pickup from your hotel at ${pickup}.` : ""}`,
    },
  ]
}

function AiListing() {
  const reduced = useReducedMotion()
  const [prompt, setPrompt] = React.useState(DEFAULT_PROMPT)
  const [fields, setFields] = React.useState<ReturnType<typeof extract> | null>(null)
  const [filled, setFilled] = React.useState(0)
  const busy = !!fields && filled < fields.length

  React.useEffect(() => {
    if (!fields || filled >= fields.length) return
    const id = window.setTimeout(() => setFilled((n) => n + 1), reduced ? 0 : filled === 0 ? 600 : 220)
    return () => window.clearTimeout(id)
  }, [fields, filled, reduced])

  const empty = extract("").map((f) => f.label)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[1fr_1.3fr]">
      <div className="flex flex-col gap-3 border-b-2 border-[#e3ecea] bg-[#0f3b38] p-4 text-white lg:border-b-0 lg:border-r-2">
        <p className="text-sm font-bold">✨ Describe it like a human</p>
        <label className="sr-only" htmlFor="trypnow-prompt">Attraction description</label>
        <textarea
          id="trypnow-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={7}
          className="w-full resize-none bg-white/10 p-3 text-sm leading-relaxed outline-none focus:bg-white/15"
        />
        <button
          type="button"
          disabled={busy || !prompt.trim()}
          onClick={() => {
            setFilled(0)
            setFields(extract(prompt))
          }}
          className="bg-[#5eead4] px-4 py-2 text-sm font-bold text-[#0f3b38] hover:brightness-105 disabled:opacity-50"
        >
          {busy ? "Generating…" : "Generate listing"}
        </button>
        <p className="text-xs text-white/70">One prompt in. Ten fields out. Your wrist says thanks.</p>
      </div>
      <div className="grid gap-2 p-4 sm:grid-cols-2">
        {(fields ?? empty.map((label) => ({ label, value: "" }))).map((f, i) => {
          const done = !!fields && i < filled
          return (
            <div key={f.label} className={cn(f.label === "Description" || f.label === "Inclusions" ? "sm:col-span-2" : "")}>
              <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-[#5b7370]">{f.label}</p>
              <motion.div
                className={cn(
                  "mt-0.5 min-h-9 border-2 px-2 py-1.5 text-sm",
                  done ? "border-[#0f766e] bg-[#f1f8f7] text-[#0f3b38]" : "border-[#e3ecea] bg-white text-[#9ab3af]"
                )}
                animate={done && !reduced ? { backgroundColor: ["#c9f5ec", "#f1f8f7"] } : undefined}
                transition={{ duration: 0.6 }}
              >
                {done ? f.value : fields && i === filled ? <span className="animate-blink">▍</span> : "…"}
              </motion.div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------------------------- app ----------------------------------- */

export function TrypNowApp() {
  const [tab, setTab] = React.useState<"packages" | "ai">("packages")
  const [toast, setToast] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(id)
  }, [toast])

  return (
    <>
      <AppWindow
        name="trypnow"
        url={tab === "packages" ? "trypnow.com/supplier/packages/new" : "trypnow.com/supplier/attractions/new"}
        liveUrl="https://trypnow.com"
        accent="#5eead4"
        command="npm run dev"
        bootLines={["loading 30+ data tables … ok", "next.js ready on :3000"]}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#e3ecea] bg-white px-4 py-3">
          <p className="text-lg font-black tracking-tight text-[#0f3b38]">
            tryp<span className="text-[#0f766e]">now</span>{" "}
            <span className="ml-1 bg-[#e3f3f0] px-1.5 py-0.5 text-[0.625rem] font-bold text-[#0f766e]">DMC</span>
          </p>
          <div className="flex border-2 border-[#0f3b38] text-xs font-bold" role="group" aria-label="Feature">
            {(
              [
                ["packages", "Package builder"],
                ["ai", "AI listing"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={tab === k}
                onClick={() => setTab(k)}
                className={cn("px-3 py-1.5", tab === k ? "bg-[#0f3b38] text-white" : "text-[#0f3b38]")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {tab === "packages" ? <PackageBuilder onToast={setToast} /> : <AiListing />}
        <AnimatePresence>
          {toast && (
            <motion.p
              role="status"
              className="absolute bottom-3 left-1/2 z-40 w-[min(26rem,90%)] -translate-x-1/2 bg-[#0f3b38] px-3 py-2 text-center text-sm font-semibold text-white"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {toast}
            </motion.p>
          )}
        </AnimatePresence>
      </AppWindow>
      <DemoNote>Demo inventory, real mechanics: drag-and-drop package building, and an AI that eats long forms for breakfast.</DemoNote>
    </>
  )
}
