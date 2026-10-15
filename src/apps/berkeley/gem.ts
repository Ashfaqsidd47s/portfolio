/**
 * A faceted gem as a small convex polyhedron, drawn on a 2D canvas.
 *
 * The model is built from a side profile: a stack of rings (table, crown,
 * girdle, pavilion) down to a culet point. Rings that sit half a step round
 * from their neighbours give the triangular star and half facets of a
 * brilliant; rings that line up give the stepped facets of an emerald cut.
 * The gem is convex, so culling back faces is all the hidden-surface work
 * it needs: no depth sort.
 *
 * Shading has no textures or WebGL. Each facet's reflection vector looks up
 * a made-up studio (a softbox overhead, strip lights at the sides, a busy
 * pattern for everything else), so facets flash light and dark as the gem
 * turns. Very bright facets pick up a hue from the same vector, which reads
 * as fire.
 *
 * Model space: x right, y down (like the screen), z towards the viewer.
 */

export type Vec3 = [number, number, number]

export type Cut = "round" | "oval" | "pear" | "marquise" | "emerald"

export type Facet = {
  pts: Vec3[]
  /** Outward unit normal. */
  n: Vec3
  /** 0 for the table, rising down the stone. Used to unfold it top-down. */
  ring: number
  /** On the pavilion (below the girdle): lit by internal reflection. */
  lower: boolean
}

export type Gem = { cut: Cut; facets: Facet[]; rings: number }

/** Body colour of a stone: hue and saturation, plus how much fire it shows. */
export type Tint = { h: number; s: number; fire: number }

export const TINTS = {
  white: { h: 214, s: 16, fire: 0.55 },
  pink: { h: 334, s: 58, fire: 0.3 },
  canary: { h: 46, s: 82, fire: 0.3 },
  blue: { h: 206, s: 72, fire: 0.3 },
  champagne: { h: 32, s: 46, fire: 0.35 },
  green: { h: 152, s: 52, fire: 0.3 },
} satisfies Record<string, Tint>

type Ring = { r: number; y: number; half: boolean }

const BRILLIANT: Ring[] = [
  { r: 0.56, y: -0.4, half: false }, // table edge
  { r: 0.82, y: -0.29, half: true }, // star tips
  { r: 1, y: -0.17, half: false }, // girdle, top
  { r: 1, y: -0.13, half: false }, // girdle, bottom
  { r: 0.56, y: 0.22, half: true }, // lower half facets
]
const BRILLIANT_CULET = 0.62

const STEP: Ring[] = [
  { r: 0.62, y: -0.36, half: false },
  { r: 0.79, y: -0.3, half: false },
  { r: 0.92, y: -0.22, half: false },
  { r: 1, y: -0.16, half: false },
  { r: 1, y: -0.12, half: false },
  { r: 0.74, y: 0.06, half: false },
  { r: 0.49, y: 0.22, half: false },
  { r: 0.24, y: 0.36, half: false },
]
const STEP_CULET = 0.46

/** The emerald cut's outline: a rectangle with its corners clipped. */
const OCTAGON: [number, number][] = (() => {
  const w = 1
  const d = 0.7
  const c = 0.22
  return [
    [w, -d + c],
    [w, d - c],
    [w - c, d],
    [-w + c, d],
    [-w, d - c],
    [-w, -d + c],
    [-w + c, -d],
    [w - c, -d],
  ]
})()

/** Outline of a cut seen from above, at angle `a`: [x, z] on a unit-ish shape. */
function section(cut: Cut, a: number): [number, number] {
  const c = Math.cos(a)
  const s = Math.sin(a)
  switch (cut) {
    case "oval":
      return [c, 0.72 * s]
    case "marquise":
      // |z| ∝ sin² meets the long axis at an angle: a point, not a curve.
      return [c, 0.56 * s * Math.abs(s)]
    case "pear":
      return c > 0 ? [c, 0.64 * s * Math.abs(s)] : [0.82 * c, 0.64 * s]
    default:
      return [c, s]
  }
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Newell's method: a polygon's normal, robust to slightly non-planar quads. */
function polygonNormal(pts: Vec3[]): Vec3 {
  let x = 0
  let y = 0
  let z = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    x += (p[1] - q[1]) * (p[2] + q[2])
    y += (p[2] - q[2]) * (p[0] + q[0])
    z += (p[0] - q[0]) * (p[1] + q[1])
  }
  const len = Math.hypot(x, y, z) || 1
  return [x / len, y / len, z / len]
}

