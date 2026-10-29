import { createRng } from "@/os/kernel/rng"
import {
  add,
  along,
  BOUNDS,
  CANTONMENT,
  inside,
  ISBT,
  lengthOf,
  MONASTERY,
  nearest,
  norm,
  rect,
  right,
  ROADS,
  scale,
  yawOf,
  type Polygon,
  type Road,
  type Vec2,
} from "../geo"
import type { Signs, SignStyle } from "../kit/signs"
import { box as makeBox, boxYaw, circle, Collision, type Box } from "./collide"
import { landmarks } from "./landmarks"
import { roadPieces } from "./roads"
import { car, cow, house, range, scooter, streetLamp, tree, type Kit, type Rng, type TreeKind } from "./props"

/**
 * The whole town as a list of pieces — each one a position and a function
 * that draws it — plus everything you can bump into. Pieces are drawn
 * lazily, a 64 m chunk at a time, as you get near them; collision is all
 * known up front. Seeded, so every visitor walks the same Dehradun.
 */

export const CHUNK = 64

export type Piece = { x: number; z: number; seed: number; build: (k: Kit) => void }

/** Somewhere you can press E. */
export type Spot = { id: string; at: Vec2; radius: number; label: string; verb: string }

/** Ground colouring regions; where they overlap, the last one added wins. */
export type Zone = { kind: "isbt" | "monastery" | "courtyard" | "cantt" | "parade" | "lawn" | "path"; poly: Polygon }

export class Plan {
  readonly pieces: Piece[] = []
  readonly collision = new Collision()
  /** Footprints already taken, so generated houses don't overlap anything. */
  readonly taken = new Collision()
  readonly exclusions: Polygon[] = []
  readonly roads: Road[] = [...ROADS]
  /** Lamp heads, [x, y, z]: the light pool lights the nearest ones at night. */
  readonly lamps: [number, number, number][] = []
  readonly spots: Spot[] = []
  readonly water: Polygon[] = []
  readonly zones: Zone[] = []
  /** Where vehicles drive, with how many of which kind. */
  readonly routes: { road: string; kind: "bus" | "vikram" | "car" | "scooter" | "truck"; count: number }[] = []
  /** Named spots the game needs: where the friend waits, the fountain, … */
  readonly marks = new Map<string, { p: Vec2; d: Vec2 }>()
  private nextSeed = 1

  readonly signs: Signs

  constructor(signs: Signs) {
    this.signs = signs
  }

  /** Adds a piece drawn in world space. */
  add(x: number, z: number, build: (k: Kit) => void) {
    this.pieces.push({ x, z, seed: this.nextSeed++ * 7919, build })
  }

  /** Something solid: collides, and keeps generated buildings off it. */
  solid(b: Box) {
    this.collision.add(b)
    this.taken.add(b)
  }

  round(x: number, z: number, r: number) {
    this.collision.add(circle(x, z, r))
    this.taken.add(makeBox(x, z, r * 2, r * 2))
  }

  /** Keeps generated buildings off a footprint without making it solid. */
  reserve(b: Box) {
    this.taken.add(b)
  }

  lamp(x: number, y: number, z: number) {
    this.lamps.push([x, y, z])
  }

  /** Pieces grouped by chunk key `cx,cz`. */
  chunks() {
    const out = new Map<string, Piece[]>()
    for (const p of this.pieces) {
      const k = chunkKey(Math.floor(p.x / CHUNK), Math.floor(p.z / CHUNK))
      let list = out.get(k)
      if (!list) out.set(k, (list = []))
      list.push(p)
    }
    return out
  }

  /** Clear of every road by `margin` beyond its kerb? */
  offRoad(p: Vec2, margin: number, skip?: Road) {
    for (const r of this.roads) {
      if (r === skip) continue
      if (nearest(r.points, p).dist < r.width / 2 + margin) return false
    }
    return true
  }

