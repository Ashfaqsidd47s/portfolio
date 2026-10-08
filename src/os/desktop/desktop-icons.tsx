import * as React from "react"
import { capturePointer, cn } from "@/lib/utils"
import { preloadApp } from "@/os/app-host"
import { AppIcon } from "@/os/app-icon"
import { useLaunch } from "@/os/hooks"
import { apps, getApp, type AppDef } from "@/os/registry/apps"
import { useSettings } from "@/os/store/settings"
import { useWindows } from "@/os/store/windows"
import {
  cellAt,
  cellRect,
  defaultLayout,
  gridFor,
  gridKey,
  iconsInBox,
  moveIcons,
  neighbour,
  resolveLayout,
  type Direction,
} from "./icon-grid"

/** Pointer travel before a press on an icon turns into a drag. */
const DRAG_THRESHOLD = 4

const ARROWS: Record<string, Direction> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" }

const leftIds = apps.filter((a) => a.column === "left").map((a) => a.id)
const rightIds = apps.filter((a) => a.column === "right").map((a) => a.id)
const allIds = [...leftIds, ...rightIds]

/** The icon grid for the current desktop size, with the visitor's arrangement applied. */
export function useIconGrid() {
  const bounds = useWindows((s) => s.bounds)
  const grid = React.useMemo(() => gridFor(bounds), [bounds])
  const key = gridKey(grid)
  const saved = useSettings((s) => s.iconLayouts[key])
  const layout = React.useMemo(
    () => resolveLayout(allIds, saved, defaultLayout(leftIds, rightIds, grid), grid),
    [saved, grid]
  )
  return { grid, key, layout, width: bounds.width }
}

type Drag = {
  id: string
  ids: string[]
  pointerId: number
  startX: number
  startY: number
  moved: boolean
}

/**
 * Desktop icons, posthog.com-style: work projects down the left edge, side
 * projects and system apps down the right. They sit on a snap-to grid and
 * can be dragged (alone or as a selection), rubber-band selected, walked
 * with the arrow keys and opened with a double-click, a tap or Enter.
 */
