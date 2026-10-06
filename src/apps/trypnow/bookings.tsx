import * as React from "react"
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { longDate, money, shortDate, timeAgo, useSideBookings, useTrypNow, type Booking, type BookingStatus, type Side } from "./data"
import { Button, Card, Drawer, PageHeader, StatusPill, inputClass, type ToastFn } from "./ui"

const PAGE_SIZE = 8

const SORTS = {
  newest: { label: "Newest first", fn: (a: Booking, b: Booking) => b.createdAt.localeCompare(a.createdAt) },
  oldest: { label: "Oldest first", fn: (a: Booking, b: Booking) => a.createdAt.localeCompare(b.createdAt) },
  amount: { label: "Amount, high → low", fn: (a: Booking, b: Booking) => b.amount - a.amount },
  travel: { label: "Travel date, soonest", fn: (a: Booking, b: Booking) => a.travelDate.localeCompare(b.travelDate) },
} as const

type Filter = "all" | BookingStatus

/** Filterable, sortable, paginated bookings — the screen agents live in all day. */
export function Bookings({
  side,
  toast,
  initialFilter = "all",
}: {
  side: Side
  toast: ToastFn
  initialFilter?: Filter
}) {
  const all = useSideBookings(side)
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<Filter>(initialFilter)
  const [sort, setSort] = React.useState<keyof typeof SORTS>("newest")
  const [page, setPage] = React.useState(0)
  const [openId, setOpenId] = React.useState<string | null>(null)

  const counts = React.useMemo(() => {
    const c = { all: all.length, pending: 0, confirmed: 0, cancelled: 0 }
    for (const b of all) c[b.status]++
    return c
  }, [all])

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return all
      .filter((b) => filter === "all" || b.status === filter)
      .filter(
        (b) =>
          !q ||
          [b.ref, b.packageName, b.agency, b.agentName, b.supplier].some((v) => v.toLowerCase().includes(q))
      )
      .sort(SORTS[sort].fn)
  }, [all, query, filter, sort])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)
  const open = all.find((b) => b.id === openId)
  const counterpart = side === "supplier" ? "Agency" : "Supplier"

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={side === "supplier" ? "Bookings" : "My bookings"}
        subtitle={
          side === "supplier"
            ? "Every booking agents made on your packages."
            : "Bookings your agency made for its travellers."
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-tn-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(0)
            }}
            placeholder="Search bookings…"
            aria-label="Search bookings"
            data-tour="tn-bookings-search"
            className={cn(inputClass, "pl-8")}
          />
        </div>
        <label className="relative flex items-center">
          <span className="sr-only">Sort</span>
          <ArrowUpDown className="pointer-events-none absolute left-2.5 size-3.5 text-tn-muted" aria-hidden />
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as keyof typeof SORTS)
              setPage(0)
            }}
            className={cn(inputClass, "w-auto appearance-none pl-8 pr-3")}
          >
            {Object.entries(SORTS).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
        {(["all", "pending", "confirmed", "cancelled"] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            data-tour={`tn-filter-${f}`}
            onClick={() => {
              setFilter(f)
              setPage(0)
            }}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-semibold capitalize",
              filter === f ? "border-tn-ink bg-tn-ink text-white" : "border-tn-line-2 bg-white text-tn-ink hover:bg-tn-soft"
            )}
          >
            {f} <span className={filter === f ? "text-white/70" : "text-tn-muted"}>{counts[f]}</span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-tn-muted">No bookings match that.</p>
        ) : (
          <>
            {/* Wide: a real table */}
            <table className="hidden w-full text-left text-xs @2xl:table">
              <thead className="border-b border-tn-line bg-tn-bg text-[0.6875rem] uppercase tracking-wider text-tn-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Ref</th>
                  <th className="px-3 py-2 font-semibold">Package</th>
                  <th className="px-3 py-2 font-semibold">{counterpart}</th>
                  <th className="px-3 py-2 text-right font-semibold">Pax</th>
                  <th className="px-3 py-2 font-semibold">Travel</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => setOpenId(b.id)}
                    className="cursor-pointer border-b border-tn-line last:border-0 hover:bg-tn-soft"
                  >
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenId(b.id)
                        }}
                        className="font-mono font-semibold text-tn-teal hover:underline"
                      >
                        {b.ref}
                      </button>
                      <span className="block text-[0.625rem] text-tn-muted">{timeAgo(b.createdAt)}</span>
                    </td>
                    <td className="max-w-48 truncate px-3 py-2 font-semibold text-tn-ink">{b.packageName}</td>
                    <td className="max-w-40 truncate px-3 py-2 text-tn-ink">
                      {side === "supplier" ? b.agency : b.supplier}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.travellers}</td>
                    <td className="px-3 py-2 tabular-nums">{shortDate(b.travelDate)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(b.amount)}</td>
                    <td className="px-3 py-2">
                      <StatusPill status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Narrow: cards */}
            <ul className="divide-y divide-tn-line @2xl:hidden">
              {visible.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(b.id)}
                    className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-tn-soft"
                  >
                    <span className="min-w-0">
                      <span className="font-mono text-xs font-semibold text-tn-teal">{b.ref}</span>
                      <span className="block truncate text-sm font-semibold text-tn-ink">{b.packageName}</span>
                      <span className="block truncate text-xs text-tn-muted">
                        {side === "supplier" ? b.agency : b.supplier} · {b.travellers} pax · {shortDate(b.travelDate)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-bold tabular-nums">{money(b.amount)}</span>
                      <StatusPill status={b.status} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <div className="flex items-center justify-between text-xs text-tn-muted">
        <p>
          {rows.length === 0 ? 0 : current * PAGE_SIZE + 1}–{Math.min(rows.length, (current + 1) * PAGE_SIZE)} of {rows.length}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="secondary" aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}>
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="px-2 tabular-nums">
            {current + 1} / {pages}
          </span>
          <Button variant="secondary" aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      <Drawer open={!!open} onClose={() => setOpenId(null)} title={open ? `Booking ${open.ref}` : "Booking"}>
        {open && <BookingDetail booking={open} side={side} toast={toast} />}
      </Drawer>
    </div>
  )
}

