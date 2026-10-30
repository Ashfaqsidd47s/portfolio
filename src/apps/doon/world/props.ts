import type { createRng } from "@/os/kernel/rng"
import { lin, type Builder } from "../kit/builder"
import type { Signs, SignStyle } from "../kit/signs"

/**
 * The town's parts, built from boxes in a local frame where the front of a
 * building faces local −z (toward its road). Everything draws into `k.b`;
 * sign faces draw into `k.s`, which is textured from the sign atlas.
 */

export type Rng = ReturnType<typeof createRng>

export type Kit = { b: Builder; s: Builder; signs: Signs; r: Rng }

export const range = (r: Rng, a: number, b: number) => a + r.next() * (b - a)

// ── palette ─────────────────────────────────────────────────────────────────

export const WALLS = [
  0xf1e4c6, 0xf3d5c2, 0xe8c3c4, 0xd6e5c4, 0xcadff0, 0xf2df8c, 0xe8b27f, 0xfbf7ef, 0xd9d0bf, 0xc5d9a8, 0xeac1a0, 0xb9d3d6,
  0xf0c8de, 0xe3dcc0,
]
const TRIM = [0xffffff, 0x7d5a4a, 0x5b6b4a, 0x9a3b2f, 0x3c5c7a]
const TIN = [0xa4432e, 0x3f6b4a, 0x7c8189, 0x2f5878]
export const GLASS = 0x2a3446
const CONCRETE = 0xb9b2a5
const TANK = 0x1e1f22
const CLOTHES = [0xd2347a, 0xf2c94c, 0x2f80ed, 0xffffff, 0xeb5757, 0x27ae60, 0x9b51e0, 0xf2994a]
/** Warm window light (linear). */
export const WARM = lin(0xffb860).map((v) => v * 1.6) as [number, number, number]
const LAMP_LIGHT = lin(0xffd08a).map((v) => v * 2.6) as [number, number, number]
const NEON = lin(0xd8f2ff).map((v) => v * 2.2) as [number, number, number]

/** A window: glass, a sill, a little sunshade, maybe lit at night. */
export function windowAt(k: Kit, x: number, y: number, z: number, w = 1.1, h = 1.25, lit = 0.5) {
  const { b, r } = k
  b.box(x, y - 0.08, z - 0.08, w + 0.2, 0.08, 0.22, 0xe9e3d6)
  b.box(x, y + h + 0.12, z - 0.22, w + 0.4, 0.08, 0.5, CONCRETE)
  if (r.chance(lit)) b.glow = r.chance(0.2) ? NEON : WARM
  b.box(x, y, z - 0.03, w, h, 0.08, GLASS)
  b.glow = null
  b.box(x, y + h * 0.45, z - 0.08, w, 0.06, 0.04, 0xe9e3d6)
}

/** Windows along a face of length `len`, at height y, on plane z (facing −z). */
function windowRow(k: Kit, len: number, y: number, z: number, lit: number) {
  const n = Math.max(1, Math.floor((len - 1) / 2.8))
  const gap = len / n
  for (let i = 0; i < n; i++) windowAt(k, -len / 2 + gap * (i + 0.5), y, z, 1.1, 1.25, lit)
}

export type HouseOpts = {
  w: number
  d: number
  floors: number
  /** A shop on the ground floor with a board over it. */
  shop?: { name: string; style: SignStyle; open?: boolean } | null
  /** A compound wall and gate in front, `yard` metres deep. */
  yard?: number
  wall?: number
  pitched?: boolean
}

