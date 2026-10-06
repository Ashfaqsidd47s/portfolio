import { describe, expect, it } from "vitest"
import { CASCADE, createWindowsStore, selectFocusedId } from "./windows"

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
})
