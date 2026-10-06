import * as Menubar from "@radix-ui/react-menubar"
import { Check, ExternalLink, Moon, Search, Sun } from "lucide-react"
import { profile } from "@/data/profile"
import { useTheme } from "@/hooks/use-theme"
import { cn } from "@/lib/utils"
import { AppIcon } from "@/os/app-icon"
import { useClock, useLaunch } from "@/os/hooks"
import { apps, getApp, type AppDef } from "@/os/registry/apps"
import { MOD_KEY, useSystemActions } from "@/os/system"
import { useUi } from "@/os/store/ui"
import { selectFocusedId, useWindows, windowsStore } from "@/os/store/windows"
import { menu } from "./menu-styles"

function AppItems({ list }: { list: AppDef[] }) {
  const launch = useLaunch()
  return list.map((app) => (
    <Menubar.Item key={app.id} className={menu.item} onSelect={() => launch(app)} data-tour={`menu-${app.id}`}>
      <AppIcon app={app} className="size-4" />
      <span className="flex-1">{app.name}</span>
    </Menubar.Item>
  ))
}

function TopMenu({ label, children, tour }: { label: React.ReactNode; children: React.ReactNode; tour?: string }) {
  return (
    <Menubar.Menu>
      <Menubar.Trigger className={menu.trigger} data-tour={tour}>
        {label}
      </Menubar.Trigger>
      <Menubar.Portal>
        <Menubar.Content className={menu.content} align="start" sideOffset={6}>
          {children}
        </Menubar.Content>
      </Menubar.Portal>
    </Menubar.Menu>
  )
}

/** Open windows, with the focused one ticked; picking one restores and focuses it. */
function WindowsMenu() {
  const windows = useWindows((s) => s.windows)
  const focusedId = useWindows(selectFocusedId)
  const launch = useLaunch()

  return (
    <TopMenu
      tour="menu-windows"
      label={
        <>
          Windows
          <span className="min-w-4 rounded bg-muted px-1 text-center text-[0.6875rem] tabular-nums text-muted-foreground">
            {windows.length}
          </span>
        </>
      }
    >
      {windows.length === 0 ? (
        <Menubar.Item disabled className={menu.item}>
          No open windows
        </Menubar.Item>
      ) : (
        <>
          {windows.map((w) => {
            const app = getApp(w.id)
            if (!app) return null
            return (
              <Menubar.Item key={w.id} className={cn(menu.item, menu.radio)} onSelect={() => launch(app)}>
                {w.id === focusedId && (
                  <span className={menu.indicator}>
                    <Check className="size-3.5" />
                  </span>
                )}
                <AppIcon app={app} className="size-4" />
                <span className="flex-1">{app.name}</span>
                {w.minimized && <span className={menu.shortcut}>minimised</span>}
              </Menubar.Item>
            )
          })}
          <Menubar.Separator className={menu.separator} />
          <Menubar.Item className={menu.item} onSelect={() => windowsStore.getState().closeAll()}>
            Close all windows
          </Menubar.Item>
        </>
      )}
    </TopMenu>
  )
}