/** A Doon house or shop-house: plastered box, floor bands, sunshades, a roof with a black water tank. */
export function house(k: Kit, o: HouseOpts) {
  const { b, r } = k
  const { w, d, floors } = o
  const H = 3.05
  const wall = o.wall ?? r.pick(WALLS)
  const trim = r.pick(TRIM)
  const top = floors * H
  b.jitter = 0.06
  b.box(0, 0, 0, w + 0.2, 0.35, d + 0.2, 0x8f877a)
  b.box(0, 0.35, 0, w, top - 0.35, d, wall)
  b.jitter = 0

  for (let f = 1; f < floors; f++) b.box(0, f * H - 0.12, 0, w + 0.24, 0.2, d + 0.24, trim === 0xffffff ? 0xece6da : CONCRETE)

  const zf = -d / 2
  for (let f = 0; f < floors; f++) {
    const y = f * H + 1.05
    if (f === 0 && o.shop) continue
    windowRow(k, w, y, zf, 0.55)
    // Side windows, sparser.
    if (d > 7 && r.chance(0.7)) {
      b.at(w / 2, 0, 0, Math.PI / 2, () => windowAt(k, 0, y, 0, 1, 1.2, 0.4))
      b.at(-w / 2, 0, 0, -Math.PI / 2, () => windowAt(k, r.chance(0.5) ? 1.5 : -1.5, y, 0, 1, 1.2, 0.4))
    }
    if (f > 0 && r.chance(0.45)) balcony(k, w, f * H, zf)
  }

  if (o.shop) shopFront(k, w, zf, o.shop)
  else door(k, r.chance(0.5) ? -w / 4 : w / 4, zf)

  if (o.pitched) {
    const tin = r.pick(TIN)
    b.box(0, top, 0, w + 0.3, 0.12, d + 0.3, CONCRETE)
    if (w >= d) b.gable(0, top + 0.12, 0, w + 0.8, Math.min(2.6, d * 0.32), d + 0.9, tin, wall)
    else b.at(0, 0, 0, Math.PI / 2, () => b.gable(0, top + 0.12, 0, d + 0.8, Math.min(2.6, w * 0.32), w + 0.9, tin, wall))
  } else {
    roof(k, w, d, top, wall)
  }

  if (o.yard) frontWall(k, w + 1.2, zf - o.yard, wall)
}

function door(k: Kit, x: number, zf: number) {
  const { b, r } = k
  b.box(x, 0.35, zf - 0.04, 1.1, 2.15, 0.1, r.pick([0x6b3e26, 0x2f4f3a, 0x8a5a2b, 0x3b4b6b]))
  b.box(x, 2.6, zf - 0.3, 1.6, 0.08, 0.6, CONCRETE)
  b.box(x, 0, zf - 0.6, 1.6, 0.35, 1.2, 0x9a9184)
}

function balcony(k: Kit, w: number, y: number, zf: number) {
  const { b, r } = k
  const bw = Math.min(w - 1, range(r, 2.4, 4.2))
  const x = range(r, -(w - bw) / 2, (w - bw) / 2)
  b.box(x, y - 0.1, zf - 0.55, bw, 0.14, 1.1, CONCRETE)
  const rail = r.pick([0x2d2d30, 0xe9e3d6, 0x3f6b4a, 0x7a2a22])
  b.box(x, y + 0.9, zf - 1.07, bw, 0.06, 0.06, rail)
  for (let i = 0; i <= Math.floor(bw / 0.45); i++) b.box(x - bw / 2 + i * (bw / Math.floor(bw / 0.45)), y, zf - 1.07, 0.04, 0.9, 0.04, rail)
  if (r.chance(0.35)) b.box(x + bw / 2 - 0.4, y, zf - 0.45, 0.32, 0.3, 0.32, 0xa0522d) // a pot
  if (r.chance(0.4)) {
    b.sway = 0.4
    b.ball(x + bw / 2 - 0.4, y + 0.55, zf - 0.45, 0.32, 0x3f7a3a, 5, 3)
    b.sway = 0
  }
}

