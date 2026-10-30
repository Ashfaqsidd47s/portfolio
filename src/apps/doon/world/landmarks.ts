import {
  add,
  along,
  beside,
  CANTONMENT,
  CANTT_GATE,
  CHOWK,
  inside,
  ISBT,
  LAKE,
  lengthOf,
  MONASTERY,
  norm,
  rect,
  right,
  roadById,
  scale,
  SPOTS,
  sub,
  yawOf,
  type Polygon,
  type Vec2,
} from "../geo"
import { lin } from "../kit/builder"
import { box as makeBox, boxYaw } from "./collide"
import { place, treeAt, type Plan } from "./plan"
import {
  armyTruck,
  bench,
  board,
  bus,
  bush,
  car,
  chaiStall,
  GLASS,
  house,
  railing,
  range,
  roadSign,
  streetLamp,
  tree,
  vikram,
  WARM,
  wallRun,
  windowAt,
  type Kit,
  type Rng,
} from "./props"

/**
 * The places the walk is about, built by hand at their surveyed spots: the
 * ISBT, Shimla Bypass Chowk, Raj Kumar Sweets, Cake House and Velmed on
 * Turner Road, the cantonment with its lake, and Mindrolling's Great Stupa.
 */

/** A local frame on the map: x along `dir`, z to its right. */
class Site {
  readonly u: Vec2
  readonly v: Vec2
  readonly yaw: number
  readonly plan: Plan
  readonly o: Vec2
  constructor(plan: Plan, o: Vec2, dir: Vec2) {
    this.plan = plan
    this.o = o
    this.u = norm(dir)
    this.v = right(this.u)
    this.yaw = yawOf(this.u)
  }
  w(x: number, z: number): Vec2 {
    return [this.o[0] + this.u[0] * x + this.v[0] * z, this.o[1] + this.u[1] * x + this.v[1] * z]
  }
  piece(x: number, z: number, fn: (k: Kit) => void, yaw = 0) {
    const p = this.w(x, z)
    this.plan.add(p[0], p[1], (k) => place(k, p[0], p[1], this.yaw + yaw, () => fn(k)))
  }
  solid(x: number, z: number, w: number, d: number, yaw = 0) {
    const p = this.w(x, z)
    this.plan.solid(boxYaw(p[0], p[1], w, d, this.yaw + yaw))
  }
  round(x: number, z: number, r: number) {
    const p = this.w(x, z)
    this.plan.round(p[0], p[1], r)
  }
  lamp(x: number, y: number, z: number) {
    const p = this.w(x, z)
    this.plan.lamp(p[0], y, p[1])
  }
  spot(id: string, x: number, z: number, radius: number, label: string, verb: string) {
    this.plan.spots.push({ id, at: this.w(x, z), radius, label, verb })
  }
  rect(x: number, z: number, w: number, d: number): Polygon {
    return rect(this.w(x, z), this.u, w, d)
  }
  /** A wall from a to b (local), in pieces, solid. */
  wall(a: Vec2, b: Vec2, h: number, colour: number, cap: number) {
    const d = sub(b, a)
    const L = Math.hypot(d[0], d[1])
    const yaw = Math.atan2(-d[1], d[0])
    const n = Math.max(1, Math.ceil(L / 16))
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const m: Vec2 = [a[0] + d[0] * t, a[1] + d[1] * t]
      const len = L / n
      this.piece(m[0], m[1], (k) => wallRun(k, len, h, colour, cap), yaw)
      this.solid(m[0], m[1], len, 0.5, yaw)
    }
  }
}

/** A wall along world points, in pieces, solid, skipping a gap around `gap`. */
function worldWall(plan: Plan, a: Vec2, b: Vec2, h: number, colour: number, cap: number, gap?: { at: Vec2; half: number }) {
  const d = sub(b, a)
  const L = Math.hypot(d[0], d[1])
  const u = norm(d)
  const yaw = yawOf(u)
  for (let s = 0; s < L; s += 12) {
    const len = Math.min(12, L - s)
    const m = add(a, scale(u, s + len / 2))
    if (gap && Math.hypot(m[0] - gap.at[0], m[1] - gap.at[1]) < gap.half + len / 2) continue
    plan.add(m[0], m[1], (k) => place(k, m[0], m[1], yaw, () => wallRun(k, len, h, colour, cap)))
    plan.solid(boxYaw(m[0], m[1], len, 0.5, yaw))
  }
}

/** A flat disc standing upright on local plane z, facing −z. */
function disc(k: Kit, x: number, y: number, z: number, r: number, hex: number, segs = 10) {
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2
    const a1 = ((i + 1) / segs) * Math.PI * 2
    k.b.triL([[x, y, z], [x - Math.cos(a0) * r, y + Math.sin(a0) * r, z], [x - Math.cos(a1) * r, y + Math.sin(a1) * r, z]], hex)
  }
}

export function landmarks(plan: Plan, r: Rng) {
  isbt(plan, r)
  chowk(plan)
  rajKumar(plan)
  cakeHouse(plan)
  velmed(plan, r)
  cantonment(plan, r)
  lake(plan, r)
  monastery(plan, r)
}

// ── ISBT ────────────────────────────────────────────────────────────────────

const DESTINATIONS = ["DELHI", "HARIDWAR", "RISHIKESH", "MUSSOORIE", "CHANDIGARH", "SHIMLA", "HALDWANI", "SAHARANPUR"]

