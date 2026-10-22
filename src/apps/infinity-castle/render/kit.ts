import type * as THREE from "three"
import { LEVEL, ROOM_R, SPAN, STAIR_LANE, type EdgeStyle, type RoomKind, type Vec3 } from "../castle"
import { Builder, MAT, type Light, type LocalBox } from "./builder"

/**
 * The castle's building blocks, each one merged mesh plus its collision
 * boxes and lantern lights, all in the block's own frame.
 *
 * A room sits on a square platform; the floor is at y = 0 and its centre
 * at the origin. A veranda runs round the outside of the walls, with a
 * red rail broken by gates where passages land. A passage starts at the
 * edge of its lower room's platform (x = 0) and runs along +x.
 *
 * Moving parts (see `builder.ts`), per side d (0 +x, 1 +z, 2 −x, 3 −z):
 * door d + 1; rail gates 5 + 3d + lane (lane 0 at −STAIR_LANE along the
 * side, 1 in the middle, 2 at +STAIR_LANE); the trapdoor is 17.
 */

export const PART_COUNT = 18
export const MAX_LIGHTS = 10
export const doorPart = (side: number) => 1 + side
export const gatePart = (side: number, lane: number) => 5 + side * 3 + lane
export const TRAP_PART = 17

/** Wall plane: the tatami room is 2·WALL across. */
export const WALL = 4.6
const R = ROOM_R
const WALL_H = 3.4
const DOOR_W = 1.6
const DOOR_H = 2.9
const TRAP = 1.5
const STAIR_HALF = 1.1
const GATE_HALF = 1.25

export type Template = {
  geometry: THREE.BufferGeometry
  boxes: LocalBox[]
  lights: Light[]
}

const WARM: Vec3 = [1.0, 0.52, 0.22]
const PALE: Vec3 = [1.0, 0.78, 0.5]

/** A red paper chōchin hanging from a cord. */
function lantern(b: Builder, x: number, y: number, z: number, size = 1, cord = 0.5) {
  const r = 0.26 * size
  const h = 0.58 * size
  const profile: [number, number][] = []
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    profile.push([r * (0.62 + 0.38 * Math.sin(Math.PI * t)), h * t])
  }
  b.lathe([x, y - h, z], profile, 10, MAT.lantern)
  b.lathe([x, y - h - 0.05 * size, z], [[r * 0.6, 0], [r * 0.6, 0.06 * size]], 10, MAT.woodDark)
  b.lathe([x, y - 0.01, z], [[r * 0.6, 0], [r * 0.6, 0.06 * size]], 10, MAT.woodDark)
  if (cord > 0) b.box([x - 0.015, y, z - 0.015], [x + 0.015, y + cord, z + 0.015], MAT.woodDark)
}

// ── Rooms ────────────────────────────────────────────────────────────────