/** Flat roof: parapet, stair tower, black tank, and sometimes washing or rebar. */
function roof(k: Kit, w: number, d: number, top: number, wall: number) {
  const { b, r } = k
  const ph = 0.9
  b.box(0, top, 0, w, 0.05, d, CONCRETE)
  b.box(0, top, -d / 2 + 0.1, w, ph, 0.2, wall)
  b.box(0, top, d / 2 - 0.1, w, ph, 0.2, wall)
  b.box(-w / 2 + 0.1, top, 0, 0.2, ph, d - 0.4, wall)
  b.box(w / 2 - 0.1, top, 0, 0.2, ph, d - 0.4, wall)
  // Stair tower ("mumty") in a back corner.
  const sx = (w / 2 - 1.7) * (r.chance(0.5) ? 1 : -1)
  b.box(sx, top, d / 2 - 1.6, 2.8, 2.6, 2.8, wall)
  b.box(sx, top + 2.6, d / 2 - 1.6, 3.2, 0.12, 3.2, CONCRETE)
  b.box(sx, top, d / 2 - 3.02, 0.9, 2.0, 0.06, 0x5a4636)
  // The black Sintex tank.
  const tx = sx + (r.chance(0.5) ? 0 : 0.4)
  b.cyl(tx, top + 2.72, d / 2 - 1.6, 0.62, 0.62, 1.15, TANK, 8)
  b.cyl(tx, top + 3.87, d / 2 - 1.6, 0.62, 0.15, 0.18, TANK, 8)
  if (r.chance(0.35)) b.cyl(-sx * 0.5, top + 0.05, -d / 4, 0.5, 0.5, 0.95, r.chance(0.5) ? 0xdedede : TANK, 7)
  if (r.chance(0.3)) {
    // Rods left for the next floor.
    for (const [x, z] of [[-w / 2 + 0.3, -d / 2 + 0.3], [w / 2 - 0.3, -d / 2 + 0.3], [-w / 2 + 0.3, 0]]) {
      b.box(x, top + ph, z, 0.05, 1.1, 0.05, 0x6b4a3a)
    }
  }
  if (r.chance(0.45)) {
    // Washing line.
    const z = range(r, -d / 4, d / 6)
    b.box(-w / 2 + 1, top, z, 0.06, 1.7, 0.06, 0x555555)
    b.box(w / 2 - 1, top, z, 0.06, 1.7, 0.06, 0x555555)
    b.box(0, top + 1.65, z, w - 2, 0.02, 0.02, 0xdddddd)
    const n = Math.floor((w - 2.4) / 0.8)
    b.sway = 0.25
    for (let i = 0; i < n; i++) {
      if (r.chance(0.3)) continue
      b.box(-w / 2 + 1.5 + i * 0.8, top + 0.95 + r.next() * 0.2, z, 0.55, 0.7 - r.next() * 0.2, 0.03, r.pick(CLOTHES))
    }
    b.sway = 0
  }
  if (r.chance(0.25)) {
    b.cyl(-sx * 0.6, top + ph, d / 2 - 1, 0.04, 0.04, 0.6, 0x777777, 4, false)
    b.at(-sx * 0.6, top + ph + 0.6, d / 2 - 1, 0.4, () => b.cyl(0, 0, 0, 0.42, 0.1, 0.2, 0xdedede, 7))
  }
}

/** The ground-floor shop: a counter, goods, an awning and a board. */
function shopFront(k: Kit, w: number, zf: number, shop: NonNullable<HouseOpts["shop"]>) {
  const { b, s, r, signs } = k
  const sw = w - 0.6
  if (shop.open === false) {
    // Rolling shutter, pulled down.
    b.box(0, 0.35, zf - 0.05, sw, 2.5, 0.1, 0x8f949a)
    for (let y = 0.6; y < 2.8; y += 0.3) b.box(0, y, zf - 0.11, sw, 0.04, 0.02, 0x6d7278)
  } else {
    b.box(0, 0.35, zf - 0.02, sw, 2.55, 0.06, 0x2a2420)
    b.glow = WARM
    b.box(0, 2.62, zf - 0.08, sw * 0.8, 0.08, 0.08, 0xffe8b0) // tube light
    b.glow = null
    b.box(0, 0.35, zf - 0.55, sw - 0.4, 0.95, 0.8, r.pick([0xd9d2c3, 0x8a6a4a, 0xbfc7cf]))
    // Goods on the counter and racks inside.
    for (let i = 0; i < Math.floor(sw / 0.5); i++) {
      if (r.chance(0.35)) continue
      b.box(-sw / 2 + 0.45 + i * 0.5, 1.3, zf - 0.55, 0.35, range(r, 0.15, 0.4), 0.35, r.pick(CLOTHES))
    }
  }
  // Awning, sloping down to the street.
  const aw = r.pick([0x2f80ed, 0xeb5757, 0x27ae60, 0xf2994a, 0x8e44ad, 0x16a085])
  b.quadL([[-w / 2, 2.6, zf - 1.3], [w / 2, 2.6, zf - 1.3], [w / 2, 3.05, zf], [-w / 2, 3.05, zf]], aw)
  b.quadL([[w / 2, 2.6, zf - 1.3], [-w / 2, 2.6, zf - 1.3], [-w / 2, 2.45, zf - 1.32], [w / 2, 2.45, zf - 1.32]], 0xffffff)
  // The board.
  const sign = signs.get(shop.name, shop.style)
  const bh = Math.min(0.95, (sw - 0.2) / sign.aspect)
  const bw = bh * sign.aspect
  b.box(0, 3.1, zf - 0.08, bw + 0.15, bh + 0.15, 0.12, shop.style.bg)
  s.sign(0, 3.17, zf - 0.15, bw, bh, sign.rect)
}

