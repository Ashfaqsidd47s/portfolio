import * as React from "react"
import { cn } from "@/lib/utils"
import { preloadApp } from "@/os/app-host"
import { AppIcon } from "@/os/app-icon"
import { useLaunch } from "@/os/hooks"
import { apps, type AppDef } from "@/os/registry/apps"
import { useSettings } from "@/os/store/settings"

function DesktopIcon({
  app,
  selected,
  onSelect,
}: {
  app: AppDef
  selected: boolean
  onSelect: (id: string | null) => void
}) {
  const launch = useLaunch()
  const clickMode = useSettings((s) => s.clickMode)
  const pointerType = React.useRef("mouse")

  return (
    <li>
      <button
        type="button"
        data-tour={`icon-${app.id}`}
        title={app.description}
        onPointerDown={(e) => {
          pointerType.current = e.pointerType
        }}
        onPointerEnter={() => preloadApp(app)}
        onFocus={() => onSelect(app.id)}
        onClick={() => {
          // Touch has no double-click, so a tap always opens.
          if (clickMode === "single" || pointerType.current !== "mouse") launch(app)
          else onSelect(app.id)
        }}
        onDoubleClick={() => launch(app)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            launch(app)
          }
        }}
        className="group flex w-[5.5rem] flex-col items-center gap-1.5 rounded-lg p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <AppIcon
          app={app}
          className={cn("size-12 transition-transform group-hover:-translate-y-0.5", selected && "ring-2 ring-ring ring-offset-2 ring-offset-transparent")}
        />
        <span
          className={cn(
            "line-clamp-2 max-w-full rounded px-1.5 py-0.5 text-center text-[0.6875rem] font-medium leading-tight",
            selected ? "bg-accent text-accent-foreground" : "bg-background/80 text-foreground backdrop-blur-sm"
          )}
        >
          {app.name}
        </span>
      </button>
    </li>
  )
}

/**
 * Two icon columns pinned to the screen edges, like posthog.com: work on the
 * left, side projects and system apps on the right. On short screens each
 * column wraps into more columns growing inwards.
 */
export function DesktopIcons() {
  const [selected, setSelected] = React.useState<string | null>(null)

  React.useEffect(() => {
    // Clicking anywhere that isn't an icon clears the selection.
    const clear = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.("[data-tour^='icon-']")) setSelected(null)
    }
    document.addEventListener("pointerdown", clear)
    return () => document.removeEventListener("pointerdown", clear)
  }, [])

  const column = (side: "left" | "right") => (
    <ul
      aria-label={side === "left" ? "Projects" : "Side projects and apps"}
      className={cn(
        "pointer-events-auto absolute top-0 flex h-full flex-col gap-1 p-3",
        side === "left" ? "left-0 flex-wrap content-start" : "right-0 flex-wrap-reverse content-start"
      )}
    >
      {apps
        .filter((a) => a.column === side)
        .map((app) => (
          <DesktopIcon key={app.id} app={app} selected={selected === app.id} onSelect={setSelected} />
        ))}
    </ul>
  )

  return (
    <nav aria-label="Desktop" className="pointer-events-none absolute inset-0">
      {column("left")}
      {column("right")}
    </nav>
  )
}