function isbt(plan: Plan, r: Rng) {
  const s = new Site(plan, ISBT.centre, ISBT.dir)
  const HL = ISBT.length / 2
  const HD = ISBT.depth / 2
  plan.zones.push({ kind: "isbt", poly: s.rect(0, 0, ISBT.length, ISBT.depth) })
  plan.zones.push({ kind: "courtyard", poly: s.rect(0, -95, ISBT.length - 4, 12) })

  // Boundary wall with the bus gates and a gap for people in the middle.
  const W = 0xe7dcc4
  const CAP = 0x9a3b2f
  for (const [a, b] of [[-HL, -72], [-58, -6], [6, 58], [72, HL]]) s.wall([a, -HD], [b, -HD], 2.0, W, CAP)
  s.wall([-HL, -HD], [-HL, HD], 2.4, W, CAP)
  s.wall([HL, -HD], [HL, HD], 2.4, W, CAP)
  s.wall([-HL, HD], [HL, HD], 2.4, W, CAP)
  for (const [x, label] of [[-65, "ENTRY"], [65, "EXIT"]] as const) {
    s.piece(x, -HD, (k) => {
      for (const px of [-7.5, 7.5]) k.b.box(px, 0, 0, 0.8, 6, 0.8, 0xc9b28a)
      k.b.box(0, 6, 0, 16, 0.9, 0.9, 0xb3261e)
      board(k, label, { bg: 0xb3261e, fg: 0xffffff }, 0.7, 6.1, 6)
    })
    s.round(x - 7.5, -HD, 0.6)
    s.round(x + 7.5, -HD, 0.6)
  }

  // The terminal: two floors, an arcade on the street, a clock tower, the name on top.
  s.piece(0, -78, (k) => {
    const { b } = k
    const cream = 0xf0e4c8
    b.box(0, 0, 0, 100, 8.6, 18, cream)
    b.box(0, 0, 0, 100.4, 0.4, 18.4, 0x8f877a)
    b.box(0, 4.1, 0, 100.6, 0.35, 18.6, 0xd8c8a8)
    // Arcade along the front.
    b.box(0, 4.0, -11, 100, 0.35, 4, 0xd8c8a8)
    for (let x = -48; x <= 48; x += 6) b.box(x, 0, -12.6, 0.6, 4.0, 0.6, 0xc9b28a)
    // Shops and ticket windows under the arcade.
    for (let x = -45; x <= 45; x += 6) {
      b.glow = r.chance(0.7) ? WARM : null
      b.box(x, 0.4, -9.05, 4.4, 3.0, 0.1, r.chance(0.3) ? 0x2a2420 : GLASS)
      b.glow = null
    }
    // Upper floor glazing, front and back.
    for (const z of [-9.05, 9.05]) {
      for (let x = -46; x <= 46; x += 4) {
        b.glow = r.chance(0.55) ? WARM : null
        b.box(x, 5.3, z, 3.2, 2.1, 0.1, GLASS)
        b.glow = null
      }
    }
    // Clock tower.
    b.box(0, 8.6, -2, 12, 6, 10, cream)
    b.box(0, 14.6, -2, 13, 0.4, 11, 0xd8c8a8)
    b.hip(0, 15, -2, 12, 3, 10, 0xa4432e)
    disc(k, 0, 11.6, -7.06, 1.7, 0xfbf7ef, 12)
    b.box(0, 11.5, -7.12, 0.12, 1.3, 0.04, 0x1b1b1d)
    b.box(0.4, 11.55, -7.12, 0.9, 0.12, 0.04, 0x1b1b1d)
    // Parapet and tanks.
    b.box(0, 8.6, -8.9, 100, 1.0, 0.3, cream)
    b.box(0, 8.6, 8.9, 100, 1.0, 0.3, cream)
    for (const x of [-40, -24, 24, 40]) b.cyl(x, 8.6, 4, 0.9, 0.9, 1.6, 0x1e1f22, 8)
    board(k, "ISBT DEHRADUN", { bg: 0x1f5fa8, fg: 0xffffff, big: true, sub: "अंतर्राज्यीय बस अड्डा, देहरादून", border: 0xf2c94c }, 3.4, 9.4, 30)
    k.b.at(-30, 0, 0, 0, () => board(k, "UTTARAKHAND TRANSPORT CORPORATION", { bg: 0xffffff, fg: 0x1f5fa8 }, 0.9, 9.6, 26))
  })
  s.solid(0, -78, 100, 18)
  for (let x = -48; x <= 48; x += 6) s.round(x, -90.6, 0.4)
  s.spot("isbt-enquiry", 18, -67, 4, "ISBT enquiry window", "Ask")

  // Platform canopy behind the building, with the bays.
  s.piece(0, -61, (k) => {
    const { b } = k
    b.box(0, 0, 0, 108, 0.25, 16, 0xbdb6a8)
    b.box(0, 0, 8, 108, 0.26, 0.4, 0xf2c94c)
    b.box(0, 5.2, 0, 110, 0.35, 17, 0xe4e0d8)
    b.box(0, 5.55, 0, 110, 0.6, 0.6, 0xc0392b)
    for (let x = -52; x <= 52; x += 13) b.cyl(x, 0.25, 6, 0.3, 0.3, 4.95, 0x7c8189, 8)
    for (let x = -50; x <= 50; x += 10) {
      b.glow = lin(0xe8f4ff).map((v) => v * 2.2) as [number, number, number]
      b.box(x, 5.1, 0, 3, 0.1, 0.25, 0xffffff)
      b.glow = null
    }
  })
  for (let x = -52; x <= 52; x += 13) s.round(x, -55, 0.35)
  for (let x = -50; x <= 50; x += 20) s.lamp(x, 5, -61)
  DESTINATIONS.forEach((dest, i) => {
    const x = -45.5 + i * 13
    s.piece(x, -54.6, (k) => {
      k.b.box(0, 3.9, 0.1, 0.06, 1.3, 0.06, 0x555555)
      board(k, dest, { bg: 0x1d3557, fg: 0xf2c94c }, 0.55, 3.2, 4)
    })
    if (i % 2 === 0) {
      s.piece(x + 6.5, -64, (k) => bench(k), Math.PI)
      s.solid(x + 6.5, -64, 1.8, 0.6)
    }
    // A bus waiting in every bay but one, nose to the platform.
    if (i === 5) return
    const colours: [number, number][] = [[0xf3f1ea, 0x1f5fa8], [0xf3f1ea, 0x2e8b57], [0xf5f5f5, 0x2a6fb0], [0xe9e2c9, 0xc0392b]]
    const [c, st] = colours[i % colours.length]
    s.piece(x, -46.5, (k) => bus(k, c, st), Math.PI / 2)
    s.solid(x, -46.5, 2.6, 11)
  })

  // The yard: rows of parked buses, two high masts, a workshop shed.
  for (const z of [5, 40]) {
    for (let x = -88; x <= 88; x += 13) {
      if (r.chance(0.3)) continue
      const yaw = r.chance(0.5) ? Math.PI / 2 : -Math.PI / 2
      const c = r.pick([0xf3f1ea, 0xe9e2c9, 0xf5f5f5, 0x8e44ad, 0xf2994a])
      s.piece(x, z, (k) => bus(k, c, r.pick([0x1f5fa8, 0x2e8b57, 0xc0392b])), yaw)
      s.solid(x, z, 2.6, 11)
    }
  }
  // Painted bays in the yard.
  for (const z of [5, 40]) {
    s.piece(0, z, (k) => {
      for (let x = -94.5; x <= 95; x += 13) k.b.box(x, 0, 0, 0.18, 0.02, 12, 0xe8e2c8)
      k.b.box(0, 0, -6.2, 190, 0.02, 0.18, 0xf2c94c)
    })
  }
  for (const x of [-60, 60]) {
    s.piece(x, 22, (k) => streetLamp(k, "mast"))
    s.round(x, 22, 0.5)
    s.lamp(x, 15.5, 22)
  }
  s.piece(85, 80, (k) => {
    const { b } = k
    for (const [x, z] of [[-14, -9], [14, -9], [-14, 9], [14, 9], [0, -9], [0, 9]]) b.box(x, 0, z, 0.4, 6, 0.4, 0x6d7278)
    b.box(0, 6, 0, 30, 0.2, 20, 0x7c8189)
    b.gable(0, 6.2, 0, 30, 2, 20, 0x8c9096)
  })
  s.solid(85, 80, 30, 20)

  // Out front: the vikram stand and a chai stall.
  for (let i = 0; i < 3; i++) {
    const x = -34 + i * 5
    s.piece(x, -95.5, (k) => vikram(k, i === 1 ? 0x1f5fa8 : 0x2e7d4f), Math.PI / 2)
    s.solid(x, -95.5, 1.8, 4)
  }
  s.piece(26, -95, (k) => chaiStall(k, "CHAI · SAMOSA"), Math.PI)
  s.solid(26, -95, 2.4, 1.2)
  s.spot("isbt-chai", 26, -96.8, 3.2, "Chai stall", "Buy chai")
  for (const x of [-46, 46]) treeAt(plan, s.w(x, -95), "mango")
}

// ── Shimla Bypass Chowk ─────────────────────────────────────────────────────

