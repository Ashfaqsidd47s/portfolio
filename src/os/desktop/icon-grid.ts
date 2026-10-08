/**
 * Desktop icons sit on a snap-to grid, like a real desktop. Everything here is
 * plain maths on grid cells, so it can be tested without a DOM:
 * - the default layout (work on the left edge, the rest on the right edge,
 *   each column wrapping inwards when the screen is short),
 * - moving one or more icons without stacking them,
 * - finding the neighbour for arrow-key navigation,
 * - which icons a rubber-band box touches.
 */

export type Cell = { col: number; row: number }
export type Layout = Record<string, Cell>
export type Grid = { cols: number; rows: number }
export type Direction = "up" | "down" | "left" | "right"

export const CELL_W = 96
export const CELL_H = 104
export const PAD = 8

export function gridFor(size: { width: number; height: number }): Grid {
  return {
    cols: Math.max(1, Math.floor((size.width - PAD * 2) / CELL_W)),
    rows: Math.max(1, Math.floor((size.height - PAD * 2) / CELL_H)),
  }
}

/** Saved layouts are kept per grid size, so a small window doesn't scramble the big-screen arrangement. */
export const gridKey = (g: Grid) => `${g.cols}x${g.rows}`

export function cellRect(cell: Cell, grid: Grid, width: number) {
  // Spread the spare width evenly so the right column hugs the right edge.
  const step = grid.cols > 1 ? (width - PAD * 2 - CELL_W) / (grid.cols - 1) : 0
  return { x: Math.round(PAD + cell.col * step), y: PAD + cell.row * CELL_H, width: CELL_W, height: CELL_H }
}

/** The cell nearest to a point in desktop px, clamped to the grid. */
export function cellAt(x: number, y: number, grid: Grid, width: number): Cell {
  const step = grid.cols > 1 ? (width - PAD * 2 - CELL_W) / (grid.cols - 1) : 1
  return {
    col: clamp(Math.round((x - PAD - CELL_W / 2) / step), 0, grid.cols - 1),
    row: clamp(Math.floor((y - PAD) / CELL_H), 0, grid.rows - 1),
  }
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max)
const key = (c: Cell) => `${c.col},${c.row}`
const inGrid = (c: Cell, g: Grid) => c.col >= 0 && c.row >= 0 && c.col < g.cols && c.row < g.rows

/** Free cells ordered by distance from `from`, nearest first. */
function nearestFree(from: Cell, grid: Grid, taken: Set<string>): Cell | undefined {
  let best: Cell | undefined
  let bestD = Infinity
  for (let col = 0; col < grid.cols; col++) {
    for (let row = 0; row < grid.rows; row++) {
      const c = { col, row }
      if (taken.has(key(c))) continue
      const d = (col - from.col) ** 2 + (row - from.row) ** 2
      if (d < bestD) {
        best = c
        bestD = d
      }
    }
  }
  return best
}

/**
 * Default arrangement: `left` ids fill the first column top-down, then the
 * second; `right` ids fill the last column, then the one before it.
 */
export function defaultLayout(left: string[], right: string[], grid: Grid): Layout {
  const layout: Layout = {}
  const taken = new Set<string>()
  const place = (id: string, preferred: Cell) => {
    const cell = inGrid(preferred, grid) && !taken.has(key(preferred)) ? preferred : nearestFree(preferred, grid, taken)
    if (!cell) return
    layout[id] = cell
    taken.add(key(cell))
  }
  left.forEach((id, i) => place(id, { col: Math.floor(i / grid.rows), row: i % grid.rows }))
  right.forEach((id, i) => place(id, { col: grid.cols - 1 - Math.floor(i / grid.rows), row: i % grid.rows }))
  return layout
}

/**
 * The layout to show: saved cells where they're still valid, defaults for
 * everything else, never two icons in one cell.
 */
export function resolveLayout(ids: string[], saved: Layout | undefined, defaults: Layout, grid: Grid): Layout {
  const layout: Layout = {}
  const taken = new Set<string>()
  const pending: string[] = []
  for (const id of ids) {
    const cell = saved?.[id]
    if (cell && inGrid(cell, grid) && !taken.has(key(cell))) {
      layout[id] = cell
      taken.add(key(cell))
    } else pending.push(id)
  }
  for (const id of pending) {
    const want = defaults[id] ?? { col: 0, row: 0 }
    const cell = taken.has(key(want)) || !inGrid(want, grid) ? nearestFree(want, grid, taken) : want
    if (!cell) continue
    layout[id] = cell
    taken.add(key(cell))
  }
  return layout
}

/**
 * Shift `ids` by a whole number of cells. Moved icons that land on another
 * icon, or off the grid, go to the nearest free cell instead.
 */
export function moveIcons(layout: Layout, ids: string[], dCol: number, dRow: number, grid: Grid): Layout {
  const moving = new Set(ids.filter((id) => layout[id]))
  if (moving.size === 0 || (dCol === 0 && dRow === 0)) return layout
  const next: Layout = {}
  const taken = new Set<string>()
  for (const [id, cell] of Object.entries(layout)) {
    if (moving.has(id)) continue
    next[id] = cell
    taken.add(key(cell))
  }
  for (const id of moving) {
    const want = {
      col: clamp(layout[id].col + dCol, 0, grid.cols - 1),
      row: clamp(layout[id].row + dRow, 0, grid.rows - 1),
    }
    const cell = taken.has(key(want)) ? (nearestFree(want, grid, taken) ?? layout[id]) : want
    next[id] = cell
    taken.add(key(cell))
  }
  return next
}

/** The icon an arrow key should move to: the closest one in that direction, favouring the same row/column. */
export function neighbour(layout: Layout, from: string, dir: Direction): string | undefined {
  const origin = layout[from]
  if (!origin) return undefined
  let best: string | undefined
  let bestScore = Infinity
  for (const [id, c] of Object.entries(layout)) {
    if (id === from) continue
    const dc = c.col - origin.col
    const dr = c.row - origin.row
    const along = dir === "left" ? -dc : dir === "right" ? dc : dir === "up" ? -dr : dr
    const across = dir === "left" || dir === "right" ? Math.abs(dr) : Math.abs(dc)
    if (along <= 0) continue
    const score = along + across * 4
    if (score < bestScore) {
      best = id
      bestScore = score
    }
  }
  return best
}

/** Ids whose cell overlaps a box given in desktop px. */
export function iconsInBox(
  layout: Layout,
  box: { x: number; y: number; width: number; height: number },
  grid: Grid,
  width: number
): string[] {
  return Object.entries(layout)
    .filter(([, cell]) => {
      const r = cellRect(cell, grid, width)
      // Only the visible tile (inset from the cell) counts, so brushing a gap selects nothing.
      const x0 = r.x + 8
      const x1 = r.x + r.width - 8
      const y0 = r.y + 4
      const y1 = r.y + r.height - 8
      return box.x < x1 && box.x + box.width > x0 && box.y < y1 && box.y + box.height > y0
    })
    .map(([id]) => id)
}
