import { AnimatePresence, motion } from "motion/react"
import { BatteryFull, ChevronLeft, ExternalLink, Signal, Wifi } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { profile } from "@/data/profile"
import { cn } from "@/lib/utils"
import { AppHost, preloadApp } from "@/os/app-host"
import { AppIcon } from "@/os/app-icon"
import { useClock, useLaunch } from "@/os/hooks"
import { apps, getApp, type AppDef } from "@/os/registry/apps"
import { Wallpaper } from "@/os/wallpaper"

const DOCK = ["about", "resume", "journey"]

/** Where the last tapped icon was, so the app can zoom out of it. */
let lastTap = { x: 50, y: 50 }

function StatusBar({ className }: { className?: string }) {
  const now = useClock()
  return (
    <div
      className={cn(
        "flex h-11 shrink-0 items-center justify-between px-6 pt-[env(safe-area-inset-top)] text-[0.8125rem] font-semibold",
        className
      )}
    >
      <time dateTime={now.toISOString()} className="tabular-nums">
        {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/i, "")}
      </time>
      <span className="flex items-center gap-1.5" aria-hidden>
        <Signal className="size-3.5" strokeWidth={2.5} />
        <Wifi className="size-3.5" strokeWidth={2.5} />
        <BatteryFull className="size-5" strokeWidth={2} />
      </span>
    </div>
  )
}

function HomeIcon({ app, showLabel = true }: { app: AppDef; showLabel?: boolean }) {
  const launch = useLaunch()
  return (
    <button
      type="button"
      data-tour={`icon-${app.id}`}
      onPointerDown={() => preloadApp(app)}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        lastTap = {
          x: ((r.left + r.width / 2) / window.innerWidth) * 100,
          y: ((r.top + r.height / 2) / window.innerHeight) * 100,
        }
        launch(app, { fromHome: true })
      }}
      className="flex flex-col items-center gap-1.5 outline-none active:scale-95 focus-visible:[&>span:first-child]:ring-2 focus-visible:[&>span:first-child]:ring-ring"
    >
      <AppIcon app={app} className="size-[3.75rem]" />
      {showLabel ? (
        <span className="w-full truncate text-center text-[0.6875rem] font-medium">{app.name}</span>
      ) : (
        <span className="sr-only">{app.name}</span>
      )}
    </button>
  )
}

function Section({ title, list }: { title: string; list: AppDef[] }) {
  return (
    <section className="rounded-3xl bg-background/70 p-4 backdrop-blur-md">
      <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <ul className="grid grid-cols-4 gap-x-3 gap-y-4">
        {list.map((app) => (
          <li key={app.id} className="min-w-0">
            <HomeIcon app={app} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function HomeScreen() {
  const launch = useLaunch()
  return (
    <div className="relative flex h-full flex-col">
      <StatusBar />
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-32 pt-2">
        <div className="flex flex-col gap-4">
          {/* Widget */}
          <button
            type="button"
            onClick={() => launch(getApp("about")!, { fromHome: true })}
            className="rounded-3xl bg-background/80 p-4 text-left shadow-sm backdrop-blur-md"
          >
            <p className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden /> {profile.availableLabel}
            </p>
            <p className="mt-1.5 text-lg font-semibold tracking-tight">{profile.name}</p>
            <p className="text-sm text-muted-foreground">
              {profile.role} · {profile.location}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Every app here is a project — tap one to use it.</p>
          </button>
          <Section title="Work" list={apps.filter((a) => a.kind === "project")} />
          <Section title="Side projects" list={apps.filter((a) => a.kind === "side-project")} />
        </div>
      </main>

      {/* Dock */}
      <nav
        aria-label="Dock"
        className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] rounded-[2rem] bg-background/75 px-5 py-3 shadow-lg backdrop-blur-xl"
      >
        <ul className="flex justify-around">
          {DOCK.map((id) => (
            <li key={id}>
              <HomeIcon app={getApp(id)!} showLabel={false} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

function AppScreen({ app }: { app: AppDef }) {
  const navigate = useNavigate()
  const location = useLocation()
  const goHome = () => {
    if ((location.state as { fromHome?: boolean } | null)?.fromHome) navigate(-1)
    else navigate("/", { replace: true })
  }

  return (
    <motion.div
      role="dialog"
      aria-label={app.name}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-background"
      style={{ transformOrigin: `${lastTap.x}% ${lastTap.y}%` }}
      initial={{ scale: 0.2, opacity: 0, borderRadius: 48 }}
      animate={{ scale: 1, opacity: 1, borderRadius: 0 }}
      exit={{ scale: 0.2, opacity: 0, borderRadius: 48 }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
    >
      <StatusBar className="bg-surface" />
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface px-2">
        <button
          type="button"
          onClick={goHome}
          className="flex items-center gap-0.5 rounded-md px-1.5 py-1 text-sm font-medium text-accent"
        >
          <ChevronLeft className="size-5" aria-hidden /> Home
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-sm font-semibold">{app.name}</h1>
        {app.liveUrl ? (
          <a
            href={app.liveUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open the live ${app.name} site`}
            className="grid size-9 place-items-center rounded-md text-muted-foreground"
          >
            <ExternalLink className="size-4" />
          </a>
        ) : (
          <span className="size-9" />
        )}
      </header>
      <div className="@container relative min-h-0 flex-1 overflow-auto">
        <AppHost app={app} isPhone />
      </div>
      {/* Home indicator */}
      <button
        type="button"
        aria-label="Go home"
        onClick={goHome}
        className="flex h-[calc(env(safe-area-inset-bottom)+1.25rem)] shrink-0 items-start justify-center bg-background pt-2"
      >
        <span className="h-1 w-32 rounded-full bg-foreground/80" />
      </button>
    </motion.div>
  )
}

/**
 * The phone OS: a home screen of app icons and a dock. Apps open full-screen
 * on top, zooming out of their icon. The route is the source of truth, so
 * the browser's Back button closes the app.
 */
export function PhoneOS({ routeApp }: { routeApp?: AppDef }) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground">
      <Wallpaper />
      <HomeScreen />
      <AnimatePresence>{routeApp && !routeApp.href && <AppScreen key={routeApp.id} app={routeApp} />}</AnimatePresence>
    </div>
  )
}