/** A compound wall `w` wide on plane z, with a gate in the middle. */
export function frontWall(k: Kit, w: number, z: number, colour: number) {
  const { b, r } = k
  const gate = 3.2
  const half = (w - gate) / 2
  b.box(-(gate + half) / 2, 0, z, half, 1.35, 0.25, colour)
  b.box((gate + half) / 2, 0, z, half, 1.35, 0.25, colour)
  b.box(-gate / 2 - 0.2, 0, z, 0.4, 1.7, 0.4, colour)
  b.box(gate / 2 + 0.2, 0, z, 0.4, 1.7, 0.4, colour)
  const g = r.pick([0x2d3a30, 0x1f1f22, 0x6b2a22, 0x2f4a6b])
  b.box(0, 0.05, z, gate, 1.4, 0.06, g)
  for (let x = -gate / 2 + 0.2; x < gate / 2; x += 0.3) b.box(x, 0.05, z - 0.04, 0.05, 1.4, 0.05, g)
  if (r.chance(0.5)) {
    // Bougainvillea spilling over the wall.
    b.sway = 0.5
    const x = (r.chance(0.5) ? -1 : 1) * (gate / 2 + half * 0.5)
    b.ball(x, 1.6, z + 0.2, 1.0, r.pick([0xd2347a, 0xe0559a, 0xf06292, 0xc2185b]), 6, 3, 0.7)
    b.ball(x + 0.6, 1.3, z + 0.3, 0.7, 0x3f7a3a, 5, 3)
    b.sway = 0
  }
}

// ── trees ───────────────────────────────────────────────────────────────────

export type TreeKind = "mango" | "sal" | "eucalyptus" | "ashoka" | "lychee" | "pine" | "palm" | "kachnar" | "jacaranda"

