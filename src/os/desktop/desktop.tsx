import * as React from "react"
import { AnimatePresence } from "motion/react"
import { useLocation, useNavigate, useNavigationType } from "react-router-dom"
import { profile } from "@/data/profile"
import { AppIcon } from "@/os/app-icon"
import { closeWindow, openWindowFor, useLaunch, type OsHistoryState } from "@/os/hooks"
import { getApp, type AppDef } from "@/os/registry/apps"
import { useSettings } from "@/os/store/settings"
import { parseLayout, selectFocusedId, serializeLayout, useWindows, visibleWindowIds, windowsStore } from "@/os/store/windows"
import { Wallpaper, useWallpaper } from "@/os/wallpaper"
import { AutopilotCursor } from "@/os/autopilot/cursor"
import { ResumeOffer } from "@/os/autopilot/controls"
import { useAutopilot } from "@/os/autopilot/store"
import { useAutopilotDriver } from "@/os/autopilot/use-autopilot"
import { BootScreen, useBoot } from "./boot"
import { useDesktopContextMenu } from "./context-menu"
import { DesktopIcons } from "./desktop-icons"
import { MenuBar } from "./menubar"
import { OsWindow } from "./os-window"
import { Screensaver, useIdle } from "./screensaver"
import { useShortcuts } from "./shortcuts"

/** How long the desk sits untouched before the screensaver starts. */
const SCREENSAVER_AFTER = 90_000

/** The only component subscribed to the window list, so opening one doesn't re-render the desktop. */
const WindowList = React.memo(function WindowList() {
  const windows = useWindows((s) => s.windows)
  const bounds = useWindows((s) => s.bounds)
  const focusedId = useWindows(selectFocusedId)
  const tabVisible = useTabVisible()
  const visible = React.useMemo(() => visibleWindowIds(windows, bounds), [windows, bounds])
  return (
    <AnimatePresence>
      {windows.map((w) => {
        const app = getApp(w.id)
        return app ? (
          <OsWindow key={w.id} app={app} win={w} focused={w.id === focusedId} visible={tabVisible && visible.has(w.id)} />
        ) : null
      })}
    </AnimatePresence>
  )
})

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange)
  return () => document.removeEventListener("visibilitychange", onChange)
}

function useTabVisible() {
  return React.useSyncExternalStore(subscribeVisibility, () => document.visibilityState === "visible", () => true)
}

const SESSION_KEY = "os:session:v1"

/**
 * Brings back a window layout: a shared one from `?windows=` (then drops the
 * parameter so the URL stays clean), or this tab's own one after a reload or
 * Back/Forward into the site. Keeps this tab's copy up to date as it changes.
 */
function useLayoutRestore() {
  const navigate = useNavigate()
  const location = useLocation()
  const done = React.useRef(false)

  React.useLayoutEffect(() => {
    // Once, on load.
    if (done.current) return
    done.current = true
    const params = new URLSearchParams(location.search)
    const shared = params.get("windows")
    const navType = (performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined)?.type
    let saved = parseLayout(shared)
    if (shared === null && (navType === "reload" || navType === "back_forward")) {
      try {
        saved = parseLayout(window.sessionStorage.getItem(SESSION_KEY))
      } catch {
        /* no session storage: start empty */
      }
    }
    if (saved.length > 0) {
      windowsStore.getState().restoreLayout(saved, (id) => {
        const app = getApp(id)
        return app && !app.href ? { width: app.window.minWidth, height: app.window.minHeight } : undefined
      })
    }
    if (shared !== null) {
      params.delete("windows")
      const search = params.toString()
      navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true, state: location.state })
    }
  }, [navigate, location.pathname, location.search, location.state])

  React.useEffect(
    () =>
      windowsStore.subscribe((s) => {
        try {
          window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(serializeLayout(s.windows, s.bounds)))
        } catch {
          /* non-fatal */
        }
      }),
    []
  )
}


