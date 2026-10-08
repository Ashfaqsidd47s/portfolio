import * as React from "react"
import { animate, motion, useDragControls, useMotionValue, useReducedMotion, type PanInfo } from "motion/react"
import { Copy, ExternalLink, Minus, RotateCcw, Square, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { AppHost } from "@/os/app-host"
import { AppIcon } from "@/os/app-icon"
import { closeWindow, desktopPoint } from "@/os/hooks"
import { resetApp } from "@/os/kernel/reset"
import type { AppDef } from "@/os/registry/apps"
import { KEEP_VISIBLE, TITLE_BAR, useWindows, windowsStore, type Point, type Rect, type WindowState } from "@/os/store/windows"

type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"

const EDGES: Edge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"]

const EDGE_CLASS: Record<Edge, string> = {
  n: "top-0 left-3 right-3 h-1.5 cursor-ns-resize",
  s: "bottom-0 left-3 right-3 h-1.5 cursor-ns-resize",
  e: "right-0 top-3 bottom-3 w-1.5 cursor-ew-resize",
  w: "left-0 top-3 bottom-3 w-1.5 cursor-ew-resize",
  ne: "right-0 top-0 size-3 cursor-nesw-resize",
  nw: "left-0 top-0 size-3 cursor-nwse-resize",
  se: "right-0 bottom-0 size-4 cursor-nwse-resize",
  sw: "left-0 bottom-0 size-3 cursor-nesw-resize",
}

/** Pointer distance from the desktop's edge that snaps a dragged window. */
const SNAP_EDGE = 8
/** Pointer travel before dragging a maximised window pulls it out. */
const DETACH_DISTANCE = 6

type SnapZone = "left" | "right" | "max"

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), Math.max(min, max))

/** The rect an edge drag produces: the opposite edge stays put, sizes clamp to min and the desktop. */
export function resizeRect(edge: Edge, start: Rect, dx: number, dy: number, min: { width: number; height: number }, bounds: { width: number; height: number }): Rect {
  let { x, y, width, height } = start
  if (edge.includes("e")) width = clamp(start.width + dx, min.width, bounds.width - start.x)
  if (edge.includes("w")) {
    width = clamp(start.width - dx, min.width, start.x + start.width)
    x = start.x + start.width - width
  }
  if (edge.includes("s")) height = clamp(start.height + dy, min.height, bounds.height - start.y)
  if (edge.includes("n")) {
    height = clamp(start.height - dy, min.height, start.y + start.height)
    y = start.y + start.height - height
  }
  return { x, y, width, height }
}

function ChromeButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-no-focus
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  )
}

/** Where a window snaps if dropped with the pointer here (desktop px), if anywhere. */
function snapZoneAt(p: Point, bounds: { width: number }): SnapZone | null {
  if (p.y <= 0) return "max"
  if (p.x <= SNAP_EDGE) return "left"
  if (p.x >= bounds.width - SNAP_EDGE) return "right"
  return null
}

function desktopOffset() {
  const r = document.querySelector("[data-desktop]")?.getBoundingClientRect()
  return { left: r?.left ?? 0, top: r?.top ?? 0 }
}

/**
 * One desktop window: title bar to drag (and snap, by dropping on a screen
 * edge), eight edges to resize, buttons to reset / minimise / maximise /
 * close. Geometry lives in the windows store and is drawn through motion
 * values, so drags and resizes run without React renders and only the
 * result is committed.
 */
