import * as THREE from "three"
import type { Vec3 } from "../castle"

/**
 * Builds one merged mesh out of boxes, quads and lathed shapes. Every
 * vertex carries a material id (the uber-shader picks wood, tatami, paper…
 * from it) and an optional moving part: a door panel, a rail gate or the
 * trapdoor slides by `slide × open[part]` in the vertex shader, so a whole
 * room is one draw call and its doors still move.
 *
 * Positions are in metres; UVs too, so patterns keep their real size.
 */

export const MAT = {
  woodDark: 0,
  woodLight: 1,
  tatami: 2,
  shoji: 3,
  fusuma: 4,
  roof: 5,
  lantern: 6,
  lacquer: 7,
  plaster: 8,
  compass: 9,
  ice: 10,
  lotus: 11,
  moonWall: 12,
  kimono: 13,
  hair: 14,
  eye: 15,
  gold: 16,
  rope: 17,
  skin: 18,
  frost: 19,
  moon: 20,
  sudare: 21,
  iron: 22,
} as const

export type LocalBox = { min: Vec3; max: Vec3; part: number }
export type Light = { pos: Vec3; color: Vec3 }

/** Quarter turns about +y: 0 keeps +x, 1 sends +x to +z, 2 to −x, 3 to −z. */
export function turn(q: number, x: number, z: number): [number, number] {
  switch (((q % 4) + 4) % 4) {
    case 1:
      return [-z, x]
    case 2:
      return [-x, -z]
    case 3:
      return [z, -x]
    default:
      return [x, z]
  }
}

export function turnBox(q: number, min: Vec3, max: Vec3): { min: Vec3; max: Vec3 } {
  const [ax, az] = turn(q, min[0], min[2])
  const [bx, bz] = turn(q, max[0], max[2])
  return {
    min: [Math.min(ax, bx), min[1], Math.min(az, bz)],
    max: [Math.max(ax, bx), max[1], Math.max(az, bz)],
  }
}

type FaceMats = { top?: number; bottom?: number }

export class Builder {
  private pos: number[] = []
  private nor: number[] = []
  private uv: number[] = []
  private mat: number[] = []
  private part: number[] = []
  private slide: number[] = []
  /** Collision boxes, in the same frame as the geometry. */
  readonly boxes: LocalBox[] = []
  readonly lights: Light[] = []

  private q = 0
  private offset: Vec3 = [0, 0, 0]
  private curPart = 0
  private curSlide: Vec3 = [0, 0, 0]

  /** Runs `fn` with everything turned `q` quarter turns and shifted. */
  frame(q: number, offset: Vec3, fn: () => void) {
    const prev = { q: this.q, offset: this.offset }
    this.q = q
    this.offset = offset
    fn()
    this.q = prev.q
    this.offset = prev.offset
  }

  /** Runs `fn` with its geometry belonging to a moving part. */
  moving(part: number, slide: Vec3, fn: () => void) {
    const prev = { part: this.curPart, slide: this.curSlide }
    this.curPart = part
    this.curSlide = slide
    fn()
    this.curPart = prev.part
    this.curSlide = prev.slide
  }

  private tx(p: Vec3): Vec3 {
    const [x, z] = turn(this.q, p[0], p[2])
    return [x + this.offset[0], p[1] + this.offset[1], z + this.offset[2]]
  }

  private tn(n: Vec3): Vec3 {
    const [x, z] = turn(this.q, n[0], n[2])
    return [x, n[1], z]
  }

  private vertex(p: Vec3, n: Vec3, u: number, v: number, mat: number) {
    const tp = this.tx(p)
    const tn = this.tn(n)
    const ts = this.tn(this.curSlide)
    this.pos.push(tp[0], tp[1], tp[2])
    this.nor.push(tn[0], tn[1], tn[2])
    this.uv.push(u, v)
    this.mat.push(mat)
    this.part.push(this.curPart)
    this.slide.push(ts[0], ts[1], ts[2])
  }