export function tree(k: Kit, x: number, z: number, kind: TreeKind, size = 1, paintedTrunk = false) {
  const { b, r } = k
  const s = size * range(r, 0.85, 1.15)
  const leafSway = 0.6
  b.push(x, 0, z, r.next() * Math.PI * 2)
  const trunk = kind === "eucalyptus" ? 0xd9d2bf : 0x6b4a32
  switch (kind) {
    case "mango":
    case "lychee": {
      b.cyl(0, 0, 0, 0.32 * s, 0.24 * s, 2.4 * s, trunk, 6)
      if (paintedTrunk) b.cyl(0, 0, 0, 0.34 * s, 0.34 * s, 1.0, 0xf4f1e8, 6, false)
      b.sway = leafSway
      const leaf = kind === "mango" ? r.pick([0x2e5a2c, 0x35662f, 0x2a5530]) : r.pick([0x3e7040, 0x467a3a])
      b.ball(0, 3.7 * s, 0, 2.4 * s, leaf, 7, 4, 0.75)
      b.ball(1.1 * s, 3.2 * s, 0.6 * s, 1.6 * s, leaf + 0x060a04, 6, 3, 0.8)
      b.ball(-1.0 * s, 3.4 * s, -0.7 * s, 1.5 * s, leaf, 6, 3, 0.8)
      b.ball(0.3 * s, 4.9 * s, 0.2 * s, 1.2 * s, kind === "mango" ? 0x4f8a3a : 0x5c9a44, 6, 3, 0.8)
      b.sway = 0
      break
    }
    case "kachnar":
    case "jacaranda": {
      // Kachnar (pink orchid tree) and jacaranda both flower along Doon's roads; here they're always in bloom.
      const bloom = kind === "kachnar" ? [0xf28cb8, 0xf7a8c8, 0xe86ea4] : [0xa98ce8, 0xbca2f2, 0x8f6fd8]
      b.cyl(0, 0, 0, 0.26 * s, 0.18 * s, 2.6 * s, 0x6b4a3a, 6)
      b.sway = leafSway
      b.ball(0, 3.9 * s, 0, 2.2 * s, bloom[0], 7, 4, 0.7)
      b.ball(1.2 * s, 3.5 * s, 0.4 * s, 1.4 * s, bloom[1], 6, 3, 0.8)
      b.ball(-1.1 * s, 3.6 * s, -0.5 * s, 1.4 * s, bloom[2], 6, 3, 0.8)
      b.ball(0.2 * s, 4.9 * s, 0.1 * s, 1.1 * s, bloom[1], 6, 3, 0.8)
      b.sway = 0
      break
    }
    case "sal": {
      b.cyl(0, 0, 0, 0.36 * s, 0.22 * s, 6 * s, trunk, 6)
      if (paintedTrunk) b.cyl(0, 0, 0, 0.38 * s, 0.38 * s, 1.0, 0xf4f1e8, 6, false)
      b.sway = leafSway
      b.ball(0, 7.2 * s, 0, 2.6 * s, 0x47723a, 7, 4, 0.9)
      b.ball(0.8 * s, 5.6 * s, 0.4 * s, 1.8 * s, 0x3f6a35, 6, 3)
      b.sway = 0
      break
    }
    case "eucalyptus": {
      b.cyl(0, 0, 0, 0.28 * s, 0.14 * s, 10 * s, trunk, 6)
      b.sway = leafSway * 1.3
      b.ball(0.3 * s, 10 * s, 0, 1.8 * s, 0x6f8f5e, 6, 4, 1.3)
      b.ball(-0.5 * s, 8.2 * s, 0.4 * s, 1.3 * s, 0x7a9a68, 5, 3, 1.2)
      b.sway = 0
      break
    }
    case "ashoka": {
      // The tall, columnar mast tree that lines every cantonment road.
      b.cyl(0, 0, 0, 0.18 * s, 0.1 * s, 2 * s, trunk, 5)
      if (paintedTrunk) b.cyl(0, 0, 0, 0.22 * s, 0.22 * s, 1.0, 0xf4f1e8, 5, false)
      b.sway = leafSway * 0.8
      b.cyl(0, 1.2 * s, 0, 0.9 * s, 0.05, 7.5 * s, r.pick([0x2b5a2c, 0x2f6330]), 7)
      b.sway = 0
      break
    }
    case "pine": {
      b.cyl(0, 0, 0, 0.25 * s, 0.15 * s, 2 * s, trunk, 5)
      b.sway = leafSway
      for (let i = 0; i < 3; i++) b.cyl(0, (1.6 + i * 1.6) * s, 0, (2 - i * 0.5) * s, 0.05, 2.6 * s, 0x2a4f3a, 7)
      b.sway = 0
      break
    }
    case "palm": {
      b.cyl(0, 0, 0, 0.22 * s, 0.18 * s, 5.5 * s, 0x8a7a5a, 6)
      b.sway = leafSway
      for (let i = 0; i < 6; i++) {
        b.at(0, 5.5 * s, 0, (i / 6) * Math.PI * 2, () => {
          b.quadL([[0, 0, -0.3], [2.6 * s, -0.9 * s, -0.25], [2.6 * s, -0.9 * s, 0.25], [0, 0, 0.3]], 0x4a8a3a)
          b.quadL([[0, 0, 0.3], [2.6 * s, -0.9 * s, 0.25], [2.6 * s, -0.9 * s, -0.25], [0, 0, -0.3]], 0x3a7a2e)
        })
      }
      b.sway = 0
      break
    }
  }
  b.pop()
}

