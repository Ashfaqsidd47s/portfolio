import * as React from "react"
import * as ContextMenu from "@radix-ui/react-context-menu"
import { AnimatePresence } from "motion/react"
import { Check } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"
import { profile } from "@/data/profile"
import { AppIcon } from "@/os/app-icon"
import { openWindowFor, useLaunch } from "@/os/hooks"
import { getApp, type AppDef } from "@/os/registry/apps"
import { cn } from "@/lib/utils"
import { useScreensaverTimer } from "@/os/overlays/idle"
import { Screensaver } from "@/os/overlays/screensaver"
import { useSettings } from "@/os/store/settings"
import { selectFocusedId, useWindows, windowsStore } from "@/os/store/windows"
import { useSystemActions } from "@/os/system"
import { Wallpaper } from "@/os/wallpaper"
import { WALLPAPERS } from "@/os/wallpapers"
import { DesktopIcons } from "./desktop-icons"
import { menu } from "./menu-styles"
import { MenuBar } from "./menubar"
import { OsWindow } from "./os-window"

/** The only component subscribed to the window list, so opening one doesn't re-render the desktop. */
const WindowList = React.memo(function WindowList() {
  const windows = useWindows((s) => s.windows)
  const focusedId = useWindows(selectFocusedId)
  return (
    <AnimatePresence>
      {windows.map((w) => {
        const app = getApp(w.id)
        return app ? (
          <OsWindow key={w.id} app={app} win={w} focused={w.id === focusedId} />
        ) : null
      })}
    </AnimatePresence>
  )
})

/** A desktop widget that says who this is and how to drive the OS. */
function Welcome() {
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

  const loaded = React.useRef(false)
  React.useEffect(() => {
    // Our own focus-driven rewrites (below) can land after the window they
    // name was closed; they must never reopen it. History state survives a
    // reload, so the first run always opens.
    const ownRewrite = loaded.current && (location.state as { fromFocus?: boolean } | null)?.fromFocus
    loaded.current = true
    if (ownRewrite) return
    if (routeApp && !routeApp.href) openWindowFor(routeApp)
  }, [routeApp, location.key, location.state])

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
    navigate(target, { replace: true, state: { fromFocus: true } })
  }, [focusedId, navigate])
}

/** Right-click on empty desktop. */
function DesktopMenu({ children }: { children: React.ReactNode }) {
  const wallpaper = useSettings((s) => s.wallpaper)
  const moved = useSettings((s) => Object.keys(s.iconCells).length > 0)
  const system = useSystemActions()
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={menu.content} data-tour="desktop-menu">
          <ContextMenu.Sub>
            <ContextMenu.SubTrigger className={cn(menu.item, "data-[state=open]:not-data-[highlighted]:bg-muted")}>
              Change wallpaper <span className={menu.shortcut}>›</span>
            </ContextMenu.SubTrigger>
            <ContextMenu.Portal>
              <ContextMenu.SubContent className={menu.content} sideOffset={4}>
                <ContextMenu.RadioGroup
                  value={wallpaper}
                  onValueChange={(v) => useSettings.getState().setWallpaper(v as typeof wallpaper)}
                >
                  {WALLPAPERS.map((w) => (
                    <ContextMenu.RadioItem key={w.id} value={w.id} className={cn(menu.item, menu.radio)} data-tour={`wallpaper-${w.id}`}>
                      <ContextMenu.ItemIndicator className={menu.indicator}>
                        <Check className="size-3.5" />
                      </ContextMenu.ItemIndicator>
                      {w.name}
                    </ContextMenu.RadioItem>
                  ))}
                </ContextMenu.RadioGroup>
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>
          <ContextMenu.Item className={menu.item} disabled={!moved} onSelect={system.cleanUpIcons} data-tour="clean-up">
            Clean up icons
          </ContextMenu.Item>
          <ContextMenu.Separator className={menu.separator} />
          <ContextMenu.Item className={menu.item} onSelect={() => system.openApp("settings")}>
            Settings…
          </ContextMenu.Item>
          <ContextMenu.Item className={menu.item} onSelect={system.about}>
            About Ashfaq OS
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

export function DesktopOS({ routeApp }: { routeApp?: AppDef }) {
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const backgroundRef = React.useRef<HTMLDivElement>(null)
  const wallpaper = useSettings((s) => s.wallpaper)
  useScreensaverTimer()

  React.useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const measure = () => windowsStore.getState().setBounds({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useUrlSync(routeApp)

  return (
    // The wallpaper class on the root shares its --wp-glow with the icons.
    <div className={cn("fixed inset-0 flex flex-col overflow-hidden bg-background", `wp-${wallpaper}`)}>
      <Wallpaper />
      <MenuBar />
      <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-clip">
        <DesktopMenu>
          <div ref={backgroundRef} data-desktop-background className="absolute inset-0" />
        </DesktopMenu>
        <Welcome />
        <DesktopIcons background={backgroundRef} />
        <WindowList />
      </div>
      <Screensaver />
    </div>
  )
}