function chowk(plan: Plan) {
  const [x, z] = CHOWK
  plan.add(x, z, (k) =>
    place(k, x, z, 0, () => {
      const { b } = k
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        k.b.at(Math.cos(a) * 5.2, 0, Math.sin(a) * 5.2, -a + Math.PI / 2, () => b.box(0, 0, 0, 2.1, 0.45, 0.35, i % 2 ? 0x1b1b1d : 0xf2c94c))
      }
      b.cyl(0, 0, 0, 5.05, 5.05, 0.4, 0x5e8a3a, 16)
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        bush(k, Math.cos(a) * 3.6, Math.sin(a) * 3.6, i % 2 ? 0xe0559a : 0xf2c94c, 0.6)
      }
      b.cyl(0, 0.4, 0, 1.2, 1.0, 1.2, 0xe7dcc4, 8)
      b.cyl(0, 1.6, 0, 0.08, 0.06, 11, 0xdedede, 6)
      // The tricolour.
      b.sway = 0.5
      b.box(1.25, 10.6, 0, 2.4, 0.5, 0.04, 0xff9933)
      b.box(1.25, 10.1, 0, 2.4, 0.5, 0.04, 0xffffff)
      b.box(1.25, 9.6, 0, 2.4, 0.5, 0.04, 0x138808)
      b.sway = 0
      b.cyl(1.25, 10.1, -0.03, 0.16, 0.16, 0.02, 0x000080, 8)
    })
  )
  plan.round(x, z, 5.4)

  const signAt = (roadId: string, s: number, off: number, text: string, sub: string) => {
    const { p, d } = beside(roadId, s, off)
    // Faces traffic coming toward the chowk.
    const yaw = yawOf(off > 0 ? d : [-d[0], -d[1]])
    plan.add(p[0], p[1], (k) => place(k, p[0], p[1], yaw, () => roadSign(k, text, sub)))
    plan.round(p[0], p[1], 0.3)
  }
  signAt("turner", 40, 6.5, "TURNER RD > CLEMENT TOWN", "टर्नर रोड")
  signAt("shimla-bypass", 35, -8, "SHIMLA BYPASS > VIKASNAGAR", "शिमला बाईपास")
  signAt("saharanpur", 230, 11, "ISBT ^  SAHARANPUR v", "आई.एस.बी.टी.")
}

// ── Turner Road ─────────────────────────────────────────────────────────────

function sweetsCounter(k: Kit, w: number, kinds: number[]) {
  const { b } = k
  b.box(0, 0, 0, w, 0.9, 0.9, 0xc9b28a)
  b.glow = lin(0xfff0d0).map((v) => v * 0.9) as [number, number, number]
  b.box(0, 0.9, 0, w, 0.5, 0.9, 0xbfe3ef)
  b.glow = null
  let x = -w / 2 + 0.35
  for (const c of kinds) {
    for (let i = 0; i < 2 && x < w / 2 - 0.3; i++) {
      b.box(x, 1.0, -0.15 + i * 0.3, 0.42, 0.14, 0.24, c)
    }
    x += 0.55
  }
}

function rajKumar(plan: Plan) {
  const { d } = SPOTS.rajKumar
  const c = add(SPOTS.rajKumar.p, scale(d, 8))
  const fwd: Vec2 = [-d[0], -d[1]]
  const s = new Site(plan, c, fwd)
  s.piece(0, 0, (k) =>
    house(k, {
      w: 10,
      d: 11,
      floors: 3,
      wall: 0xf2df8c,
      shop: { name: "RAJ KUMAR SWEET SHOP", style: { bg: 0xb3261e, fg: 0xfff1c8, sub: "राज कुमार स्वीट शॉप", border: 0xf2c94c } },
    })
  )
  s.solid(0, 0, 10, 11)
  // Sweets in the glass counter: laddoo, barfi, bal mithai, jalebi, peda.
  s.piece(0, -6.6, (k) => sweetsCounter(k, 7, [0xf2a33a, 0xfbf3e0, 0x5a2e1a, 0xf28c28, 0xe8d0a0, 0xf5c542, 0xa8d08d]))
  s.piece(4.3, -7.3, (k) => {
    k.b.cyl(0, 0, 0, 0.5, 0.45, 0.8, 0x3a3a3a, 8)
    k.b.cyl(0, 0.8, 0, 0.7, 0.75, 0.25, 0x1b1b1d, 10)
    k.b.cyl(0, 0.98, 0, 0.6, 0.6, 0.06, 0xf28c28, 10)
  })
  s.solid(0, -6.6, 7, 1)
  s.spot("rajkumar", 0, -8, 3.5, "Raj Kumar Sweet Shop", "Buy bal mithai")
  plan.marks.set("rajkumar", { p: s.w(0, -8), d: fwd })
}

function cakeHouse(plan: Plan) {
  const { p, d } = SPOTS.cakeHouse
  const fwd: Vec2 = [-d[0], -d[1]]
  const s = new Site(plan, p, fwd)
  s.piece(0, 0, (k) =>
    house(k, {
      w: 9,
      d: 12,
      floors: 2,
      wall: 0xf7d6e3,
      shop: { name: "CAKE HOUSE", style: { bg: 0xfff4f8, fg: 0xa0164e, sub: "केक हाउस", border: 0xa0164e } },
    })
  )
  s.solid(0, 0, 9, 12)
  s.piece(0, -6.9, (k) => {
    const { b } = k
    b.box(0, 0, 0, 6.5, 0.9, 0.9, 0xfbe7ef)
    b.glow = lin(0xfff0f4).map((v) => v * 1.1) as [number, number, number]
    b.box(0, 0.9, 0, 6.5, 0.6, 0.9, 0xd8f0f8)
    b.glow = null
    const cakes: [number, number][] = [[0xfbf7ef, 0xe0559a], [0x5a2e1a, 0x3a1a0e], [0xf6c1d4, 0xffffff], [0xf2df8c, 0xf28c28], [0xfbf7ef, 0x6b3e26]]
    cakes.forEach(([base, top], i) => {
      const x = -2.6 + i * 1.3
      b.cyl(x, 0.95, 0, 0.32, 0.32, 0.22, base, 8)
      b.cyl(x, 1.17, 0, 0.32, 0.3, 0.06, top, 8)
      b.ball(x, 1.27, 0, 0.06, 0xc0392b, 4, 3)
    })
  })
  s.solid(0, -6.9, 6.5, 1)
  s.piece(5.5, -8.5, (k) => {
    k.b.box(0, 0, 0, 0.1, 2.2, 0.1, 0x555555)
    board(k, "PATTIES · PASTRY · CAKES", { bg: 0xa0164e, fg: 0xffffff }, 0.45, 2.2, 3.2)
  })
  s.round(5.5, -8.5, 0.2)
  s.spot("cakehouse", 0, -8.6, 3.5, "Cake House", "Buy patties")
  plan.marks.set("cakehouse", { p: s.w(0, -8.6), d: fwd })
}