export function bush(k: Kit, x: number, z: number, colour = 0x3f7a3a, size = 1) {
  k.b.sway = 0.35
  k.b.ball(x, 0.45 * size, z, 0.75 * size, colour, 6, 3, 0.7)
  k.b.sway = 0
}

// ── street furniture ────────────────────────────────────────────────────────

/** A street light on a pole, its arm reaching toward local −z (the road). */
export function streetLamp(k: Kit, kind: "street" | "park" | "mast" = "street") {
  const { b } = k
  if (kind === "park") {
    b.cyl(0, 0, 0, 0.12, 0.08, 3.2, 0x2d2d30, 6)
    b.glow = LAMP_LIGHT
    b.box(0, 3.2, 0, 0.42, 0.42, 0.42, 0xfff1c8)
    b.glow = null
    b.hip(0, 3.62, 0, 0.6, 0.25, 0.6, 0x2d2d30)
    return
  }
  if (kind === "mast") {
    b.cyl(0, 0, 0, 0.35, 0.18, 16, 0x9aa0a6, 6)
    b.box(0, 16, 0, 2.6, 0.2, 2.6, 0x6d7278)
    b.glow = LAMP_LIGHT
    for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) b.box(x, 15.75, z, 0.6, 0.25, 0.6, 0xfff1c8)
    b.glow = null
    return
  }
  b.cyl(0, 0, 0, 0.11, 0.08, 7.5, 0x8a9096, 6)
  b.box(0, 7.4, -0.8, 0.1, 0.1, 1.7, 0x8a9096)
  b.glow = LAMP_LIGHT
  b.box(0, 7.25, -1.6, 0.34, 0.16, 0.6, 0xfff1c8)
  b.glow = null
}

export function bench(k: Kit) {
  const { b } = k
  const wood = 0x9a6a3a
  b.box(0, 0.42, 0, 1.8, 0.08, 0.5, wood)
  b.box(0, 0.6, 0.25, 1.8, 0.45, 0.06, wood)
  for (const x of [-0.75, 0.75]) b.box(x, 0, 0, 0.08, 0.42, 0.5, 0x2d2d30)
}

/** A run of railing along local x, `len` long. */
export function railing(k: Kit, len: number, colour = 0x2d2d30, h = 1.0) {
  const { b } = k
  b.box(0, h - 0.06, 0, len, 0.06, 0.06, colour)
  b.box(0, h * 0.5, 0, len, 0.04, 0.04, colour)
  const n = Math.max(1, Math.round(len / 2))
  for (let i = 0; i <= n; i++) b.box(-len / 2 + (i * len) / n, 0, 0, 0.07, h, 0.07, colour)
}

/** A stretch of wall along local x. */
export function wallRun(k: Kit, len: number, h: number, colour: number, cap = 0xd8d2c4, thick = 0.3) {
  const { b } = k
  b.box(0, 0, 0, len, h, thick, colour)
  b.box(0, h, 0, len + 0.06, 0.12, thick + 0.12, cap)
  for (let x = -len / 2; x <= len / 2 + 0.01; x += 4) b.box(x, 0, 0, 0.45, h + 0.15, thick + 0.15, colour)
}

/** A green highway sign on two posts, facing local −z. */
export function roadSign(k: Kit, text: string, sub?: string, h = 1.4) {
  const { b, s, signs } = k
  const sign = signs.get(text, { bg: 0x1d6b3a, fg: 0xffffff, border: 0xffffff, sub })
  const sw = h * sign.aspect
  for (const x of [-sw / 2 + 0.2, sw / 2 - 0.2]) b.box(x, 0, 0.05, 0.1, 2.6 + h, 0.1, 0x8a9096)
  b.box(0, 2.5, 0.04, sw + 0.12, h + 0.12, 0.06, 0x1d6b3a)
  s.sign(0, 2.56, -0.01, sw, h, sign.rect)
}

