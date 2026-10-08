import * as React from "react"
import { useNavigate } from "react-router-dom"
import { autopilotStore } from "@/os/autopilot/store"
import type { AppDef } from "@/os/registry/apps"
import { selectFocusedId, serializeLayout, windowsStore, type Point } from "@/os/store/windows"

const PHONE_QUERY = "(max-width: 767px)"

function subscribePhone(onChange: () => void) {
  const mql = window.matchMedia(PHONE_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

/** Below 768px the site is a phone; above, a desktop — the same breakpoint posthog.com uses. */
export function useIsPhone() {
  return React.useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false
  )
}

/** The current time, refreshed often enough for a minute-precision clock. */
export function useClock() {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 10_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

/** History state the OS puts on its entries. */
export type OsHistoryState = {
  /** The phone opened this app from its home screen. */
  fromHome?: boolean
  /** This entry opened that window, so going Back from it closes the window. */
  opened?: string
  /** A rewrite after a focus change, not a request to open anything. */
  fromFocus?: boolean
} | null

/** Centre of an element, in px relative to the desktop area. */
export function desktopPoint(selector: string): Point | undefined {
  const el = document.querySelector(selector)
  const desk = document.querySelector("[data-desktop]")
  if (!el || !desk) return undefined
  const r = el.getBoundingClientRect()
  const d = desk.getBoundingClientRect()
  return { x: r.left + r.width / 2 - d.left, y: r.top + r.height / 2 - d.top }
}

export function openWindowFor(app: AppDef) {
  windowsStore.getState().open(app.id, {
    size: { width: app.window.width, height: app.window.height },
    minSize: { width: app.window.minWidth, height: app.window.minHeight },
    // The window grows out of its desktop icon, and shrinks back into it.
    origin: desktopPoint(`[data-icon="${app.id}"] button`),
  })
}

/**
 * Close a window and put keyboard focus somewhere sensible: the window now
 * on top, else the app's desktop icon.
 */
export function closeWindow(id: string) {
  const hadFocus = document.querySelector(`[data-window="${id}"]`)?.contains(document.activeElement)
  windowsStore.getState().close(id)
  if (!hadFocus) return
  const next = selectFocusedId(windowsStore.getState())
  const target = next
    ? document.querySelector<HTMLElement>(`[data-window="${next}"]`)
    : document.querySelector<HTMLElement>(`[data-icon="${id}"] button`)
  target?.focus({ preventScroll: true })
}

/**
 * Opening an app is a navigation: the URL is the source of truth for what the
 * visitor asked for, so links, Back and shared URLs all behave the same.
 * Page apps (the journey, the résumé) leave the OS for their own route.
 */
export function useLaunch() {
  const navigate = useNavigate()
  return React.useCallback(
    (app: AppDef, options: { fromHome?: boolean } = {}) => {
      if (app.href) {
        navigate(app.href)
        return
      }
      // Opening pushes a history entry; bringing back a window that is already
      // open only replaces the current one (keeping what that entry opened).
      const isOpen = windowsStore.getState().windows.some((w) => w.id === app.id)
      const here = (window.history.state as { usr?: OsHistoryState } | null)?.usr
      const state: OsHistoryState = {
        ...(options.fromHome && { fromHome: true }),
        ...(isOpen ? here?.opened && { opened: here.opened } : { opened: app.id }),
      }
      // The autopilot opens apps over and over; it mustn't fill the visitor's Back history.
      const touring = autopilotStore.getState().status === "running"
      navigate(`/apps/${app.id}`, { state, replace: isOpen || touring })
    },
    [navigate]
  )
}

/** A link that opens this exact desktop: the current app plus every window's place. */
export function desktopLink() {
  const { windows, bounds } = windowsStore.getState()
  const url = new URL(window.location.href)
  url.search = ""
  url.hash = ""
  if (windows.length > 0) url.searchParams.set("windows", JSON.stringify(serializeLayout(windows, bounds)))
  return url.toString()
}
