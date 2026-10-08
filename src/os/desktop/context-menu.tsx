import * as React from "react"
import { Code2, ExternalLink, Info, LayoutGrid, SquareArrowOutUpRight } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"
import { useLaunch } from "@/os/hooks"
import { getApp } from "@/os/registry/apps"
import { useSettings, WALLPAPERS } from "@/os/store/settings"
import { useIconGrid } from "./desktop-icons"
import { MenuPanel, useDismiss, type MenuEntry } from "./menu"

type Target = { x: number; y: number; appId?: string; keyboard: boolean }

/**
 * Right-click on the desktop: open the icon under the pointer, change the
 * wallpaper, tidy the icons, flip display settings. Inside windows the
 * browser's own menu stays, so text in the apps can still be copied.
 */
export function useDesktopContextMenu() {
  const [target, setTarget] = React.useState<Target | null>(null)

  const onContextMenu = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.target as Element
    if (el.closest("[data-window], input, textarea, a")) return
    e.preventDefault()
    const origin = e.currentTarget.getBoundingClientRect()
    // The context-menu key fires with the pointer at 0,0: open by the focused icon instead.
    const keyboard = e.clientX === 0 && e.clientY === 0
    const iconEl = el.closest<HTMLElement>("[data-icon]")
    const at = keyboard && iconEl ? iconEl.getBoundingClientRect() : null
    setTarget({
      x: (at ? at.left + at.width / 2 : e.clientX) - origin.left,
      y: (at ? at.top + at.height / 2 : e.clientY) - origin.top,
      appId: iconEl?.dataset.icon,
      keyboard,
    })
  }, [])

  const menu = target ? <DesktopContextMenu target={target} onClose={() => setTarget(null)} /> : null
  return { onContextMenu, menu }
}

function DesktopContextMenu({ target, onClose }: { target: Target; onClose: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const launch = useLaunch()
  const { theme, toggle } = useTheme()
  const { key } = useIconGrid()
  const { wallpaper, setWallpaper, clickMode, setClickMode, resetIconLayout } = useSettings()
  const app = getApp(target.appId)

  useDismiss(true, ref, onClose)

  // Keep the whole menu on screen: flip it left/up when it would overflow.
  React.useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.offsetParent as HTMLElement | null
    if (!el || !parent) return
    const x = target.x + el.offsetWidth > parent.clientWidth ? Math.max(4, target.x - el.offsetWidth) : target.x
    const y = target.y + el.offsetHeight > parent.clientHeight ? Math.max(4, target.y - el.offsetHeight) : target.y
    el.style.transform = `translate(${x}px, ${y}px)`
    el.style.visibility = "visible"
  }, [target])

  const entries: MenuEntry[] = []
  if (app) {
    entries.push({ label: `Open ${app.name}`, icon: <SquareArrowOutUpRight className="size-3.5" />, onSelect: () => launch(app) })
    if (app.liveUrl) entries.push({ type: "link", label: "Open live site", href: app.liveUrl, icon: <ExternalLink className="size-3.5" /> })
    if (app.repo) entries.push({ type: "link", label: "View code", href: app.repo, icon: <Code2 className="size-3.5" /> })
    entries.push({ type: "separator" })
  }
  entries.push(
    { type: "label", label: "Wallpaper" },
    ...WALLPAPERS.map<MenuEntry>((w) => ({
      label: w.name,
      checked: wallpaper === w.id,
      radio: true,
      onSelect: () => setWallpaper(w.id),
    })),
    { type: "separator" },
    { label: "Clean up icons", icon: <LayoutGrid className="size-3.5" />, onSelect: () => resetIconLayout(key) },
    { label: "Dark mode", checked: theme === "dark", onSelect: toggle },
    {
      label: "Open icons with one click",
      checked: clickMode === "single",
      onSelect: () => setClickMode(clickMode === "single" ? "double" : "single"),
    },
    { type: "separator" },
    { label: "About this portfolio", icon: <Info className="size-3.5" />, onSelect: () => launch(getApp("about")!) }
  )

  return (
    <div ref={ref} className="invisible absolute left-0 top-0 z-[1000]" style={{ transform: `translate(${target.x}px, ${target.y}px)` }}>
      <MenuPanel entries={entries} onClose={onClose} autoFocus={target.keyboard} label="Desktop" />
    </div>
  )
}