/** A big fixed board on a frame, facing local −z. */
export function board(k: Kit, text: string, style: SignStyle, height: number, y: number, maxW = 99) {
  const { b, s, signs } = k
  const sign = signs.get(text, style)
  let h = height
  if (h * sign.aspect > maxW) h = maxW / sign.aspect
  const w = h * sign.aspect
  b.box(0, y - 0.08, 0.06, w + 0.2, h + 0.16, 0.1, style.border ?? style.bg)
  s.sign(0, y, -0.01, w, h, sign.rect)
  return { w, h }
}

// ── vehicles (static and moving share these) ────────────────────────────────

/** Uttarakhand Roadways bus, 11 m long along local x. */
export function bus(k: Kit, colour = 0xf3f1ea, stripe = 0x1f5fa8) {
  const { b } = k
  const L = 11, W = 2.5
  b.box(0, 0.5, 0, L, 2.6, W, colour)
  b.box(0, 1.05, 0, L + 0.02, 0.28, W + 0.02, stripe)
  b.box(0, 3.1, 0, L - 0.6, 0.15, W - 0.4, 0xd8d6cc)
  b.box(L / 2 - 0.04, 1.6, 0, 0.1, 1.2, W - 0.3, GLASS)
  for (const side of [-1, 1]) {
    for (let x = -L / 2 + 0.8; x < L / 2 - 1.4; x += 1.25) b.box(x, 1.8, side * (W / 2 + 0.01), 1.0, 0.9, 0.04, GLASS)
    for (const x of [-L / 2 + 2, L / 2 - 2.2]) b.cyl(x, 0, side * (W / 2 - 0.25), 0.5, 0.5, 0.3, 0x1b1b1d, 8)
  }
  b.box(L / 2 - 0.2, 0.55, 0, 0.3, 0.3, W - 0.2, 0x3a3a3a)
}

/** Dehradun's six-seater Vikram tempo, 3.8 m along local x. */
export function vikram(k: Kit, colour = 0x2e7d4f) {
  const { b } = k
  b.box(0, 0.35, 0, 3.8, 1.1, 1.55, colour)
  b.box(-0.3, 1.45, 0, 3.2, 0.9, 1.55, 0xf2f2ea)
  b.box(1.6, 1.45, 0, 0.08, 0.7, 1.35, GLASS)
  b.box(-0.3, 2.35, 0, 3.4, 0.1, 1.7, colour)
  for (const side of [-1, 1]) b.box(-0.6, 1.5, side * 0.79, 2.0, 0.6, 0.04, 0x1b1b1d)
  b.cyl(1.4, 0, 0, 0.33, 0.33, 0.25, 0x1b1b1d, 7)
  for (const side of [-1, 1]) b.cyl(-1.2, 0, side * 0.72, 0.33, 0.33, 0.25, 0x1b1b1d, 7)
}

/** An army truck (olive, canvas back). */
export function armyTruck(k: Kit) {
  const { b } = k
  const olive = 0x4b5a2e
  b.box(2.4, 0.6, 0, 1.8, 1.9, 2.3, olive)
  b.box(3.32, 1.5, 0, 0.06, 0.8, 1.9, GLASS)
  b.box(-0.9, 0.9, 0, 4.6, 0.3, 2.4, olive)
  b.box(-0.9, 1.2, 0, 4.6, 1.6, 2.4, 0x5d6b3a)
  b.box(-0.9, 2.8, 0, 4.6, 0.25, 2.4, 0x56653a)
  for (const x of [2.4, -1.4, -2.6]) for (const side of [-1, 1]) b.cyl(x, 0, side * 1.0, 0.55, 0.55, 0.35, 0x1b1b1d, 8)
}

/** A small hatchback in a random colour. */
export function car(k: Kit, colour?: number) {
  const { b, r } = k
  const c = colour ?? r.pick([0xffffff, 0xc0392b, 0x9aa0a6, 0x2c3e50, 0xf5f5f0, 0x1f4e79, 0x8e1b1b])
  b.box(0, 0.3, 0, 3.7, 0.75, 1.65, c)
  b.box(-0.2, 1.05, 0, 2.2, 0.62, 1.5, c)
  b.box(0.9, 1.08, 0, 0.06, 0.5, 1.4, GLASS)
  b.box(-1.3, 1.08, 0, 0.06, 0.5, 1.4, GLASS)
  for (const side of [-1, 1]) b.box(-0.2, 1.12, side * 0.76, 1.9, 0.45, 0.04, GLASS)
  for (const x of [1.2, -1.2]) for (const side of [-1, 1]) b.cyl(x, 0, side * 0.72, 0.3, 0.3, 0.22, 0x1b1b1d, 7)
}