function velmed(plan: Plan, r: Rng) {
  const { p, d } = SPOTS.velmed
  const s = new Site(plan, p, d)
  s.piece(0, 0, (k) => {
    const { b } = k
    const white = 0xf4f6f8
    b.box(0, 0, 0, 44, 18, 22, white)
    for (let f = 0; f < 5; f++) {
      const y = f * 3.6 + 1.0
      for (const z of [-11.02, 11.02]) {
        for (let x = -20; x <= 20; x += 2.5) {
          b.glow = r.chance(0.6) ? lin(0xe8f4ff).map((v) => v * 1.5) as [number, number, number] : null
          b.box(x, y, z, 2.1, 2.0, 0.08, 0x3d6b8f)
          b.glow = null
        }
      }
      b.box(0, y + 2.4, 0, 44.4, 0.3, 22.4, 0xdfe6ec)
    }
    b.box(0, 0, -13, 12, 0.3, 4, 0xdfe6ec)
    b.box(0, 4, -13, 12, 0.35, 4.4, 0x1f5fa8)
    for (const x of [-5.5, 5.5]) b.box(x, 0, -14.8, 0.4, 4, 0.4, 0xdfe6ec)
    b.glow = lin(0xff5050).map((v) => v * 1.4) as [number, number, number]
    b.box(-16, 13, -11.1, 2.4, 0.7, 0.1, 0xd32f2f)
    b.box(-16, 12.15, -11.1, 0.7, 2.4, 0.1, 0xd32f2f)
    b.glow = null
    board(k, "VELMED HOSPITAL", { bg: 0xffffff, fg: 0x1f5fa8, sub: "वेलमेड हॉस्पिटल", border: 0x1f5fa8 }, 2.4, 18.4, 26)
    b.cyl(14, 18, 4, 1.2, 1.2, 2, 0x1e1f22, 8)
  })
  s.solid(0, 0, 44, 22)
  s.solid(0, -13.5, 12, 3)
  // Compound wall on the road with a wide gate, an ambulance inside.
  s.wall([-26, -30], [-6, -30], 1.6, 0xf4f6f8, 0x1f5fa8)
  s.wall([6, -30], [26, -30], 1.6, 0xf4f6f8, 0x1f5fa8)
  s.piece(-12, -18, (k) => {
    car(k, 0xffffff)
    k.b.box(0, 1.3, 0, 2.2, 0.2, 1.52, 0xd32f2f)
    k.b.glow = lin(0x5090ff).map((v) => v * 2) as [number, number, number]
    k.b.box(0, 1.7, 0, 0.5, 0.15, 0.6, 0x2f80ed)
    k.b.glow = null
  })
  s.solid(-12, -18, 3.8, 1.8)
  for (const x of [12, 17]) {
    s.piece(x, -18, (k) => car(k), Math.PI / 2)
    s.solid(x, -18, 1.8, 3.8)
  }
  plan.zones.push({ kind: "courtyard", poly: s.rect(0, -20, 50, 20) })
  s.spot("velmed", 0, -16, 4, "Velmed Hospital", "Look in")
}

// ── Clement Town Cantonment ─────────────────────────────────────────────────

function cantonment(plan: Plan, r: Rng) {
  plan.zones.push({ kind: "cantt", poly: CANTONMENT })
  const wall = 0xe9dcc0
  const cap = 0x9a3b2f
  worldWall(plan, CANTONMENT[0], CANTONMENT[2], 2.3, wall, cap, { at: CANTT_GATE, half: 9 })
  worldWall(plan, CANTONMENT[2], CANTONMENT[3], 2.3, wall, cap)
  worldWall(plan, CANTONMENT[0], CANTONMENT[6], 2.3, wall, cap)
  worldWall(plan, CANTONMENT[6], CANTONMENT[5], 2.3, wall, cap)

  // The gate arch over Turner Road.
  const turner = roadById("turner")
  const gateS = 1205
  const { d } = along(turner.points, gateS)
  const g = new Site(plan, CANTT_GATE, d)
  g.piece(0, 0, (k) => {
    const { b } = k
    for (const z of [-7, 7]) {
      b.box(0, 0, z, 1.8, 6.4, 1.8, 0xe9dcc0)
      b.box(0, 6.4, z, 2.2, 0.4, 2.2, 0x9a3b2f)
      b.box(0, 0, z, 2.0, 0.6, 2.0, 0x6d6a60)
    }
    b.box(0, 6.0, 0, 1.2, 1.6, 15.8, 0x2d3a22)
  })
  // The board faces traffic arriving from the town (local −x of the road frame).
  g.piece(-0.65, 0, (k) => board(k, "CLEMENT TOWN CANTT.", { bg: 0x2d3a22, fg: 0xf2c94c, big: true, sub: "छावनी क्षेत्र" }, 1.25, 6.15, 12.5), Math.PI / 2)
  g.round(0, -7, 1.1)
  g.round(0, 7, 1.1)
  // Sentry box and the raised boom.
  g.piece(-4, 9.6, (k) => {
    const { b } = k
    for (let i = 0; i < 4; i++) b.box(0, i * 0.6, 0, 1.5, 0.6, 1.5, i % 2 ? 0xffffff : 0xc0392b)
    b.box(0, 2.4, 0, 1.9, 0.15, 1.9, 0x2d3a22)
    b.hip(0, 2.55, 0, 1.9, 0.6, 1.9, 0x2d3a22)
    b.box(0, 1.0, -0.76, 0.8, 0.8, 0.04, GLASS)
  })
  g.solid(-4, 9.6, 1.6, 1.6)
  g.piece(-2.2, -5.6, (k) => {
    const { b } = k
    b.box(0, 0, 0, 0.5, 1.1, 0.5, 0x6d6a60)
    for (let i = 0; i < 6; i++) b.box(0, 1.1 + i * 0.9, 0, 0.16, 0.9, 0.16, i % 2 ? 0xffffff : 0xc0392b)
  })
  g.piece(-14, 7.5, (k) => {
    k.b.box(0, 0, 0, 0.1, 1.6, 0.1, 0x555555)
    board(k, "SPEED LIMIT 20", { bg: 0xffffff, fg: 0xc0392b, border: 0xc0392b }, 0.5, 1.6, 2.6)
  }, Math.PI / 2)

  // Avenue trees, trunks painted white, the length of Turner Road inside.
  const L = lengthOf(turner.points)
  for (let s = gateS + 18; s < L - 8; s += 13) {
    for (const side of [-1, 1]) {
      const { p, d: dd } = along(turner.points, s)
      const at = add(p, scale(right(dd), side * (turner.width / 2 + 3)))
      if (inside(CANTONMENT, at)) treeAt(plan, at, r.chance(0.6) ? "ashoka" : "sal", 1, true)
    }
  }

  // The parade ground with its flag and dais.
  const parade = beside("turner", 1470, -95)
  const pg = new Site(plan, parade.p, parade.d)
  plan.zones.push({ kind: "parade", poly: pg.rect(0, 0, 130, 80) })
  plan.reserve(makeBox(parade.p[0], parade.p[1], 136, 86, parade.d[0], parade.d[1]))
  pg.piece(0, 44, (k) => {
    const { b } = k
    b.box(0, 0, 0, 14, 0.8, 5, 0xe9dcc0)
    b.box(0, 0.8, 0.8, 12, 2.6, 0.2, 0x9a3b2f)
    for (const x of [-5.5, 5.5]) b.box(x, 0.8, -2, 0.25, 2.8, 0.25, 0xe9dcc0)
    b.box(0, 3.4, -0.2, 14, 0.2, 5, 0x2d3a22)
  }, Math.PI)
  pg.solid(0, 44, 14, 5)
  pg.piece(0, 32, (k) => {
    const { b } = k
    b.cyl(0, 0, 0, 1.4, 1.2, 0.6, 0xe9dcc0, 8)
    b.cyl(0, 0.6, 0, 0.08, 0.06, 13, 0xdedede, 6)
    b.sway = 0.5
    b.box(1.5, 12.5, 0, 2.8, 0.6, 0.04, 0xff9933)
    b.box(1.5, 11.9, 0, 2.8, 0.6, 0.04, 0xffffff)
    b.box(1.5, 11.3, 0, 2.8, 0.6, 0.04, 0x138808)
    b.sway = 0
  })
  pg.round(0, 32, 1.4)
  for (let x = -60; x <= 60; x += 6) {
    pg.piece(x, -40, (k) => k.b.box(0, 0, 0, 0.6, 0.3, 0.3, (x / 6) % 2 ? 0xffffff : 0xc0392b))
  }

  // Motor pool.
  const pool = beside("turner", 1700, -60)
  const mp = new Site(plan, pool.p, pool.d)
  plan.zones.push({ kind: "courtyard", poly: mp.rect(0, 0, 60, 34) })
  for (let i = 0; i < 6; i++) {
    const x = -24 + i * 9.5
    mp.piece(x, 4, (k) => armyTruck(k), Math.PI / 2)
    mp.solid(x, 4, 2.6, 8)
  }
  mp.piece(0, 15, (k) => {
    const { b } = k
    b.box(0, 0, 0, 56, 0.3, 6, 0x9a9184)
    for (let x = -27; x <= 27; x += 9) b.box(x, 0.3, 2.6, 0.3, 4.5, 0.3, 0x6d7278)
    b.box(0, 4.8, 0, 58, 0.15, 7, 0x4b5a2e)
  })
  plan.reserve(makeBox(pool.p[0], pool.p[1], 64, 40, pool.d[0], pool.d[1]))

  // Barracks, bungalows and trees fill the rest.
  const u = norm(d)
  const v = right(u)
  const base = CANTT_GATE
  for (let a = 30; a < 1100; a += 42) {
    for (let b = -520; b < 520; b += 34) {
      const p: Vec2 = add(base, add(scale(u, a + range(r, -4, 4)), scale(v, b + range(r, -4, 4))))
      if (!inside(CANTONMENT, p)) continue
      if (plan.nearestRoad(p).dist < 16) continue
      if (inLake(p, 34)) continue
      const roll = r.next()
      if (roll < 0.38) {
        const w = range(r, 32, 44)
        const foot = makeBox(p[0], p[1], w + 6, 16, u[0], u[1])
        if (!plan.taken.hits(foot)) {
          plan.solid(boxYaw(p[0], p[1], w, 10, yawOf(u)))
          plan.add(p[0], p[1], (k) => place(k, p[0], p[1], yawOf(u), () => barrack(k, w)))
          continue
        }
      } else if (roll < 0.62) {
        const foot = makeBox(p[0], p[1], 20, 20, u[0], u[1])
        if (!plan.taken.hits(foot)) {
          plan.solid(boxYaw(p[0], p[1], 14, 11, yawOf(u)))
          const wall = r.pick([0xf4efe6, 0xe9dcc0, 0xf2e3c6])
          plan.add(p[0], p[1], (k) => place(k, p[0], p[1], yawOf(u), () => bungalow(k, wall)))
          continue
        }
      }
      for (let i = 0; i < r.int(2, 4); i++) {
        treeAt(plan, add(p, [range(r, -12, 12), range(r, -12, 12)]), r.pick(["sal", "sal", "mango", "eucalyptus"]), 1, r.chance(0.3))
      }
    }
  }
}

