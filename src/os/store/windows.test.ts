import { describe, expect, it } from "vitest"
import { CASCADE, createWindowsStore, parseLayout, selectFocusedId, serializeLayout, visibleWindowIds } from "./windows"

const BOUNDS = { width: 1200, height: 800 }
const opts = { size: { width: 600, height: 400 }, minSize: { width: 300, height: 200 } }

function setup(...ids: string[]) {
  const store = createWindowsStore(BOUNDS)
  for (const id of ids) store.getState().open(id, opts)
  return store
}

const zOf = (store: ReturnType<typeof setup>) =>
  Object.fromEntries(store.getState().windows.map((w) => [w.id, w.z]))

describe("windows store", () => {
  it("centres the first window and cascades the next", () => {
    const store = setup("a", "b")
    const [a, b] = store.getState().windows
    expect(a.rect).toEqual({ x: 300, y: 200, width: 600, height: 400 })
    expect(b.rect).toEqual({ x: 300 + CASCADE, y: 200 + CASCADE, width: 600, height: 400 })
  })

  it("wraps the cascade back to the corner instead of running off screen", () => {
    const store = createWindowsStore({ width: 700, height: 500 })
    store.getState().open("a", opts)
    store.getState().open("b", opts)
    store.getState().open("c", opts)
    const c = store.getState().windows[2]
    expect(c.rect.x + c.rect.width).toBeLessThanOrEqual(700)
    expect(c.rect.y + c.rect.height).toBeLessThanOrEqual(500)
  })

  it("keeps z-order dense and puts the focused window on top", () => {
    const store = setup("a", "b", "c")
    expect(zOf(store)).toEqual({ a: 1, b: 2, c: 3 })
    store.getState().focus("a")
    expect(zOf(store)).toEqual({ a: 3, b: 1, c: 2 })
    expect(selectFocusedId(store.getState())).toBe("a")
  })

  it("does not change state when focusing the window already on top", () => {
    const store = setup("a", "b")
    const before = store.getState().windows
    store.getState().focus("b")
    expect(store.getState().windows).toBe(before)
  })

  it("re-opening an open app focuses it instead of duplicating it", () => {
    const store = setup("a", "b")
    store.getState().open("a", opts)
    expect(store.getState().windows).toHaveLength(2)
    expect(selectFocusedId(store.getState())).toBe("a")
  })

  it("closing renumbers z and focuses the next window down", () => {
    const store = setup("a", "b", "c")
    store.getState().close("c")
    expect(zOf(store)).toEqual({ a: 1, b: 2 })
    expect(selectFocusedId(store.getState())).toBe("b")
  })

  it("skips minimised windows when picking the focused one", () => {
    const store = setup("a", "b")
    store.getState().minimize("b")
    expect(selectFocusedId(store.getState())).toBe("a")
    store.getState().open("b", opts)
    expect(store.getState().windows.find((w) => w.id === "b")?.minimized).toBe(false)
    expect(selectFocusedId(store.getState())).toBe("b")
  })

  it("maximise then restore returns the previous rect", () => {
    const store = setup("a")
    const before = store.getState().windows[0].rect
    store.getState().toggleMaximize("a")
    expect(store.getState().windows[0].maximized).toBe(true)
    store.getState().toggleMaximize("a")
    expect(store.getState().windows[0]).toMatchObject({ maximized: false, rect: before })
  })

  it("snaps to a half and restores the old size when dragged away", () => {
    const store = setup("a")
    store.getState().snap("a", "right")
    expect(store.getState().windows[0].rect).toEqual({ x: 600, y: 0, width: 600, height: 800 })
    store.getState().move("a", { x: 100, y: 100 })
    expect(store.getState().windows[0]).toMatchObject({
      snapped: false,
      rect: { x: 100, y: 100, width: 600, height: 400 },
    })
  })

  it("clamps resize to the window's minimum size", () => {
    const store = setup("a")
    store.getState().resize("a", { x: 10, y: 10, width: 50, height: 50 })
    expect(store.getState().windows[0].rect).toMatchObject({ width: 300, height: 200 })
  })

  it("keeps enough of a window on screen to grab it", () => {
    const store = setup("a")
    store.getState().move("a", { x: 5000, y: -300 })
    const { rect } = store.getState().windows[0]
    expect(rect.x).toBeLessThan(BOUNDS.width)
    expect(rect.y).toBe(0)
  })

  it("pulls windows back inside when the desktop shrinks", () => {
    const store = setup("a")
    store.getState().move("a", { x: 1000, y: 700 })
    store.getState().setBounds({ width: 800, height: 600 })
    const { rect } = store.getState().windows[0]
    expect(rect.x).toBeLessThan(800)
    expect(rect.y).toBeLessThan(600)
  })

  it("restore undoes maximise, then snap, then minimises", () => {
    const store = setup("a")
    const { maximize, restore, snap } = store.getState()
    const original = store.getState().windows[0].rect
    maximize("a")
    restore("a")
    expect(store.getState().windows[0]).toMatchObject({ maximized: false, rect: original })
    snap("a", "left")
    restore("a")
    expect(store.getState().windows[0]).toMatchObject({ snapped: false, rect: original })
    restore("a")
    expect(store.getState().windows[0].minimized).toBe(true)
  })

  it("detaching a maximised window keeps the grabbed spot under the pointer", () => {
    const store = setup("a")
    store.getState().maximize("a")
    // Grab the title bar three quarters of the way across the screen.
    const rect = store.getState().detach("a", { x: 900, y: 10 })!
    expect(rect.width).toBe(600)
    expect((900 - rect.x) / rect.width).toBeCloseTo(0.75, 1)
    expect(store.getState().windows[0].maximized).toBe(false)
  })

  it("cycle brings the bottom window to the front", () => {
    const store = setup("a", "b", "c")
    store.getState().cycle()
    expect(selectFocusedId(store.getState())).toBe("a")
    store.getState().cycle()
    expect(selectFocusedId(store.getState())).toBe("b")
  })

  it("round-trips a layout through percentages, on another screen size", () => {
    const store = setup("a", "b")
    store.getState().snap("b", "right")
    store.getState().focus("a")
    const saved = parseLayout(JSON.stringify(serializeLayout(store.getState().windows, BOUNDS)))
    const other = createWindowsStore({ width: 2400, height: 1600 })
    other.getState().restoreLayout(saved, () => opts.minSize)
    const [b, a] = other.getState().windows
    expect(a).toMatchObject({ id: "a", z: 2, rect: { x: 600, y: 400, width: 1200, height: 800 } })
    expect(b).toMatchObject({ id: "b", snapped: "right", rect: { x: 1200, y: 0, width: 1200, height: 1600 } })
    other.getState().restore("b")
    expect(other.getState().windows[0].rect.width).toBe(1200)
  })

  it("ignores unknown apps and malformed layouts", () => {
    expect(parseLayout("not json")).toEqual([])
    expect(parseLayout('[{"id":"a","x":"1"}]')).toEqual([])
    const store = createWindowsStore(BOUNDS)
    store.getState().restoreLayout([{ id: "nope", x: 0, y: 0, w: 50, h: 50 }], () => undefined)
    expect(store.getState().windows).toEqual([])
  })

  it("treats minimised and mostly covered windows as hidden", () => {
    const store = setup("a", "b", "c")
    const { move, maximize, minimize } = store.getState()
    move("a", { x: 0, y: 0 })
    move("b", { x: 600, y: 400 })
    expect(visibleWindowIds(store.getState().windows, BOUNDS)).toEqual(new Set(["a", "b", "c"]))
    maximize("c")
    expect(visibleWindowIds(store.getState().windows, BOUNDS)).toEqual(new Set(["c"]))
    minimize("c")
    expect(visibleWindowIds(store.getState().windows, BOUNDS)).toEqual(new Set(["a", "b"]))
  })
})
