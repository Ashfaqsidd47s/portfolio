import * as THREE from "three"

/**
 * Writes flat-shaded, vertex-coloured triangles into plain arrays, so a whole
 * chunk of the town (houses, trees, lamps, buses) becomes one mesh.
 *
 * Shapes are placed in a local frame: an origin plus a yaw about +y in the
 * three.js sense, so local +x points along (cos θ, −sin θ) in world x/z and
 * local +z along (sin θ, cos θ). `box(x, y, z, …)` takes the centre of the
 * footprint and the height of the bottom.
 */

type Frame = { ox: number; oy: number; oz: number; ux: number; uz: number }

const linear = new Map<number, [number, number, number]>()
const tmp = new THREE.Color()

/** sRGB hex → linear RGB, cached. */
export function lin(hex: number): [number, number, number] {
  let c = linear.get(hex)
  if (!c) {
    tmp.setHex(hex)
    c = [tmp.r, tmp.g, tmp.b]
    linear.set(hex, c)
  }
  return c
}

export class Builder {
  readonly pos: number[] = []
  readonly nor: number[] = []
  readonly col: number[] = []
  readonly emi: number[] = []
  readonly swy: number[] = []
  readonly uv: number[] = []
  private f: Frame = { ox: 0, oy: 0, oz: 0, ux: 1, uz: 0 }
  private stack: Frame[] = []
  /** Light the next shapes give off at night (linear RGB), or null. */
  glow: [number, number, number] | null = null
  /** How much the next shapes move in the wind. */
  sway = 0
  /** Brightness wobble per shape, 0–1. */
  jitter = 0
  private rand: () => number
  private uvRect: [number, number, number, number] | null = null

  readonly withUv: boolean

  constructor(rand: () => number = Math.random, withUv = false) {
    this.rand = rand
    this.withUv = withUv
  }

  get count() {
    return this.pos.length / 3
  }

  /** Moves the frame by a local offset and turn, relative to the current one. */
  push(x: number, y: number, z: number, yaw = 0) {
    this.stack.push(this.f)
    const [wx, wz] = this.world2(x, z)
    const c = Math.cos(yaw)
    const s = -Math.sin(yaw)
    const f = this.f
    // Compose the turn: new u = rotate(old u) by yaw in the same sense.
    const ux = f.ux * c - f.uz * s
    const uz = f.uz * c + f.ux * s
    this.f = { ox: wx, oy: f.oy + y, oz: wz, ux, uz }
    return this
  }

  pop() {
    this.f = this.stack.pop() ?? { ox: 0, oy: 0, oz: 0, ux: 1, uz: 0 }
    return this
  }

  /** Runs `fn` in a frame moved by (x, y, z) and turned by `yaw`. */
  at(x: number, y: number, z: number, yaw: number, fn: () => void) {
    this.push(x, y, z, yaw)
    fn()
    this.pop()
  }

  private world2(x: number, z: number): [number, number] {
    const { ox, oz, ux, uz } = this.f
    // local x → u, local z → v = (−uz, ux)
    return [ox + x * ux - z * uz, oz + x * uz + z * ux]
  }

  private v(x: number, y: number, z: number): [number, number, number] {
    const [wx, wz] = this.world2(x, z)
    return [wx, this.f.oy + y, wz]
  }

  private colour(hex: number): [number, number, number] {
    const c = lin(hex)
    if (!this.jitter) return c
    const k = 1 + (this.rand() - 0.5) * this.jitter
    return [c[0] * k, c[1] * k, c[2] * k]
  }