/** Platform, veranda and tatami; the trapdoor only in plain halls. */
function platform(b: Builder, opts: { trap: boolean; floor: number }) {
  const t = opts.trap ? TRAP : 0
  const deck = (x0: number, z0: number, x1: number, z1: number, top: number) => {
    if (x1 <= x0 || z1 <= z0) return
    b.box([x0, -0.7, z0], [x1, -0.1, z1], MAT.woodDark)
    b.box([x0, -0.1, z0], [x1, 0, z1], top)
  }
  if (t) {
    // Ring round the trapdoor; the floor's tatami stops at the walls.
    deck(-WALL, -WALL, WALL, -t, opts.floor)
    deck(-WALL, t, WALL, WALL, opts.floor)
    deck(-WALL, -t, -t, t, opts.floor)
    deck(t, -t, WALL, t, opts.floor)
    for (const s of [-1, 1]) {
      b.moving(TRAP_PART, [s * (t - 0.05), -0.72, 0], () => {
        const [x0, x1] = s < 0 ? [-t, 0] : [0, t]
        b.box([x0, -0.7, -t], [x1, -0.1, t], MAT.woodDark)
        b.box([x0, -0.1, -t], [x1, 0, t], opts.floor)
      })
    }
    b.solid([-R, -0.7, -R], [R, 0, -t])
    b.solid([-R, -0.7, t], [R, 0, R])
    b.solid([-R, -0.7, -t], [-t, 0, t])
    b.solid([t, -0.7, -t], [R, 0, t])
    b.solid([-t, -0.7, -t], [t, 0, t], TRAP_PART)
  } else {
    deck(-WALL, -WALL, WALL, WALL, opts.floor)
    b.solid([-R, -0.7, -R], [R, 0, R])
  }
  // Veranda boards between the wall and the rail.
  for (let d = 0; d < 4; d++) {
    b.frame(d, [0, 0, 0], () => {
      b.box([WALL, -0.7, -WALL], [R, -0.1, R], MAT.woodDark)
      b.box([WALL, -0.1, -WALL], [R, 0, R], MAT.woodLight, { grain: true })
    })
  }
  // Stilts and brackets underneath: rooms hang in the void.
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const px = x * (R - 0.6)
    const pz = z * (R - 0.6)
    b.box([px - 0.16, -3.2, pz - 0.16], [px + 0.16, -0.7, pz + 0.16], MAT.woodDark, { grain: true })
    lantern(b, px, -3.2, pz, 0.8, 0)
  }
  b.box([-R + 0.4, -1.25, -0.22], [R - 0.4, -0.7, 0.22], MAT.woodDark, { grain: true })
  b.box([-0.22, -1.25, -R + 0.4], [0.22, -0.7, R - 0.4], MAT.woodDark, { grain: true })
}

/** The rail along one side, with three gates that sink into the deck. */
function rail(b: Builder, side: number, mat: number = MAT.lacquer) {
  const x0 = R - 0.13
  const x1 = R - 0.01
  const run = (z0: number, z1: number, part: number) => {
    b.moving(part, [0, -1.08, 0], () => {
      b.box([x0, 0.86, z0], [x1, 0.98, z1], mat, { grain: true })
      b.box([x0 + 0.02, 0.42, z0], [x1 - 0.02, 0.5, z1], mat, { grain: true })
      for (const z of [z0, z1]) b.box([x0 - 0.01, 0, z - 0.06], [x1 + 0.01, 1.02, z + 0.06], mat, { grain: true })
    })
    b.solid([x0, 0, z0], [x1, 1.05, z1], part)
  }
  const lanes = [-STAIR_LANE, 0, STAIR_LANE]
  const halves = [GATE_HALF, DOOR_W, GATE_HALF]
  let z = -R
  lanes.forEach((c, lane) => {
    run(z, c - halves[lane], 0)
    run(c - halves[lane], c + halves[lane], gatePart(side, lane))
    z = c + halves[lane]
  })
  run(z, R, 0)
}

type Shell = { wall: number; transom: number; doors: number; lightColor: Vec3; inner: Vec3[] }

