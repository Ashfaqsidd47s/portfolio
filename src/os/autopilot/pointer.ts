import { animate, motionValue } from "motion/react"
import { abortable, bezier, moveDuration } from "./run"

/**
 * The fake pointer: where it is (viewport px), whether it's pressed and
 * shown. The engine animates these directly; `cursor.tsx` draws them.
 */
export const cursor = {
  x: motionValue(-100),
  y: motionValue(-100),
  opacity: motionValue(0),
  pressed: motionValue(0),
}

type Ripple = { id: number; x: number; y: number }
const rippleListeners = new Set<(r: Ripple) => void>()
let rippleId = 0

export function onRipple(listener: (r: Ripple) => void) {
  rippleListeners.add(listener)
  return () => void rippleListeners.delete(listener)
}

function ripple(x: number, y: number) {
  const r = { id: rippleId++, x, y }
  for (const l of rippleListeners) l(r)
}

export type Point = { x: number; y: number }

export const centre = (el: Element): Point => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/**
 * Glide the cursor to `to` along a gently curved path, taking about as long
 * as a person would (Fitts's law). Stops as soon as `signal` aborts.
 */
export async function glide(to: Point, targetWidth: number, signal: AbortSignal, onStep?: (p: Point) => void) {
  const from = { x: cursor.x.get(), y: cursor.y.get() }
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.hypot(dx, dy)
  if (dist < 1) return
  // Bend the path sideways by up to a fifth of its length, either way.
  const bend = (Math.random() - 0.5) * 0.4 * dist
  const control = { x: from.x + dx / 2 - (dy / dist) * bend, y: from.y + dy / 2 + (dx / dist) * bend }
  const run = animate(0, 1, {
    duration: moveDuration(dist, targetWidth) / 1000,
    ease: [0.45, 0, 0.25, 1],
    onUpdate: (t) => {
      const p = bezier(from, control, to, t)
      cursor.x.set(p.x)
      cursor.y.set(p.y)
      onStep?.(p)
    },
  })
  try {
    await abortable(Promise.resolve(run), signal)
  } finally {
    run.stop()
  }
}

// ---- Real events ----------------------------------------------------------
// The tour clicks, types and drags through the same DOM events a person
// would, so it exercises the actual demo code. These events are untrusted
// (`isTrusted === false`), which is how hand-over tells them from the visitor.

/** Whatever is under the point, if it belongs to `within`; else `within` itself. */
function hit(p: Point, within?: Element): Element {
  const el = document.elementFromPoint(p.x, p.y)
  if (!within) return el ?? document.body
  return el && within.contains(el) ? el : within
}

function fire(el: Element, type: string, p: Point, init: MouseEventInit = {}) {
  const base: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: p.x,
    clientY: p.y,
    screenX: p.x,
    screenY: p.y,
    view: window,
    button: 0,
    ...init,
  }
  const event = type.startsWith("pointer")
    ? new PointerEvent(type, { ...base, pointerId: 1, pointerType: "mouse", isPrimary: true, width: 1, height: 1 })
    : new MouseEvent(type, base)
  el.dispatchEvent(event)
}

const FOCUSABLE = "button, a[href], input, textarea, select, [tabindex]"

export function press(el: Element, p: Point) {
  cursor.pressed.set(1)
  const target = hit(p, el)
  fire(target, "pointerdown", p, { buttons: 1 })
  fire(target, "mousedown", p, { buttons: 1 })
  target.closest<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true })
}

export function release(el: Element, p: Point, detail = 1) {
  cursor.pressed.set(0)
  const target = hit(p, el)
  fire(target, "pointerup", p, { buttons: 0 })
  fire(target, "mouseup", p, { buttons: 0, detail })
  fire(target, "click", p, { buttons: 0, detail })
  ripple(p.x, p.y)
}

export function doubleClickEvent(el: Element, p: Point) {
  fire(hit(p, el), "dblclick", p, { buttons: 0, detail: 2 })
}

/** A pointer move during a drag, sent to whatever is under the pointer (window listeners hear it too). */
export function dragMove(p: Point) {
  const target = hit(p)
  fire(target, "pointermove", p, { buttons: 1 })
  fire(target, "mousemove", p, { buttons: 1 })
}

/** End a drag wherever the pointer is. */
export function dragRelease(p: Point) {
  cursor.pressed.set(0)
  const target = hit(p)
  fire(target, "pointerup", p, { buttons: 0 })
  fire(target, "mouseup", p, { buttons: 0 })
}

/** Set a field's value the way typing does, so React's onChange sees it. */
export function setFieldValue(el: HTMLInputElement | HTMLTextAreaElement, value: string, data: string | null) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value)
  el.dispatchEvent(new InputEvent("input", { bubbles: true, data, inputType: data === null ? "deleteContentBackward" : "insertText" }))
}

export function keyEvent(key: string, init: KeyboardEventInit = {}) {
  const target = document.activeElement ?? document.body
  for (const type of ["keydown", "keyup"]) target.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true, ...init }))
}
