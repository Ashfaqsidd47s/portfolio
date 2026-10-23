import type { Controls } from "./game"

/**
 * Desktop: WASD / arrows, Shift to run, Space to jump, F to provoke the
 * biwa, B / N / M to mute the biwa, the music or everything, the mouse to
 * look (pointer lock, or drag where lock isn't allowed).
 *
 * Touch: the left part of the screen is a floating joystick (push it far to
 * run), the right part drags the view, and a quick tap there jumps.
 */

const KEYS = {
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  run: ["ShiftLeft", "ShiftRight"],
  jump: ["Space"],
  strum: ["KeyF"],
  biwa: ["KeyB"],
  music: ["KeyN"],
  mute: ["KeyM"],
}

export type SoundKey = "biwa" | "music" | "mute"
const HANDLED = new Set(Object.values(KEYS).flat())

export type InputOptions = {
  controls: Controls
  /** The input is live: playing, focused, not paused. */
  active: () => boolean
  onStrum: () => void
  /** A sound toggle was pressed. */
  onSound?: (key: SoundKey) => void
  /** Joystick state, for drawing it. */
  onStick?: (stick: { x: number; y: number; dx: number; dy: number } | null) => void
  mouseSpeed?: number
}

export function bindKeyboard(opts: InputOptions) {
  const held = new Set<string>()
  const apply = () => {
    const has = (k: string[]) => k.some((c) => held.has(c))
    const x = (has(KEYS.right) ? 1 : 0) - (has(KEYS.left) ? 1 : 0)
    const y = (has(KEYS.forward) ? 1 : 0) - (has(KEYS.back) ? 1 : 0)
    opts.controls.move = [x, y]
    opts.controls.run = has(KEYS.run)
  }
  const down = (e: KeyboardEvent) => {
    if (!opts.active() || !HANDLED.has(e.code) || e.ctrlKey || e.metaKey || e.altKey) return
    // Claim the key before the desktop's own shortcuts (⇧W closes a window).
    e.preventDefault()
    e.stopPropagation()
    if (KEYS.jump.includes(e.code) && !e.repeat) opts.controls.jump = true
    if (KEYS.strum.includes(e.code) && !e.repeat) opts.onStrum()
    if (!e.repeat) for (const k of ["biwa", "music", "mute"] as const) if (KEYS[k].includes(e.code)) opts.onSound?.(k)
    held.add(e.code)
    apply()
  }
  const up = (e: KeyboardEvent) => {
    if (!held.has(e.code)) return
    held.delete(e.code)
    apply()
  }
  const clear = () => {
    held.clear()
    apply()
  }
  window.addEventListener("keydown", down, true)
  window.addEventListener("keyup", up, true)
  window.addEventListener("blur", clear)
  return () => {
    window.removeEventListener("keydown", down, true)
    window.removeEventListener("keyup", up, true)
    window.removeEventListener("blur", clear)
  }
}

/** Mouse look while the pointer is locked to the canvas. */
export function bindMouse(target: HTMLElement, opts: InputOptions) {
  const speed = opts.mouseSpeed ?? 0.0022
  let dragging = false
  const move = (e: MouseEvent) => {
    if (!opts.active()) return
    if (document.pointerLockElement === target || dragging) {
      opts.controls.look[0] += e.movementX * speed
      opts.controls.look[1] += e.movementY * speed
    }
  }
  // Fallback when lock is refused: hold the button and drag.
  const down = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && document.pointerLockElement !== target) dragging = true
  }
  const up = () => (dragging = false)
  document.addEventListener("mousemove", move)
  target.addEventListener("pointerdown", down)
  window.addEventListener("pointerup", up)
  return () => {
    document.removeEventListener("mousemove", move)
    target.removeEventListener("pointerdown", down)
    window.removeEventListener("pointerup", up)
  }
}

export function bindTouch(target: HTMLElement, opts: InputOptions) {
  let stick: { id: number; x: number; y: number } | null = null
  const looks = new Map<number, { x: number; y: number; t: number; moved: number }>()
  const RADIUS = 56

  const down = (e: PointerEvent) => {
    if (e.pointerType === "mouse" || !opts.active()) return
    const rect = target.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    target.setPointerCapture(e.pointerId)
    if (!stick && x < rect.width * 0.45) {
      stick = { id: e.pointerId, x, y }
      opts.onStick?.({ x, y, dx: 0, dy: 0 })
    } else {
      looks.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 })
    }
    e.preventDefault()
  }
  const move = (e: PointerEvent) => {
    if (stick && e.pointerId === stick.id) {
      const rect = target.getBoundingClientRect()
      let dx = e.clientX - rect.left - stick.x
      let dy = e.clientY - rect.top - stick.y
      const len = Math.hypot(dx, dy)
      if (len > RADIUS) {
        dx = (dx / len) * RADIUS
        dy = (dy / len) * RADIUS
      }
      opts.controls.move = [dx / RADIUS, -dy / RADIUS]
      opts.controls.run = len > RADIUS * 1.25
      opts.onStick?.({ x: stick.x, y: stick.y, dx, dy })
      return
    }
    const look = looks.get(e.pointerId)
    if (!look) return
    const dx = e.clientX - look.x
    const dy = e.clientY - look.y
    look.x = e.clientX
    look.y = e.clientY
    look.moved += Math.abs(dx) + Math.abs(dy)
    opts.controls.look[0] += dx * 0.0055
    opts.controls.look[1] += dy * 0.0055
  }
  const up = (e: PointerEvent) => {
    if (stick && e.pointerId === stick.id) {
      stick = null
      opts.controls.move = [0, 0]
      opts.controls.run = false
      opts.onStick?.(null)
      return
    }
    const look = looks.get(e.pointerId)
    if (!look) return
    looks.delete(e.pointerId)
    // A quick tap jumps.
    if (performance.now() - look.t < 220 && look.moved < 12) opts.controls.jump = true
  }
  target.addEventListener("pointerdown", down)
  target.addEventListener("pointermove", move)
  target.addEventListener("pointerup", up)
  target.addEventListener("pointercancel", up)
  return () => {
    target.removeEventListener("pointerdown", down)
    target.removeEventListener("pointermove", move)
    target.removeEventListener("pointerup", up)
    target.removeEventListener("pointercancel", up)
  }
}
