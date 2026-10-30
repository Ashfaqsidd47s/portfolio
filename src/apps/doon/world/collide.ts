import { BOUNDS, inside, type Polygon, type Vec2 } from "../geo"

/**
 * What you can't walk through: turned boxes (buildings, walls, buses),
 * circles (trees, poles) and polygons (the lake). Shapes sit in a 16 m grid
 * so a step only tests what's near it.
 */

export type Box = { kind: "box"; x: number; z: number; hx: number; hz: number; ux: number; uz: number }
export type Circle = { kind: "circle"; x: number; z: number; r: number }
export type Shape = Box | Circle

const CELL = 16

/** A box centred on (x, z), `w` along direction (ux, uz) and `d` across it. */
export const box = (x: number, z: number, w: number, d: number, ux = 1, uz = 0): Box => {
  const l = Math.hypot(ux, uz) || 1
  return { kind: "box", x, z, hx: w / 2, hz: d / 2, ux: ux / l, uz: uz / l }
}

/** Same, from a yaw (three.js convention: local +x → (cos θ, −sin θ)). */
export const boxYaw = (x: number, z: number, w: number, d: number, yaw: number): Box =>
  box(x, z, w, d, Math.cos(yaw), -Math.sin(yaw))

export const circle = (x: number, z: number, r: number): Circle => ({ kind: "circle", x, z, r })

export class Collision {
  private grid = new Map<number, Shape[]>()
  private polys: Polygon[] = []
  /** Moving shapes (vehicles), tested every step. */
  dynamic: Shape[] = []

  private key(cx: number, cz: number) {
    return (cx + 512) * 4096 + (cz + 512)
  }

  add(s: Shape) {
    const r = s.kind === "circle" ? s.r : Math.hypot(s.hx, s.hz)
    const x0 = Math.floor((s.x - r) / CELL), x1 = Math.floor((s.x + r) / CELL)
    const z0 = Math.floor((s.z - r) / CELL), z1 = Math.floor((s.z + r) / CELL)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = this.key(cx, cz)
        let list = this.grid.get(k)
        if (!list) this.grid.set(k, (list = []))
        list.push(s)
      }
    }
  }

  addPolygon(p: Polygon) {
    this.polys.push(p)
  }

  /** Shapes in every cell within `r` of a point, each once. */
  query(x: number, z: number, r: number): Shape[] {
    const out = new Set<Shape>()
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
      for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
        for (const s of this.grid.get(this.key(cx, cz)) ?? []) out.add(s)
      }
    }
    return [...out]
  }

  /** Does a box overlap any box or circle already added? */
  hits(b: Box) {
    for (const s of this.query(b.x, b.z, Math.hypot(b.hx, b.hz))) {
      if (s.kind === "box" ? boxesOverlap(s, b) : overlap(b, s.x, s.z, s.r)) return true
    }
    return false
  }

  /** Shapes near a point. */
  near(x: number, z: number): Shape[] {
    return this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? []
  }

  /** Is a circle of radius `r` at (x, z) clear of everything? */
  free(x: number, z: number, r: number) {
    if (x < BOUNDS.minX + r || x > BOUNDS.maxX - r || z < BOUNDS.minZ + r || z > BOUNDS.maxZ - r) return false
    for (const s of this.near(x, z)) if (overlap(s, x, z, r)) return false
    for (const s of this.dynamic) if (overlap(s, x, z, r)) return false
    return !this.inPolygon(x, z, r)
  }

  private inPolygon(x: number, z: number, r: number) {
    for (const p of this.polys) {
      if (inside(p, [x, z]) || inside(p, [x + r, z]) || inside(p, [x - r, z]) || inside(p, [x, z + r]) || inside(p, [x, z - r])) {
        return true
      }
    }
    return false
  }

  /**
   * Moves a circle from `from` by `step`, sliding along whatever it meets.
   * Boxes and circles push it out; polygons and the world's edge stop the
   * blocked axis.
   */
  move(from: Vec2, step: Vec2, r: number): Vec2 {
    let x = from[0]
    let z = from[1]
    // Axis by axis, so walls slide.
    if (this.free(x + step[0], z, r)) x += step[0]
    else x = this.pushOut(x + step[0], z, r, from)[0]
    if (this.free(x, z + step[1], r)) z += step[1]
    else z = this.pushOut(x, z + step[1], r, [x, from[1]])[1]
    if (!this.free(x, z, r)) {
      const [px, pz] = this.pushOut(x, z, r, from)
      if (this.free(px, pz, r)) return [px, pz]
      return this.free(from[0], from[1], r) ? from : [x, z]
    }
    return [x, z]
  }

  /** Nudges a circle out of the boxes and circles it overlaps; falls back to `fallback`. */
  private pushOut(x: number, z: number, r: number, fallback: Vec2): Vec2 {
    for (let i = 0; i < 3; i++) {
      let moved = false
      for (const s of [...this.near(x, z), ...this.dynamic]) {
        const p = separate(s, x, z, r)
        if (p) {
          x = p[0]
          z = p[1]
          moved = true
        }
      }
      if (!moved) break
    }
    if (this.inPolygon(x, z, r) || x < BOUNDS.minX + r || x > BOUNDS.maxX - r || z < BOUNDS.minZ + r || z > BOUNDS.maxZ - r) {
      return fallback
    }
    return [x, z]
  }
}