  excluded(p: Vec2) {
    return this.exclusions.some((poly) => inside(poly, p))
  }

  /** Can a building with this footprint go here? */
  fits(b: Box, roadMargin = 1.2) {
    const pts = corners(b)
    for (const p of [...pts, [b.x, b.z] as Vec2]) {
      if (p[0] < BOUNDS.minX + 4 || p[0] > BOUNDS.maxX - 4 || p[1] < BOUNDS.minZ + 4 || p[1] > BOUNDS.maxZ - 4) return false
      if (this.excluded(p)) return false
      if (!this.offRoad(p, roadMargin)) return false
    }
    return !this.taken.hits(b)
  }

  nearestRoad(p: Vec2) {
    let best = { road: this.roads[0], dist: Infinity, d: [1, 0] as Vec2, at: p }
    for (const r of this.roads) {
      const n = nearest(r.points, p)
      if (n.dist - r.width / 2 < best.dist) best = { road: r, dist: n.dist - r.width / 2, d: n.d, at: n.at }
    }
    return best
  }
}

export const chunkKey = (cx: number, cz: number) => `${cx},${cz}`

export function corners(b: Box): Vec2[] {
  const vx = -b.uz
  const vz = b.ux
  return [
    [b.x + b.ux * b.hx + vx * b.hz, b.z + b.uz * b.hx + vz * b.hz],
    [b.x - b.ux * b.hx + vx * b.hz, b.z - b.uz * b.hx + vz * b.hz],
    [b.x - b.ux * b.hx - vx * b.hz, b.z - b.uz * b.hx - vz * b.hz],
    [b.x + b.ux * b.hx - vx * b.hz, b.z + b.uz * b.hx - vz * b.hz],
  ]
}

/** Runs `fn` in a frame at (x, z) turned by `yaw`, in both the solid and the sign builder. */
export function place(k: Kit, x: number, z: number, yaw: number, fn: () => void, y = 0) {
  k.b.push(x, y, z, yaw)
  k.s.push(x, y, z, yaw)
  fn()
  k.s.pop()
  k.b.pop()
}

// ── shop names (made up, in the style of the street) ────────────────────────

const SHOPS: { name: string; sub?: string; bg: number; fg: number }[] = [
  { name: "SHARMA GENERAL STORE", sub: "शर्मा जनरल स्टोर", bg: 0xf2c94c, fg: 0x7a2a22 },
  { name: "DOON MEDICOS", sub: "दून मेडिकोज़", bg: 0x1f7a4a, fg: 0xffffff },
  { name: "NEGI DHABA", sub: "नेगी ढाबा", bg: 0xb3261e, fg: 0xfff1c8 },
  { name: "MOMO POINT", bg: 0xffffff, fg: 0xd2347a },
  { name: "RAWAT MOBILE CARE", bg: 0x2f80ed, fg: 0xffffff },
  { name: "BISHT KIRANA", sub: "बिष्ट किराना", bg: 0xf2994a, fg: 0x2d2d30 },
  { name: "GARHWAL HARDWARE", bg: 0x3c3c3c, fg: 0xf2c94c },
  { name: "CHAI ADDA", sub: "चाय अड्डा", bg: 0x7a3e1d, fg: 0xffe8b0 },
  { name: "NEW DOON TAILORS", bg: 0xe8e2f8, fg: 0x5b2a86 },
  { name: "THAPA BAKERS", bg: 0xfde6c8, fg: 0x8a4a1a },
  { name: "PAHADI SWAD", sub: "पहाड़ी स्वाद", bg: 0x27ae60, fg: 0xffffff },
  { name: "GUPTA SWEETS", sub: "गुप्ता स्वीट्स", bg: 0xd35400, fg: 0xfff1c8 },
  { name: "UNIQUE PHOTOSTAT", bg: 0x2d2d30, fg: 0x56ccf2 },
  { name: "KUMAON FRUITS", bg: 0x6fcf97, fg: 0x1b4332 },
  { name: "SAI ELECTRICALS", bg: 0x1d3557, fg: 0xf1faee },
  { name: "CLEMENT TOWN PHARMACY", bg: 0xffffff, fg: 0x1f7a4a },
  { name: "HIMALAYA BOOK DEPOT", bg: 0x8e1b1b, fg: 0xffffff },
  { name: "VERMA DAIRY", sub: "वर्मा डेरी", bg: 0xeaf4fb, fg: 0x1f5fa8 },
  { name: "LUCKY HAIR SALON", bg: 0x9b51e0, fg: 0xffffff },
  { name: "BHATT CYCLE WORKS", bg: 0x4f4f4f, fg: 0xf2994a },
  { name: "ROYAL OPTICALS", bg: 0x0b3d91, fg: 0xf2c94c },
  { name: "DOON TYRES", bg: 0x111111, fg: 0xf2c94c },
  { name: "SHIVAM CHAAT", sub: "शिवम चाट", bg: 0xeb5757, fg: 0xffffff },
  { name: "RANA AUTO PARTS", bg: 0x2d2d30, fg: 0xffffff },
]

