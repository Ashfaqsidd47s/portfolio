import { MotionConfig } from "motion/react"
import { Navigate, useMatch } from "react-router-dom"
import { useDocumentMeta } from "@/hooks/use-document-meta"
import { profile } from "@/data/profile"
import { useIsPhone } from "@/os/hooks"
import { getApp } from "@/os/registry/apps"
import { DesktopOS } from "./desktop/desktop"
import { PhoneOS } from "./mobile/phone-os"

/**
 * The portfolio as an operating system. `/` is the desktop (or the phone home
 * screen); `/apps/:id` is the same OS with that app open. Same apps, same
 * registry, two shells.
 */
export default function OS() {
  const isPhone = useIsPhone()
  const appId = useMatch("/apps/:id")?.params.id
  const app = getApp(appId)

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
    </MotionConfig>
  )
}
