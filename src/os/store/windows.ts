import { createStore, useStore } from "zustand"

/**
 * The window manager's state: one record per open window, modelled on
 * posthog.com's AppWindow. Geometry is in px relative to the desktop area
 * (below the menu bar). Z-order is kept dense — 1…n, focused window = n — so
 * it never creeps up and always doubles as the CSS z-index.
 */

export type Point = { x: number; y: number }
export type Size = { width: number; height: number }
export type Rect = Point & Size

export type SnapSide = "left" | "right"

export type WindowState = {
  /** One window per app for now, so the id is the app id. */
  id: string
  z: number
  rect: Rect
  /** Where to go back to after maximise or snap. */
  restoreRect?: Rect
  minSize: Size
  minimized: boolean
  maximized: boolean
  snapped: SnapSide | false
}

export type OpenOptions = {
  size: Size
  minSize: Size
}

type State = {
  windows: WindowState[]
  /** Size of the desktop area, measured by the shell. */
  bounds: Size
}

type Actions = {
  setBounds: (bounds: Size) => void
  open: (id: string, options: OpenOptions) => void
  close: (id: string) => void
  closeAll: () => void
  focus: (id: string) => void
  minimize: (id: string) => void
  toggleMaximize: (id: string) => void
  snap: (id: string, side: SnapSide) => void
  move: (id: string, position: Point) => void
  resize: (id: string, rect: Rect) => void
}

export type WindowsStore = State & Actions

/** Offset between cascaded windows. */
export const CASCADE = 32
/** How much of a window must stay on screen so its title bar can be grabbed. */
export const KEEP_VISIBLE = 96
export const TITLE_BAR = 40

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), Math.max(min, max))

/** Restack so `id` is on top and the rest keep their order, numbered 1…n. */
function restack(windows: WindowState[], topId?: string): WindowState[] {
  const order = [...windows].sort((a, b) => a.z - b.z)
  if (topId) {
    const i = order.findIndex((w) => w.id === topId)
    if (i !== -1) order.push(order.splice(i, 1)[0])
  }
  const rank = new Map(order.map((w, i) => [w.id, i + 1]))
  return windows.map((w) => (w.z === rank.get(w.id) ? w : { ...w, z: rank.get(w.id)! }))
}

/** Where a new window goes: centred if it is the first, otherwise cascaded. */
export function placeWindow(size: Size, bounds: Size, windows: WindowState[]): Rect {
  const width = Math.min(size.width, Math.max(bounds.width - CASCADE, 0))
  const height = Math.min(size.height, Math.max(bounds.height - CASCADE, 0))
  const centred = {
    x: Math.round((bounds.width - width) / 2),
    y: Math.round((bounds.height - height) / 2),
  }

  const visible = windows.filter((w) => !w.minimized && !w.maximized)
  if (visible.length === 0) return { ...centred, width, height }

  const top = visible.reduce((a, b) => (b.z > a.z ? b : a))
  let x = top.rect.x + CASCADE
  let y = top.rect.y + CASCADE
  // Wrap back to the top-left when the cascade would run off the desktop.
  if (x + width > bounds.width || y + height > bounds.height) {
    x = CASCADE / 2
    y = CASCADE / 2
  }
  return { x, y, width, height }
}

function clampPosition(p: Point, size: Size, bounds: Size): Point {
  return {
    x: clamp(p.x, KEEP_VISIBLE - size.width, bounds.width - KEEP_VISIBLE),
    y: clamp(p.y, 0, bounds.height - TITLE_BAR),
  }
}