const HIGHWAY_SHOPS: typeof SHOPS = [
  { name: "HOTEL VALLEY VIEW", bg: 0x1d3557, fg: 0xf2c94c },
  { name: "HERO SHOWROOM", bg: 0xb3261e, fg: 0xffffff },
  { name: "DOON TRANSPORT CO.", bg: 0x2d2d30, fg: 0xf2c94c },
  { name: "AGGARWAL SWEETS", sub: "अग्रवाल स्वीट्स", bg: 0xd35400, fg: 0xffffff },
  { name: "GUEST HOUSE", bg: 0xffffff, fg: 0x1f5fa8 },
  { name: "BUS TICKET BOOKING", bg: 0xf2c94c, fg: 0x1f1f22 },
  { name: "TYRE & PUNCTURE", bg: 0x111111, fg: 0xeb5757 },
  { name: "DHABA 24x7", bg: 0x27ae60, fg: 0xffffff },
]

const TIBETAN_SHOPS: typeof SHOPS = [
  { name: "AMA MOMO HOUSE", bg: 0x8e1b1b, fg: 0xf2c94c },
  { name: "TASHI DELEK CAFE", bg: 0xf2c94c, fg: 0x8e1b1b },
  { name: "DHARMA HANDICRAFTS", bg: 0x1f5fa8, fg: 0xffffff },
  { name: "THUKPA CORNER", bg: 0x27ae60, fg: 0xffffff },
  { name: "LOTUS PRAYER BEADS", bg: 0xffffff, fg: 0x8e1b1b },
]

const style = (s: (typeof SHOPS)[number]): SignStyle => ({ bg: s.bg, fg: s.fg, sub: s.sub })

// ── generation ──────────────────────────────────────────────────────────────

export function buildPlan(signs: Signs, seed = 2026): Plan {
  const plan = new Plan(signs)
  const r = createRng(seed)

  plan.exclusions.push(
    rect(ISBT.centre, ISBT.dir, ISBT.length + 12, ISBT.depth + 12),
    CANTONMENT,
    rect(MONASTERY.centre, [1, 0], MONASTERY.w + 16, MONASTERY.h + 16)
  )

  landmarks(plan, r)
  lanes(plan, r)
  roadPieces(plan)
  for (const road of plan.roads) frontage(plan, road, r)
  backfill(plan, r)
  roadside(plan, r)
  edges(plan)

  plan.routes.push(
    { road: "saharanpur", kind: "bus", count: 3 },
    { road: "saharanpur", kind: "car", count: 5 },
    { road: "saharanpur", kind: "truck", count: 1 },
    { road: "haridwar-bypass", kind: "car", count: 3 },
    { road: "shimla-bypass", kind: "vikram", count: 2 },
    { road: "shimla-bypass", kind: "car", count: 2 },
    { road: "turner", kind: "vikram", count: 3 },
    { road: "turner", kind: "scooter", count: 4 },
    { road: "turner", kind: "car", count: 3 },
    { road: "buddha-temple", kind: "scooter", count: 2 }
  )
  return plan
}

