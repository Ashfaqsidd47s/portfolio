import * as React from "react"
import { ArrowLeft, MapPin, Minus, Plus, Search, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { delay } from "@/os/kernel/rng"
import { AiListing } from "./ai-listing"
import { SUPPLIER, money, timeAgo, useSideBookings, useTrypNow, type Package } from "./data"
import { PackageBuilder } from "./package-builder"
import { Button, Card, Field, Modal, PageHeader, StatusPill, inputClass, type ToastFn } from "./ui"

const DAY = 86_400_000

/* -------------------------------- dashboard ------------------------------- */

export function Dashboard({ toast, onShowPending }: { toast: ToastFn; onShowPending: () => void }) {
  const bookings = useSideBookings("supplier")
  const packages = useTrypNow((s) => s.packages)
  const setStatus = useTrypNow((s) => s.setBookingStatus)
  const [now] = React.useState(() => Date.now())

  const stats = React.useMemo(() => {
    const recent = bookings.filter((b) => now - new Date(b.createdAt).getTime() < 30 * DAY)
    const confirmed = recent.filter((b) => b.status === "confirmed")
    return {
      revenue: confirmed.reduce((n, b) => n + b.amount, 0),
      bookings: recent.length,
      travellers: recent.reduce((n, b) => n + b.travellers, 0),
      pending: bookings.filter((b) => b.status === "pending"),
      live: packages.filter((p) => p.supplier === SUPPLIER).length,
    }
  }, [bookings, packages, now])

  const top = React.useMemo(() => {
    const counts = new Map<string, { name: string; count: number; revenue: number }>()
    for (const b of bookings) {
      if (b.status === "cancelled") continue
      const row = counts.get(b.packageId) ?? { name: b.packageName, count: 0, revenue: 0 }
      row.count++
      row.revenue += b.amount
      counts.set(b.packageId, row)
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5)
  }, [bookings])
  const maxCount = Math.max(1, ...top.map((t) => t.count))

  const tiles = [
    { label: "Revenue · 30 days", value: money(stats.revenue), note: "confirmed bookings" },
    { label: "Bookings · 30 days", value: stats.bookings, note: `${stats.travellers} travellers` },
    { label: "Awaiting you", value: stats.pending.length, note: "pending approval", onClick: onShowPending },
    { label: "Live packages", value: stats.live, note: "on the marketplace" },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={`Welcome back, ${SUPPLIER}`} subtitle="Here's how your inventory is selling." />

      <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-4">
        {tiles.map((t) => {
          const body = (
            <>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-tn-muted">{t.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-tn-ink">{t.value}</p>
              <p className="text-xs text-tn-muted">{t.note}</p>
            </>
          )
          return t.onClick ? (
            <button
              key={t.label}
              type="button"
              onClick={t.onClick}
              className="rounded-lg border border-tn-line bg-white p-3 text-left hover:border-tn-teal"
            >
              {body}
            </button>
          ) : (
            <Card key={t.label} className="p-3">
              {body}
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 @4xl:grid-cols-2">
        <Card className="p-3">
          <p className="text-sm font-bold text-tn-ink">Needs your approval</p>
          {stats.pending.length === 0 ? (
            <p className="py-6 text-center text-xs text-tn-muted">All caught up. ✨</p>
          ) : (
            <ul className="mt-2 divide-y divide-tn-line">
              {stats.pending.slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-tn-ink">
                      {b.packageName} · {b.travellers} pax
                    </span>
                    <span className="block truncate text-[0.6875rem] text-tn-muted">
                      {b.ref} · {b.agency} · {timeAgo(b.createdAt)}
                    </span>
                  </span>
                  <span className="text-xs font-semibold tabular-nums">{money(b.amount)}</span>
                  <Button
                    onClick={() => {
                      setStatus(b.id, "confirmed")
                      toast(`${b.ref} confirmed — ${b.agency} has been notified`)
                    }}
                  >
                    Confirm
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-3">
          <p className="text-sm font-bold text-tn-ink">Top packages</p>
          <p className="text-[0.6875rem] text-tn-muted">Active bookings per package</p>
          <ol className="mt-3 flex flex-col gap-3">
            {top.map((t) => (
              <li key={t.name}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-semibold text-tn-ink">{t.name}</span>
                  <span className="shrink-0 tabular-nums text-tn-ink">
                    {t.count} <span className="text-tn-muted">· {money(t.revenue)}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-tn-soft">
                  <div className="h-full rounded-full bg-tn-teal" style={{ width: `${(t.count / maxCount) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <RecentActivity />
    </div>
  )
}

function RecentActivity() {
  const bookings = useSideBookings("supplier")
  return (
    <Card className="p-3">
      <p className="text-sm font-bold text-tn-ink">Recent activity</p>
      <ul className="mt-2 divide-y divide-tn-line">
        {bookings.slice(0, 5).map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-xs">
            <span className="min-w-0 truncate text-tn-ink">
              <span className="font-semibold">{b.agentName}</span> ({b.agency}) booked{" "}
              <span className="font-semibold">{b.packageName}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="hidden text-tn-muted @lg:inline">{timeAgo(b.createdAt)}</span>
              <StatusPill status={b.status} />
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/* -------------------------------- packages -------------------------------- */

function PackageCard({ pkg, footer, highlight }: { pkg: Package; footer: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={cn("flex flex-col overflow-hidden transition-shadow", highlight && "ring-2 ring-tn-teal")}>
      <div className="flex items-center gap-3 border-b border-tn-line bg-tn-soft p-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-white text-2xl shadow-sm">{pkg.emoji}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-tn-ink">{pkg.name}</span>
          <span className="flex items-center gap-1 text-xs text-tn-muted">
            <MapPin className="size-3" aria-hidden /> {pkg.city}, {pkg.country} · {pkg.nights}N/{pkg.nights + 1}D
          </span>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <ul className="flex flex-wrap gap-1">
          {pkg.highlights.map((h) => (
            <li key={h} className="rounded bg-tn-bg px-1.5 py-0.5 text-[0.6875rem] text-tn-ink ring-1 ring-tn-line">
              {h}
            </li>
          ))}
        </ul>
        <div className="mt-auto flex items-end justify-between gap-2">{footer}</div>
      </div>
    </Card>
  )
}

export function Packages({ toast }: { toast: ToastFn }) {
  const packages = useTrypNow((s) => s.packages)
  const bookings = useSideBookings("supplier")
  const [building, setBuilding] = React.useState(false)
  const [fresh, setFresh] = React.useState<string | null>(null)
  const own = packages.filter((p) => p.supplier === SUPPLIER)

  if (building) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          title="New package"
          subtitle="Drag hotels, attractions and transfers into days, then publish."
          actions={
            <Button variant="ghost" onClick={() => setBuilding(false)}>
              <ArrowLeft className="size-3.5" /> All packages
            </Button>
          }
        />
        <Card className="overflow-hidden">
          <PackageBuilder
            onPublished={(pkg) => {
              setBuilding(false)
              setFresh(pkg.id)
              toast(`Published "${pkg.name}" at ${money(pkg.pricePerPax)}/pax — agents can book it now`)
            }}
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Packages"
        subtitle={`${own.length} live on the marketplace`}
        actions={
          <Button data-tour="tn-new-package" onClick={() => setBuilding(true)}>
            <Plus className="size-3.5" /> New package
          </Button>
        }
      />
      <div className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
        {own.map((p) => {
          const active = bookings.filter((b) => b.packageId === p.id && b.status !== "cancelled")
          return (
            <PackageCard
              key={p.id}
              pkg={p}
              highlight={p.id === fresh}
              footer={
                <>
                  <span className="text-xs text-tn-muted">
                    {active.length} bookings · published {timeAgo(p.publishedAt)}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-tn-ink">
                    {money(p.pricePerPax)}
                    <span className="text-xs font-normal text-tn-muted">/pax</span>
                  </span>
                </>
              }
            />
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------- attractions ------------------------------ */

export function Attractions({ toast }: { toast: ToastFn }) {
  const listings = useTrypNow((s) => s.listings)
  const KIND = { hotel: "Hotel", attraction: "Attraction", transfer: "Transfer" }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Attractions & inventory" subtitle="List new inventory from one sentence, then use it in packages." />
      <Card className="overflow-hidden">
        <AiListing onSaved={(l) => toast(`"${l.name}" added to inventory at $${l.price} — find it in the package builder`)} />
      </Card>
      <Card className="overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-tn-line bg-tn-bg text-[0.6875rem] uppercase tracking-wider text-tn-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Item</th>
              <th className="hidden px-3 py-2 font-semibold @lg:table-cell">Type</th>
              <th className="hidden px-3 py-2 font-semibold @2xl:table-cell">Unit</th>
              <th className="px-3 py-2 text-right font-semibold">Price</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((l) => (
              <tr key={l.id} className="border-b border-tn-line last:border-0">
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2 font-semibold text-tn-ink">
                    <span aria-hidden>{l.emoji}</span>
                    {l.name}
                    {l.ai && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-tn-mint px-1 py-0.5 text-[0.625rem] font-semibold text-tn-teal">
                        <Sparkles className="size-2.5" aria-hidden /> AI
                      </span>
                    )}
                  </span>
                </td>
                <td className="hidden px-3 py-2 text-tn-muted @lg:table-cell">{KIND[l.kind]}</td>
                <td className="hidden px-3 py-2 text-tn-muted @2xl:table-cell">{l.meta}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">${l.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

/* ------------------------------- marketplace ------------------------------ */

export function Marketplace({ toast }: { toast: ToastFn }) {
  const packages = useTrypNow((s) => s.packages)
  const [query, setQuery] = React.useState("")
  const [country, setCountry] = React.useState("All")
  const [booking, setBooking] = React.useState<Package | null>(null)
  const countries = ["All", ...new Set(packages.map((p) => p.country))]

  const q = query.trim().toLowerCase()
  const visible = packages.filter(
    (p) =>
      (country === "All" || p.country === country) &&
      (!q || [p.name, p.city, p.supplier, ...p.highlights].some((v) => v.toLowerCase().includes(q)))
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Marketplace" subtitle="Packages from DMCs worldwide, bookable for your travellers." />
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-tn-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search destinations, suppliers, experiences…"
          aria-label="Search packages"
          className={cn(inputClass, "pl-8")}
        />
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by country">
        {countries.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={country === c}
            onClick={() => setCountry(c)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-semibold",
              country === c ? "border-tn-ink bg-tn-ink text-white" : "border-tn-line-2 bg-white text-tn-ink hover:bg-tn-soft"
            )}
          >
            {c}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-tn-muted">No packages match that search.</p>
      ) : (
        <div className="grid gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {visible.map((p) => (
            <PackageCard
              key={p.id}
              pkg={p}
              footer={
                <>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.6875rem] text-tn-muted">by {p.supplier}</span>
                    <span className="text-sm font-bold tabular-nums text-tn-ink">
                      {money(p.pricePerPax)}
                      <span className="text-xs font-normal text-tn-muted">/pax</span>
                    </span>
                  </span>
                  <Button data-tour={`tn-book-${p.id}`} onClick={() => setBooking(p)}>
                    Book
                  </Button>
                </>
              }
            />
          ))}
        </div>
      )}
      <Modal open={!!booking} onClose={() => setBooking(null)} title={booking ? `Book ${booking.name}` : "Book"}>
        {booking && (
          <BookingForm
            pkg={booking}
            onDone={(message) => {
              setBooking(null)
              toast(message)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function BookingForm({ pkg, onDone }: { pkg: Package; onDone: (message: string) => void }) {
  const createBooking = useTrypNow((s) => s.createBooking)
  const setStatus = useTrypNow((s) => s.setBookingStatus)
  const [travellers, setTravellers] = React.useState(2)
  const [date, setDate] = React.useState(() => new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10))
  const [busy, setBusy] = React.useState(false)
  const [minDate] = React.useState(() => new Date(Date.now() + DAY).toISOString().slice(0, 10))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    await delay(700)
    const b = createBooking({ packageId: pkg.id, travellers, travelDate: new Date(date).toISOString() })
    if (pkg.supplier === SUPPLIER) {
      onDone(`${b.ref} sent to ${pkg.supplier} — switch to Supplier to confirm it`)
    } else {
      // Other DMCs answer on their own a moment later.
      window.setTimeout(() => setStatus(b.id, "confirmed"), 2500)
      onDone(`${b.ref} sent to ${pkg.supplier} — they usually confirm within seconds`)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field label="Travellers">
        <span className="flex items-center gap-2">
          <Button variant="secondary" aria-label="Fewer travellers" disabled={travellers <= 1} onClick={() => setTravellers(travellers - 1)}>
            <Minus className="size-3.5" />
          </Button>
          <span className="w-8 text-center text-sm font-bold tabular-nums" aria-live="polite">
            {travellers}
          </span>
          <Button variant="secondary" aria-label="More travellers" disabled={travellers >= 12} onClick={() => setTravellers(travellers + 1)}>
            <Plus className="size-3.5" />
          </Button>
        </span>
      </Field>
      <Field label="Travel date">
        <input type="date" required min={minDate} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </Field>
      <div className="flex items-center justify-between rounded-lg bg-tn-soft px-3 py-2 text-xs">
        <span className="text-tn-muted">
          {money(pkg.pricePerPax)} × {travellers}
        </span>
        <span className="text-base font-bold tabular-nums text-tn-ink">{money(pkg.pricePerPax * travellers)}</span>
      </div>
      <Button type="submit" disabled={busy} data-tour="tn-book-submit" className="py-2">
        {busy ? "Sending to supplier…" : "Request booking"}
      </Button>
    </form>
  )
}
