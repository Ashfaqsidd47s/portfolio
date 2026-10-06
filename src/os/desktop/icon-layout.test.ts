import { describe, expect, it } from "vitest"
import { CELL, EDGE, layoutIcons, neighbour, pointToCell } from "./icon-layout"

const bounds = { width: 1200, height: 4 * CELL.height + EDGE * 2 } // 4 rows
const icons = [
  { id: "a", side: "left" as const },
  { id: "b", side: "left" as const },
  { id: "c", side: "right" as const },
]

describe("icon layout", () => {
  it("stacks each side's icons down its edge", () => {
    const [a, b, c] = layoutIcons(icons, {}, bounds)
    expect(a).toMatchObject({ x: EDGE, y: EDGE })
    expect(b).toMatchObject({ x: EDGE, y: EDGE + CELL.height })
    expect(c).toMatchObject({ x: bounds.width - EDGE - CELL.width, y: EDGE })
  })

  it("wraps into a new column when a column is full", () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ id: `i${i}`, side: "left" as const }))
    const slots = layoutIcons(many, {}, bounds)
    expect(slots[4].cell).toEqual({ side: "left", col: 1, row: 0 })
  })

  it("keeps a moved icon where it was dropped and flows the rest around it", () => {
    const slots = layoutIcons(icons, { b: { side: "left", col: 0, row: 0 } }, bounds)
    expect(slots.find((s) => s.id === "b")!.cell).toEqual({ side: "left", col: 0, row: 0 })
    expect(slots.find((s) => s.id === "a")!.cell).toEqual({ side: "left", col: 0, row: 1 })
  })

  it("clamps a moved icon back on screen when the desktop gets smaller", () => {
    const slots = layoutIcons(icons, { a: { side: "left", col: 0, row: 9 } }, bounds)
    expect(slots.find((s) => s.id === "a")!.cell.row).toBe(3)
  })

  it("maps a drop point to the cell under it, anchored to the nearer edge", () => {
    expect(pointToCell(EDGE + CELL.width + 5, EDGE + 5, bounds)).toEqual({ side: "left", col: 1, row: 0 })
    expect(pointToCell(bounds.width - EDGE - 5, EDGE + CELL.height * 2 + 5, bounds)).toEqual({
      side: "right",
      col: 0,
      row: 2,
    })
  })

  it("finds the neighbour in an arrow-key direction", () => {
    const slots = layoutIcons(icons, {}, bounds)
    expect(neighbour(slots, "a", "down")?.id).toBe("b")
    expect(neighbour(slots, "b", "up")?.id).toBe("a")
    expect(neighbour(slots, "a", "right")?.id).toBe("c")
    expect(neighbour(slots, "a", "up")).toBeUndefined()
  })
})
