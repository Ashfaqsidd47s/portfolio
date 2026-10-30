/**
 * The map: one corner of Dehradun from the ISBT at Majra down Turner Road to
 * Clement Town, in metres. x runs east, z runs south, 1 unit is 1 m, so a
 * walk across the game is the walk across the town.
 *
 * Everything hangs off a few surveyed points (published coordinates,
 * projected below). The roads between them follow the real roads' bearings
 * and lengths; plots, lanes and filler buildings along them are generated.
 * To correct the map, move a point here: the world is rebuilt from it.
 */

export type Vec2 = [number, number]

/** Projection centre, a little south of the ISBT. */
const LAT0 = 30.28
const LON0 = 78.0
/** Metres per degree of latitude, and of longitude at 30.28° N. */
const M_LAT = 110_860
const M_LON = 96_130

export const project = (lat: number, lon: number): Vec2 => [(lon - LON0) * M_LON, -(lat - LAT0) * M_LAT]
export const unproject = ([x, z]: Vec2) => ({ lat: LAT0 - z / M_LAT, lon: LON0 + x / M_LON })

/** Published coordinates the rest of the map is laid out from. */
export const SURVEYED = {
  /** Inter State Bus Terminal, Majra (OSM way 451131123). */
  isbt: project(30.28782, 77.99803),
  /** Raj Kumar Sweet Shop, 1 Turner Road, at the corner with Saharanpur Road. */
  rajKumarSweets: project(30.28633, 77.99577),
  /** Clement Town cantonment. */
  clementTown: project(30.27083, 78.00972),
} as const

/** World edge: everything outside is the side of the diorama. */
export const BOUNDS = { minX: -800, maxX: 900, minZ: -1060, maxZ: 1100 }

// ── vector helpers ──────────────────────────────────────────────────────────

export const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]]
export const add = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]]
export const scale = (a: Vec2, s: number): Vec2 => [a[0] * s, a[1] * s]
export const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1]
export const len = (a: Vec2) => Math.hypot(a[0], a[1])
export const norm = (a: Vec2): Vec2 => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l]
}
/** The right-hand side of someone facing `d` (x east, z south, seen from above). */
export const right = (d: Vec2): Vec2 => [-d[1], d[0]]
/** Yaw (rotation about +y, three.js convention) that turns local +x onto `d`. */
export const yawOf = (d: Vec2) => Math.atan2(-d[1], d[0])

// ── polylines ───────────────────────────────────────────────────────────────

export type Polyline = Vec2[]

export function lengthOf(line: Polyline) {
  let total = 0
  for (let i = 1; i < line.length; i++) total += len(sub(line[i], line[i - 1]))
  return total
}

/** The point `s` metres along a line, and the direction there. */
export function along(line: Polyline, s: number): { p: Vec2; d: Vec2 } {
  let left = Math.max(0, s)
  for (let i = 1; i < line.length; i++) {
    const seg = sub(line[i], line[i - 1])
    const l = len(seg)
    if (left <= l || i === line.length - 1) {
      const t = l > 0 ? Math.min(left, l) / l : 0
      return { p: add(line[i - 1], scale(seg, t)), d: norm(seg) }
    }
    left -= l
  }
  return { p: line[0], d: [1, 0] }
}

/** Distance from a point to a line, with where along the line it's closest. */
export function nearest(line: Polyline, p: Vec2): { dist: number; s: number; d: Vec2; at: Vec2 } {
  let best = { dist: Infinity, s: 0, d: [1, 0] as Vec2, at: line[0] }
  let s0 = 0
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]
    const seg = sub(line[i], a)
    const l2 = dot(seg, seg)
    const l = Math.sqrt(l2)
    const t = l2 > 0 ? Math.max(0, Math.min(1, dot(sub(p, a), seg) / l2)) : 0
    const at = add(a, scale(seg, t))
    const dist = len(sub(p, at))
    if (dist < best.dist) best = { dist, s: s0 + t * l, d: norm(seg), at }
    s0 += l
  }
  return best
}

// ── polygons ────────────────────────────────────────────────────────────────

export type Polygon = Vec2[]

export function inside(poly: Polygon, [x, z]: Vec2) {
  let hit = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) hit = !hit
  }
  return hit
}

/** A rectangle centred on `c`, `w` along `d` and `h` across it. */
export function rect(c: Vec2, d: Vec2, w: number, h: number): Polygon {
  const u = scale(norm(d), w / 2)
  const v = scale(right(norm(d)), h / 2)
  return [sub(sub(c, u), v), sub(add(c, u), v), add(add(c, u), v), add(sub(c, u), v)]
}

// ── roads ───────────────────────────────────────────────────────────────────

export type RoadKind = "highway" | "main" | "lane"

export type Road = {
  id: string
  name: string
  kind: RoadKind
  /** Carriageway width in metres, kerb to kerb. */
  width: number
  points: Polyline
  /** A raised median down the middle. */
  divider?: boolean
}

const [rkX, rkZ] = SURVEYED.rajKumarSweets

/**
 * Shimla Bypass Chowk: Saharanpur Road meets Shimla Bypass (west) and Turner
 * Road (south-east). Raj Kumar Sweets stands on its eastern corner.
 */
export const CHOWK: Vec2 = [rkX - 15, rkZ + 2]

