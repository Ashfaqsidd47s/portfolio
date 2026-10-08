import { windowsStore } from "@/os/store/windows"
import {
  centre,
  cursor,
  doubleClickEvent,
  dragMove,
  dragRelease,
  glide,
  keyEvent,
  press,
  release,
  setFieldValue,
  type Point,
} from "./pointer"
import { sleep } from "./run"
import { autopilotStore } from "./store"

/**
 * What a tour can find: a `data-tour` id, or any CSS selector (anything
 * starting with `[`, `.` or `#`, or containing a space). Tours target
 * `data-tour` attributes, never styling classes, so restyling never breaks them.
 */
export type Target = string

export const toSelector = (t: Target) => (/^[[.#]|\s/.test(t) ? t : `[data-tour="${t}"]`)

/** Scope a target to one app's window. */
export const inWindow = (appId: string, t: Target) => `[data-window="${appId}"] ${toSelector(t)}`

const isShown = (el: Element) => {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 && !el.closest("[inert]") && getComputedStyle(el).visibility !== "hidden"
}

export type TourContext = ReturnType<typeof createContext>

/** The verbs tours are written in. Every one stops promptly when `signal` aborts. */
export function createContext(signal: AbortSignal) {
  const wait = (ms: number) => sleep(ms, signal)

  /** Wait (up to `timeout`) for the target to exist and be on screen. */
  async function find(target: Target, timeout = 6000): Promise<Element> {
    const selector = toSelector(target)
    const until = Date.now() + timeout
    for (;;) {
      const el = [...document.querySelectorAll(selector)].find(isShown)
      if (el) return el
      if (Date.now() > until) throw new Error(`Autopilot: nothing on screen matches ${selector}`)
      await wait(80)
    }
  }

  /** Scroll the target into view inside its window, then move the cursor onto it. */
  async function moveTo(target: Target): Promise<Element> {
    const el = await find(target)
    const before = el.getBoundingClientRect()
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })
    if (before.top < 0 || before.bottom > window.innerHeight || before.left < 0 || before.right > window.innerWidth) await wait(450)
    else await wait(16)
    await glide(centre(el), el.getBoundingClientRect().width, signal)
    return el
  }

  async function click(target: Target) {
    const el = await moveTo(target)
    await wait(90)
    const p = centre(el)
    press(el, p)
    await wait(90)
    release(el, p)
    await wait(220)
  }

  async function dblclick(target: Target) {
    const el = await moveTo(target)
    await wait(90)
    const p = centre(el)
    press(el, p)
    release(el, p, 1)
    await wait(70)
    press(el, p)
    release(el, p, 2)
    doubleClickEvent(el, p)
    await wait(250)
  }

  /** Type into a field at a human pace (~`wpm` words a minute). */
  async function type(target: Target, text: string, { wpm = 260, replace = false } = {}) {
    await click(target)
    const el = (await find(target)) as HTMLInputElement | HTMLTextAreaElement
    if (replace && el.value) {
      setFieldValue(el, "", null)
      await wait(150)
    }
    const perChar = 60_000 / (wpm * 5)
    for (const ch of text) {
      setFieldValue(el, el.value + ch, ch)
      await wait(perChar * (0.6 + Math.random() * 0.8))
    }
    await wait(250)
  }

  /** Press a key on whatever has focus, e.g. `press("ArrowRight", { shiftKey: true })`. */
  async function pressKey(key: string, init: KeyboardEventInit = {}) {
    keyEvent(key, init)
    await wait(300)
  }

  /**
   * Press on `from` and drag to `to` (a target or a viewport point). Real
   * pointer moves are sent all the way, so drop zones light up as they do
   * for a person. The pointer is always released, even when aborted.
   */
  async function drag(from: Target, to: Target | Point, { grab }: { grab?: Point } = {}) {
    const el = await moveTo(from)
    const start = grab ?? centre(el)
    if (grab) await glide(grab, 20, signal)
    await wait(120)
    press(el, start)
    let last = start
    try {
      await wait(120)
      const end = typeof to === "string" ? centre(await find(to)) : to
      await glide(end, typeof to === "string" ? 80 : 40, signal, (p) => {
        last = p
        dragMove(p)
      })
      last = end
      dragMove(end)
      await wait(180)
    } finally {
      dragRelease(last)
    }
    await wait(350)
  }

  async function scroll(target: Target, by: number) {
    const el = await moveTo(target)
    el.scrollBy({ top: by, behavior: "smooth" })
    await wait(700)
  }

  /** Show a caption by the cursor (also read out by screen readers). Waits `ms` if given. */
  async function say(text: string, ms = 0) {
    autopilotStore.setState({ caption: text })
    if (ms) await wait(ms)
  }

  /** Open an app the way a person does: double-click its desktop icon. */
  async function openApp(id: string) {
    if (windowsStore.getState().windows.some((w) => w.id === id)) {
      windowsStore.getState().close(id)
      await wait(300)
    }
    await dblclick(`[data-icon="${id}"] button`)
    await find(`[data-window="${id}"]`)
    // Let the window finish growing and the app's chunk load.
    await wait(700)
  }

  async function closeWindow(id: string) {
    await click(`[data-window="${id}"] [aria-label^="Close"]`)
    await wait(300)
  }

  /** Drag a window by its title bar to a point, e.g. onto a screen edge to snap it. */
  async function dragWindow(id: string, to: Point) {
    const header = await find(`[data-window="${id}"] > header`)
    const r = header.getBoundingClientRect()
    await drag(`[data-window="${id}"] > header`, to, { grab: { x: r.left + Math.min(160, r.width / 3), y: r.top + r.height / 2 } })
  }

  return {
    signal,
    wait,
    find,
    moveTo,
    click,
    dblclick,
    type,
    press: pressKey,
    drag,
    dragWindow,
    scroll,
    say,
    openApp,
    closeWindow,
    cursor,
  }
}
