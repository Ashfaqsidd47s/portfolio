import { describe, expect, it } from "vitest"
import { cellAt, cellRect, defaultLayout, gridFor, iconsInBox, moveIcons, neighbour, resolveLayout } from "./icon-grid"

const grid = { cols: 10, rows: 4 }
const cells = (layout: Record<string, { col: number; row: number }>) =>
  Object.values(layout).map((c) => `${c.col},${c.row}`)

describe("defaultLayout", () => {
  it("fills the left column down, then wraps inwards", () => {
    const layout = defaultLayout(["a", "b", "c", "d", "e"], [], grid)
    expect(layout.a).toEqual({ col: 0, row: 0 })
    expect(layout.d).toEqual({ col: 0, row: 3 })
    expect(layout.e).toEqual({ col: 1, row: 0 })
  })

  it("fills the right column from the right edge, wrapping inwards", () => {
    const layout = defaultLayout([], ["x", "y", "z", "w", "v"], grid)
    expect(layout.x).toEqual({ col: 9, row: 0 })
    expect(layout.v).toEqual({ col: 8, row: 0 })
  })

  it("never stacks icons, even on a tiny grid", () => {
    const layout = defaultLayout(["a", "b", "c"], ["x", "y"], { cols: 2, rows: 2 })
    expect(new Set(cells(layout)).size).toBe(Object.keys(layout).length)
  })
})

describe("resolveLayout", () => {
  const defaults = defaultLayout(["a", "b"], ["c"], grid)

  it("keeps valid saved cells and fills in the rest", () => {
    const layout = resolveLayout(["a", "b", "c"], { a: { col: 4, row: 2 } }, defaults, grid)
    expect(layout.a).toEqual({ col: 4, row: 2 })
    expect(layout.b).toEqual(defaults.b)
  })

  it("drops saved cells that are off the grid or collide", () => {
    const layout = resolveLayout(["a", "b", "c"], { a: { col: 40, row: 0 }, b: { col: 9, row: 0 } }, defaults, grid)
    expect(layout.a).toEqual(defaults.a)
    expect(new Set(cells(layout)).size).toBe(3)
  })
})

describe("moveIcons", () => {
  const layout = defaultLayout(["a", "b", "c"], [], grid)

  it("moves a group by a cell offset", () => {
    const next = moveIcons(layout, ["a", "b"], 3, 0, grid)
    expect(next.a).toEqual({ col: 3, row: 0 })
    expect(next.b).toEqual({ col: 3, row: 1 })
    expect(next.c).toEqual(layout.c)
  })

  it("sends an icon dropped on another one to the nearest free cell", () => {
    const next = moveIcons(layout, ["a"], 0, 1, grid)
    expect(next.b).toEqual(layout.b)
    expect(next.a).not.toEqual(layout.b)
    expect(new Set(cells(next)).size).toBe(3)
  })

  it("clamps to the grid", () => {
    expect(moveIcons(layout, ["a"], -5, -5, grid).a).toEqual({ col: 0, row: 0 })
  })
})

describe("neighbour", () => {
  const layout = { a: { col: 0, row: 0 }, b: { col: 0, row: 1 }, c: { col: 1, row: 0 }, far: { col: 9, row: 3 } }

  it("walks along rows and columns", () => {
    expect(neighbour(layout, "a", "down")).toBe("b")
    expect(neighbour(layout, "a", "right")).toBe("c")
    expect(neighbour(layout, "b", "up")).toBe("a")
    expect(neighbour(layout, "a", "up")).toBeUndefined()
  })
})

describe("geometry", () => {
  it("maps a cell's centre back to the same cell", () => {
    const size = { width: 1280, height: 800 }
    const g = gridFor(size)
    for (const cell of [{ col: 0, row: 0 }, { col: g.cols - 1, row: g.rows - 1 }, { col: 3, row: 2 }]) {
      const r = cellRect(cell, g, size.width)
      expect(cellAt(r.x + r.width / 2, r.y + r.height / 2, g, size.width)).toEqual(cell)
    }
  })

  it("finds icons inside a rubber-band box", () => {
    const layout = defaultLayout(["a", "b", "c"], ["z"], grid)
    const width = 1000
    const a = cellRect(layout.a, grid, width)
    const b = cellRect(layout.b, grid, width)
    const box = { x: a.x + 20, y: a.y + 20, width: 10, height: b.y + 20 - a.y }
    expect(iconsInBox(layout, box, grid, width).sort()).toEqual(["a", "b"])
  })
})
