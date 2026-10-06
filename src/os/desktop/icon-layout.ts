import type { IconCell } from "@/os/store/settings"

/** Size of one desktop icon cell, and the gap kept from the desktop edge. */
export const CELL = { width: 96, height: 100 }
export const EDGE = 12

export type IconSlot = { id: string; x: number; y: number; cell: IconCell }

type Bounds = { width: number; height: number }

const key = (c: IconCell) => `${c.side}:${c.col}:${c.row}`

export const gridRows = (bounds: Bounds) => Math.max(1, Math.floor((bounds.height - EDGE * 2) / CELL.height))
/** Columns per side: each side may use up to half the desktop. */
export const gridCols = (bounds: Bounds) => Math.max(1, Math.floor((bounds.width / 2 - EDGE) / CELL.width))

export function cellToPoint(cell: IconCell, bounds: Bounds) {
  const x = cell.side === "left" ? EDGE + cell.col * CELL.width : bounds.width - EDGE - (cell.col + 1) * CELL.width
  return { x, y: EDGE + cell.row * CELL.height }
}

/** The cell under a point on the desktop: the nearer edge decides the side. */
export function pointToCell(x: number, y: number, bounds: Bounds): IconCell {
  const side = x < bounds.width / 2 ? "left" : "right"
  const fromEdge = side === "left" ? x - EDGE : bounds.width - EDGE - x
  return {
    side,
    col: Math.min(gridCols(bounds) - 1, Math.max(0, Math.floor(fromEdge / CELL.width))),
    row: Math.min(gridRows(bounds) - 1, Math.max(0, Math.floor((y - EDGE) / CELL.height))),
  }
}

/**
 * Places every icon on an edge-anchored grid. Icons the visitor moved keep
 * their cell (clamped onto the screen); the rest fill their side's columns
 * top to bottom, wrapping inwards when a column is full. Anchoring to the
 * nearer edge keeps the layout sensible when the window is resized.
 */
export function layoutIcons(
  icons: { id: string; side: "left" | "right" }[],
  moved: Record<string, IconCell>,
  bounds: Bounds
): IconSlot[] {
  const rows = gridRows(bounds)
  const cols = gridCols(bounds)
  const taken = new Set<string>()
  const placed = new Map<string, IconCell>()

  const claim = (id: string, cell: IconCell) => {
    taken.add(key(cell))
    placed.set(id, cell)
  }

  const nextFree = (side: IconCell["side"], from = 0) => {
    for (let i = from; i < rows * cols; i++) {
      const cell = { side, col: Math.floor(i / rows), row: i % rows }
      if (!taken.has(key(cell))) return cell
    }
    return { side, col: cols - 1, row: rows - 1 }
  }

  // Moved icons first, so defaults flow around them.
  for (const icon of icons) {
    const want = moved[icon.id]
    if (!want) continue
    const cell = { side: want.side, col: Math.min(want.col, cols - 1), row: Math.min(want.row, rows - 1) }
    if (!taken.has(key(cell))) claim(icon.id, cell)
    else claim(icon.id, nextFree(cell.side, cell.col * rows + cell.row))
  }
  for (const icon of icons) {
    if (!placed.has(icon.id)) claim(icon.id, nextFree(icon.side))
  }

  return icons.map((icon) => {
    const cell = placed.get(icon.id)!
    return { id: icon.id, cell, ...cellToPoint(cell, bounds) }
  })
}

/** The icon to move to with an arrow key: nearest in that direction, favouring straight lines. */
export function neighbour(slots: IconSlot[], fromId: string, dir: "up" | "down" | "left" | "right") {
  const from = slots.find((s) => s.id === fromId)
  if (!from) return undefined
  let best: IconSlot | undefined
  let bestScore = Infinity
  for (const s of slots) {
    if (s.id === fromId) continue
    const dx = s.x - from.x
    const dy = s.y - from.y
    const ahead = dir === "up" ? -dy : dir === "down" ? dy : dir === "left" ? -dx : dx
    const across = dir === "up" || dir === "down" ? Math.abs(dx) : Math.abs(dy)
    if (ahead <= 0) continue
    const score = ahead + across * 3
    if (score < bestScore) {
      best = s
      bestScore = score
    }
  }
  return best
}