function overlap(s: Shape, x: number, z: number, r: number) {
  if (s.kind === "circle") return Math.hypot(x - s.x, z - s.z) < s.r + r
  const dx = x - s.x
  const dz = z - s.z
  const lx = dx * s.ux + dz * s.uz
  const lz = -dx * s.uz + dz * s.ux
  const cx = Math.max(-s.hx, Math.min(s.hx, lx))
  const cz = Math.max(-s.hz, Math.min(s.hz, lz))
  return Math.hypot(lx - cx, lz - cz) < r
}

/** Where a circle overlapping `s` should go to just touch it, or null. */
function separate(s: Shape, x: number, z: number, r: number): Vec2 | null {
  if (s.kind === "circle") {
    const dx = x - s.x
    const dz = z - s.z
    const d = Math.hypot(dx, dz)
    if (d >= s.r + r) return null
    const k = d > 1e-6 ? (s.r + r) / d : 0
    return d > 1e-6 ? [s.x + dx * k, s.z + dz * k] : [s.x + s.r + r, s.z]
  }
  const dx = x - s.x
  const dz = z - s.z
  // Local axes: u = (ux, uz), v = (−uz, ux).
  const lx = dx * s.ux + dz * s.uz
  const lz = -dx * s.uz + dz * s.ux
  const cx = Math.max(-s.hx, Math.min(s.hx, lx))
  const cz = Math.max(-s.hz, Math.min(s.hz, lz))
  const ox = lx - cx
  const oz = lz - cz
  const d = Math.hypot(ox, oz)
  if (d >= r) return null
  let nx: number, nz: number
  if (d > 1e-6) {
    nx = cx + (ox / d) * r
    nz = cz + (oz / d) * r
  } else {
    // Centre inside the box: leave by the nearest side.
    const px = s.hx - Math.abs(lx)
    const pz = s.hz - Math.abs(lz)
    if (px < pz) {
      nx = Math.sign(lx || 1) * (s.hx + r)
      nz = lz
    } else {
      nx = lx
      nz = Math.sign(lz || 1) * (s.hz + r)
    }
  }
  return [s.x + nx * s.ux - nz * s.uz, s.z + nx * s.uz + nz * s.ux]
}

/** Separating-axis test for two turned boxes. */
export function boxesOverlap(a: Box, b: Box) {
  const axes: [number, number][] = [[a.ux, a.uz], [-a.uz, a.ux], [b.ux, b.uz], [-b.uz, b.ux]]
  const dx = b.x - a.x
  const dz = b.z - a.z
  for (const [ax, az] of axes) {
    const ra = a.hx * Math.abs(a.ux * ax + a.uz * az) + a.hz * Math.abs(-a.uz * ax + a.ux * az)
    const rb = b.hx * Math.abs(b.ux * ax + b.uz * az) + b.hz * Math.abs(-b.uz * ax + b.ux * az)
    if (Math.abs(dx * ax + dz * az) > ra + rb) return false
  }
  return true
}
