import * as React from "react"
import { useNavigate } from "react-router-dom"
import type { AppDef } from "@/os/registry/apps"
import { windowsStore } from "@/os/store/windows"

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

export function openWindowFor(app: AppDef) {
  windowsStore.getState().open(app.id, {
    size: { width: app.window.width, height: app.window.height },
    minSize: { width: app.window.minWidth, height: app.window.minHeight },
  })
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
      navigate(`/apps/${app.id}`, { state: options.fromHome ? { fromHome: true } : undefined })
    },
    [navigate]
  )
}