/**
 * Numbered lanes off the main roads, the way Clement Town's run off Turner
 * Road. Their positions are generated; their names follow the town's habit.
 */
function lanes(plan: Plan, r: Rng) {
  let number = 1
  for (const parent of ROADS.filter((x) => x.kind !== "lane")) {
    const L = lengthOf(parent.points)
    for (let s = 50 + r.next() * 40; s < L - 40; s += range(r, 85, 150)) {
      const side = r.chance(0.5) ? 1 : -1
      const { p, d } = along(parent.points, s)
      const turn = range(r, -0.2, 0.2)
      const perp = scale(right(d), side)
      const dir = norm([perp[0] * Math.cos(turn) - perp[1] * Math.sin(turn), perp[1] * Math.cos(turn) + perp[0] * Math.sin(turn)])
      const want = range(r, 70, 210)
      let length = 0
      for (let t = parent.width / 2 + 8; t <= want; t += 6) {
        const q = add(p, scale(dir, t))
        if (q[0] < BOUNDS.minX + 25 || q[0] > BOUNDS.maxX - 25 || q[1] < BOUNDS.minZ + 25 || q[1] > BOUNDS.maxZ - 25) break
        if (plan.excluded(q) || plan.excluded(add(q, scale(right(dir), 14))) || plan.excluded(add(q, scale(right(dir), -14)))) break
        if (!plan.offRoad(q, 22, parent)) break
        length = t
      }
      if (length < 55) continue
      plan.roads.push({
        id: `lane-${number}`,
        name: `Lane No. ${number}`,
        kind: "lane",
        width: 5,
        points: [p, add(p, scale(dir, length))],
      })
      number++
    }
  }
}

/** Shops and houses along both sides of a road. */
function frontage(plan: Plan, road: Road, r: Rng) {
  const L = lengthOf(road.points)
  const names = road.id === "saharanpur" || road.id === "haridwar-bypass" ? HIGHWAY_SHOPS : SHOPS
  for (const side of [1, -1]) {
    let s = road.kind === "lane" ? 8 : 4
    while (s < L - 6) {
      const w = road.kind === "lane" ? range(r, 8, 12) : range(r, 7, 13)
      const { p, d } = along(road.points, s + w / 2)
      const shopChance = road.kind === "lane" ? 0.08 : road.kind === "highway" ? 0.7 : 0.75
      const isShop = r.chance(shopChance)
      const yard = !isShop && r.chance(0.65) ? range(r, 2, 4) : 0
      const depth = road.kind === "lane" ? range(r, 9, 13) : range(r, 10, 16)
      const setback = road.width / 2 + (road.kind === "lane" ? 1.5 : 3) + yard + r.next()
      const c = add(p, scale(right(d), side * (setback + depth / 2)))
      // Front faces the road: local +x runs along it, local +z points away.
      const fwd: Vec2 = side > 0 ? d : [-d[0], -d[1]]
      const yaw = yawOf(fwd)
      const foot = makeBox(c[0], c[1], w + 0.4, depth + yard + 0.6, fwd[0], fwd[1])
      if (plan.fits(foot)) {
        // Clement Town is mostly one and two storeys; the highway a little taller.
        const floors = road.kind === "lane" ? r.pick([1, 1, 2, 2, 3]) : road.kind === "highway" ? r.pick([2, 2, 3, 3, 4]) : r.pick([1, 2, 2, 2, 3])
        const nearMonastery = road.id === "buddha-temple" && s > L - 160
        const shop = isShop ? (nearMonastery ? r.pick(TIBETAN_SHOPS) : r.pick(names)) : null
        const open = r.chance(0.85)
        const pitched = !isShop && r.chance(0.18)
        const hw = w
        plan.solid(boxYaw(c[0], c[1], w, depth, yaw))
        plan.add(c[0], c[1], (k) =>
          place(k, c[0], c[1], yaw, () =>
            house(k, { w: hw, d: depth, floors, yard, pitched, shop: shop && { name: shop.name, style: style(shop), open } })
          )
        )
        if (isShop && r.chance(0.5)) parkedTwoWheeler(plan, add(p, scale(right(d), side * (road.width / 2 + 1.4))), d, r)
        s += w + range(r, 0.3, 2.5)
      } else {
        s += 3
      }
    }
  }
}