/** Walls of sliding doors, the ceiling and a hipped roof. */
function shell(b: Builder, s: Shell) {
  for (let d = 0; d < 4; d++) {
    b.frame(d, [0, 0, 0], () => {
      const x0 = WALL - 0.14
      // Fixed panels either side of the doorway, and the glowing transom.
      b.box([x0, 0, -WALL], [WALL, DOOR_H, -DOOR_W], s.wall)
      b.box([x0, 0, DOOR_W], [WALL, DOOR_H, WALL], s.wall)
      b.box([x0, DOOR_H + 0.16, -WALL], [WALL, WALL_H, WALL], s.transom)
      b.box([x0 - 0.06, DOOR_H, -WALL], [WALL + 0.06, DOOR_H + 0.16, WALL], MAT.woodDark, { grain: true })
      b.box([x0 - 0.06, 0, -WALL], [WALL + 0.06, 0.04, WALL], MAT.woodDark, { grain: true })
      b.solid([x0 - 0.06, 0, -WALL], [WALL + 0.06, WALL_H, -DOOR_W])
      b.solid([x0 - 0.06, 0, DOOR_W], [WALL + 0.06, WALL_H, WALL])
      b.solid([x0 - 0.06, DOOR_H, -DOOR_W], [WALL + 0.06, WALL_H, DOOR_W])
      // Two doors, sliding apart over the fixed panels.
      for (const sgn of [-1, 1]) {
        b.moving(doorPart(d), [0, 0, sgn * (DOOR_W - 0.12)], () => {
          const [z0, z1] = sgn < 0 ? [-DOOR_W, 0] : [0, DOOR_W]
          b.box([WALL + 0.005, 0.02, z0], [WALL + 0.07, DOOR_H, z1], s.doors)
        })
      }
      b.solid([x0, 0, -DOOR_W], [WALL + 0.07, DOOR_H, DOOR_W], doorPart(d))
      // Corner pillar and door posts.
      b.box([WALL - 0.24, -0.1, WALL - 0.24], [WALL + 0.1, WALL_H + 0.1, WALL + 0.1], MAT.woodDark, { grain: true })
      for (const z of [-DOOR_W - 0.12, DOOR_W]) {
        b.box([x0 - 0.04, 0, z], [WALL + 0.08, DOOR_H, z + 0.12], MAT.woodDark, { grain: true })
      }
      // A lantern over every door.
      lantern(b, WALL + 0.62, 3.1, 0, 1.15, 0.5)
      b.light([WALL + 0.9, 2.5, 0], WARM)
      rail(b, d)
    })
  }
  // Ceiling: coffered inside, a broad eave outside.
  const top = WALL_H + 0.25
  b.box([-WALL, WALL_H, -WALL], [WALL, top, WALL], MAT.woodDark)
  for (const c of [-2.3, 0, 2.3]) {
    b.box([-WALL, WALL_H - 0.16, c - 0.07], [WALL, WALL_H, c + 0.07], MAT.woodDark, { grain: true })
    b.box([c - 0.07, WALL_H - 0.16, -WALL], [c + 0.07, WALL_H, WALL], MAT.woodDark, { grain: true })
  }
  const E = WALL + 0.62
  b.box([-E, top, -E], [E, top + 0.2, E], MAT.woodDark)
  b.solid([-E, WALL_H, -E], [E, top + 0.2, E])
  roof(b, E + 0.1, top + 0.2, 1.1, 6.4)
  for (const p of s.inner) {
    lantern(b, p[0], p[1], p[2], 1, WALL_H - p[1])
    b.light([p[0], p[1] - 0.35, p[2]], s.lightColor)
  }
}

/** A hipped roof from an eave half-width `e` at `y0` up to a cap at `y1`. */
function roof(b: Builder, e: number, y0: number, cap: number, y1: number) {
  for (let d = 0; d < 4; d++) {
    b.frame(d, [0, 0, 0], () => {
      const slope = Math.hypot(e - cap, y1 - y0)
      b.quad([e, y0, e], [e, y0, -e], [cap, y1, -cap], [cap, y1, cap], MAT.roof, [
        [-e, 0],
        [e, 0],
        [cap, slope],
        [-cap, slope],
      ])
      // Upturned corner tip.
      b.box([e - 0.25, y0 - 0.05, e - 0.25], [e + 0.2, y0 + 0.18, e + 0.2], MAT.woodDark)
    })
  }
  b.box([-cap - 0.1, y1, -cap - 0.1], [cap + 0.1, y1 + 0.18, cap + 0.1], MAT.woodDark)
  b.box([-0.18, y1 + 0.18, -cap], [0.18, y1 + 0.42, cap], MAT.roof)
  // Something to stand on after a fall: the roof as four terraces.
  for (let i = 0; i < 4; i++) {
    const w = e - (i * (e - cap)) / 4
    const h = y0 + ((i + 0.6) * (y1 - y0)) / 4
    b.solid([-w, y0, -w], [w, h, w])
  }
}

const INNER: Vec3[] = [
  [-2.3, 2.6, -2.3],
  [2.3, 2.6, -2.3],
  [2.3, 2.6, 2.3],
  [-2.3, 2.6, 2.3],
]