/** A long single-storey barrack with a red tin roof and a veranda. */
function barrack(k: Kit, w: number) {
  const { b, r } = k
  b.box(0, 0, 0, w + 0.4, 0.5, 10.4, 0x8f877a)
  b.box(0, 0.5, 0.8, w, 3.2, 7, 0xf2e3c6)
  b.box(0, 0.5, -3.2, w, 0.12, 2.6, 0xb9b2a5)
  for (let x = -w / 2 + 0.4; x <= w / 2; x += 3) b.box(x, 0.5, -4.3, 0.3, 3.2, 0.3, 0xffffff)
  for (let x = -w / 2 + 2; x < w / 2 - 1; x += 4) {
    windowAt(k, x, 1.4, -2.7, 1.1, 1.3, 0.5)
    b.box(x + 2, 0.5, -2.74, 1.0, 2.2, 0.08, 0x2f4a3a)
  }
  b.box(0, 3.7, 0, w + 0.6, 0.15, 10.4, 0xb9b2a5)
  b.gable(0, 3.85, 0, w + 1.2, 2.2, 11.2, 0xa4432e, 0xf2e3c6)
  board(k, `UNIT ${r.int(1, 9)}${r.pick(["A", "B", "C"])}`, { bg: 0x2d3a22, fg: 0xffffff }, 0.45, 3.0, 3)
}

/** A colonial officers' bungalow: hipped roof, white veranda posts, a hedge. */
function bungalow(k: Kit, wall: number) {
  const { b } = k
  b.box(0, 0, 0, 14.4, 0.6, 11.4, 0x8f877a)
  b.box(0, 0.6, 1, 13, 3.6, 9, wall)
  b.box(0, 0.6, -4.5, 13, 0.12, 2, 0xb9b2a5)
  for (const x of [-6.2, -2, 2, 6.2]) b.box(x, 0.6, -5.3, 0.35, 3.6, 0.35, 0xffffff)
  for (const x of [-4.5, 4.5]) windowAt(k, x, 1.6, -3.5, 1.3, 1.6, 0.5)
  b.box(0, 0.6, -3.56, 1.3, 2.4, 0.08, 0x5a3a24)
  b.box(0, 4.2, 0, 14.6, 0.15, 11.6, 0xd8d2c4)
  b.hip(0, 4.35, 0, 15.2, 2.8, 12.2, 0x3f6b4a, 4)
  b.box(4, 4.6, 2, 0.8, 2.2, 0.8, 0xa4432e)
  b.sway = 0.3
  for (let x = -7; x <= 7; x += 1.4) b.box(x, 0, -8.2, 1.4, 1.0, 0.8, 0x356b30)
  b.sway = 0
}

// ── the lake ────────────────────────────────────────────────────────────────

let lakePoly: Polygon = []

function inLake(p: Vec2, margin: number) {
  const dx = p[0] - LAKE.centre[0]
  const dz = p[1] - LAKE.centre[1]
  const lx = dx * LAKE.dir[0] + dz * LAKE.dir[1]
  const lz = dx * right(LAKE.dir)[0] + dz * right(LAKE.dir)[1]
  return (lx / (LAKE.rx + margin)) ** 2 + (lz / (LAKE.rz + margin)) ** 2 < 1
}

function lakeShape(grow: number, phase: number[]): Polygon {
  const n = 32
  const v = right(LAKE.dir)
  const out: Polygon = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const k = 1 + 0.07 * Math.sin(3 * a + phase[0]) + 0.05 * Math.sin(5 * a + phase[1])
    const x = Math.cos(a) * (LAKE.rx * k + grow)
    const z = Math.sin(a) * (LAKE.rz * k + grow)
    out.push(add(LAKE.centre, add(scale(LAKE.dir, x), scale(v, z))))
  }
  return out
}