export function centroid(pts: Vec3[]): Vec3 {
  let x = 0
  let y = 0
  let z = 0
  for (const p of pts) {
    x += p[0]
    y += p[1]
    z += p[2]
  }
  return [x / pts.length, y / pts.length, z / pts.length]
}

/**
 * Builds a gem. `detail` is the number of facets round the girdle for the
 * curved cuts (even; 16 for a hero stone, 12 for small ones). The emerald
 * cut always has eight sides.
 */
export function buildGem(cut: Cut, detail = 16): Gem {
  const step = cut === "emerald"
  const profile = step ? STEP : BRILLIANT
  const culetY = step ? STEP_CULET : BRILLIANT_CULET
  const n = step ? OCTAGON.length : detail
  const girdleY = -0.15
  const middle: Vec3 = [0, 0.05, 0]

  const rings: Vec3[][] = profile.map(({ r, y, half }) =>
    Array.from({ length: n }, (_, k): Vec3 => {
      if (step) {
        const [x, z] = OCTAGON[k]
        return [x * r, y, z * r]
      }
      const [x, z] = section(cut, ((k + (half ? 0.5 : 0)) / n) * Math.PI * 2)
      return [x * r, y, z * r]
    })
  )

  const facets: Facet[] = []
  const add = (pts: Vec3[], ring: number) => {
    let normal = polygonNormal(pts)
    const c = centroid(pts)
    // Wind every facet outwards, whatever order its points came in.
    if (dot(normal, sub(c, middle)) < 0) {
      pts = [...pts].reverse()
      normal = [-normal[0], -normal[1], -normal[2]]
    }
    facets.push({ pts, n: normal, ring, lower: c[1] > girdleY })
  }

  add(rings[0], 0)

  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i]
    const b = rings[i + 1]
    const ah = profile[i].half
    const bh = profile[i + 1].half
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n
      if (ah === bh) {
        add([a[k], a[k1], b[k1], b[k]], i + 1)
      } else if (bh) {
        // b[k] sits between a[k] and a[k+1].
        add([a[k], a[k1], b[k]], i + 1)
        add([b[k], a[k1], b[k1]], i + 1)
      } else {
        // a[k] sits between b[k] and b[k+1].
        add([b[k], b[k1], a[k]], i + 1)
        add([a[k], b[k1], a[k1]], i + 1)
      }
    }
  }

  const last = rings[rings.length - 1]
  const culet: Vec3 = [0, culetY, 0]
  for (let k = 0; k < n; k++) add([last[k], last[(k + 1) % n], culet], rings.length)

  return { cut, facets, rings: rings.length + 1 }
}

// ---- Drawing -------------------------------------------------------------

export type Pose = {
  x: number
  y: number
  /** Pixels per model unit: roughly the girdle's radius. */
  scale: number
  /** Turn about the vertical axis, radians. */
  spin: number
  /** Lean towards the viewer, radians; positive shows the table. */
  tilt: number
  tint: Tint
  /** Shifts the studio pattern, so two stones never flash in step. */
  phase: number
  alpha?: number
  /** 0 → 1: facets appear ring by ring from the table down. */
  reveal?: number
}