export function buildRoom(kind: RoomKind): Template {
  const b = new Builder()
  switch (kind) {
    case "hall":
      platform(b, { trap: true, floor: MAT.tatami })
      shell(b, { wall: MAT.fusuma, transom: MAT.shoji, doors: MAT.fusuma, lightColor: WARM, inner: INNER })
      break
    case "akaza":
      akaza(b)
      break
    case "doma":
      platform(b, { trap: false, floor: MAT.ice })
      shell(b, { wall: MAT.frost, transom: MAT.shoji, doors: MAT.frost, lightColor: [0.55, 0.8, 1.0], inner: INNER })
      doma(b)
      break
    case "kokushibo":
      platform(b, { trap: false, floor: MAT.tatami })
      shell(b, { wall: MAT.moonWall, transom: MAT.moonWall, doors: MAT.moonWall, lightColor: [0.7, 0.45, 1.0], inner: INNER })
      kokushibo(b)
      break
    case "nakime":
      platform(b, { trap: false, floor: MAT.tatami })
      shell(b, { wall: MAT.fusuma, transom: MAT.shoji, doors: MAT.fusuma, lightColor: PALE, inner: INNER.slice(2) })
      nakime(b)
      break
  }
  return { geometry: b.geometry(), boxes: b.boxes, lights: b.lights.slice(0, MAX_LIGHTS) }
}

/**
 * Upper Three: an open-air ring with Akaza's compass-needle snowflake on
 * the boards, tall posts and a sacred rope sagging between them.
 */
function akaza(b: Builder) {
  b.box([-R, -0.7, -R], [R, -0.1, R], MAT.woodDark)
  b.box([-R, -0.1, -R], [R, 0, R], MAT.compass)
  b.solid([-R, -0.7, -R], [R, 0, R])
  const P = R - 0.45
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    b.box([x * P - 0.2, 0, z * P - 0.2], [x * P + 0.2, 6, z * P + 0.2], MAT.lacquer, { grain: true, solid: true })
    b.box([x * P - 0.26, 6, z * P - 0.26], [x * P + 0.26, 6.2, z * P + 0.26], MAT.gold)
    b.box([x * P - 0.16, -3.6, z * P - 0.16], [x * P + 0.16, -0.7, z * P + 0.16], MAT.woodDark, { grain: true })
  }
  for (let d = 0; d < 4; d++) {
    b.frame(d, [0, 0, 0], () => {
      // The rope sags in segments, with paper streamers.
      const n = 8
      for (let i = 0; i < n; i++) {
        const z0 = -P + (2 * P * i) / n
        const z1 = -P + (2 * P * (i + 1)) / n
        const sag = (z: number) => 5.6 - 0.7 * (1 - (z / P) ** 2)
        b.hexa(
          [
            [P - 0.09, sag(z0) - 0.09, z0],
            [P + 0.09, sag(z0) - 0.09, z0],
            [P + 0.09, sag(z1) - 0.09, z1],
            [P - 0.09, sag(z1) - 0.09, z1],
            [P - 0.09, sag(z0) + 0.09, z0],
            [P + 0.09, sag(z0) + 0.09, z0],
            [P + 0.09, sag(z1) + 0.09, z1],
            [P - 0.09, sag(z1) + 0.09, z1],
          ],
          MAT.rope
        )
        if (i % 2 === 1) b.box([P - 0.01, sag(z1) - 0.75, z1 - 0.07], [P + 0.01, sag(z1) - 0.05, z1 + 0.07], MAT.plaster)
      }
      lantern(b, P, 4.9, 0, 1.3, 0)
      b.light([P - 0.5, 4.2, 0], [1.0, 0.35, 0.3])
      rail(b, d, MAT.woodDark)
    })
  }
}

