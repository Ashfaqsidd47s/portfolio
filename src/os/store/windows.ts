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
  /** Centre of the icon the window grew out of, so it can shrink back into it. */
  origin?: Point
}

export type OpenOptions = {
  size: Size
  minSize: Size
  origin?: Point
}

/**
 * A window in a shared or saved layout. Geometry is in percent of the
 * desktop, so the layout fits whatever screen opens it (posthog.com's
 * `?windows=` format). Listed bottom to top.
 */
export type SavedWindow = {
  id: string
  x: number
  y: number
  w: number
  h: number
  min?: 1
  max?: 1
  snap?: SnapSide
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
  maximize: (id: string) => void
  /** Undo maximise or snap; a window that is neither gets minimised. */
  restore: (id: string) => void
  snap: (id: string, side: SnapSide) => void
  /**
   * Un-maximise or un-snap a window that is being dragged, keeping the same
   * spot of its title bar under the pointer. Returns the new rect.
   */
  detach: (id: string, pointer: Point) => Rect | undefined
  /** Bring the bottom-most visible window to the front (Alt+Tab-style). */
  cycle: () => void
  /** Replace every window with a saved layout; `defaults` gives each app's min size. */
  restoreLayout: (saved: SavedWindow[], minSizeFor: (id: string) => Size | undefined) => void
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

      open: (id, { size, minSize, origin }) => {
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
            origin,
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

      maximize: (id) => {
        const w = get().windows.find((w) => w.id === id)
        if (w && !w.maximized) get().toggleMaximize(id)
        else get().focus(id)
      },

      restore: (id) => {
        const w = get().windows.find((w) => w.id === id)
        if (!w) return
        if (w.maximized) get().toggleMaximize(id)
        else if (w.snapped)
          update(id, (w) => ({ ...w, snapped: false, rect: w.restoreRect ?? w.rect, restoreRect: undefined }))
        else get().minimize(id)
      },

      detach: (id, pointer) => {
        const { bounds, windows } = get()
        const w = windows.find((w) => w.id === id)
        if (!w || (!w.maximized && !w.snapped)) return w?.rect
        const current = w.maximized ? { x: 0, y: 0, ...bounds } : w.rect
        const size = w.restoreRect ?? w.rect
        // Keep the grabbed point at the same fraction of the title bar.
        const ratio = (pointer.x - current.x) / current.width
        const rect = {
          ...clampPosition({ x: Math.round(pointer.x - ratio * size.width), y: Math.max(0, pointer.y - TITLE_BAR / 2) }, size, bounds),
          width: size.width,
          height: size.height,
        }
        update(id, (w) => ({ ...w, maximized: false, snapped: false, restoreRect: undefined, rect }))
        return rect
      },

      cycle: () => {
        const visible = get().windows.filter((w) => !w.minimized)
        if (visible.length < 2) return
        get().focus(visible.reduce((a, b) => (b.z < a.z ? b : a)).id)
      },

      restoreLayout: (saved, minSizeFor) => {
        const { bounds } = get()
        const pct = (n: number, of: number) => Math.round((n / 100) * of)
        const windows: WindowState[] = []
        for (const entry of saved) {
          const minSize = minSizeFor(entry.id)
          if (!minSize || windows.some((w) => w.id === entry.id)) continue
          const width = clamp(pct(entry.w, bounds.width), minSize.width, bounds.width)
          const height = clamp(pct(entry.h, bounds.height), minSize.height, bounds.height)
          const free = { ...clampPosition({ x: pct(entry.x, bounds.width), y: pct(entry.y, bounds.height) }, { width, height }, bounds), width, height }
          windows.push({
            id: entry.id,
            z: windows.length + 1,
            rect: entry.snap ? snapRect(entry.snap, bounds) : free,
            restoreRect: entry.snap || entry.max ? free : undefined,
            minSize,
            minimized: Boolean(entry.min),
            maximized: Boolean(entry.max) && !entry.snap,
            snapped: entry.snap ?? false,
          })
        }
        set({ windows })
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

/** The rect a window actually covers on screen. */
export const screenRect = (w: WindowState, bounds: Size): Rect => (w.maximized ? { x: 0, y: 0, ...bounds } : w.rect)

/** Above this share covered by other windows, a window counts as hidden. */
export const OCCLUDED = 0.8

/**
 * Ids of windows a visitor can actually see: not minimised and less than
 * 80% covered by the windows above them. Coverage is sampled on a 10×10
 * grid, which is plenty for a pause/resume decision.
 */
export function visibleWindowIds(windows: WindowState[], bounds: Size): Set<string> {
  const shown = windows.filter((w) => !w.minimized)
  const visible = new Set<string>()
  const N = 10
  for (const w of shown) {
    const r = screenRect(w, bounds)
    const above = shown.filter((o) => o.z > w.z).map((o) => screenRect(o, bounds))
    let covered = 0
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const px = r.x + ((i + 0.5) / N) * r.width
        const py = r.y + ((j + 0.5) / N) * r.height
        if (above.some((a) => px >= a.x && px < a.x + a.width && py >= a.y && py < a.y + a.height)) covered++
      }
    }
    if (covered / (N * N) <= OCCLUDED) visible.add(w.id)
  }
  return visible
}

/** The layout as percentages of the desktop, bottom window first. */
export function serializeLayout(windows: WindowState[], bounds: Size): SavedWindow[] {
  const pct = (n: number, of: number) => Math.round((n / of) * 10000) / 100
  return [...windows]
    .sort((a, b) => a.z - b.z)
    .map((w) => {
      // Maximised and snapped windows remember the rect they go back to.
      const r = (w.maximized || w.snapped) && w.restoreRect ? w.restoreRect : w.rect
      return {
        id: w.id,
        x: pct(r.x, bounds.width),
        y: pct(r.y, bounds.height),
        w: pct(r.width, bounds.width),
        h: pct(r.height, bounds.height),
        ...(w.minimized && { min: 1 as const }),
        ...(w.maximized && { max: 1 as const }),
        ...(w.snapped && { snap: w.snapped }),
      }
    })
}

/** Parse a `?windows=` value; anything malformed yields an empty layout. */
export function parseLayout(raw: string | null): SavedWindow[] {
  if (!raw) return []
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    const num = (n: unknown) => typeof n === "number" && Number.isFinite(n)
    return data.filter(
      (e): e is SavedWindow =>
        typeof e === "object" && e !== null && typeof e.id === "string" && num(e.x) && num(e.y) && num(e.w) && num(e.h) &&
        (e.snap === undefined || e.snap === "left" || e.snap === "right")
    )
  } catch {
    return []
  }
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