export function DesktopIcons({ children }: { children?: React.ReactNode }) {
  const { grid, key, layout, width } = useIconGrid()
  const setIconLayout = useSettings((s) => s.setIconLayout)
  const clickMode = useSettings((s) => s.clickMode)
  const launch = useLaunch()
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set())
  const rootRef = React.useRef<HTMLDivElement>(null)
  const bandRef = React.useRef<HTMLDivElement>(null)
  const drag = React.useRef<Drag | null>(null)
  const suppressClick = React.useRef(false)
  const pointerType = React.useRef("mouse")
  // Dragged icons keep their transform until the new layout has rendered, so they don't flash back.
  const pendingClear = React.useRef<string[]>([])

  const iconEl = (id: string) => rootRef.current?.querySelector<HTMLElement>(`[data-icon="${id}"]`)

  React.useLayoutEffect(() => {
    for (const id of pendingClear.current) {
      const el = iconEl(id)
      if (el) el.style.transform = ""
    }
    pendingClear.current = []
  }, [layout])

  React.useEffect(() => {
    // Clicking anywhere that isn't an icon or the desktop menu clears the selection.
    const clear = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.("[data-icon], [role='menu']")) setSelected(new Set())
    }
    document.addEventListener("pointerdown", clear)
    return () => document.removeEventListener("pointerdown", clear)
  }, [])

  // ---- Icon press, drag and drop ------------------------------------------

  const onIconPointerDown = (e: React.PointerEvent, id: string) => {
    pointerType.current = e.pointerType
    if (e.button === 2) {
      // Right-click: act on the selection if the icon is in it, else on the icon.
      if (!selected.has(id)) setSelected(new Set([id]))
      return
    }
    if (e.button !== 0) return
    const ids = selected.has(id) ? [...selected] : [id]
    drag.current = { id, ids, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false }
    capturePointer(e.currentTarget, e.pointerId)
  }

  const onIconPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      d.moved = true
      if (!selected.has(d.id)) setSelected(new Set([d.id]))
    }
    for (const id of d.ids) {
      const el = iconEl(id)
      if (el) el.style.transform = `translate(${dx}px, ${dy}px)`
    }
  }

  const onIconPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    drag.current = null
    if (!d.moved) return
    suppressClick.current = true
    const from = layout[d.id]
    const r = cellRect(from, grid, width)
    const to = cellAt(r.x + r.width / 2 + e.clientX - d.startX, r.y + r.height / 2 + e.clientY - d.startY, grid, width)
    const next = moveIcons(layout, d.ids, to.col - from.col, to.row - from.row, grid)
    if (next === layout) {
      for (const id of d.ids) {
        const el = iconEl(id)
        if (el) el.style.transform = ""
      }
      return
    }
    pendingClear.current = d.ids
    setIconLayout(key, next)
  }

  const onIconPointerCancel = () => {
    const d = drag.current
    drag.current = null
    for (const id of d?.ids ?? []) {
      const el = iconEl(id)
      if (el) el.style.transform = ""
    }
  }

  const onIconClick = (e: React.MouseEvent, app: AppDef) => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      setSelected((s) => {
        const next = new Set(s)
        if (next.has(app.id)) next.delete(app.id)
        else next.add(app.id)
        return next
      })
      return
    }
    // Touch has no double-click, so a tap always opens.
    if (clickMode === "single" || pointerType.current !== "mouse") launch(app)
    else setSelected(new Set([app.id]))
  }

  const onIconKeyDown = (e: React.KeyboardEvent, app: AppDef) => {
    if (e.key === "Enter") {
      e.preventDefault()
      launch(app)
    } else if (e.key === "Escape") {
      setSelected(new Set())
    } else if (ARROWS[e.key] && !e.shiftKey) {
      e.preventDefault()
      const next = neighbour(layout, app.id, ARROWS[e.key])
      if (!next) return
      setSelected(new Set([next]))
      iconEl(next)?.querySelector("button")?.focus()
    }
  }

  // ---- Rubber-band selection on empty desktop -----------------------------
  // The box is moved by writing styles directly, so dragging it doesn't
  // re-render the desktop on every pointer move; only a change in which
  // icons it touches does.

  const band = React.useRef<{ x: number; y: number; pointerId: number; additive: ReadonlySet<string>; last: string } | null>(null)

  const onBackgroundPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const origin = e.currentTarget.getBoundingClientRect()
    const additive = e.shiftKey || e.metaKey || e.ctrlKey ? selected : new Set<string>()
    band.current = { x: e.clientX - origin.left, y: e.clientY - origin.top, pointerId: e.pointerId, additive, last: "" }
    if (!e.shiftKey && !e.metaKey && !e.ctrlKey) setSelected(new Set())
    capturePointer(e.currentTarget, e.pointerId)
  }

  const onBackgroundPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const b = band.current
    const el = bandRef.current
    if (!b || !el || b.pointerId !== e.pointerId) return
    const origin = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - origin.left
    const y = e.clientY - origin.top
    const box = { x: Math.min(x, b.x), y: Math.min(y, b.y), width: Math.abs(x - b.x), height: Math.abs(y - b.y) }
    Object.assign(el.style, {
      display: "block",
      transform: `translate(${box.x}px, ${box.y}px)`,
      width: `${box.width}px`,
      height: `${box.height}px`,
    })
    const hits = iconsInBox(layout, box, grid, width)
    const signature = hits.sort().join(",")
    if (signature === b.last) return
    b.last = signature
    setSelected(new Set([...b.additive, ...hits]))
  }

  const endBand = () => {
    band.current = null
    if (bandRef.current) bandRef.current.style.display = "none"
  }

  return (
    <div ref={rootRef} className="absolute inset-0">
      <div
        data-desktop-background
        aria-hidden
        className="absolute inset-0 touch-none"
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onBackgroundPointerMove}
        onPointerUp={endBand}
        onPointerCancel={endBand}
      />
      {/* Desktop widgets sit above the background but below the icons. */}
      {children}
      <div
        ref={bandRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 z-[1] hidden rounded-sm border border-ring bg-ring/15"
      />
      <ul aria-label="Desktop" className="pointer-events-none absolute inset-0">
        {allIds.map((id) => {
          const app = getApp(id)!
          const cell = layout[id]
          if (!cell) return null
          const r = cellRect(cell, grid, width)
          const isSelected = selected.has(id)
          return (
            <li
              key={id}
              data-icon={id}
              className="pointer-events-auto absolute flex justify-center will-change-transform"
              style={{ left: r.x, top: r.y, width: r.width, height: r.height }}
            >
              <button
                type="button"
                data-tour={`icon-${app.id}`}
                aria-pressed={isSelected}
                title={`${app.name} — ${app.description}`}
                onPointerDown={(e) => onIconPointerDown(e, id)}
                onPointerMove={onIconPointerMove}
                onPointerUp={onIconPointerUp}
                onPointerCancel={onIconPointerCancel}
                onPointerEnter={() => preloadApp(app)}
                onClick={(e) => onIconClick(e, app)}
                onDoubleClick={() => launch(app)}
                onKeyDown={(e) => onIconKeyDown(e, app)}
                className="group flex h-fit w-[5.5rem] touch-none select-none flex-col items-center gap-1.5 rounded-lg p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <AppIcon
                  app={app}
                  className={cn(
                    "size-12 transition-[transform,filter] group-hover:-translate-y-0.5 group-hover:drop-shadow-[0_0_14px_var(--wp-glow)]",
                    isSelected && "ring-2 ring-ring ring-offset-2 ring-offset-transparent"
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
            </li>
          )
        })}
      </ul>
    </div>
  )
}