function Clock() {
  const now = useClock()
  const dehradun = now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
  return (
    <time
      dateTime={now.toISOString()}
      title={`${now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} · In Dehradun it's ${dehradun} (IST)`}
      className="px-2 text-xs tabular-nums text-muted-foreground"
    >
      <span className="hidden lg:inline">{now.toLocaleDateString(undefined, { weekday: "short" })} </span>
      {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
    </time>
  )
}

/**
 * The top menu bar, built on Radix Menubar like posthog.com's: arrow keys move
 * between menus, Escape closes, and every app is reachable from here as well
 * as from its desktop icon.
 */
export function MenuBar() {
  const { theme, toggle } = useTheme()
  const focused = getApp(useWindows(selectFocusedId))
  const system = useSystemActions()
  const openSpotlight = () => useUi.getState().setSpotlightOpen(true)

  return (
    <header className="relative z-[900] flex h-10 shrink-0 items-center gap-1 border-b border-border bg-background/85 px-2 backdrop-blur-md">
      <Menubar.Root className="flex min-w-0 flex-1 items-center gap-0.5" aria-label="Menu bar">
        <TopMenu
          tour="menu-logo"
          label={
            <>
              <span className="grid size-5 place-items-center rounded bg-foreground text-[0.5625rem] font-bold text-background">MA</span>
              <span className="sr-only">Ashfaq OS menu</span>
            </>
          }
        >
          <Menubar.Item className={menu.item} onSelect={system.about}>
            About Ashfaq OS
          </Menubar.Item>
          <Menubar.Item className={menu.item} onSelect={() => system.openApp("settings")}>
            Settings…
          </Menubar.Item>
          <Menubar.Separator className={menu.separator} />
          <Menubar.Item className={menu.item} onSelect={() => openSpotlight()}>
            Search
            <span className={menu.shortcut}>{MOD_KEY}K</span>
          </Menubar.Item>
          <Menubar.Item className={menu.item} onSelect={system.downloadResume}>
            Download résumé (PDF)
          </Menubar.Item>
          <Menubar.Separator className={menu.separator} />
          <Menubar.Item className={menu.item} onSelect={system.restart}>
            Restart…
          </Menubar.Item>
        </TopMenu>

        <span className="hidden truncate px-2 text-xs font-semibold lg:inline">{focused?.name ?? "Ashfaq OS"}</span>

        <TopMenu label="Projects" tour="menu-projects">
          <Menubar.Label className={menu.label}>Work</Menubar.Label>
          <AppItems list={apps.filter((a) => a.kind === "project")} />
        </TopMenu>
        <TopMenu label="Side projects" tour="menu-side-projects">
          <AppItems list={apps.filter((a) => a.kind === "side-project")} />
        </TopMenu>
        <TopMenu label="Apps" tour="menu-apps">
          <AppItems list={apps.filter((a) => a.kind === "system")} />
        </TopMenu>
        <TopMenu label="Contact" tour="menu-contact">
          <Menubar.Item className={menu.item} asChild>
            <a href={profile.socials.email}>Email {profile.name.split(" ")[1]}</a>
          </Menubar.Item>
          <Menubar.Item className={menu.item} onSelect={system.copyEmail}>
            Copy email address
          </Menubar.Item>
          <Menubar.Separator className={menu.separator} />
          <Menubar.Item className={menu.item} asChild>
            <a href={profile.socials.github} target="_blank" rel="noreferrer">
              GitHub <ExternalLink className="ml-auto size-3" aria-hidden />
            </a>
          </Menubar.Item>
          <Menubar.Item className={menu.item} asChild>
            <a href={profile.socials.linkedin} target="_blank" rel="noreferrer">
              LinkedIn <ExternalLink className="ml-auto size-3" aria-hidden />
            </a>
          </Menubar.Item>
          <Menubar.Separator className={menu.separator} />
          <Menubar.Item className={menu.item} onSelect={system.downloadResume}>
            Download résumé (PDF)
          </Menubar.Item>
        </TopMenu>

        <div className="ml-auto" />
        <WindowsMenu />
      </Menubar.Root>

      <button
        type="button"
        onClick={openSpotlight}
        data-tour="spotlight-button"
        aria-label="Search apps and actions"
        className="flex h-7 items-center gap-2 rounded-md border border-border px-2 text-xs text-muted-foreground hover:bg-muted"
      >
        <Search className="size-3.5" aria-hidden />
        <span className="hidden xl:inline">Search</span>
        <kbd className="font-sans text-[0.6875rem]">{MOD_KEY}K</kbd>
      </button>
      <button
        type="button"
        onClick={toggle}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        className="grid size-7 place-items-center rounded-md hover:bg-muted"
      >
        {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      </button>
      <Clock />
    </header>
  )
}
