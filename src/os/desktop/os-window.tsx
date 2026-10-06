import * as React from "react"
import { motion, useDragControls, useMotionValue } from "motion/react"
import { Copy, ExternalLink, Minus, Square, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { AppHost } from "@/os/app-host"
import { AppIcon } from "@/os/app-icon"
import type { AppDef } from "@/os/registry/apps"
import { KEEP_VISIBLE, TITLE_BAR, useWindows, windowsStore, type Rect, type WindowState } from "@/os/store/windows"

type Edge = "e" | "s" | "se"

const EDGE_CLASS: Record<Edge, string> = {
  e: "right-0 top-3 bottom-3 w-1.5 cursor-ew-resize",
  s: "bottom-0 left-3 right-3 h-1.5 cursor-ns-resize",
  se: "bottom-0 right-0 size-4 cursor-nwse-resize",
}

/** Drag an edge to resize. Pointer capture keeps the drag alive outside the handle. */
function ResizeHandle({
  edge,
  win,
  rect,
  onResizing,
}: {
  edge: Edge
  win: WindowState
  rect: Rect
  onResizing: (on: boolean) => void
}) {
  const start = React.useRef<{ x: number; y: number; rect: Rect } | null>(null)

  return (
    <div
      aria-hidden
      className={cn("absolute z-10 touch-none", EDGE_CLASS[edge])}
      onPointerDown={(e) => {
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { x: e.clientX, y: e.clientY, rect }
        onResizing(true)
      }}
      onPointerMove={(e) => {
        const s = start.current
        if (!s) return
        windowsStore.getState().resize(win.id, {
          ...s.rect,
          width: s.rect.width + (edge === "s" ? 0 : e.clientX - s.x),
          height: s.rect.height + (edge === "e" ? 0 : e.clientY - s.y),
        })
      }}
      onPointerUp={() => {
        start.current = null
        onResizing(false)
      }}
      onPointerCancel={() => {
        start.current = null
        onResizing(false)
      }}
    />
  )
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

/**
 * One desktop window: title bar to drag, edges to resize, buttons to
 * minimise / maximise / close. Geometry lives in the windows store; Motion
 * animates between store states and handles the drag itself.
 */
export function OsWindow({
  app,
  win,
  focused,
}: {
  app: AppDef
  win: WindowState
  focused: boolean
}) {
  const bounds = useWindows((s) => s.bounds)
  const controls = useDragControls()
  const [resizing, setResizing] = React.useState(false)
  const target: Rect = win.maximized ? { x: 0, y: 0, ...bounds } : win.rect
  const x = useMotionValue(target.x)
  const y = useMotionValue(target.y)
  const titleId = `window-title-${win.id}`
  const { focus, minimize, toggleMaximize, close, move } = windowsStore.getState()

  return (
    <motion.section
      role="dialog"
      aria-labelledby={titleId}
      data-window={win.id}
      inert={win.minimized}
      style={{ x, y, zIndex: win.z }}
      initial={{ opacity: 0, scale: 0.94, width: target.width, height: target.height }}
      animate={{
        opacity: win.minimized ? 0 : 1,
        scale: win.minimized ? 0.9 : 1,
        x: target.x,
        y: target.y,
        width: target.width,
        height: target.height,
      }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.15 } }}
      transition={
        resizing
          ? { duration: 0 }
          : { type: "spring", stiffness: 520, damping: 42, opacity: { duration: 0.15 } }
      }
      drag={!win.maximized}
      dragControls={controls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0}
      // Numbers, not a ref: with a ref Motion rescales the position inside the
      // bounds whenever the window changes size, pushing it off its stored spot.
      dragConstraints={{
        left: KEEP_VISIBLE - target.width,
        right: bounds.width - KEEP_VISIBLE,
        top: 0,
        bottom: bounds.height - TITLE_BAR,
      }}
      onDragEnd={() => move(win.id, { x: x.get(), y: y.get() })}
      onPointerDownCapture={(e) => {
        // Minimising or closing a background window shouldn't raise it first.
        if (!(e.target as Element).closest("[data-no-focus]")) focus(win.id)
      }}
      className={cn(
        "absolute left-0 top-0 flex flex-col overflow-hidden border bg-elevated text-foreground",
        win.maximized ? "rounded-none border-x-0 border-b-0" : "rounded-xl",
        focused ? "border-border-strong shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)]" : "border-border shadow-lg",
        win.minimized && "pointer-events-none"
      )}
    >
      <header
        onPointerDown={(e) => {
          if (!win.maximized) controls.start(e)
        }}
        onDoubleClick={() => toggleMaximize(win.id)}
        className={cn(
          "flex h-10 shrink-0 cursor-default touch-none select-none items-center gap-2 border-b border-border pl-3 pr-1.5",
          focused ? "bg-surface" : "bg-surface/60"
        )}
      >
        <AppIcon app={app} className="size-5" />
        <h2 id={titleId} className={cn("min-w-0 flex-1 truncate text-[0.8125rem] font-semibold", !focused && "text-muted-foreground")}>
          {app.name}
        </h2>
        {app.liveUrl && (
          <a
            href={app.liveUrl}
            target="_blank"
            rel="noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            className="mr-1 hidden items-center gap-1 rounded-md px-2 py-1 text-[0.6875rem] font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:inline-flex"
          >
            Live site <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
        <ChromeButton label="Minimise" onClick={() => minimize(win.id)}>
          <Minus className="size-3.5" />
        </ChromeButton>
        <ChromeButton label={win.maximized ? "Restore" : "Maximise"} onClick={() => toggleMaximize(win.id)}>
          {win.maximized ? <Copy className="size-3 -scale-x-100" /> : <Square className="size-3" />}
        </ChromeButton>
        <ChromeButton label={`Close ${app.name}`} onClick={() => close(win.id)}>
          <X className="size-4" />
        </ChromeButton>
      </header>

      <div className="@container relative min-h-0 flex-1 overflow-auto">
        <AppHost app={app} isPhone={false} />
      </div>

      {!win.maximized &&
        (["e", "s", "se"] as const).map((edge) => (
          <ResizeHandle key={edge} edge={edge} win={win} rect={target} onResizing={setResizing} />
        ))}
    </motion.section>
  )
}