export function createWindowsStore(initialBounds: Size = { width: 1280, height: 760 }) {
  return createStore<WindowsStore>()((set, get) => {
    const update = (id: string, fn: (w: WindowState) => WindowState) =>
      set((s) => ({ windows: s.windows.map((w) => (w.id === id ? fn(w) : w)) }))

    return {
      windows: [],
      bounds: initialBounds,

      setBounds: (bounds) => {
        const { bounds: prev } = get()
        if (prev.width === bounds.width && prev.height === bounds.height) return
        set((s) => ({
          bounds,
          // Keep snapped windows glued to their half, and pull anything that
          // fell off the edge back into view.
          windows: s.windows.map((w) => {
            if (w.snapped) return { ...w, rect: snapRect(w.snapped, bounds) }
            const width = Math.min(w.rect.width, bounds.width)
            const height = Math.min(w.rect.height, bounds.height)
            return { ...w, rect: { ...clampPosition(w.rect, { width, height }, bounds), width, height } }
          }),
        }))
      },

      open: (id, { size, minSize }) => {
        const existing = get().windows.find((w) => w.id === id)
        if (existing) {
          if (existing.minimized) update(id, (w) => ({ ...w, minimized: false }))
          get().focus(id)
          return
        }
        set((s) => {
          const window: WindowState = {
            id,
            z: s.windows.length + 1,
            rect: placeWindow(size, s.bounds, s.windows),
            minSize,
            minimized: false,
            maximized: false,
            snapped: false,
          }
          return { windows: [...s.windows, window] }
        })
      },

      close: (id) => set((s) => ({ windows: restack(s.windows.filter((w) => w.id !== id)) })),

      closeAll: () => set({ windows: [] }),

      focus: (id) => {
        const { windows } = get()
        const target = windows.find((w) => w.id === id)
        if (!target) return
        // Already on top and visible: keep the same state object, so nothing re-renders.
        if (target.z === windows.length && !target.minimized) return
        set({ windows: restack(windows.map((w) => (w.id === id ? { ...w, minimized: false } : w)), id) })
      },

      minimize: (id) => update(id, (w) => ({ ...w, minimized: true })),

      toggleMaximize: (id) => {
        update(id, (w) =>
          w.maximized
            ? { ...w, maximized: false, rect: w.restoreRect ?? w.rect, restoreRect: undefined }
            : { ...w, maximized: true, snapped: false, restoreRect: w.snapped ? w.restoreRect : w.rect }
        )
        get().focus(id)
      },

      snap: (id, side) => {
        const { bounds } = get()
        update(id, (w) => ({
          ...w,
          snapped: side,
          maximized: false,
          restoreRect: w.snapped || w.maximized ? w.restoreRect : w.rect,
          rect: snapRect(side, bounds),
        }))
        get().focus(id)
      },

      move: (id, position) => {
        const { bounds } = get()
        update(id, (w) => {
          // Dragging a snapped window off its half gives it back its old size.
          const size = w.snapped && w.restoreRect ? w.restoreRect : w.rect
          return {
            ...w,
            snapped: false,
            maximized: false,
            restoreRect: undefined,
            rect: {
              ...clampPosition(position, size, bounds),
              width: size.width,
              height: size.height,
            },
          }
        })
      },

      resize: (id, rect) => {
        const { bounds } = get()
        update(id, (w) => {
          const width = clamp(rect.width, w.minSize.width, bounds.width)
          const height = clamp(rect.height, w.minSize.height, bounds.height)
          return {
            ...w,
            snapped: false,
            maximized: false,
            restoreRect: undefined,
            rect: { ...clampPosition(rect, { width, height }, bounds), width, height },
          }
        })
      },
    }
  })
}

export function snapRect(side: SnapSide, bounds: Size): Rect {
  const width = Math.floor(bounds.width / 2)
  return { x: side === "left" ? 0 : bounds.width - width, y: 0, width, height: bounds.height }
}

/** The focused window: highest z among the ones that aren't minimised. */
export function selectFocusedId(s: State): string | undefined {
  let top: WindowState | undefined
  for (const w of s.windows) if (!w.minimized && (!top || w.z > top.z)) top = w
  return top?.id
}

export const windowsStore = createWindowsStore()

export function useWindows<T>(selector: (s: WindowsStore) => T): T {
  return useStore(windowsStore, selector)
}