export function scooter(k: Kit) {
  const { b, r } = k
  const c = r.pick([0xc0392b, 0x2f80ed, 0xf2f2f2, 0x27ae60, 0x1b1b1d])
  b.box(0, 0.2, 0, 1.7, 0.45, 0.4, c)
  b.box(-0.25, 0.65, 0, 0.7, 0.18, 0.36, 0x1b1b1d)
  b.box(0.65, 0.6, 0, 0.12, 0.55, 0.12, 0x6d7278)
  b.box(0.65, 1.15, 0, 0.08, 0.06, 0.7, 0x1b1b1d)
  for (const x of [0.65, -0.6]) b.cyl(x, 0, 0, 0.22, 0.22, 0.12, 0x1b1b1d, 6)
}

/** A cow, lying down chewing — the Doon's original traffic calming. */
export function cow(k: Kit) {
  const { b, r } = k
  const c = r.pick([0xf2efe8, 0xd8c8b0, 0x8a6a4a, 0xe8e2d6])
  b.box(0, 0, 0, 1.6, 0.65, 0.8, c)
  b.box(0.95, 0.3, 0.1, 0.5, 0.45, 0.4, c)
  b.box(1.22, 0.38, 0.1, 0.12, 0.25, 0.34, 0xc89a8a)
  b.box(0.95, 0.75, -0.08, 0.06, 0.2, 0.06, 0xe8dcc0)
  b.box(0.95, 0.75, 0.28, 0.06, 0.2, 0.06, 0xe8dcc0)
}

/** A chai stall: a cart, a kettle with steam, a bench. */
export function chaiStall(k: Kit, name = "CHAI") {
  const { b } = k
  b.box(0, 0.4, 0, 2.2, 0.9, 1.0, 0x2f80ed)
  b.box(0, 1.3, 0, 2.3, 0.06, 1.1, 0x9a7a5a)
  b.box(-0.6, 1.36, 0, 0.5, 0.15, 0.5, 0x3a3a3a)
  b.cyl(-0.6, 1.51, 0, 0.18, 0.15, 0.3, 0xb0b4b8, 7)
  for (let i = 0; i < 5; i++) b.cyl(0.2 + i * 0.16, 1.36, 0.2, 0.05, 0.06, 0.1, 0xf2efe8, 5)
  for (const x of [-1.05, 1.05]) b.box(x, 1.36, -0.45, 0.05, 1.3, 0.05, 0x6d7278)
  b.box(0, 2.66, -0.1, 2.5, 0.06, 1.5, 0xeb5757)
  b.glow = WARM
  b.box(0, 2.55, -0.1, 0.5, 0.06, 0.06, 0xffe8b0)
  b.glow = null
  b.at(0, 0, -1.8, 0, () => bench(k))
  board(k, name, { bg: 0xf2c94c, fg: 0x7a2a22 }, 0.4, 2.0, 2)
}

/** A patch of wildflowers. */
export function flowers(k: Kit, n = 9, spread = 1.6) {
  const { b, r } = k
  const colours = [0xf7a8c8, 0xf2d24c, 0xffffff, 0xb79cf0, 0xf28c5c]
  const c = r.pick(colours)
  b.sway = 0.3
  for (let i = 0; i < n; i++) {
    const x = (r.next() - 0.5) * spread * 2
    const z = (r.next() - 0.5) * spread * 2
    b.box(x, 0, z, 0.05, 0.28, 0.05, 0x4f8a3a)
    b.box(x, 0.28, z, 0.18, 0.12, 0.18, r.chance(0.75) ? c : r.pick(colours))
  }
  b.sway = 0
}