function parkedTwoWheeler(plan: Plan, at: Vec2, d: Vec2, r: Rng) {
  const yaw = yawOf(d) + Math.PI / 2 + range(r, -0.3, 0.3)
  plan.add(at[0], at[1], (k) => place(k, at[0], at[1], yaw, () => scooter(k)))
}

/** Houses, orchards and fields behind the frontage. */
function backfill(plan: Plan, r: Rng) {
  const step = 22
  const kinds: TreeKind[] = ["mango", "mango", "lychee", "sal", "eucalyptus", "pine"]
  for (let x = BOUNDS.minX + 12; x < BOUNDS.maxX - 12; x += step) {
    for (let z = BOUNDS.minZ + 12; z < BOUNDS.maxZ - 12; z += step) {
      const p: Vec2 = [x + range(r, -6, 6), z + range(r, -6, 6)]
      if (plan.excluded(p) || !plan.offRoad(p, 6)) continue
      const near = plan.nearestRoad(p)
      if (near.dist < 110 && r.chance(near.road.kind === "lane" ? 0.75 : 0.55)) {
        // Face the nearest road.
        const to = norm([near.at[0] - p[0], near.at[1] - p[1]])
        const fwd: Vec2 = [-to[1], to[0]]
        const yaw = yawOf(fwd)
        const w = range(r, 8, 12)
        const d = range(r, 8, 12)
        const yard = r.chance(0.7) ? range(r, 2, 3.5) : 0
        const foot = makeBox(p[0], p[1], w + 1.5, d + yard + 1.5, fwd[0], fwd[1])
        if (!plan.fits(foot, 2)) continue
        const floors = r.pick([1, 1, 2, 2, 3])
        const pitched = r.chance(0.22)
        plan.solid(boxYaw(p[0], p[1], w, d, yaw))
        plan.add(p[0], p[1], (k) => place(k, p[0], p[1], yaw, () => house(k, { w, d, floors, yard, pitched })))
        if (r.chance(0.5)) treeAt(plan, add(p, scale(fwd, (w / 2 + 3) * (r.chance(0.5) ? 1 : -1))), r.pick(kinds))
      } else {
        // An orchard or a field with a few trees.
        const n = near.dist > 110 ? r.int(1, 4) : r.int(0, 2)
        const kind = r.pick(kinds)
        for (let i = 0; i < n; i++) {
          const t = add(p, [range(r, -8, 8), range(r, -8, 8)])
          if (!plan.excluded(t)) treeAt(plan, t, kind)
        }
        if (r.chance(0.08)) cowAt(plan, add(p, [range(r, -5, 5), range(r, -5, 5)]), r)
      }
    }
  }
}

export function treeAt(plan: Plan, p: Vec2, kind: TreeKind, size = 1, painted = false) {
  if (!plan.offRoad(p, 1.5)) return
  const b = makeBox(p[0], p[1], 1.2, 1.2)
  if (plan.taken.hits(b)) return
  plan.round(p[0], p[1], 0.45)
  plan.add(p[0], p[1], (k) => tree(k, p[0], p[1], kind, size, painted))
}