function BookingDetail({ booking: b, side, toast }: { booking: Booking; side: Side; toast: ToastFn }) {
  const setStatus = useTrypNow((s) => s.setBookingStatus)
  const rows: [string, React.ReactNode][] = [
    ["Status", <StatusPill key="status" status={b.status} />],
    ["Package", b.packageName],
    ["Supplier", b.supplier],
    ["Agency", `${b.agency} · ${b.agentName}`],
    ["Travellers", b.travellers],
    ["Travel date", longDate(b.travelDate)],
    ["Booked", `${longDate(b.createdAt)} (${timeAgo(b.createdAt)})`],
    ["Amount", <span key="amount" className="font-bold">{money(b.amount)}</span>],
  ]

  const act = (status: BookingStatus, message: string) => {
    setStatus(b.id, status)
    toast(message)
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="divide-y divide-tn-line rounded-lg border border-tn-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
            <dt className="text-tn-muted">{k}</dt>
            <dd className="text-right font-medium text-tn-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        {side === "supplier" && b.status === "pending" && (
          <>
            <Button data-tour="tn-confirm" onClick={() => act("confirmed", `${b.ref} confirmed — ${b.agency} has been notified`)}>
              Confirm booking
            </Button>
            <Button variant="danger" onClick={() => act("cancelled", `${b.ref} declined`)}>
              Decline
            </Button>
          </>
        )}
        {side === "supplier" && b.status === "confirmed" && (
          <Button variant="danger" onClick={() => act("cancelled", `${b.ref} cancelled and refunded`)}>
            Cancel booking
          </Button>
        )}
        {side === "agent" && b.status !== "cancelled" && (
          <Button variant="danger" onClick={() => act("cancelled", `Cancellation for ${b.ref} sent to ${b.supplier}`)}>
            Cancel booking
          </Button>
        )}
        {b.status === "cancelled" && <p className="text-xs text-tn-muted">This booking is closed.</p>}
      </div>
    </div>
  )
}