/** Upper Two: an icy hall with a lotus pond and frozen lotus thrusting up. */
function doma(b: Builder) {
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    const r = 1.2 + (i % 3) * 0.55
    lotus(b, Math.cos(a) * r, 0.03, Math.sin(a) * r, 0.7 + (i % 2) * 0.3)
  }
  lotus(b, 0, 0.03, 0, 1.4)
  for (const [x, z] of [
    [-3.4, -3.4],
    [3.4, -3.4],
    [3.4, 3.4],
    [-3.4, 3.4],
  ]) {
    // Frozen lotus: a cluster of ice spikes.
    for (let k = 0; k < 3; k++) {
      const h = 1.8 + k * 0.6
      const ox = x + (k - 1) * 0.25
      b.lathe([ox, 0, z], [[0.22, 0], [0.16, h * 0.6], [0, h]], 5, MAT.frost)
    }
    b.solid([x - 0.5, 0, z - 0.5], [x + 0.5, 2.6, z + 0.5])
  }
  b.light([0, 1.2, 0], [0.5, 0.75, 1.0])
}

function lotus(b: Builder, x: number, y: number, z: number, s: number) {
  b.lathe([x, y - 0.01, z], [[0.32 * s, 0], [0.34 * s, 0.02]], 10, MAT.ice, false)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const c = Math.cos(a)
    const n = Math.sin(a)
    const tip: Vec3 = [x + c * 0.26 * s, y + 0.26 * s, z + n * 0.26 * s]
    const base: Vec3 = [x + c * 0.05 * s, y, z + n * 0.05 * s]
    const side: Vec3 = [-n * 0.09 * s, 0, c * 0.09 * s]
    const mid: Vec3 = [x + c * 0.18 * s, y + 0.1 * s, z + n * 0.18 * s]
    b.quad(base, [mid[0] + side[0], mid[1], mid[2] + side[2]], tip, [mid[0] - side[0], mid[1], mid[2] - side[2]], MAT.lotus, [
      [0.5, 0],
      [1, 0.5],
      [0.5, 1],
      [0, 0.5],
    ])
    b.quad(base, [mid[0] - side[0], mid[1], mid[2] - side[2]], tip, [mid[0] + side[0], mid[1], mid[2] + side[2]], MAT.lotus, [
      [0.5, 0],
      [0, 0.5],
      [0.5, 1],
      [1, 0.5],
    ])
  }
}

/** Upper One: a hall of pillars under the eyes on the walls. */
function kokushibo(b: Builder) {
  for (const x of [-2, 2]) {
    for (const z of [-2, 2]) {
      b.box([x - 0.22, 0, z - 0.22], [x + 0.22, WALL_H, z + 0.22], MAT.woodDark, { grain: true, solid: true })
    }
  }
  // A pale moon hanging in the middle of the room.
  b.lathe([0, 1.75, 0], [[0, 0], [0.32, 0.08], [0.45, 0.3], [0.45, 0.6], [0.32, 0.82], [0, 0.9]], 14, MAT.moon)
  b.box([-0.015, 2.65, -0.015], [0.015, WALL_H, 0.015], MAT.woodDark)
  b.light([0, 2.2, 0], [0.75, 0.5, 1.0])
}

/**
 * Nakime's dais at the back of her chamber, and Nakime: kimono, the
 * curtain of black hair with one great eye showing, and her biwa.
 */