export function OsWindow({
  app,
  win,
  focused,
  visible,
}: {
  app: AppDef
  win: WindowState
  focused: boolean
  visible: boolean
}) {
  const bounds = useWindows((s) => s.bounds)
  const controls = useDragControls()
  const reduced = useReducedMotion()
  const sectionRef = React.useRef<HTMLElement>(null)
  const [zone, setZone] = React.useState<SnapZone | null>(null)
  const zoneRef = React.useRef<SnapZone | null>(null)
  const [generation, setGeneration] = React.useState(0)
  // While the pointer is driving the window, the store doesn't animate it.
  const live = React.useRef(false)

  const target: Rect = win.maximized ? { x: 0, y: 0, ...bounds } : win.rect
  const x = useMotionValue(target.x)
  const y = useMotionValue(target.y)
  const width = useMotionValue(target.width)
  const height = useMotionValue(target.height)
  const titleId = `window-title-${win.id}`
  const { focus, minimize, toggleMaximize, maximize, snap, move, resize, detach } = windowsStore.getState()

  // Store → screen: glide to every committed rect (snap, maximise, cascade, viewport clamp).
  React.useEffect(() => {
    if (live.current) return
    const transition = reduced ? { duration: 0 } : ({ type: "spring", stiffness: 520, damping: 42 } as const)
    const runs = [
      animate(x, target.x, transition),
      animate(y, target.y, transition),
      animate(width, target.width, transition),
      animate(height, target.height, transition),
    ]
    return () => runs.forEach((r) => r.stop())
  }, [target.x, target.y, target.width, target.height, reduced, x, y, width, height])

  // Keyboard focus moves into a window when it opens.
  React.useEffect(() => {
    sectionRef.current?.focus({ preventScroll: true })
  }, [])

  // Grow from the icon on open and shrink back into it on close; minimising
  // shrinks towards the Windows button in the menu bar.
  const minimizeTarget = React.useMemo(() => (win.minimized ? desktopPoint("[data-windows-button]") : undefined), [win.minimized])
  const anchor = minimizeTarget ?? win.origin
  const transformOrigin = anchor ? `${anchor.x - target.x}px ${anchor.y - target.y}px` : "50% 50%"

  // ---- Drag, snap, and pulling a maximised window off the top -----------

  const pendingDetach = React.useRef<Point | null>(null)

  const onTitlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    // A press that never turns into a drag must still hand control back to the store.
    window.addEventListener("pointerup", () => (live.current = false), { once: true })
    if (win.maximized || win.snapped) {
      // Keep receiving moves even once the pointer leaves the title bar.
      e.currentTarget.setPointerCapture(e.pointerId)
      pendingDetach.current = { x: e.clientX, y: e.clientY }
      return
    }
    live.current = true
    controls.start(e)
  }

  const onTitlePointerMove = (e: React.PointerEvent) => {
    const start = pendingDetach.current
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) < DETACH_DISTANCE) return
    pendingDetach.current = null
    const off = desktopOffset()
    const rect = detach(win.id, { x: e.clientX - off.left, y: e.clientY - off.top })
    if (!rect) return
    live.current = true
    x.set(rect.x)
    y.set(rect.y)
    width.set(rect.width)
    height.set(rect.height)
    controls.start(e)
  }

  const onDrag = (_: unknown, info: PanInfo) => {
    const off = desktopOffset()
    const next = snapZoneAt({ x: info.point.x - window.scrollX - off.left, y: info.point.y - window.scrollY - off.top }, bounds)
    if (zoneRef.current === next) return
    zoneRef.current = next
    setZone(next)
  }

  const onDragEnd = () => {
    live.current = false
    const zone = zoneRef.current
    zoneRef.current = null
    setZone(null)
    if (zone === "max") maximize(win.id)
    else if (zone) snap(win.id, zone)
    else move(win.id, { x: x.get(), y: y.get() })
  }

  // ---- Resize from any edge ----------------------------------------------
  // Pointer moves write straight to the motion values once per frame; the
  // store only hears about the final rect.

  const resizing = React.useRef<{ edge: Edge; px: number; py: number; start: Rect; frame: number; rect: Rect } | null>(null)

  const onEdgeDown = (edge: Edge) => (e: React.PointerEvent) => {
    e.stopPropagation()
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    live.current = true
    const start = { x: x.get(), y: y.get(), width: width.get(), height: height.get() }
    resizing.current = { edge, px: e.clientX, py: e.clientY, start, frame: 0, rect: start }
  }

  const onEdgeMove = (e: React.PointerEvent) => {
    const r = resizing.current
    if (!r) return
    r.rect = resizeRect(r.edge, r.start, e.clientX - r.px, e.clientY - r.py, win.minSize, bounds)
    if (r.frame) return
    r.frame = requestAnimationFrame(() => {
      r.frame = 0
      x.set(r.rect.x)
      y.set(r.rect.y)
      width.set(r.rect.width)
      height.set(r.rect.height)
    })
  }

  const onEdgeUp = () => {
    const r = resizing.current
    if (!r) return
    cancelAnimationFrame(r.frame)
    resizing.current = null
    live.current = false
    resize(win.id, r.rect)
  }

  const zoneRect: Rect | null =
    zone === "max"
      ? { x: 0, y: 0, ...bounds }
      : zone
        ? { x: zone === "left" ? 0 : bounds.width - Math.floor(bounds.width / 2), y: 0, width: Math.floor(bounds.width / 2), height: bounds.height }
        : null

  return (
    <>
      {zoneRect && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-xl border-2 border-ring/70 bg-ring/15 backdrop-blur-[2px] transition-all duration-150"
          style={{ left: zoneRect.x + 6, top: zoneRect.y + 6, width: zoneRect.width - 12, height: zoneRect.height - 12, zIndex: win.z }}
        />
      )}
      <motion.section
        ref={sectionRef}
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-window={win.id}
        inert={win.minimized}
        style={{ x, y, width, height, zIndex: win.z, transformOrigin }}
        initial={{ opacity: 0, scale: win.origin ? 0.2 : 0.94 }}
        animate={{ opacity: win.minimized ? 0 : 1, scale: win.minimized ? 0.1 : 1 }}
        exit={{ opacity: 0, scale: win.origin ? 0.2 : 0.94, transition: { duration: 0.18 } }}
        transition={{ type: "spring", stiffness: 420, damping: 36, opacity: { duration: 0.15 } }}
        drag
        dragControls={controls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0}
        // Numbers, not a ref: with a ref Motion rescales the position inside the
        // bounds whenever the window changes size, pushing it off its stored spot.
        dragConstraints={{
          left: KEEP_VISIBLE - width.get(),
          right: bounds.width - KEEP_VISIBLE,
          top: 0,
          bottom: bounds.height - TITLE_BAR,
        }}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        onPointerDownCapture={(e) => {
          // Minimising or closing a background window shouldn't raise it first.
          if (!(e.target as Element).closest("[data-no-focus]")) focus(win.id)
        }}
        className={cn(
          "absolute left-0 top-0 flex flex-col overflow-hidden border bg-elevated text-foreground outline-none",
          win.maximized ? "rounded-none border-x-0 border-b-0" : "rounded-xl",
          focused ? "border-border-strong shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)]" : "border-border shadow-lg",
          win.minimized && "pointer-events-none"
        )}
      >
        <header
          onPointerDown={onTitlePointerDown}
          onPointerMove={onTitlePointerMove}
          onPointerUp={() => (pendingDetach.current = null)}
          onDoubleClick={(e) => {
            if (!(e.target as Element).closest("button, a")) toggleMaximize(win.id)
          }}
          className={cn(
            "flex h-10 shrink-0 cursor-default touch-none select-none items-center gap-2 border-b border-border pl-3 pr-1.5",
            focused ? "bg-surface" : "bg-surface/60"
          )}
        >
          <AppIcon app={app} className={cn("size-5", !focused && "opacity-70")} />
          <h2 id={titleId} className={cn("min-w-0 flex-1 truncate text-[0.8125rem] font-semibold", !focused && "text-muted-foreground")}>
            {app.name}
          </h2>
          {app.liveUrl && (
            <a
              href={app.liveUrl}
              target="_blank"
              rel="noreferrer"
              data-no-focus
              onPointerDown={(e) => e.stopPropagation()}
              className="mr-1 hidden items-center gap-1 rounded-md px-2 py-1 text-[0.6875rem] font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
            >
              Live site <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
          {app.resettable && (
            <ChromeButton
              label="Reset demo data"
              onClick={() => {
                resetApp(app.id)
                // Remount too, so the app's own view state starts over.
                setGeneration((g) => g + 1)
              }}
            >
              <RotateCcw className="size-3.5" />
            </ChromeButton>
          )}
          <ChromeButton label="Minimise" onClick={() => minimize(win.id)}>
            <Minus className="size-3.5" />
          </ChromeButton>
          <ChromeButton label={win.maximized ? "Restore (⇧↓)" : "Maximise (⇧↑)"} onClick={() => toggleMaximize(win.id)}>
            {win.maximized ? <Copy className="size-3 -scale-x-100" /> : <Square className="size-3" />}
          </ChromeButton>
          <ChromeButton label={`Close ${app.name} (⇧W)`} onClick={() => closeWindow(win.id)}>
            <X className="size-4" />
          </ChromeButton>
        </header>

        <div className="@container relative min-h-0 flex-1 overflow-auto">
          <AppHost key={generation} app={app} isPhone={false} isFocused={focused} isVisible={visible} />
        </div>

        {!win.maximized &&
          EDGES.map((edge) => (
            <div
              key={edge}
              aria-hidden
              className={cn("absolute z-10 touch-none", EDGE_CLASS[edge])}
              onPointerDown={onEdgeDown(edge)}
              onPointerMove={onEdgeMove}
              onPointerUp={onEdgeUp}
              onPointerCancel={onEdgeUp}
            />
          ))}
      </motion.section>
    </>
  )
}
