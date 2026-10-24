import type { Up } from "./physics"

/**
 * Quarter-turn orientations: the 24 ways to set a cube down. Nakime turns
 * whole rooms over, so a room's floor can face any of the six directions;
 * because every turn is a multiple of 90°, a turned room's collision boxes
 * stay axis-aligned and the physics doesn't change.
 *
 * A Mat3 is row-major and maps a room's own frame to the world: w = M·l.
 */

export type Vec3 = [number, number, number]
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number]

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]

const AXES: Vec3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
]

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** The orientation sending local x and y to the given world axes. */
export function fromAxes(x: Vec3, y: Vec3): Mat3 {
  const z = cross(x, y)
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]
}

/** All 24, upright ones first. */
export const ROTATIONS: readonly Mat3[] = (() => {
  const out: Mat3[] = []
  for (const y of AXES) for (const x of AXES) if (dot(x, y) === 0) out.push(fromAxes(x, y))
  return out.sort((a, b) => b[4] - a[4])
})()

/** Every orientation whose floor isn't the floor: upside down or on a side. */
export const TURNED: readonly Mat3[] = ROTATIONS.filter((m) => m[4] !== 1)

export function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ]
}

/** World to the room's own frame (the inverse of a rotation is its transpose). */
export function unapply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
    m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
    m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
  ]
}

/** Which way is up inside a room set down this way. */
export function upOf(m: Mat3): Up {
  const y: Vec3 = [m[1], m[4], m[7]]
  const axis = y.findIndex((c) => c !== 0) as 0 | 1 | 2
  return { axis, sign: y[axis] > 0 ? 1 : -1 }
}

/** A room's side d (0 +x, 1 +z, 2 −x, 3 −z) as a vector in its own frame. */
export const sideVector = (d: number): Vec3 => [[1, 0, -1, 0][d], 0, [0, 1, 0, -1][d]]

/** The side of a turned room that faces a world direction, or −1 (it faces up or down). */
export function sideFacing(m: Mat3, world: Vec3): number {
  for (let d = 0; d < 4; d++) {
    const v = apply(m, sideVector(d))
    if (v[0] === world[0] && v[1] === world[1] && v[2] === world[2]) return d
  }
  return -1
}

/** An axis-aligned box in a room's frame, turned into the world (still axis-aligned). */
export function orientBox(m: Mat3, min: Vec3, max: Vec3): { min: Vec3; max: Vec3 } {
  const a = apply(m, min)
  const b = apply(m, max)
  return {
    min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
    max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
  }
}

export const sameUp = (a: Up, b: Up) => a.axis === b.axis && a.sign === b.sign

/** a·b: turn by b, then by a. */
export function multiply(a: Mat3, b: Mat3): Mat3 {
  const out: number[] = []
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out.push(a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c])
  return out as unknown as Mat3
}
