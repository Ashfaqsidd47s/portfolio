import * as React from "react"
import { Copy, Download, Info, Link2, Mail, Moon, Power, Sun } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Github, Linkedin } from "@/components/icons"
import { profile } from "@/data/profile"
import { useTheme } from "@/hooks/use-theme"
import { cn } from "@/lib/utils"
import { AppIcon } from "@/os/app-icon"
import { desktopLink, useClock, useLaunch } from "@/os/hooks"
import { apps, getApp, type AppDef } from "@/os/registry/apps"
import { selectFocusedId, useWindows, windowsStore } from "@/os/store/windows"
import { AutopilotControls } from "@/os/autopilot/controls"
import { useBoot } from "./boot"
import { MenuPanel, useDismiss, type MenuEntry } from "./menu"
import { SHORTCUTS } from "./shortcuts"

type MenuDef = { id: string; label: React.ReactNode; title: string; entries: MenuEntry[] }

function useMenus(): MenuDef[] {
  const launch = useLaunch()
  const navigate = useNavigate()
  const startBoot = useBoot((s) => s.start)

  const appEntries = (list: AppDef[]): MenuEntry[] =>
    list.map((app) => ({ label: app.name, icon: <AppIcon app={app} className="size-4" />, onSelect: () => launch(app) }))

  return [
    {
      id: "logo",
      title: "Ashfaq OS",
      label: (
        <>
          <span className="grid size-6 place-items-center rounded-md bg-foreground text-[0.625rem] font-bold text-background">MA</span>
          <span className="text-xs font-semibold">Ashfaq OS</span>
        </>
      ),
      entries: [
        { label: "About this portfolio", icon: <Info className="size-3.5" />, onSelect: () => launch(getApp("about")!) },
        {
          type: "link",
          label: "Download résumé",
          href: profile.resumeFile,
          download: profile.resumeFileName,
          icon: <Download className="size-3.5" />,
        },
        { type: "separator" },
        {
          label: "Restart…",
          icon: <Power className="size-3.5" />,
          onSelect: () => {
            windowsStore.getState().closeAll()
            navigate("/", { replace: true })
            startBoot()
          },
        },
      ],
    },
    { id: "projects", title: "Projects", label: "Projects", entries: appEntries(apps.filter((a) => a.kind === "project")) },
    {
      id: "side-projects",
      title: "Side projects",
      label: "Side projects",
      entries: appEntries(apps.filter((a) => a.kind === "side-project")),
    },
    { id: "apps", title: "Apps", label: "Apps", entries: appEntries(apps.filter((a) => a.kind === "system")) },
    {
      id: "contact",
      title: "Contact",
      label: "Contact",
      entries: [
        { type: "link", label: `Email ${profile.name.split(" ")[0]}`, href: profile.socials.email, icon: <Mail className="size-3.5" /> },
        {
          label: "Copy email address",
          icon: <Copy className="size-3.5" />,
          onSelect: () => void navigator.clipboard?.writeText(profile.email).catch(() => {}),
        },
        { type: "separator" },
        { type: "link", label: "LinkedIn", href: profile.socials.linkedin, icon: <Linkedin className="size-3.5" /> },
        { type: "link", label: "GitHub", href: profile.socials.github, icon: <Github className="size-3.5" /> },
      ],
    },
  ]
}

/**
 * The left half of the menubar. Works like a real one: click a title to open
 * its menu, then hover (or ←/→) to move between menus while one is open.
 */
function Menus() {
  const menus = useMenus()
  const [open, setOpen] = React.useState<{ id: string; keyboard: boolean } | null>(null)
  const ref = React.useRef<HTMLDivElement>(null)
  const close = React.useCallback(() => setOpen(null), [])
  useDismiss(open !== null, ref, close)

  const step = (from: string, dir: -1 | 1) => {
    const i = menus.findIndex((m) => m.id === from)
    const next = menus[(i + dir + menus.length) % menus.length]
    setOpen({ id: next.id, keyboard: true })
    ref.current?.querySelector<HTMLElement>(`[data-menu="${next.id}"]`)?.focus()
  }

  return (
    <nav ref={ref} aria-label="Menu bar" className="flex min-w-0 items-center gap-0.5">
      {menus.map((menu) => {
        const isOpen = open?.id === menu.id
        return (
          <div key={menu.id} className="relative">
            <button
              type="button"
              data-menu={menu.id}
              aria-haspopup="menu"
              aria-expanded={isOpen}
              title={menu.title}
              onClick={(e) => setOpen(isOpen ? null : { id: menu.id, keyboard: e.detail === 0 })}
              onPointerEnter={() => open && !isOpen && setOpen({ id: menu.id, keyboard: false })}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault()
                  setOpen({ id: menu.id, keyboard: true })
                }
              }}
              className={cn(
                "flex h-7 items-center gap-2 rounded-md px-2 text-xs font-medium hover:bg-muted",
                menu.id === "logo" && "pl-1",
                isOpen && "bg-muted"
              )}
            >
              {menu.label}
            </button>
            {isOpen && (
              <MenuPanel
                className="absolute left-0 top-9"
                label={menu.title}
                entries={menu.entries}
                autoFocus={open.keyboard}
                onClose={close}
                onStep={(dir) => step(menu.id, dir)}
              />
            )}
          </div>
        )
      })}
    </nav>
  )
}