function lake(plan: Plan, r: Rng) {
  const phase = [r.next() * 6, r.next() * 6]
  const water = lakeShape(0, phase)
  lakePoly = water
  plan.water.push(water)
  plan.collision.addPolygon(lakeShape(-1.2, phase))
  plan.zones.push({ kind: "path", poly: lakeShape(6.5, phase) })
  plan.zones.push({ kind: "lawn", poly: lakeShape(22, phase) })
  plan.reserve(makeBox(LAKE.centre[0], LAKE.centre[1], LAKE.rx * 2 + 30, LAKE.rz * 2 + 30, LAKE.dir[0], LAKE.dir[1]))

  const v = right(LAKE.dir)
  const n = water.length
  // Stone edge, railings on every other stretch, benches, lamps, trees.
  const friendI = Math.round(n * 0.75) // the shore nearest the road (−v side)
  for (let i = 0; i < n; i++) {
    const a = water[i]
    const b = water[(i + 1) % n]
    const m: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    const dd = norm(sub(b, a))
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    const yaw = yawOf(dd)
    // Outward: whichever side of the edge faces away from the centre.
    const out0 = right(dd)
    const toC = sub(LAKE.centre, m)
    const outward: Vec2 = out0[0] * toC[0] + out0[1] * toC[1] > 0 ? [-out0[0], -out0[1]] : out0
    plan.add(m[0], m[1], (k) =>
      place(k, m[0], m[1], yaw, () => {
        k.b.box(0, -0.6, 0, L + 0.3, 0.75, 0.7, 0x9c968c)
      })
    )
    const edge = add(m, scale(outward, 0.9))
    if (i % 2 === 0 && Math.abs(i - friendI) > 1) {
      const ry = yawOf(dd)
      plan.add(edge[0], edge[1], (k) => place(k, edge[0], edge[1], ry, () => railing(k, L * 0.9, 0x2d4a3a, 0.9)))
    }
    // A bench facing the water, a park lamp beside it, trees behind.
    const seat = add(m, scale(outward, 3.6))
    const face: Vec2 = [-outward[0], -outward[1]]
    // Bench backs face away from the water: its local −z must point at the lake.
    const fy = yawOf([-face[1], face[0]])
    if (i % 3 === 0 || i === friendI) {
      plan.add(seat[0], seat[1], (k) => place(k, seat[0], seat[1], fy, () => bench(k)))
      plan.solid(boxYaw(seat[0], seat[1], 1.8, 0.6, fy))
      if (i === friendI) plan.marks.set("friend", { p: add(seat, scale(outward, 0.15)), d: face })
    }
    if (i % 3 === 1) {
      const lp = add(m, scale(outward, 5.6))
      plan.add(lp[0], lp[1], (k) => place(k, lp[0], lp[1], 0, () => streetLamp(k, "park")))
      plan.round(lp[0], lp[1], 0.2)
      plan.lamp(lp[0], 3.4, lp[1])
    }
    for (let j = 0; j < 2; j++) {
      const tp = add(m, add(scale(outward, range(r, 11, 19)), scale(dd, range(r, -6, 6))))
      if (inside(CANTONMENT, tp) && plan.nearestRoad(tp).dist > 3) {
        const t = r.chance(0.45) ? "eucalyptus" : r.chance(0.5) ? "sal" : "mango"
        plan.round(tp[0], tp[1], 0.45)
        plan.add(tp[0], tp[1], (k) => tree(k, tp[0], tp[1], t))
      }
    }
  }

  // The fountain in the middle, lotus pads near the west shore.
  plan.marks.set("fountain", { p: LAKE.centre, d: LAKE.dir })
  plan.add(LAKE.centre[0], LAKE.centre[1], (k) =>
    place(k, LAKE.centre[0], LAKE.centre[1], 0, () => {
      k.b.cyl(0, -0.8, 0, 2.6, 2.4, 0.9, 0x8f877a, 12)
      k.b.cyl(0, 0.1, 0, 0.7, 0.5, 0.7, 0xb9b2a5, 8)
      k.b.glow = lin(0x80d0ff).map((v) => v * 1.4) as [number, number, number]
      k.b.cyl(0, 0.05, 0, 2.2, 2.2, 0.02, 0x5aa8d8, 12)
      k.b.glow = null
    })
  )
  for (let i = 0; i < 26; i++) {
    const p = add(LAKE.centre, add(scale(LAKE.dir, range(r, -LAKE.rx * 0.8, -LAKE.rx * 0.45)), scale(v, range(r, -26, 26))))
    plan.add(p[0], p[1], (k) =>
      place(k, p[0], p[1], 0, () => {
        k.b.cyl(0, -0.33, 0, 0.6 + (i % 3) * 0.15, 0.6 + (i % 3) * 0.15, 0.04, i % 2 ? 0x3d7a3a : 0x4a8a3e, 7)
        if (i % 3 === 0) k.b.ball(0.15, -0.15, 0.1, 0.22, 0xf06292, 5, 3, 0.8)
      })
    )
  }
  // A small pavilion on the far shore.
  const gz = add(LAKE.centre, add(scale(LAKE.dir, LAKE.rx + 12), scale(v, 6)))
  plan.add(gz[0], gz[1], (k) =>
    place(k, gz[0], gz[1], 0, () => {
      k.b.cyl(0, 0, 0, 4.2, 4.2, 0.5, 0xb9b2a5, 6)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6
        k.b.box(Math.cos(a) * 3.5, 0.5, Math.sin(a) * 3.5, 0.3, 2.8, 0.3, 0xffffff)
      }
      k.b.cyl(0, 3.3, 0, 4.6, 0.3, 2.2, 0xa4432e, 6)
    })
  )
  plan.round(gz[0], gz[1], 4.2)
  // The name, by the path from the road.
  const sp = add(LAKE.centre, scale(v, -(LAKE.rz + 16)))
  const sy = yawOf(LAKE.dir)
  plan.add(sp[0], sp[1], (k) =>
    place(k, sp[0], sp[1], sy, () => {
      for (const x of [-1.6, 1.6]) k.b.box(x, 0, 0.08, 0.12, 2.2, 0.12, 0x5a3a24)
      board(k, "CLEMENT TOWN LAKE", { bg: 0x2d4a3a, fg: 0xfff1c8, border: 0xf2c94c }, 0.7, 1.4, 4)
    })
  )
  plan.round(sp[0], sp[1], 1.4)
  plan.spots.push({ id: "ducks", at: add(LAKE.centre, scale(LAKE.dir, -LAKE.rx - 4)), radius: 5, label: "The ducks", verb: "Feed the ducks" })
}

// ── Mindrolling Monastery ───────────────────────────────────────────────────

const MAROON = 0x6b1a1a
const GOLD = 0xd4a017
const WHITE = 0xf7f3ea

