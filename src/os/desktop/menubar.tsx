import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"
import { cn } from "@/lib/utils"
import { AppIcon } from "@/os/app-icon"
import { useClock, useLaunch } from "@/os/hooks"
import { getApp } from "@/os/registry/apps"
import { selectFocusedId, useWindows, windowsStore } from "@/os/store/windows"

/** Lists open windows; picking one restores and focuses it. */
function WindowsMenu() {
  const windows = useWindows((s) => s.windows)
  const focusedId = useWindows(selectFocusedId)
  const launch = useLaunch()
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
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
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-[1000] w-56 rounded-lg border border-border bg-elevated p-1 shadow-lg">
          {windows.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No open windows</p>
          ) : (
            <>
              {windows.map((w) => {
                const app = getApp(w.id)
                if (!app) return null
                return (
                  <button
                    key={w.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      launch(app)
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    <AppIcon app={app} className="size-4" />
                    <span className={cn("flex-1 truncate", w.id === focusedId && "font-semibold")}>{app.name}</span>
                    {w.minimized && <span className="text-[0.6875rem] text-muted-foreground">minimised</span>}
                  </button>
                )
              })}
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  windowsStore.getState().closeAll()
                  setOpen(false)
                }}
                className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
              >
                Close all windows
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export function MenuBar() {
  const { theme, toggle } = useTheme()
  const now = useClock()
  const focused = getApp(useWindows(selectFocusedId))

  return (
    <header className="relative z-[900] flex h-10 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-3 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-6 place-items-center rounded-md bg-foreground text-[0.625rem] font-bold text-background">MA</span>
        <span className="text-xs font-semibold">Ashfaq OS</span>
        {focused && (
          <>
            <span className="text-border-strong" aria-hidden>
              /
            </span>
            <span className="truncate text-xs text-muted-foreground">{focused.name}</span>
          </>
        )}
      </div>
      <div className="ml-auto flex items-center gap-1">
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
          title={now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        >
          {now.toLocaleDateString(undefined, { weekday: "short" })}{" "}
          {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </time>
      </div>
    </header>
  )
}