export type Projected = {
  /** Screen points of each facet facing the viewer. */
  polys: { pts: [number, number][]; facet: Facet; nz: number }[]
  /** Brightest visible point, where a glint looks natural. */
  hot: { x: number; y: number; v: number }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

function rotate(p: Vec3, cy: number, sy: number, ct: number, st: number): Vec3 {
  // Spin about y, then lean about x so the top tips towards the viewer.
  const x = p[0] * cy + p[2] * sy
  const z0 = -p[0] * sy + p[2] * cy
  const y = p[1] * ct + z0 * st
  const z = -p[1] * st + z0 * ct
  return [x, y, z]
}

/** The made-up studio a facet reflects: 0 (black) → 1 (blown out). */
function studio(r: Vec3, phase: number, lower: boolean) {
  const overhead = smooth(0.5, 0.95, -r[1])
  const strips = smooth(0.72, 0.98, r[0]) * 0.55 + smooth(0.78, 0.99, -r[0]) * 0.4
  const busy = 0.5 + 0.5 * Math.sin(r[0] * 9 + r[2] * 5 + phase) * Math.sin(r[1] * 7 - r[2] * 4 + phase * 0.7)
  if (lower) {
    // Pavilion facets mostly show light bounced inside the stone: higher contrast.
    return clamp01(0.04 + 0.95 * busy * busy * busy + overhead * 0.35 + strips * 0.5)
  }
  return clamp01(0.07 + 0.55 * busy * busy + overhead + strips)
}

function hsl(h: number, s: number, l: number): [number, number, number] {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

/** Projects the visible facets without drawing them. */
export function project(gem: Gem, pose: Pose): Projected {
  const cy = Math.cos(pose.spin)
  const sy = Math.sin(pose.spin)
  const ct = Math.cos(pose.tilt)
  const st = Math.sin(pose.tilt)
  const polys: Projected["polys"] = []
  const hot = { x: pose.x, y: pose.y, v: -1 }
  for (const facet of gem.facets) {
    const n = rotate(facet.n, cy, sy, ct, st)
    if (n[2] <= 0.001) continue
    const pts = facet.pts.map((p): [number, number] => {
      const q = rotate(p, cy, sy, ct, st)
      return [pose.x + q[0] * pose.scale, pose.y + q[1] * pose.scale]
    })
    polys.push({ pts, facet, nz: n[2] })
    // Facing the viewer and lit from above: the likeliest place to flash.
    const v = n[2] * 0.6 - n[1] * 0.4 + (facet.ring === 1 ? 0.15 : 0)
    if (v > hot.v) {
      hot.v = v
      hot.x = pts[0][0]
      hot.y = pts[0][1]
    }
  }
  return { polys, hot }
}

function tracePoly(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
}

/** Adds the stone's outline (every visible facet) to the current path. */
export function traceSilhouette(ctx: CanvasRenderingContext2D, projected: Projected) {
  for (const p of projected.polys) tracePoly(ctx, p.pts)
}

/** A facet's colour, seen with normal `n` (view space), and how lit it is. */
function shade(n: Vec3, facet: Facet, tint: Tint, phase: number) {
  // Reflect the view ray (0, 0, -1) about the normal.
  const r: Vec3 = [2 * n[2] * n[0], 2 * n[2] * n[1], 2 * n[2] * n[2] - 1]
  const v = studio(r, phase + facet.ring * 0.9, facet.lower)
  let [cr, cg, cb] = hsl(tint.h, tint.s, 5 + 90 * v)
  const glow = smooth(0.55, 1, v) * tint.fire
  if (glow > 0) {
    const hue = (((Math.atan2(r[2], r[0]) * 180) / Math.PI) * 2 + r[1] * 140 + phase * 40 + 720) % 360
    const [fr, fg, fb] = hsl(hue, 90, 66)
    const m = glow * 0.5
    cr += (fr - cr) * m
    cg += (fg - cg) * m
    cb += (fb - cb) * m
  }
  return { fill: `rgb(${cr | 0},${cg | 0},${cb | 0})`, v }
}

/**
 * What shows through the table: the pavilion, mirrored back up at the
 * viewer. Drawing it from below, squashed into the table's ellipse and
 * turning against the stone, gives the radiating arrows of a well-cut stone.
 */
function drawTableView(
  ctx: CanvasRenderingContext2D,
  gem: Gem,
  pose: Pose,
  table: [number, number][],
  alpha: number
) {
  let tx = 0
  let ty = 0
  for (const [x, y] of table) {
    tx += x
    ty += y
  }
  tx /= table.length
  ty /= table.length
  const tilt = -Math.PI / 2
  const spin = -pose.spin * 1.4 + 0.4
  const cy = Math.cos(spin)
  const sy = Math.sin(spin)
  const ct = Math.cos(tilt)
  const st = Math.sin(tilt)
  const inner = project(gem, { ...pose, x: 0, y: 0, scale: pose.scale * 0.62, spin, tilt })

  ctx.save()
  ctx.beginPath()
  tracePoly(ctx, table)
  ctx.clip()
  ctx.translate(tx, ty)
  ctx.scale(1, Math.max(0.2, Math.sin(pose.tilt)))
  ctx.globalAlpha = alpha
  ctx.lineWidth = Math.max(0.4, pose.scale * 0.008)
  for (const { pts, facet } of inner.polys) {
    if (!facet.lower) continue
    const { fill, v } = shade(rotate(facet.n, cy, sy, ct, st), facet, pose.tint, pose.phase + 2.1)
    ctx.beginPath()
    tracePoly(ctx, pts)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.strokeStyle = `rgba(255,255,255,${0.08 + 0.2 * v})`
    ctx.stroke()
  }
  ctx.restore()
}

/** Draws the gem shaded. Returns the projection so callers can add glints. */
export function drawGem(ctx: CanvasRenderingContext2D, gem: Gem, pose: Pose): Projected {
  const projected = project(gem, pose)
  const alpha = pose.alpha ?? 1
  const reveal = pose.reveal ?? 1
  if (alpha <= 0 || reveal <= 0) return projected

  const cy = Math.cos(pose.spin)
  const sy = Math.sin(pose.spin)
  const ct = Math.cos(pose.tilt)
  const st = Math.sin(pose.tilt)
  const span = gem.rings + 2

  ctx.save()
  const base = ctx.globalAlpha
  ctx.lineJoin = "round"
  ctx.lineWidth = Math.max(0.5, pose.scale * 0.012)
  for (const { pts, facet } of projected.polys) {
    const show = clamp01((reveal * span - facet.ring) / 2)
    if (show <= 0) continue
    const { fill, v } = shade(rotate(facet.n, cy, sy, ct, st), facet, pose.tint, pose.phase)
    ctx.globalAlpha = base * alpha * show
    ctx.beginPath()
    tracePoly(ctx, pts)
    ctx.fillStyle = fill
    ctx.fill()
    if (facet.ring === 0) {
      drawTableView(ctx, gem, pose, pts, ctx.globalAlpha * 0.82)
      ctx.beginPath()
      tracePoly(ctx, pts)
    }
    ctx.strokeStyle = `rgba(255,255,255,${0.1 + 0.32 * v})`
    ctx.stroke()
  }
  ctx.restore()
  return projected
}

/**
 * Draws the facet edges only, each traced in over `progress` (0 → 1), rings
 * from the table down. The loader's line drawing.
 */
export function drawWire(
  ctx: CanvasRenderingContext2D,
  gem: Gem,
  pose: Pose,
  progress: number,
  color: string
) {
  const { polys } = project(gem, pose)
  const span = gem.rings + 3
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(0.6, pose.scale * 0.008)
  ctx.lineJoin = "round"
  ctx.lineCap = "round"
  ctx.globalAlpha *= pose.alpha ?? 1
  for (const { pts, facet } of polys) {
    const p = clamp01((progress * span - facet.ring) / 3)
    if (p <= 0) continue
    let length = 0
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      length += Math.hypot(b[0] - a[0], b[1] - a[1])
    }
    ctx.setLineDash([length, length])
    ctx.lineDashOffset = length * (1 - p)
    ctx.beginPath()
    tracePoly(ctx, pts)
    ctx.stroke()
  }
  ctx.restore()
}

/** A four-point star with a soft halo: the flash off a facet. */
export function drawGlint(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number) {
  if (alpha <= 0 || size <= 0) return
  ctx.save()
  const base = ctx.globalAlpha
  ctx.globalCompositeOperation = "lighter"
  ctx.globalAlpha = base * clamp01(alpha)

  const halo = ctx.createRadialGradient(x, y, 0, x, y, size * 0.7)
  halo.addColorStop(0, "rgba(255,255,255,0.9)")
  halo.addColorStop(0.25, "rgba(220,235,255,0.35)")
  halo.addColorStop(1, "rgba(200,220,255,0)")
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(x, y, size * 0.7, 0, Math.PI * 2)
  ctx.fill()

  const ray = (dx: number, dy: number, len: number, width: number) => {
    ctx.beginPath()
    ctx.moveTo(x - dx * len, y - dy * len)
    ctx.quadraticCurveTo(x + dy * width, y - dx * width, x + dx * len, y + dy * len)
    ctx.quadraticCurveTo(x - dy * width, y + dx * width, x - dx * len, y - dy * len)
    ctx.fill()
  }
  ctx.fillStyle = "rgba(255,255,255,0.95)"
  ray(1, 0, size, size * 0.09)
  ray(0, 1, size, size * 0.09)
  ctx.globalAlpha = base * clamp01(alpha) * 0.6
  const d = Math.SQRT1_2
  ray(d, d, size * 0.45, size * 0.05)
  ray(d, -d, size * 0.45, size * 0.05)
  ctx.restore()
}