  /** A quad from four corners, counter-clockwise seen from the front. */
  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, mat: number, uvs?: [number, number][]) {
    const e1: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const e2: Vec3 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]
    const n = normalize(cross(e1, e2))
    const w = Math.hypot(...e1)
    const h = Math.hypot(...e2)
    const t = uvs ?? [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ]
    this.vertex(a, n, t[0][0], t[0][1], mat)
    this.vertex(b, n, t[1][0], t[1][1], mat)
    this.vertex(c, n, t[2][0], t[2][1], mat)
    this.vertex(a, n, t[0][0], t[0][1], mat)
    this.vertex(c, n, t[2][0], t[2][1], mat)
    this.vertex(d, n, t[3][0], t[3][1], mat)
  }

  /**
   * An axis-aligned box. UVs are local coordinates in metres: walls get
   * u along the wall and v up it; with `grain`, u runs along the box's
   * longest side instead, so wood grain follows the beam.
   */
  box(
    min: Vec3,
    max: Vec3,
    mat: number,
    opts: FaceMats & { grain?: boolean; solid?: boolean | number; unit?: boolean } = {}
  ) {
    const [x0, y0, z0] = min
    const [x1, y1, z1] = max
    const size = [x1 - x0, y1 - y0, z1 - z0]
    const uvOf = (p: Vec3, axisU: number, axisV: number): [number, number] => [p[axisU], p[axisV]]
    // Each face: normal, corners, and which axes map to u, v.
    const faces: [Vec3, Vec3[], number, number][] = [
      [[1, 0, 0], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], 2, 1],
      [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], 2, 1],
      [[0, 1, 0], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], 0, 2],
      [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], 0, 2],
      [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], 0, 1],
      [[0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], 0, 1],
    ]
    for (const [n, corners, au, av] of faces) {
      let u = au
      let v = av
      if (opts.grain && size[av] > size[au]) [u, v] = [av, au]
      const m = n[1] > 0 ? (opts.top ?? mat) : n[1] < 0 ? (opts.bottom ?? mat) : mat
      // `unit`: 0–1 across each face, for decals like an eye.
      const t = corners.map((c): [number, number] =>
        opts.unit ? [(c[u] - min[u]) / (size[u] || 1), (c[v] - min[v]) / (size[v] || 1)] : uvOf(c, u, v)
      )
      this.vertexQuad(corners, n, t, m)
    }
    if (opts.solid) this.solid(min, max, typeof opts.solid === "number" ? opts.solid : this.curPart)
  }

  private vertexQuad(c: Vec3[], n: Vec3, t: [number, number][], mat: number) {
    for (const i of [0, 1, 2, 0, 2, 3]) this.vertex(c[i], n, t[i][0], t[i][1], mat)
  }

  /** A collision box (turned and shifted like the geometry). */
  solid(min: Vec3, max: Vec3, part = 0) {
    const a = this.tx(min)
    const b = this.tx(max)
    this.boxes.push({
      min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
      max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
      part,
    })
  }

  light(pos: Vec3, color: Vec3) {
    this.lights.push({ pos: this.tx(pos), color })
  }

  /**
   * A surface of revolution about a vertical axis. `profile` is [radius,
   * height] from bottom to top. UVs: u around (0–1), v up the profile (0–1).
   */
  lathe(center: Vec3, profile: [number, number][], sides: number, mat: number, caps = true) {
    const ring = (r: number, y: number, i: number): Vec3 => {
      const a = (i / sides) * Math.PI * 2
      return [center[0] + Math.cos(a) * r, center[1] + y, center[2] + Math.sin(a) * r]
    }
    const last = profile.length - 1
    for (let k = 0; k < last; k++) {
      const [r0, y0] = profile[k]
      const [r1, y1] = profile[k + 1]
      const slope = Math.atan2(r0 - r1, y1 - y0)
      for (let i = 0; i < sides; i++) {
        const a0 = (i / sides) * Math.PI * 2
        const a1 = ((i + 1) / sides) * Math.PI * 2
        const n0: Vec3 = [Math.cos(a0) * Math.cos(slope), Math.sin(slope), Math.sin(a0) * Math.cos(slope)]
        const n1: Vec3 = [Math.cos(a1) * Math.cos(slope), Math.sin(slope), Math.sin(a1) * Math.cos(slope)]
        const p00 = ring(r0, y0, i)
        const p10 = ring(r0, y0, i + 1)
        const p11 = ring(r1, y1, i + 1)
        const p01 = ring(r1, y1, i)
        const u0 = i / sides
        const u1 = (i + 1) / sides
        const v0 = k / last
        const v1 = (k + 1) / last
        this.vertex(p00, n0, u0, v0, mat)
        this.vertex(p01, n0, u0, v1, mat)
        this.vertex(p11, n1, u1, v1, mat)
        this.vertex(p00, n0, u0, v0, mat)
        this.vertex(p11, n1, u1, v1, mat)
        this.vertex(p10, n1, u1, v0, mat)
      }
    }
    if (!caps) return
    for (const [k, n] of [
      [0, -1],
      [last, 1],
    ] as const) {
      const [r, y] = profile[k]
      if (r <= 0) continue
      const c: Vec3 = [center[0], center[1] + y, center[2]]
      for (let i = 0; i < sides; i++) {
        const a = ring(r, y, i)
        const b = ring(r, y, i + 1)
        const v = k / last
        if (n > 0) {
          this.vertex(c, [0, 1, 0], 0.5, v, mat)
          this.vertex(b, [0, 1, 0], 0.5, v, mat)
          this.vertex(a, [0, 1, 0], 0.5, v, mat)
        } else {
          this.vertex(c, [0, -1, 0], 0.5, v, mat)
          this.vertex(a, [0, -1, 0], 0.5, v, mat)
          this.vertex(b, [0, -1, 0], 0.5, v, mat)
        }
      }
    }
  }

  /**
   * A six-sided solid from eight corners: bottom face a b c d, top face
   * e f g h above them in the same order. Faces are turned to face out.
   */
  hexa(c: [Vec3, Vec3, Vec3, Vec3, Vec3, Vec3, Vec3, Vec3], mat: number) {
    const mid = c.reduce<Vec3>((m, p) => [m[0] + p[0] / 8, m[1] + p[1] / 8, m[2] + p[2] / 8], [0, 0, 0])
    const [a, b, cc, d, e, f, g, h] = c
    const faces: [Vec3, Vec3, Vec3, Vec3][] = [
      [a, b, cc, d],
      [e, f, g, h],
      [a, b, f, e],
      [b, cc, g, f],
      [cc, d, h, g],
      [d, a, e, h],
    ]
    for (const [p, q, r, s] of faces) {
      const n = cross([q[0] - p[0], q[1] - p[1], q[2] - p[2]], [s[0] - p[0], s[1] - p[1], s[2] - p[2]])
      const centre: Vec3 = [(p[0] + r[0]) / 2 - mid[0], (p[1] + r[1]) / 2 - mid[1], (p[2] + r[2]) / 2 - mid[2]]
      if (n[0] * centre[0] + n[1] * centre[1] + n[2] * centre[2] >= 0) this.quad(p, q, r, s, mat)
      else this.quad(p, s, r, q, mat)
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2))
    g.setAttribute("aMat", new THREE.Float32BufferAttribute(this.mat, 1))
    g.setAttribute("aPart", new THREE.Float32BufferAttribute(this.part, 1))
    g.setAttribute("aSlide", new THREE.Float32BufferAttribute(this.slide, 3))
    g.computeBoundingSphere()
    g.computeBoundingBox()
    return g
  }
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(...v) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