function monastery(plan: Plan, r: Rng) {
  const s = new Site(plan, MONASTERY.centre, [1, 0])
  const HW = MONASTERY.w / 2
  const HH = MONASTERY.h / 2
  plan.zones.push({ kind: "monastery", poly: s.rect(0, 0, MONASTERY.w, MONASTERY.h) })
  plan.zones.push({ kind: "courtyard", poly: s.rect(MONASTERY.gate[0] - MONASTERY.centre[0], -98, 10, 74) })
  plan.zones.push({ kind: "courtyard", poly: s.rect(0, 30, 70, 70) })
  plan.zones.push({ kind: "courtyard", poly: s.rect(60, -30, 40, 36) })

  // Walls, with the gate on the north side where Buddha Temple Road arrives.
  const gx = MONASTERY.gate[0] - MONASTERY.centre[0]
  s.wall([-HW, -HH], [gx - 8, -HH], 3, WHITE, MAROON)
  s.wall([gx + 8, -HH], [HW, -HH], 3, WHITE, MAROON)
  s.wall([-HW, -HH], [-HW, HH], 3, WHITE, MAROON)
  s.wall([HW, -HH], [HW, HH], 3, WHITE, MAROON)
  s.wall([-HW, HH], [HW, HH], 3, WHITE, MAROON)

  s.piece(gx, -HH, (k) => {
    const { b } = k
    for (const x of [-6.5, -2.6, 2.6, 6.5]) {
      b.box(x, 0, 0, 0.9, 6.5, 0.9, 0xb3261e)
      b.box(x, 0, 0, 1.2, 0.5, 1.2, WHITE)
    }
    b.box(0, 6.5, 0, 15.5, 0.5, 2.2, 0xf2c94c)
    b.box(0, 7.0, 0, 15.5, 0.4, 2.2, 0x27ae60)
    b.box(0, 7.4, 0, 15.5, 0.4, 2.2, 0x2f80ed)
    b.box(0, 7.8, 0, 16.5, 0.3, 3.0, 0xb3261e)
    b.hip(0, 8.1, 0, 17, 2.6, 3.8, 0x2e7d4f, 9)
    b.cyl(0, 10.7, 0, 0.35, 0.1, 1.2, GOLD, 6)
    b.ball(0, 11.9, 0, 0.3, GOLD, 5, 3)
    board(k, "MINDROLLING MONASTERY", { bg: MAROON, fg: 0xf2c94c, sub: "मिंड्रोलिंग मठ" }, 1.0, 5.3, 7.8)
  })
  for (const x of [-6.5, -2.6, 2.6, 6.5]) s.round(gx + x, -HH, 0.6)

  // The path in: lamps and small chortens either side.
  for (let z = -120; z <= -12; z += 14) {
    for (const side of [-1, 1]) {
      const x = gx + side * 7
      s.piece(x, z, (k) => chorten(k))
      s.round(x, z, 1.2)
      if (z % 28 === 0) {
        s.piece(gx + side * 5, z + 7, (k) => streetLamp(k, "park"))
        s.lamp(gx + side * 5, 3.4, z + 7)
      }
    }
  }

  greatStupa(s)
  temple(s, r)

  // A seated Buddha in the garden.
  s.piece(-70, -50, (k) => {
    const { b } = k
    b.box(0, 0, 0, 9, 1.2, 9, 0xe9e2d0)
    b.cyl(0, 1.2, 0, 3.6, 3.6, 0.8, 0xf6c1d4, 10)
    b.cyl(0, 2.0, 0, 3.0, 3.4, 0.4, 0xf06292, 10)
    const gold = 0xe6b422
    b.ball(0, 2.9, 0, 2.6, gold, 8, 4, 0.42)
    b.cyl(0, 3.0, 0, 1.5, 1.15, 3.2, gold, 8)
    b.ball(0, 6.0, 0, 1.45, gold, 8, 4, 0.55)
    b.cyl(0, 6.2, 0, 0.45, 0.45, 0.9, gold, 8)
    b.ball(0, 7.6, 0, 1.0, gold, 8, 4)
    b.ball(0, 8.55, 0, 0.42, 0x2d2d30, 6, 3)
    b.box(0, 3.2, -1.3, 1.6, 0.4, 0.7, gold)
  }, Math.PI)
  s.solid(-70, -50, 9, 9)

  // A gallery of prayer wheels along the west wall.
  s.piece(-108, -10, (k) => {
    const { b } = k
    b.box(0, 0, 0, 4, 0.3, 46, 0xb9b2a5)
    b.box(1.6, 0.3, 0, 0.6, 3.2, 46, MAROON)
    for (let z = -21; z <= 21; z += 1.6) {
      b.cyl(0, 0.9, z, 0.45, 0.45, 1.2, 0xc0392b, 8)
      b.cyl(0, 1.0, z, 0.47, 0.47, 0.12, GOLD, 8)
      b.cyl(0, 1.9, z, 0.47, 0.47, 0.12, GOLD, 8)
    }
    b.box(0.6, 3.5, 0, 5, 0.2, 47, 0x2e7d4f)
    b.gable(0.6, 3.7, 0, 47, 1.2, 5, GOLD)
  }, Math.PI / 2)
  s.solid(-108, -10, 4, 46)
  s.spot("wheels", -104.5, -10, 6, "Prayer wheels", "Spin the prayer wheels")

  // Monks' quarters along the east and south walls.
  for (const [x, z, w, yaw] of [[100, 10, 60, -Math.PI / 2], [10, 115, 90, Math.PI]] as const) {
    s.piece(x, z, (k) => {
      const { b } = k
      b.box(0, 0, 0, w, 10.5, 12, 0xf2e3c6)
      b.box(0, 9.4, 0, w + 0.2, 1.1, 12.2, MAROON)
      for (let f = 0; f < 3; f++) {
        for (let xx = -w / 2 + 2; xx < w / 2 - 1; xx += 3.2) {
          windowAt(k, xx, f * 3.2 + 1.0, -6, 1.0, 1.4, 0.5)
          b.box(xx, f * 3.2 + 2.55, -6.1, 1.4, 0.25, 0.12, 0xf2c94c)
        }
      }
      b.box(0, 10.5, 0, w + 0.6, 0.3, 12.6, 0xb9b2a5)
    }, yaw)
    s.solid(x, z, w, 12, yaw)
  }

  // Garden trees and flowerbeds.
  for (let i = 0; i < 46; i++) {
    const x = range(r, -HW + 8, HW - 22)
    const z = range(r, -HH + 8, HH - 18)
    if (Math.abs(x - gx) < 14 && z < -10) continue
    if (Math.abs(x) < 34 && Math.abs(z - 30) < 34) continue
    if (Math.abs(x - 60) < 24 && Math.abs(z + 30) < 22) continue
    if (Math.abs(x + 70) < 8 && Math.abs(z + 50) < 8) continue
    if (x < -100) continue
    const p = s.w(x, z)
    if (!plan.taken.hits(makeBox(p[0], p[1], 2, 2))) {
      const kind = r.pick(["pine", "palm", "mango", "ashoka"] as const)
      plan.round(p[0], p[1], 0.45)
      plan.add(p[0], p[1], (k) => tree(k, p[0], p[1], kind))
    }
  }
  for (let i = 0; i < 18; i++) {
    const x = range(r, -HW + 10, HW - 24)
    const z = range(r, -HH + 10, HH - 20)
    if ((Math.abs(x - gx) < 12 && z < -8) || (Math.abs(x) < 36 && Math.abs(z - 30) < 36)) continue
    s.piece(x, z, (k) => {
      for (let j = 0; j < 5; j++) bush(k, (j - 2) * 1.1, 0, j % 2 ? 0xf2c94c : 0xe0559a, 0.55)
    })
  }

  // Flags strung from the stupa's spire.
  plan.marks.set("stupa", { p: s.w(0, -14), d: [0, 1] })
  s.spot("stupa", 0, -14, 6, "The Great Stupa", "Walk the kora")
}