function cowAt(plan: Plan, p: Vec2, r: Rng) {
  const yaw = r.next() * Math.PI * 2
  const b = boxYaw(p[0], p[1], 2.2, 1.0, yaw)
  if (plan.taken.hits(b)) return
  plan.solid(b)
  plan.add(p[0], p[1], (k) => place(k, p[0], p[1], yaw, () => cow(k)))
}

/** Street lights, avenue trees, parked cars and the odd cow along the main roads. */
function roadside(plan: Plan, r: Rng) {
  for (const road of plan.roads) {
    const L = lengthOf(road.points)
    const gap = road.kind === "highway" ? 34 : road.kind === "main" ? 30 : 42
    let side = 1
    for (let s = 10; s < L - 5; s += gap) {
      const { p, d } = along(road.points, s)
      const at = add(p, scale(right(d), side * (road.width / 2 + 0.9)))
      if (plan.offRoad(at, 0.5) && !plan.taken.hits(makeBox(at[0], at[1], 0.6, 0.6))) {
        // Arm toward the road: local −z must point back at the road centre.
        const fwd: Vec2 = side > 0 ? d : [-d[0], -d[1]]
        const yaw = yawOf(fwd)
        const kind = road.kind === "lane" ? "park" : "street"
        plan.round(at[0], at[1], 0.2)
        plan.add(at[0], at[1], (k) => place(k, at[0], at[1], yaw, () => streetLamp(k, kind)))
        const head = kind === "street" ? add(at, scale(right(fwd), -1.6)) : at
        plan.lamp(head[0], kind === "street" ? 7.2 : 3.4, head[1])
      }
      if (road.kind !== "lane") side = -side
    }
    if (road.kind === "lane") continue
    // Parked cars and cows on the shoulder.
    for (let s = 40; s < L - 40; s += range(r, 50, 120)) {
      const { p, d } = along(road.points, s)
      const sd = r.chance(0.5) ? 1 : -1
      const at = add(p, scale(right(d), sd * (road.width / 2 + 1.3)))
      if (!plan.offRoad(at, -0.5, road) || plan.excluded(at)) continue
      const yaw = yawOf(d)
      if (r.chance(0.12)) {
        cowAt(plan, add(p, scale(right(d), sd * (road.width / 2 - 1.2))), r)
        continue
      }
      const b = boxYaw(at[0], at[1], 3.8, 1.8, yaw)
      if (plan.taken.hits(b)) continue
      plan.solid(b)
      plan.add(at[0], at[1], (k) => place(k, at[0], at[1], yaw, () => car(k)))
    }
  }
}

/** The diorama's cut edge: earth in layers, all the way round. */
function edges(plan: Plan) {
  const sides: [Vec2, Vec2][] = [
    [[BOUNDS.minX, BOUNDS.minZ], [BOUNDS.maxX, BOUNDS.minZ]],
    [[BOUNDS.maxX, BOUNDS.minZ], [BOUNDS.maxX, BOUNDS.maxZ]],
    [[BOUNDS.maxX, BOUNDS.maxZ], [BOUNDS.minX, BOUNDS.maxZ]],
    [[BOUNDS.minX, BOUNDS.maxZ], [BOUNDS.minX, BOUNDS.minZ]],
  ]
  for (const [a, b] of sides) {
    const d = norm([b[0] - a[0], b[1] - a[1]])
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    // Outward is to the left of travel (the loop runs clockwise seen from above).
    const yaw = yawOf(d)
    for (let s = 0; s < L; s += 32) {
      const len = Math.min(32, L - s)
      const m = add(a, scale(d, s + len / 2))
      plan.add(m[0], m[1], (k) =>
        place(k, m[0], m[1], yaw, () => {
          const layers: [number, number, number][] = [
            [-0.6, 0.6, 0x5e8a3a],
            [-3, 2.4, 0x7a5a3a],
            [-6.5, 3.5, 0x5e4430],
            [-12, 5.5, 0x463428],
          ]
          for (const [y, h, c] of layers) k.b.box(0, y, -0.3, len, h, 0.6, c)
        })
      )
    }
  }
}