function nakime(b: Builder) {
  const z = -3.4
  b.box([-2.4, 0, -4.5], [2.4, 0.45, -2.2], MAT.woodDark, { solid: true })
  b.box([-2.4, 0.45, -4.5], [2.4, 0.5, -2.2], MAT.tatami)
  const y = 0.5
  b.lathe([0, y, z], [[0.85, 0], [0.8, 0.25], [0.55, 0.62], [0.36, 0.8]], 12, MAT.kimono)
  b.lathe([0, y + 0.8, z], [[0.36, 0], [0.33, 0.35], [0.2, 0.62]], 12, MAT.kimono)
  b.lathe([0, y + 1.42, z], [[0.08, 0], [0.18, 0.12], [0.2, 0.3], [0.15, 0.45], [0, 0.5]], 10, MAT.skin)
  // Hair: falls behind her to the floor, and over her face in front.
  b.box([-0.26, y + 0.2, z - 0.26], [0.26, y + 1.98, z - 0.08], MAT.hair)
  b.box([-0.23, y + 1.05, z + 0.12], [0.23, y + 1.95, z + 0.22], MAT.hair)
  b.box([-0.24, y + 1.85, z - 0.2], [0.24, y + 2.0, z + 0.2], MAT.hair)
  b.box([-0.12, y + 1.58, z + 0.221], [0.12, y + 1.72, z + 0.231], MAT.eye, { unit: true })
  // The biwa: a pear-shaped body held upright, neck bent back.
  b.frame(0, [0.32, y + 0.4, z + 0.42], () => {
    b.box([-0.26, 0, -0.05], [0.26, 0.55, 0.05], MAT.woodLight)
    b.box([-0.2, 0.55, -0.045], [0.2, 0.78, 0.045], MAT.woodLight)
    b.box([-0.05, 0.78, -0.04], [0.05, 1.35, 0.04], MAT.woodDark)
    b.box([-0.08, 1.35, -0.12], [0.08, 1.48, 0.04], MAT.woodDark)
    b.box([-0.02, 0.1, 0.05], [0.02, 1.35, 0.055], MAT.gold)
  })
  b.box([-0.05, y + 0.62, z + 0.38], [0.2, y + 0.66, z + 0.5], MAT.gold)
  b.solid([-1, 0.45, z - 0.9], [1, 2.6, z + 0.9])
  for (const x of [-1.9, 1.9]) {
    lantern(b, x, 2.9, -3.9, 1.5, 0.5)
    b.light([x, 2.2, -3.6], [1.0, 0.45, 0.2])
  }
  b.light([0, 2.4, -1.4], PALE)
}

// ── Passages ─────────────────────────────────────────────────────────────

export function buildEdge(style: EdgeStyle): Template {
  const b = new Builder()
  if (style === "stair") stair(b)
  else walkway(b, style === "corridor")
  return { geometry: b.geometry(), boxes: b.boxes, lights: b.lights.slice(0, MAX_LIGHTS) }
}

function walkway(b: Builder, enclosed: boolean) {
  const L = SPAN
  b.box([0, -0.25, -1.5], [L, 0, 1.5], MAT.woodLight, { grain: true, solid: true })
  for (const z of [-1.25, 1.25]) b.box([0, -0.6, z - 0.15], [L, -0.25, z + 0.15], MAT.woodDark, { grain: true })
  const posts = 6
  if (enclosed) {
    for (const s of [-1, 1]) {
      const [z0, z1] = s < 0 ? [-1.6, -1.46] : [1.46, 1.6]
      b.box([0, 0, z0], [L, 2.6, z1], MAT.shoji)
      b.solid([0, 0, z0], [L, 2.6, z1])
      for (let i = 0; i <= posts; i++) {
        const x = (i / posts) * L
        b.box([x - 0.08, 0, z0 - 0.04], [x + 0.08, 2.7, z1 + 0.04], MAT.woodDark, { grain: true })
      }
    }
    b.box([0, 2.6, -1.75], [L, 2.78, 1.75], MAT.woodDark)
    b.solid([0, 2.6, -1.9], [L, 3.5, 1.9])
    const uv: [number, number][] = [
      [0, 0],
      [L, 0],
      [L, 2],
      [0, 2],
    ]
    b.quad([0, 2.78, 1.95], [L, 2.78, 1.95], [L, 3.45, 0], [0, 3.45, 0], MAT.roof, uv)
    b.quad([L, 2.78, -1.95], [0, 2.78, -1.95], [0, 3.45, 0], [L, 3.45, 0], MAT.roof, uv)
    for (const x of [L / 3, (2 * L) / 3]) {
      lantern(b, x, 2.6, 0, 0.9, 0)
      b.light([x, 1.9, 0], WARM)
    }
  } else {
    for (const s of [-1, 1]) {
      const [z0, z1] = s < 0 ? [-1.52, -1.38] : [1.38, 1.52]
      b.box([0, 0.9, z0], [L, 1.02, z1], MAT.lacquer, { grain: true })
      b.box([0, 0.45, z0 + 0.02], [L, 0.52, z1 - 0.02], MAT.lacquer, { grain: true })
      b.solid([0, 0, z0], [L, 1.05, z1])
      for (let i = 0; i <= posts; i++) {
        const x = (i / posts) * L
        b.box([x - 0.07, 0, z0 - 0.01], [x + 0.07, 1.08, z1 + 0.01], MAT.lacquer, { grain: true })
      }
      // Lantern poles at the middle.
      const x = L / 2
      b.box([x - 0.06, 0, z0], [x + 0.06, 2.5, z1], MAT.woodDark, { grain: true })
      b.box([x - 0.05, 2.4, s * 0.9], [x + 0.05, 2.48, z1], MAT.woodDark)
      lantern(b, x, 2.4, s * 0.95, 0.9, 0.15)
      b.light([x, 1.8, s * 0.8], WARM)
    }
  }
}