/** A desktop widget that says who this is and how to drive the OS. */
function Welcome({ onChangeWallpaper }: { onChangeWallpaper: () => void }) {
  const launch = useLaunch()
  const featured = getApp("trypnow")!
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center p-28">
      <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-border bg-background/85 p-5 shadow-lg backdrop-blur-md">
        <p className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-accent" aria-hidden /> {profile.availableLabel}
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Hi, I'm {profile.name}.</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {profile.role} in {profile.location}. Every project on this desktop is an app you can open and actually use —
          double-click one to start.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Drag icons around, right-click the desktop for options, or{" "}
          <button type="button" onClick={onChangeWallpaper} className="font-medium text-foreground underline underline-offset-2">
            change the wallpaper
          </button>
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => launch(featured)}
            className="inline-flex items-center gap-2 rounded-md bg-primary py-1.5 pl-1.5 pr-3 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            <AppIcon app={featured} className="size-5" /> Open {featured.name}
          </button>
          <button
            type="button"
            onClick={() => launch(getApp("about")!)}
            className="rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            About me
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Keeps the URL and the windows in step, both ways:
 * - /apps/:id opens (or focuses) that window — on load, from links, on Back.
 * - Opening a window pushes a history entry tagged with it, so Back closes
 *   the window that entry opened (newest first), then lands on the one below.
 * - Focusing, closing or minimising a window rewrites the URL to the window
 *   now on top, without adding history entries.
 */
function useUrlSync(routeApp: AppDef | undefined) {
  const navigate = useNavigate()
  const location = useLocation()
  const focusedId = useWindows(selectFocusedId)
  // The URL we expect to be at: the current one, or the last one we asked
  // for if that navigation hasn't landed yet.
  const expected = React.useRef(location.pathname)
  React.useLayoutEffect(() => {
    expected.current = location.pathname
  }, [location.pathname])

  const navType = useNavigationType()
  const state = location.state as OsHistoryState
  const current = React.useRef<{ state: OsHistoryState; idx: number } | null>(null)
  React.useEffect(() => {
    const left = current.current
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    current.current = { state, idx }
    const first = left === null

    if (!first && navType === "POP") {
      // Back: close the window the entry we just left had opened.
      if (idx < left.idx && left.state?.opened && left.state.opened !== routeApp?.id) closeWindow(left.state.opened)
      // Landed on the bare desktop with a window still on top: name it in the URL.
      const top = selectFocusedId(windowsStore.getState())
      if (!routeApp && top) {
        expected.current = `/apps/${top}`
        navigate(expected.current, { replace: true, state: { fromFocus: true, ...(state?.opened && { opened: state.opened }) } })
        return
      }
    } else if (!first && state?.fromFocus) {
      // Our own focus-driven rewrites (below) can land after the window they
      // name was closed; they must never reopen it. History state survives a
      // reload, so the first run always opens.
      return
    }
    if (routeApp && !routeApp.href) openWindowFor(routeApp)
  }, [routeApp, location.key, state, navType, navigate])

  // Only a change of focus may rewrite the URL. `navigate` changes identity on
  // every navigation, so without this guard a new URL would be "corrected"
  // back to the old focused window before the new one opens.
  const prevFocused = React.useRef(focusedId)
  React.useEffect(() => {
    if (prevFocused.current === focusedId) return
    prevFocused.current = focusedId
    const target = focusedId ? `/apps/${focusedId}` : "/"
    if (expected.current === target) return
    expected.current = target
    // Keep the entry's `opened` tag, so Back still closes that window.
    const opened = current.current?.state?.opened
    navigate(target, { replace: true, state: { fromFocus: true, ...(opened && { opened }) } satisfies OsHistoryState })
  }, [focusedId, navigate])
}

export function DesktopOS({ routeApp }: { routeApp?: AppDef }) {
  const viewportRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => windowsStore.getState().setBounds({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useLayoutRestore()
  useUrlSync(routeApp)
  useShortcuts()

  const wallpaper = useWallpaper()
  const booting = useBoot((s) => s.booting)
  // While the autopilot is driving it *is* the screensaver.
  const autopilot = useAutopilot((s) => s.status)
  const idle = useIdle(SCREENSAVER_AFTER, !booting && autopilot !== "running")
  // A deep link means the visitor came for one app: don't start the tour over it.
  const [deepLink] = React.useState(() => Boolean(routeApp))
  useAutopilotDriver({ ready: !booting, deepLink })
  const cycleWallpaper = useSettings((s) => s.cycleWallpaper)
  const { onContextMenu, menu } = useDesktopContextMenu()

  return (
    <div data-wallpaper={wallpaper} className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <Wallpaper />
      <MenuBar />
      <div ref={viewportRef} data-desktop onContextMenu={onContextMenu} className="relative min-h-0 flex-1 overflow-clip">
        <DesktopIcons>
          <Welcome onChangeWallpaper={cycleWallpaper} />
        </DesktopIcons>
        <WindowList />
        {menu}
      </div>
      <AutopilotCursor />
      <ResumeOffer />
      <AnimatePresence>
        {booting && <BootScreen key="boot" />}
        {idle && !booting && <Screensaver key="screensaver" />}
      </AnimatePresence>
    </div>
  )
}