/** The Great Stupa: four white tiers, a dome, a gold spire of thirteen rings, about 52 m. */
function greatStupa(s: Site) {
  s.piece(0, 30, (k) => {
    const { b } = k
    const tiers: [number, number][] = [[40, 6], [33, 6], [27, 6], [21, 5]]
    let y = 0
    b.box(0, 0, 0, 46, 0.6, 46, 0xd8d2c4)
    y = 0.6
    const outline = lin(0xffd27a).map((v) => v * 2.2) as [number, number, number]
    for (const [w, h] of tiers) {
      b.box(0, y, 0, w, h, w, WHITE)
      b.box(0, y + h - 0.9, 0, w + 0.1, 0.7, w + 0.1, MAROON)
      b.box(0, y + h - 0.2, 0, w + 0.5, 0.2, w + 0.5, GOLD)
      // Windows on every face, lit at night.
      for (let side = 0; side < 4; side++) {
        b.at(0, 0, 0, (side * Math.PI) / 2, () => {
          for (let x = -w / 2 + 3; x <= w / 2 - 3; x += 3.4) {
            b.glow = WARM
            b.box(x, y + 1.4, -w / 2 - 0.03, 1.2, 2.2, 0.08, 0x3a2a20)
            b.glow = null
            b.box(x, y + 3.7, -w / 2 - 0.1, 1.6, 0.3, 0.2, GOLD)
          }
          // A string of lights along the edge.
          b.glow = outline
          for (let x = -w / 2; x <= w / 2; x += 1.6) b.box(x, y + h + 0.05, -w / 2 - 0.25, 0.18, 0.18, 0.18, 0xfff1c8)
          b.glow = null
        })
      }
      y += h
    }
    // Steps up the north face.
    for (let i = 0; i < 6; i++) b.box(0, i * 1.0, -21.5 - (5 - i) * 0.9, 6, 1.0, 1.0, 0xd8d2c4)
    b.cyl(0, y, 0, 9.5, 9.5, 2, WHITE, 16)
    b.box(0, y + 1.7, 0, 0.1, 0.1, 0.1, WHITE)
    b.ball(0, y + 2, 0, 9, WHITE, 16, 8)
    b.cyl(0, y + 2.2, 0, 9.6, 9.6, 0.4, GOLD, 16)
    y += 11
    b.box(0, y - 0.5, 0, 5.4, 3.4, 5.4, 0xe0b040)
    b.box(0, y + 2.9, 0, 6, 0.4, 6, GOLD)
    y += 3.3
    for (let i = 0; i < 13; i++) {
      const r0 = 2.6 - i * 0.13
      b.cyl(0, y + i * 0.92, 0, r0, r0 - 0.1, 0.92, i % 2 ? GOLD : 0xb8860b, 10)
    }
    y += 13 * 0.92
    b.cyl(0, y, 0, 2.6, 2.2, 0.6, GOLD, 12)
    b.cyl(0, y + 0.6, 0, 0.4, 0.3, 1.4, GOLD, 8)
    b.ball(0, y + 2.4, 0, 0.6, GOLD, 6, 4)
    b.glow = outline
    b.ball(0, y + 3.4, 0, 0.35, 0xfff1c8, 5, 3)
    b.glow = null

    // Prayer flags from below the spire to the plaza's edge.
    const top = y - 6
    const colours = [0x2f80ed, 0xffffff, 0xc0392b, 0x27ae60, 0xf2c94c]
    b.sway = 0.7
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8
      const ax = Math.cos(a) * 34
      const az = Math.sin(a) * 34
      const len = Math.hypot(ax, az, top)
      const n = Math.floor(len / 1.3)
      for (let j = 1; j < n; j++) {
        const t = j / n
        const sag = Math.sin(t * Math.PI) * 3.2
        const fx = ax * t
        const fz = az * t
        const fy = top * (1 - t) + 2.2 * t - sag
        b.at(fx, fy, fz, -a, () => b.quadL([[0, 0, -0.32], [0, 0, 0.32], [0, -0.75, 0.32], [0, -0.75, -0.32]], colours[j % 5]))
        b.at(fx, fy, fz, -a + Math.PI, () => b.quadL([[0, 0, -0.32], [0, 0, 0.32], [0, -0.75, 0.32], [0, -0.75, -0.32]], colours[j % 5]))
      }
    }
    b.sway = 0
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8
      b.cyl(Math.cos(a) * 34, 0, Math.sin(a) * 34, 0.1, 0.08, 2.4, 0x5a3a24, 5)
    }
  })
  s.solid(0, 30, 40, 40)
  s.solid(0, 30 - 23, 6, 6)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    s.round(Math.cos(a) * 34, 30 + Math.sin(a) * 34, 0.2)
  }
  s.lamp(0, 24, 30)
}

/** The main temple: three floors, a maroon frieze, a gold roof, the Dharma wheel with its deer. */
function temple(s: Site, r: Rng) {
  s.piece(60, -30, (k) => {
    const { b } = k
    b.box(0, 0, 0, 34, 1.2, 28, 0xd8d2c4)
    b.box(0, 1.2, 0, 30, 14, 24, 0xf2e3c6)
    b.box(0, 13.2, 0, 30.2, 2, 24.2, MAROON)
    for (let f = 0; f < 3; f++) {
      for (let z = -9; z <= 9; z += 4.5) {
        b.at(-15, 0, z, Math.PI / 2, () => {
          b.glow = r.chance(0.6) ? WARM : null
          b.box(0, f * 4 + 2.6, -0.04, 1.5, 2.2, 0.1, 0x2a1a14)
          b.glow = null
          b.box(0, f * 4 + 4.9, -0.12, 2.0, 0.3, 0.2, 0xf2c94c)
          b.box(0, f * 4 + 2.4, -0.1, 2.2, 0.2, 0.16, 0x1b1b1d)
        })
      }
    }
    // Entrance porch on the west, toward the path.
    b.box(-17.5, 1.2, 0, 5, 0.3, 12, 0xd8d2c4)
    for (const z of [-5, -1.7, 1.7, 5]) b.box(-19.6, 1.2, z, 0.7, 5, 0.7, 0xb3261e)
    b.box(-17.5, 6.2, 0, 5.4, 0.5, 12.4, 0xf2c94c)
    b.box(-17.5, 6.7, 0, 5.6, 0.4, 12.6, 0x27ae60)
    b.hip(-17.5, 7.1, 0, 6, 1.4, 13, GOLD, 6)
    for (let i = 0; i < 4; i++) b.box(-21.5 - i * 0.6, 0, 0, 0.6, 1.2 - i * 0.3, 8, 0xd8d2c4)
    // Gold roof pavilion.
    b.box(0, 15.2, 0, 14, 3.4, 12, 0xf2e3c6)
    b.box(0, 18.2, 0, 14.4, 0.6, 12.4, MAROON)
    b.hip(0, 18.8, 0, 16, 3.2, 14, GOLD, 4)
    b.cyl(0, 22, 0, 0.5, 0.2, 1.8, GOLD, 8)
    for (const [x, z] of [[-14.5, -11.5], [14.5, -11.5], [-14.5, 11.5], [14.5, 11.5]]) b.cyl(x, 15.2, z, 0.5, 0.5, 1.8, GOLD, 8)
    // Dharma wheel between two deer on the west parapet.
    b.at(-15.2, 0, 0, Math.PI / 2, () => {
      disc(k, 0, 17.2, -0.2, 1.3, GOLD, 12)
      disc(k, 0, 17.2, -0.25, 0.5, 0xb8860b, 8)
      for (const x of [-2, 2]) {
        b.box(x, 15.2, -0.3, 1.2, 0.8, 0.6, GOLD)
        b.box(x * 1.2, 16.0, -0.3, 0.4, 0.6, 0.4, GOLD)
      }
    })
  })
  s.solid(60, -30, 34, 28)
  s.spot("temple", 38, -30, 5, "Mindrolling main temple", "Look inside")
}

/** A small white chorten with a gold tip. */
function chorten(k: Kit) {
  const { b } = k
  b.box(0, 0, 0, 2.2, 0.6, 2.2, WHITE)
  b.box(0, 0.6, 0, 1.7, 0.5, 1.7, WHITE)
  b.cyl(0, 1.1, 0, 0.8, 0.95, 0.5, WHITE, 8)
  b.ball(0, 1.6, 0, 0.75, WHITE, 8, 4)
  b.box(0, 2.2, 0, 0.6, 0.35, 0.6, GOLD)
  b.cyl(0, 2.55, 0, 0.3, 0.08, 1.0, GOLD, 6)
}

export const lakeOutline = () => lakePoly
