import * as React from "react"
import * as ContextMenu from "@radix-ui/react-context-menu"
import { ExternalLink } from "lucide-react"
import { Github } from "@/components/icons"
import { cn } from "@/lib/utils"
import { preloadApp } from "@/os/app-host"
import { AppIcon } from "@/os/app-icon"
import { useLaunch } from "@/os/hooks"
import { apps, getApp, type AppDef } from "@/os/registry/apps"
import { useSettings, type IconCell } from "@/os/store/settings"
import { useWindows } from "@/os/store/windows"
import { CELL, layoutIcons, neighbour, pointToCell, type IconSlot } from "./icon-layout"
import { menu } from "./menu-styles"

/** How far the pointer must travel before a press becomes a drag. */
const DRAG_THRESHOLD = 5

type Drag = { id: string; dx: number; dy: number }

function IconMenu({ app, children }: { app: AppDef; children: React.ReactNode }) {
  const launch = useLaunch()
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={menu.content}>
          <ContextMenu.Item className={cn(menu.item, "font-semibold")} onSelect={() => launch(app)}>
            Open {app.name}
          </ContextMenu.Item>
          {(app.liveUrl || app.repo) && <ContextMenu.Separator className={menu.separator} />}
          {app.liveUrl && (
            <ContextMenu.Item className={menu.item} asChild>
              <a href={app.liveUrl} target="_blank" rel="noreferrer">
                Open live site <ExternalLink className="ml-auto size-3" aria-hidden />
              </a>
            </ContextMenu.Item>
          )}
          {app.repo && (
            <ContextMenu.Item className={menu.item} asChild>
              <a href={app.repo} target="_blank" rel="noreferrer">
                View source <Github className="ml-auto size-3" aria-hidden />
              </a>
            </ContextMenu.Item>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

/**
 * Desktop icons on an edge-anchored grid. Click to select, double-click (or
 * Enter) to open, drag to rearrange — dropping on another icon swaps them —
 * arrow keys to move the selection, rubber-band on empty desktop to select
 * several. Positions are saved per visitor; "Clean up icons" resets them.
 */
export function DesktopIcons({ background }: { background: React.RefObject<HTMLDivElement | null> }) {
  const bounds = useWindows((s) => s.bounds)
  const iconCells = useSettings((s) => s.iconCells)
  const clickMode = useSettings((s) => s.clickMode)
  const launch = useLaunch()
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())
  const [drag, setDrag] = React.useState<Drag | null>(null)
  const [focusId, setFocusId] = React.useState(apps[0].id)
  const buttons = React.useRef(new Map<string, HTMLButtonElement>())
  const press = React.useRef<{ id: string; x: number; y: number; pointerType: string; dragging: boolean } | null>(null)
  const suppressClick = React.useRef(false)
  const pointerType = React.useRef("mouse")
  const bandRef = React.useRef<HTMLDivElement>(null)

  const slots = React.useMemo(
    () => layoutIcons(apps.map((a) => ({ id: a.id, side: a.column })), iconCells, bounds),
    [iconCells, bounds]
  )
  const slotsRef = React.useRef(slots)
  React.useEffect(() => {
    slotsRef.current = slots
  }, [slots])

  const select = (ids: string[]) => setSelected(new Set(ids))

  /* ---------------------------- rubber band ---------------------------- */
  React.useEffect(() => {
    const bg = background.current
    const band = bandRef.current
    if (!bg || !band) return
    let start: { x: number; y: number; id: number } | null = null
    let last = ""

    const local = (e: PointerEvent) => {
      const r = bg.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary || e.target !== bg) return
      setSelected(new Set())
      if (e.pointerType !== "mouse") return
      start = { ...local(e), id: e.pointerId }
      last = ""
      bg.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return
      const p = local(e)
      const box = {
        left: Math.min(start.x, p.x),
        top: Math.min(start.y, p.y),
        right: Math.max(start.x, p.x),
        bottom: Math.max(start.y, p.y),
      }
      // Write the box straight to the DOM — no React render per pointer move.
      Object.assign(band.style, {
        display: "block",
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.right - box.left}px`,
        height: `${box.bottom - box.top}px`,
      })
      const hit = slotsRef.current
        .filter((s) => s.x + 12 < box.right && s.x + CELL.width - 12 > box.left && s.y + 4 < box.bottom && s.y + 76 > box.top)
        .map((s) => s.id)
      const key = hit.join()
      if (key !== last) {
        last = key
        setSelected(new Set(hit))
      }
    }
    const up = () => {
      start = null
      band.style.display = "none"
    }
    bg.addEventListener("pointerdown", down)
    bg.addEventListener("pointermove", move)
    bg.addEventListener("pointerup", up)
    bg.addEventListener("pointercancel", up)
    return () => {
      bg.removeEventListener("pointerdown", down)
      bg.removeEventListener("pointermove", move)
      bg.removeEventListener("pointerup", up)
      bg.removeEventListener("pointercancel", up)
    }
  }, [background])

  /* ------------------------------- drag -------------------------------- */
  const onPointerDown = (e: React.PointerEvent, slot: IconSlot) => {
    pointerType.current = e.pointerType
    if (e.button !== 0) return
    press.current = { id: slot.id, x: e.clientX, y: e.clientY, pointerType: e.pointerType, dragging: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current
    if (!p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (!p.dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
    p.dragging = true
    setDrag({ id: p.id, dx, dy })
  }

  const onPointerUp = (slot: IconSlot) => {
    const p = press.current
    press.current = null
    if (!p?.dragging || !drag) return
    suppressClick.current = true
    const cell = pointToCell(slot.x + drag.dx + CELL.width / 2, slot.y + drag.dy + CELL.height / 2, bounds)
    setDrag(null)
    const same = (a: IconCell, b: IconCell) => a.side === b.side && a.col === b.col && a.row === b.row
    if (same(cell, slot.cell)) return
    const occupant = slots.find((s) => s.id !== slot.id && same(s.cell, cell))
    useSettings.getState().placeIcons({ [slot.id]: cell, ...(occupant ? { [occupant.id]: slot.cell } : {}) })
  }

  /* ----------------------------- keyboard ------------------------------ */
  const onKeyDown = (e: React.KeyboardEvent, app: AppDef) => {
    const dirs = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" } as const
    if (e.key === "Enter") {
      e.preventDefault()
      launch(app)
    } else if (e.key === "Escape") {
      select([])
    } else if (e.key in dirs) {
      e.preventDefault()
      const next = neighbour(slots, app.id, dirs[e.key as keyof typeof dirs])
      if (next) {
        setFocusId(next.id)
        select([next.id])
        buttons.current.get(next.id)?.focus()
      }
    }
  }

  return (
    <nav aria-label="Desktop" className="pointer-events-none absolute inset-0">
      <div
        ref={bandRef}
        aria-hidden
        className="pointer-events-none absolute z-0 hidden rounded border border-accent bg-accent/15"
      />
      <ul className="contents">
        {slots.map((slot) => {
          const app = getApp(slot.id)!
          const isSelected = selected.has(app.id)
          const dragging = drag?.id === app.id
          return (
            <li
              key={app.id}
              className={cn(
                "absolute left-0 top-0",
                dragging ? "z-10" : "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
              )}
              style={{
                width: CELL.width,
                transform: `translate(${slot.x + (dragging ? drag.dx : 0)}px, ${slot.y + (dragging ? drag.dy : 0)}px)`,
              }}
            >
              <IconMenu app={app}>
                <button
                  ref={(el) => {
                    if (el) buttons.current.set(app.id, el)
                    else buttons.current.delete(app.id)
                  }}
                  type="button"
                  data-tour={`icon-${app.id}`}
                  data-selected={isSelected || undefined}
                  title={app.description}
                  tabIndex={focusId === app.id ? 0 : -1}
                  onPointerDown={(e) => onPointerDown(e, slot)}
                  onPointerMove={onPointerMove}
                  onPointerUp={() => onPointerUp(slot)}
                  onPointerEnter={() => preloadApp(app)}
                  onContextMenu={() => select([app.id])}
                  onFocus={() => {
                    setFocusId(app.id)
                    if (!selected.has(app.id)) select([app.id])
                  }}
                  onClick={(e) => {
                    if (suppressClick.current) {
                      suppressClick.current = false
                      return
                    }
                    // Space selects; a tap opens (touch has no double-click); a mouse
                    // click opens or selects depending on the click setting.
                    if (e.detail === 0) select([app.id])
                    else if (clickMode === "single" || pointerType.current !== "mouse") launch(app)
                    else select([app.id])
                  }}
                  onDoubleClick={() => launch(app)}
                  onKeyDown={(e) => onKeyDown(e, app)}
                  className={cn(
                    "group pointer-events-auto flex w-full touch-none flex-col items-center gap-1.5 rounded-lg p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    dragging && "cursor-grabbing opacity-90"
                  )}
                >
                  <AppIcon
                    app={app}
                    className={cn(
                      "size-12 transition-[transform,filter] group-hover:-translate-y-0.5 group-hover:drop-shadow-[0_0_14px_var(--wp-glow)]",
                      isSelected && "ring-2 ring-ring ring-offset-2 ring-offset-transparent",
                      dragging && "scale-105 drop-shadow-[0_12px_18px_rgb(0_0_0/0.3)]"
                    )}
                  />
                  <span
                    className={cn(
                      "line-clamp-2 max-w-full rounded px-1.5 py-0.5 text-center text-[0.6875rem] font-medium leading-tight",
                      isSelected ? "bg-accent text-accent-foreground" : "bg-background/80 text-foreground backdrop-blur-sm"
                    )}
                  >
                    {app.name}
                  </span>
                </button>
              </IconMenu>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
