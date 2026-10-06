import * as React from "react"
import { CalendarCheck, CalendarDays, ExternalLink, LayoutDashboard, Package as PackageIcon, RotateCcw, Store, Ticket } from "lucide-react"
import { cn } from "@/lib/utils"
import { Bookings } from "./bookings"
import { AGENCY, SUPPLIER, useTrypNow, type Side } from "./data"
import { useToast } from "./ui"
import { Attractions, Dashboard, Marketplace, Packages } from "./views"

type View = "dashboard" | "packages" | "attractions" | "bookings" | "marketplace" | "my-bookings"

const NAV: Record<Side, { id: View; label: string; Icon: typeof LayoutDashboard }[]> = {
  supplier: [
    { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { id: "packages", label: "Packages", Icon: PackageIcon },
    { id: "attractions", label: "Attractions", Icon: Ticket },
    { id: "bookings", label: "Bookings", Icon: CalendarCheck },
  ],
  agent: [
    { id: "marketplace", label: "Marketplace", Icon: Store },
    { id: "my-bookings", label: "My bookings", Icon: CalendarDays },
  ],
}

function Logo() {
  return (
    <p className="text-lg font-black tracking-tight text-tn-ink">
      tryp<span className="text-tn-teal">now</span>
    </p>
  )
}

/**
 * TrypNow: both sides of a B2B travel marketplace in one window. As the
 * supplier you build and publish packages, list attractions with AI and
 * confirm bookings; switch to the agent and book what you just published.
 */
export default function TrypNow() {
  const [side, setSide] = React.useState<Side>("supplier")
  const [view, setView] = React.useState<View>("dashboard")
  const [bookingFilter, setBookingFilter] = React.useState<"all" | "pending">("all")
  const [toast, toastNode] = useToast()
  const reset = useTrypNow((s) => s.reset)
  const pending = useTrypNow((s) => s.bookings.filter((b) => b.supplier === SUPPLIER && b.status === "pending").length)
  const mainRef = React.useRef<HTMLElement>(null)

  const go = (next: View) => {
    setView(next)
    if (next === "bookings") setBookingFilter("all")
    mainRef.current?.scrollTo({ top: 0 })
  }

  const switchSide = (next: Side) => {
    setSide(next)
    go(NAV[next][0].id)
  }

  const badge = (id: View) => (id === "bookings" && pending > 0 ? pending : null)

  const roleSwitch = (
    <div className="flex rounded-md bg-tn-soft p-0.5 text-xs font-semibold ring-1 ring-tn-line" role="group" aria-label="Signed in as">
      {(["supplier", "agent"] as const).map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={side === s}
          data-tour={`tn-side-${s}`}
          onClick={() => switchSide(s)}
          className={cn(
            "flex-1 rounded px-2.5 py-1 capitalize",
            side === s ? "bg-white text-tn-ink shadow-sm" : "text-tn-muted hover:text-tn-ink"
          )}
        >
          {s}
        </button>
      ))}
    </div>
  )

  return (
    <div className="@container h-full">
      <div className="relative flex h-full flex-col bg-tn-bg font-sans text-tn-ink @3xl:flex-row">
        {/* Sidebar (wide) / top bar (narrow) */}
        <aside className="flex shrink-0 flex-col gap-3 border-b border-tn-line bg-white p-3 @3xl:w-52 @3xl:border-b-0 @3xl:border-r">
          <div className="flex items-center justify-between gap-3 @3xl:flex-col @3xl:items-stretch">
            <div className="flex items-center gap-2">
              <Logo />
              <span className="rounded bg-tn-mint px-1.5 py-0.5 text-[0.625rem] font-bold text-tn-teal">
                {side === "supplier" ? "DMC" : "AGENT"}
              </span>
            </div>
            {roleSwitch}
          </div>
          <p className="hidden truncate text-[0.6875rem] text-tn-muted @3xl:block">
            Signed in as {side === "supplier" ? SUPPLIER : AGENCY}
          </p>
          <nav aria-label="TrypNow" className="-mx-1 overflow-x-auto @3xl:mx-0 @3xl:overflow-visible">
            <ul className="flex gap-1 px-1 @3xl:flex-col @3xl:px-0">
              {NAV[side].map(({ id, label, Icon }) => (
                <li key={id}>
                  <button
                    type="button"
                    aria-current={view === id ? "page" : undefined}
                    data-tour={`tn-nav-${id}`}
                    onClick={() => go(id)}
                    className={cn(
                      "flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold",
                      view === id ? "bg-tn-mint text-tn-teal" : "text-tn-ink hover:bg-tn-soft"
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                    {badge(id) && (
                      <span className="ml-auto rounded-full bg-tn-teal px-1.5 text-[0.625rem] text-white" aria-label={`${badge(id)} pending`}>
                        {badge(id)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-auto hidden flex-col gap-2 border-t border-tn-line pt-3 @3xl:flex">
            <p className="text-[0.6875rem] leading-snug text-tn-muted">
              Demo data, real mechanics. Everything you do is saved in this browser.
            </p>
            <button
              type="button"
              onClick={() => {
                reset()
                switchSide("supplier")
                toast("Demo data reset")
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-tn-muted hover:text-tn-ink"
            >
              <RotateCcw className="size-3.5" aria-hidden /> Reset demo data
            </button>
            <a
              href="https://trypnow.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-tn-teal hover:underline"
            >
              <ExternalLink className="size-3.5" aria-hidden /> trypnow.com
            </a>
          </div>
        </aside>

        <main ref={mainRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
          {view === "dashboard" && (
            <Dashboard
              toast={toast}
              onShowPending={() => {
                setView("bookings")
                setBookingFilter("pending")
              }}
            />
          )}
          {view === "packages" && <Packages toast={toast} />}
          {view === "attractions" && <Attractions toast={toast} />}
          {view === "bookings" && <Bookings key={bookingFilter} side="supplier" toast={toast} initialFilter={bookingFilter} />}
          {view === "marketplace" && <Marketplace toast={toast} />}
          {view === "my-bookings" && <Bookings side="agent" toast={toast} />}
        </main>

        {toastNode}
      </div>
    </div>
  )
}
