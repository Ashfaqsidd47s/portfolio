import * as React from "react"
import { useNavigate } from "react-router-dom"
import { useLaunch } from "@/os/hooks"
import { getApp } from "@/os/registry/apps"
import { useSettings } from "@/os/store/settings"
import { useUi } from "@/os/store/ui"
import { windowsStore } from "@/os/store/windows"
import { profile } from "@/data/profile"

/** OS-level actions shared by the menu bar, the context menu, Spotlight and Settings. */
export function useSystemActions() {
  const navigate = useNavigate()
  const launch = useLaunch()

  return React.useMemo(
    () => ({
      openApp: (id: string) => {
        const app = getApp(id)
        if (app) launch(app)
      },
      about: () => useUi.getState().setAboutOpen(true),
      /** Close everything and play the boot sequence again. */
      restart: () => {
        windowsStore.getState().closeAll()
        navigate("/", { replace: true })
        useUi.getState().setBooting(true)
      },
      cleanUpIcons: () => useSettings.getState().cleanUpIcons(),
      copyEmail: async () => {
        try {
          await navigator.clipboard.writeText(profile.email)
          useUi.getState().toast({ title: "Email copied", description: profile.email })
        } catch {
          useUi.getState().toast({ title: "Couldn't copy", description: profile.email })
        }
      },
      downloadResume: () => {
        const a = document.createElement("a")
        a.href = profile.resumeFile
        a.download = profile.resumeFileName
        a.click()
      },
    }),
    [launch, navigate]
  )
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
/** How to write the shortcut modifier on this platform. */
export const MOD_KEY = isMac ? "⌘" : "Ctrl "

/** True when keystrokes belong to a text field rather than the OS. */
export function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
}
