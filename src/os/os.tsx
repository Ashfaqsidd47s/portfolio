import * as React from "react"
import { MotionConfig } from "motion/react"
import { Navigate, useMatch } from "react-router-dom"
import { useDocumentMeta } from "@/hooks/use-document-meta"
import { profile } from "@/data/profile"
import { useIsPhone } from "@/os/hooks"
import { getApp } from "@/os/registry/apps"
import { useSettings } from "@/os/store/settings"
import { useUi } from "@/os/store/ui"
import { DesktopOS } from "./desktop/desktop"
import { PhoneOS } from "./mobile/phone-os"
import { AboutDialog } from "./overlays/about-dialog"
import { BootScreen } from "./overlays/boot"
import { Spotlight } from "./overlays/spotlight"
import { Toaster } from "./overlays/toaster"

/**
 * The portfolio as an operating system. `/` is the desktop (or the phone home
 * screen); `/apps/:id` is the same OS with that app open. Same apps, same
 * registry, two shells.
 */
export default function OS() {
  const isPhone = useIsPhone()
  const appId = useMatch("/apps/:id")?.params.id
  const app = getApp(appId)

  // First visit: play the boot sequence (skipped for anyone who prefers less motion).
  React.useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!useSettings.getState().booted && !reduced) useUi.getState().setBooting(true)
  }, [])

  useDocumentMeta(
    app && !app.href
      ? { title: `${app.name} — ${profile.name}`, description: app.description, path: `/apps/${app.id}` }
      : {
          title: `${profile.name} — ${profile.role}`,
          description:
            "My portfolio as an operating system: every project is an app you can open and use, from TrypNow's package builder to the pixel-art journey of how I got here.",
          path: "/",
        }
  )

  if (appId && !app) return <Navigate to="/" replace />
  if (app?.href) return <Navigate to={app.href} replace />

  return (
    <MotionConfig reducedMotion="user">
      {isPhone ? <PhoneOS routeApp={app} /> : <DesktopOS routeApp={app} />}
      <Spotlight />
      <AboutDialog />
      <Toaster placement={isPhone ? "top" : "bottom-right"} />
      <BootScreen />
    </MotionConfig>
  )
}