  /** One triangle, world-space corners, normal from the winding. */
  private tri(a: number[], b: number[], c: number[], col: [number, number, number], uvs?: number[]) {
    const ex = b[0] - a[0], ey = b[1] - a[1], ez = b[2] - a[2]
    const fx = c[0] - a[0], fy = c[1] - a[1], fz = c[2] - a[2]
    let nx = ey * fz - ez * fy
    let ny = ez * fx - ex * fz
    let nz = ex * fy - ey * fx
    const l = Math.hypot(nx, ny, nz) || 1
    nx /= l
    ny /= l
    nz /= l
    const g = this.glow
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2])
      this.nor.push(nx, ny, nz)
      this.col.push(col[0], col[1], col[2])
      if (g) this.emi.push(g[0], g[1], g[2])
      else this.emi.push(0, 0, 0)
      this.swy.push(this.sway)
    }
    if (this.withUv) this.uv.push(...(uvs ?? [0, 0, 0, 0, 0, 0]))
  }

  /** A quad from four local corners, counter-clockwise seen from outside. */
  quadL(p: number[][], hex: number | [number, number, number]) {
    const c = typeof hex === "number" ? this.colour(hex) : hex
    const w = p.map((q) => this.v(q[0], q[1], q[2]))
    const r = this.uvRect
    if (r) {
      const [u0, v0, u1, v1] = r
      this.tri(w[0], w[1], w[2], c, [u0, v0, u1, v0, u1, v1])
      this.tri(w[0], w[2], w[3], c, [u0, v0, u1, v1, u0, v1])
    } else {
      this.tri(w[0], w[1], w[2], c)
      this.tri(w[0], w[2], w[3], c)
    }
  }

  triL(p: number[][], hex: number) {
    const c = this.colour(hex)
    const w = p.map((q) => this.v(q[0], q[1], q[2]))
    this.tri(w[0], w[1], w[2], c)
  }

  /** A box: footprint centred on (x, z), bottom at y, `w` along local x, `d` along local z. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, hex: number, opts: { bottom?: boolean; top?: number } = {}) {
    const c = this.colour(hex)
    const x0 = x - w / 2, x1 = x + w / 2
    const z0 = z - d / 2, z1 = z + d / 2
    const y0 = y, y1 = y + h
    const top = opts.top === undefined ? c : lin(opts.top)
    const q = (p: number[][], col: [number, number, number]) => {
      const w4 = p.map((v) => this.v(v[0], v[1], v[2]))
      this.tri(w4[0], w4[1], w4[2], col)
      this.tri(w4[0], w4[2], w4[3], col)
    }
    q([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], top) // top
    q([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], c) // +z
    q([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], c) // −z
    q([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], c) // +x
    q([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], c) // −x
    if (opts.bottom) q([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], c)
  }

  /** A gable roof over a w × d footprint, ridge along local x, `h` tall. */
  gable(x: number, y: number, z: number, w: number, h: number, d: number, hex: number, gableHex = hex) {
    const x0 = x - w / 2, x1 = x + w / 2
    const z0 = z - d / 2, z1 = z + d / 2
    const yr = y + h
    this.quadL([[x0, y, z1], [x1, y, z1], [x1, yr, z], [x0, yr, z]], hex)
    this.quadL([[x1, y, z0], [x0, y, z0], [x0, yr, z], [x1, yr, z]], hex)
    this.triL([[x1, y, z1], [x1, y, z0], [x1, yr, z]], gableHex)
    this.triL([[x0, y, z0], [x0, y, z1], [x0, yr, z]], gableHex)
  }

  /** A hipped roof or pyramid: four slopes up to a ridge `ridge` long (0: a point). */
  hip(x: number, y: number, z: number, w: number, h: number, d: number, hex: number, ridge = 0) {
    const x0 = x - w / 2, x1 = x + w / 2
    const z0 = z - d / 2, z1 = z + d / 2
    const yr = y + h
    const r0 = x - ridge / 2, r1 = x + ridge / 2
    this.quadL([[x0, y, z1], [x1, y, z1], [r1, yr, z], [r0, yr, z]], hex)
    this.quadL([[x1, y, z0], [x0, y, z0], [r0, yr, z], [r1, yr, z]], hex)
    this.triL([[x1, y, z1], [x1, y, z0], [r1, yr, z]], hex)
    this.triL([[x0, y, z0], [x0, y, z1], [r0, yr, z]], hex)
  }

  /** A pyramid hanging point-down: base at y, tip `h` below. */
  spike(x: number, y: number, z: number, w: number, h: number, d: number, hex: number) {
    const x0 = x - w / 2, x1 = x + w / 2
    const z0 = z - d / 2, z1 = z + d / 2
    const yt = y - h
    this.triL([[x0, y, z1], [x, yt, z], [x1, y, z1]], hex)
    this.triL([[x1, y, z0], [x, yt, z], [x0, y, z0]], hex)
    this.triL([[x1, y, z1], [x, yt, z], [x1, y, z0]], hex)
    this.triL([[x0, y, z0], [x, yt, z], [x0, y, z1]], hex)
  }

  /** A cylinder or cone frustum with a lid. */
  cyl(x: number, y: number, z: number, r0: number, r1: number, h: number, hex: number, segs = 8, lid = true) {
    const c = this.colour(hex)
    const ring = (r: number, yy: number) =>
      Array.from({ length: segs }, (_, i) => {
        const a = (i / segs) * Math.PI * 2 + Math.PI / segs
        return this.v(x + Math.cos(a) * r, yy, z + Math.sin(a) * r)
      })
    const lo = ring(r0, y)
    const hi = ring(r1, y + h)
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % segs
      this.tri(lo[i], hi[j], lo[j], c)
      if (r1 > 0.001) this.tri(lo[i], hi[i], hi[j], c)
    }
    if (lid && r1 > 0.001) {
      const top = this.v(x, y + h, z)
      for (let i = 0; i < segs; i++) this.tri(top, hi[(i + 1) % segs], hi[i], c)
    }
  }

  /** A faceted ball (a low-poly UV sphere), squashed by `sy`. */
  ball(x: number, y: number, z: number, r: number, hex: number, segs = 6, rings = 4, sy = 1) {
    const c = this.colour(hex)
    const pt = (i: number, j: number) => {
      const th = (j / rings) * Math.PI
      const ph = (i / segs) * Math.PI * 2
      return this.v(x + Math.sin(th) * Math.cos(ph) * r, y + Math.cos(th) * r * sy, z + Math.sin(th) * Math.sin(ph) * r)
    }
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < segs; i++) {
        const a = pt(i, j), b = pt(i + 1, j), d = pt(i, j + 1), e = pt(i + 1, j + 1)
        if (j > 0) this.tri(a, b, d, c)
        if (j < rings - 1) this.tri(b, e, d, c)
      }
    }
  }

  /** A sign face: a quad on local plane z = `z`, facing −z, textured from an atlas rect (u0, v0, u1, v1). */
  sign(x: number, y: number, z: number, w: number, h: number, rect: [number, number, number, number]) {
    this.uvRect = rect
    this.quadL([[x + w / 2, y, z], [x - w / 2, y, z], [x - w / 2, y + h, z], [x + w / 2, y + h, z]], [1, 1, 1])
    this.uvRect = null
  }

  geometry(): THREE.BufferGeometry | null {
    if (!this.pos.length) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3))
    g.setAttribute("emit", new THREE.Float32BufferAttribute(this.emi, 3))
    g.setAttribute("sway", new THREE.Float32BufferAttribute(this.swy, 1))
    if (this.withUv) g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2))
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}
