import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { CornerDownLeft, Download, Info, Mail, Moon, Power, Search, Settings2, Sparkles, Sun, Wallpaper as WallpaperIcon } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"
import { cn } from "@/lib/utils"
import { AppIcon } from "@/os/app-icon"
import { useLaunch } from "@/os/hooks"
import { apps, findProject } from "@/os/registry/apps"
import { useSettings } from "@/os/store/settings"
import { useUi } from "@/os/store/ui"
import { isTyping, useSystemActions } from "@/os/system"
import { WALLPAPERS } from "@/os/wallpapers"

type Result = {
  id: string
  label: string
  hint: string
  group: "Apps" | "Actions"
  icon: React.ReactNode
  keywords: string
  run: () => void
}

function ActionIcon({ children }: { children: React.ReactNode }) {
  return <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">{children}</span>
}

function useResults(): Result[] {
  const launch = useLaunch()
  const system = useSystemActions()
  const { theme, toggle } = useTheme()

  return React.useMemo(() => {
    const appResults: Result[] = apps.map((app) => {
      const project = findProject(app.project)
      return {
        id: `app:${app.id}`,
        label: app.name,
        hint: project?.tagline ?? app.description,
        group: "Apps",
        icon: <AppIcon app={app} className="size-6" />,
        keywords: [app.name, app.description, project?.tagline, ...(project?.stack ?? [])].join(" ").toLowerCase(),
        run: () => launch(app),
      }
    })
    const action = (id: string, label: string, hint: string, icon: React.ReactNode, run: () => void, extra = ""): Result => ({
      id: `action:${id}`,
      label,
      hint,
      group: "Actions",
      icon: <ActionIcon>{icon}</ActionIcon>,
      keywords: `${label} ${hint} ${extra}`.toLowerCase(),
      run,
    })
    return [
      ...appResults,
      action(
        "theme",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        "Appearance",
        theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />,
        toggle,
        "theme dark light"
      ),
      ...WALLPAPERS.map((w) =>
        action(`wallpaper:${w.id}`, `Wallpaper: ${w.name}`, w.blurb, <WallpaperIcon className="size-3.5" />, () =>
          useSettings.getState().setWallpaper(w.id)
        , "background")
      ),
      action("cleanup", "Clean up icons", "Put every desktop icon back in its place", <Sparkles className="size-3.5" />, system.cleanUpIcons, "sort arrange"),
      action("resume", "Download résumé", "PDF", <Download className="size-3.5" />, system.downloadResume, "cv"),
      action("email", "Copy email address", "Contact", <Mail className="size-3.5" />, system.copyEmail, "contact hire"),
      action("settings", "Settings", "Wallpaper, theme, screensaver", <Settings2 className="size-3.5" />, () => system.openApp("settings"), "preferences"),
      action("about", "About Ashfaq OS", "What this is", <Info className="size-3.5" />, system.about),
      action("restart", "Restart", "Close everything and boot again", <Power className="size-3.5" />, system.restart, "reboot"),
    ]
  }, [launch, system, theme, toggle])
}

function rank(results: Result[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return results.filter((r) => r.group === "Apps" || ["action:theme", "action:resume", "action:email"].includes(r.id))
  const words = q.split(/\s+/)
  return results
    .filter((r) => words.every((w) => r.keywords.includes(w)))
    .sort((a, b) => {
      const score = (r: Result) => (r.label.toLowerCase().startsWith(q) ? 0 : r.label.toLowerCase().includes(q) ? 1 : 2)
      return score(a) - score(b)
    })
}

/**
 * ⌘K / Ctrl+K (or "/") launcher: find any app, project or OS action by name,
 * description or tech stack, then Enter to run it.
 */
export function Spotlight() {
  const open = useUi((s) => s.spotlightOpen)
  const setOpen = useUi((s) => s.setSpotlightOpen)

  // Global shortcuts.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen(!useUi.getState().spotlightOpen)
      } else if (e.key === "/" && !isTyping(e.target) && !useUi.getState().spotlightOpen) {
        e.preventDefault()
        setOpen(true)
      } else if (e.key === "Escape" && useUi.getState().spotlightOpen) {
        // Also here, not only on the input, in case focus never reached it.
        setOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [setOpen])

  // The panel mounts fresh on every open, so the query always starts empty.
  return <AnimatePresence>{open && <SpotlightPanel close={() => setOpen(false)} />}</AnimatePresence>
}

function SpotlightPanel({ close }: { close: () => void }) {
  const results = useResults()
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const listRef = React.useRef<HTMLUListElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const shown = React.useMemo(() => rank(results, query), [results, query])

  React.useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null
    // autoFocus can lose to whatever had focus (a menu trigger); take it after paint.
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      cancelAnimationFrame(id)
      returnFocus?.focus?.()
    }
  }, [])

  const run = (r: Result | undefined) => {
    if (!r) return
    close()
    r.run()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const next = (active + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % Math.max(shown.length, 1)
      setActive(next)
      listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" })
    } else if (e.key === "Enter") {
      e.preventDefault()
      run(shown[active])
    }
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-start justify-center px-4 pt-[12vh]">
      <motion.button
        type="button"
        aria-label="Close search"
        className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={close}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative flex max-h-[min(32rem,70vh)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-elevated shadow-2xl"
        initial={{ opacity: 0, scale: 0.97, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.14 }}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="Search apps, tech, actions…"
            aria-label="Search apps, tech and actions"
            aria-controls="spotlight-results"
            aria-activedescendant={shown[active] ? `spotlight-${shown[active].id}` : undefined}
            role="combobox"
            aria-expanded="true"
            data-tour="spotlight-input"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 font-sans text-[0.625rem] text-muted-foreground">esc</kbd>
        </div>
        <ul id="spotlight-results" ref={listRef} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {shown.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing matches “{query}”.</li>}
          {shown.map((r, i) => {
            const header = i === 0 || shown[i - 1].group !== r.group
            return (
              <React.Fragment key={r.id}>
                {header && (
                  <li role="presentation" className="px-2 pb-1 pt-2 text-[0.6875rem] font-medium text-muted-foreground">
                    {r.group}
                  </li>
                )}
                <li
                  id={`spotlight-${r.id}`}
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  onPointerMove={() => setActive(i)}
                  onClick={() => run(r)}
                  className={cn(
                    "flex cursor-default items-center gap-3 rounded-lg px-2 py-1.5",
                    i === active && "bg-accent text-accent-foreground"
                  )}
                >
                  {r.icon}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.label}</span>
                    <span className={cn("block truncate text-xs", i === active ? "text-accent-foreground/80" : "text-muted-foreground")}>
                      {r.hint}
                    </span>
                  </span>
                  {i === active && <CornerDownLeft className="size-3.5 shrink-0" aria-hidden />}
                </li>
              </React.Fragment>
            )
          })}
        </ul>
      </motion.div>
    </div>
  )
}