/** Lists open windows; picking one restores and focuses it. */
function WindowsMenu() {
  const windows = useWindows((s) => s.windows)
  const focusedId = useWindows(selectFocusedId)
  const launch = useLaunch()
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const close = React.useCallback(() => setOpen(false), [])
  const [copied, setCopied] = React.useState(false)
  useDismiss(open, ref, close)

  React.useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(t)
  }, [copied])

  const shortcuts: MenuEntry[] = [
    { type: "separator" },
    { type: "label", label: "Keyboard shortcuts" },
    ...SHORTCUTS.map<MenuEntry>((s) => ({ type: "info", label: s.action, shortcut: s.keys })),
  ]

  const entries: MenuEntry[] =
    windows.length === 0
      ? [{ type: "label", label: "No open windows" }, ...shortcuts]
      : [
          ...windows.flatMap<MenuEntry>((w) => {
            const app = getApp(w.id)
            if (!app) return []
            return [
              {
                label: `${app.name}${w.minimized ? " (minimised)" : ""}`,
                checked: w.id === focusedId,
                onSelect: () => launch(app),
              },
            ]
          }),
          { type: "separator" },
          { label: "Cycle windows", shortcut: "⇧`", onSelect: () => windowsStore.getState().cycle() },
          {
            label: "Copy link to this desktop",
            icon: <Link2 className="size-3.5" />,
            onSelect: () =>
              void navigator.clipboard
                ?.writeText(desktopLink())
                .then(() => setCopied(true))
                .catch(() => {}),
          },
          { label: "Close all windows", shortcut: "⇧X", onSelect: () => windowsStore.getState().closeAll() },
          ...shortcuts,
        ]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        data-windows-button
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium hover:bg-muted"
      >
        Windows
        <span className="min-w-4 rounded bg-muted px-1 text-center text-[0.6875rem] tabular-nums text-muted-foreground">
          {windows.length}
        </span>
      </button>
      {open && <MenuPanel className="absolute right-0 top-9 w-64" label="Open windows" entries={entries} onClose={close} />}
      <span role="status" className={cn("absolute right-0 top-9 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[0.6875rem] text-background", !copied && "sr-only")}>
        {copied ? "Link copied" : ""}
      </span>
    </div>
  )
}

const HOME_TZ = "Asia/Kolkata"

export function MenuBar() {
  const { theme, toggle } = useTheme()
  const now = useClock()
  const focused = getApp(useWindows(selectFocusedId))
  const fmt = (opts: Intl.DateTimeFormatOptions) => now.toLocaleString(undefined, opts)
  const homeTime = fmt({ hour: "2-digit", minute: "2-digit", timeZone: HOME_TZ })

  return (
    <header className="relative z-[900] flex h-10 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-2 backdrop-blur-md">
      <Menus />
      {focused && (
        <span className="hidden min-w-0 truncate border-l border-border pl-3 text-xs text-muted-foreground sm:inline">
          {focused.name}
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <AutopilotControls />
        <WindowsMenu />
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="grid size-7 place-items-center rounded-md hover:bg-muted"
        >
          {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
        </button>
        <time
          dateTime={now.toISOString()}
          className="px-2 text-xs tabular-nums text-muted-foreground"
          title={`${fmt({ weekday: "long", day: "numeric", month: "long" })} · ${homeTime} in Dehradun`}
        >
          {fmt({ weekday: "short" })} {fmt({ hour: "2-digit", minute: "2-digit" })}
        </time>
      </div>
    </header>
  )
}