/** A long stair climbing one level, in the right-hand lane. */
function stair(b: Builder) {
  const n = 24
  const rise = LEVEL / n
  const run = SPAN / n
  const zc = -STAIR_LANE
  const z0 = zc - STAIR_HALF
  const z1 = zc + STAIR_HALF
  for (let i = 0; i < n; i++) {
    const x = i * run
    const top = (i + 1) * rise
    b.box([x, top - 0.08, z0], [x + run + 0.03, top, z1], MAT.woodLight, { grain: true })
    b.box([x, top - rise, z0 + 0.05], [x + 0.05, top - 0.08, z1 - 0.05], MAT.woodDark)
    b.solid([x, top - 0.7, z0], [x + run, top, z1])
    // Rails: a solid strip per tread so nobody walks off the side.
    b.solid([x, top - 0.6, z0 - 0.12], [x + run, top + 1.0, z0])
    b.solid([x, top - 0.6, z1], [x + run, top + 1.0, z1 + 0.12])
  }
  // Stringers and handrails follow the slope.
  for (const z of [z0 - 0.06, z1 + 0.06]) {
    const t = 0.07
    sloped(b, z - t, z + t, -0.55, 0.05, MAT.woodDark)
    sloped(b, z - 0.05, z + 0.05, 0.95, 1.05, MAT.lacquer)
    for (let i = 0; i <= n; i += 4) {
      const x = Math.min(i * run, SPAN - 0.1)
      const y = (i + (i < n ? 1 : 0)) * rise
      b.box([x, y - 0.1, z - 0.05], [x + 0.1, y + 1.05, z + 0.05], MAT.lacquer, { grain: true })
    }
  }
  // A lantern on a pole halfway up.
  const mx = SPAN / 2
  const my = LEVEL / 2
  b.box([mx - 0.06, my - 0.2, z1 + 0.06], [mx + 0.06, my + 2.3, z1 + 0.18], MAT.woodDark, { grain: true })
  b.box([mx - 0.04, my + 2.2, zc + 0.5], [mx + 0.04, my + 2.28, z1 + 0.12], MAT.woodDark)
  lantern(b, mx, my + 2.2, zc + 0.5, 0.9, 0.15)
  b.light([mx, my + 1.6, zc + 0.3], WARM)
  b.light([SPAN * 0.1, 1.5, zc], [0.5, 0.26, 0.12])
  b.light([SPAN * 0.9, LEVEL + 1.0, zc], [0.5, 0.26, 0.12])
}

/** A beam running up the stair's slope, between heights y0 and y1 above the nosing line. */
function sloped(b: Builder, za: number, zb: number, y0: number, y1: number, mat: number) {
  const L = SPAN
  const H = LEVEL
  b.hexa(
    [
      [0, y0, zb],
      [L, H + y0, zb],
      [L, H + y0, za],
      [0, y0, za],
      [0, y1, zb],
      [L, H + y1, zb],
      [L, H + y1, za],
      [0, y1, za],
    ],
    mat
  )
}