/** Saharanpur Road (NH-307) runs NNE–SSW, 29° off north, along the ISBT's front. */
const SAHARANPUR_DIR = norm([-0.485, 0.875])
const saharanpurAt = (t: number): Vec2 => add(CHOWK, scale(SAHARANPUR_DIR, t))

/** Turner Road, from the chowk to Clement Town (about 2.2 km). */
const TURNER: Polyline = [
  CHOWK,
  [-330, -590],
  [-215, -445],
  [-95, -290],
  [20, -135],
  [130, 15],
  [225, 150],
  [300, 265],
  [380, 390],
  [470, 540],
  [590, 720],
  [720, 900],
  [820, 1100],
]

export const ROADS: Road[] = [
  {
    id: "saharanpur",
    name: "Saharanpur Road",
    kind: "highway",
    width: 17,
    divider: true,
    points: [saharanpurAt(-400), saharanpurAt(-190), CHOWK, saharanpurAt(250), saharanpurAt(780)],
  },
  {
    id: "haridwar-bypass",
    name: "Haridwar Bypass Road",
    kind: "highway",
    width: 14,
    divider: true,
    points: [saharanpurAt(-375), [0, -1012], [300, -1004], [900, -992]],
  },
  {
    id: "shimla-bypass",
    name: "Shimla Bypass Road",
    kind: "main",
    width: 12,
    points: [CHOWK, [-520, -735], [-640, -790], [-800, -850]],
  },
  { id: "turner", name: "Turner Road", kind: "main", width: 9, points: TURNER },
  {
    id: "buddha-temple",
    name: "Buddha Temple Road",
    kind: "main",
    width: 7,
    points: [[225, 150], [130, 250], [60, 420], [20, 600], [-10, 770]],
  },
]

export const roadById = (id: string) => ROADS.find((r) => r.id === id)!

// ── landmarks ───────────────────────────────────────────────────────────────

/** A point beside a road: `s` metres along it, `off` metres to its right (negative: left). */
export function beside(roadId: string, s: number, off: number): { p: Vec2; d: Vec2 } {
  const { p, d } = along(roadById(roadId).points, s)
  return { p: add(p, scale(right(d), off)), d }
}

/** The ISBT compound: 220 m along Saharanpur Road, 200 m deep, entered from the road. */
export const ISBT = {
  centre: SURVEYED.isbt,
  /** Along the road, pointing north-north-east; its right is into the compound. */
  dir: scale(SAHARANPUR_DIR, -1) as Vec2,
  length: 220,
  depth: 200,
}

/** Clement Town Cantonment gate, where Turner Road enters the cantonment. */
export const CANTT_GATE: Vec2 = [300, 265]

/** The cantonment: everything south-east of its wall, east of Buddha Temple Road. */
export const CANTONMENT: Polygon = [
  [90, 400],
  [CANTT_GATE[0], CANTT_GATE[1]],
  [553, 103],
  [900, 330],
  [900, 1100],
  [250, 1100],
  [170, 700],
]

/** Clement Town Lake: on the right just inside the gate. */
export const LAKE = { centre: [275, 420] as Vec2, rx: 80, rz: 56, dir: norm([0.539, 0.842]) as Vec2 }

/** Mindrolling Monastery, the "Buddha Temple", at the end of Buddha Temple Road. */
export const MONASTERY = { centre: [-20, 905] as Vec2, w: 240, h: 270, gate: [-10, 772] as Vec2 }

// ── named places (for the banner, the map and fast travel) ──────────────────

export type Place = {
  id: string
  name: string
  /** Shown under the name. */
  note: string
  at: Vec2
  /** Inside this radius (metres) counts as being there. */
  radius: number
  /** A spot you can fast-travel to. */
  travel?: boolean
}

const cake = beside("turner", 1120, -13)
const velmed = beside("turner", 1120, 42)

export const SPOTS = {
  cakeHouse: cake,
  velmed,
  rajKumar: { p: SURVEYED.rajKumarSweets, d: norm(sub(TURNER[1], TURNER[0])) },
}

export const PLACES: Place[] = [
  { id: "isbt", name: "ISBT Dehradun", note: "Inter State Bus Terminal, Majra", at: ISBT.centre, radius: 150, travel: true },
  { id: "chowk", name: "Shimla Bypass Chowk", note: "Saharanpur Rd · Shimla Bypass · Turner Rd", at: CHOWK, radius: 45, travel: true },
  { id: "rajkumar", name: "Raj Kumar Sweet Shop", note: "1 Turner Road", at: SURVEYED.rajKumarSweets, radius: 18 },
  { id: "cakehouse", name: "Cake House", note: "81/2 Turner Road, opp. Velmed", at: cake.p, radius: 16, travel: true },
  { id: "velmed", name: "Velmed Hospital", note: "Turner Road, Morowala", at: velmed.p, radius: 30 },
  { id: "gate", name: "Clement Town Cantonment", note: "Army area · drive slow", at: CANTT_GATE, radius: 30 },
  { id: "lake", name: "Clement Town Lake", note: "Inside the cantonment", at: LAKE.centre, radius: 120, travel: true },
  { id: "monastery", name: "Mindrolling Monastery", note: "Buddha Temple · Great Stupa", at: MONASTERY.centre, radius: 150, travel: true },
]

/** Where the walk starts: out the front of the terminal, by the chai stall and the Vikram stand. */
export const START: Vec2 = add(ISBT.centre, scale(right(ISBT.dir), -94.5))
