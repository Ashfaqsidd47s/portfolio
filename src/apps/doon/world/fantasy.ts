import { add, beside, BOUNDS, ISBT, MONASTERY, norm, right, scale, yawOf, type Vec2 } from "../geo"
import { lin } from "../kit/builder"
import { box as makeBox } from "./collide"
import { place, type Plan } from "./plan"
import { flowers, range, tree, type Rng } from "./props"

/**
 * The isekai side of the town: Dehradun sits on a floating island above a
 * sea of cloud, with rock tiers, roots and waterfalls under its edges and
 * little islets drifting round it. Warp crystals stand at the places you
 * can travel between.
 */

const ROCK = [0x6a5a7a, 0x5a4c6e, 0x4c4060, 0x3f3552]
const CRYSTAL = lin(0x7ff6ff).map((v) => v * 2.2) as [number, number, number]
const FALL = lin(0x9fdcff).map((v) => v * 1.2) as [number, number, number]

/** The island's underside, all the way round the edge. */
export function islandEdge(plan: Plan, r: Rng) {
  const sides: [Vec2, Vec2][] = [
    [[BOUNDS.minX, BOUNDS.minZ], [BOUNDS.maxX, BOUNDS.minZ]],
    [[BOUNDS.maxX, BOUNDS.minZ], [BOUNDS.maxX, BOUNDS.maxZ]],
    [[BOUNDS.maxX, BOUNDS.maxZ], [BOUNDS.minX, BOUNDS.maxZ]],
    [[BOUNDS.minX, BOUNDS.maxZ], [BOUNDS.minX, BOUNDS.minZ]],
  ]
  let n = 0
  for (const [a, b] of sides) {
    const d = norm([b[0] - a[0], b[1] - a[1]])
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    // Local +z points inward (the loop runs clockwise seen from above).
    const yaw = yawOf(d)
    for (let s = 0; s < L; s += 32) {
      const len = Math.min(32, L - s)
      const m = add(a, scale(d, s + len / 2))
      const fall = n++ % 9 === 4
      const roots = [range(r, -len / 2, len / 2), range(r, -len / 2, len / 2), range(r, -len / 2, len / 2)]
      const gem = r.chance(0.35) ? range(r, -len / 3, len / 3) : null
      // Rock teeth hanging under the island.
      const teeth = Array.from({ length: 3 }, () => [range(r, -len / 2 + 3, len / 2 - 3), range(r, 8, 22), range(r, 3, 7)])
      plan.add(m[0], m[1], (k) =>
        place(k, m[0], m[1], yaw, () => {
          const { b } = k
          b.box(0, -0.6, 0.3, len, 0.6, 0.6, 0x5e9a3a)
          b.box(0, -3, 1.2, len, 2.4, 2.4, 0x7a5a3a)
          for (let i = 0; i < ROCK.length; i++) {
            const inset = 1.5 + i * i * 2.4
            const y = -3 - (i + 1) * 7
            b.jitter = 0.08
            b.box(0, y, inset + 4, len + 0.02, 7, 8, ROCK[i])
            b.jitter = 0
            if (i < 2) b.box(0, y + 7, inset + 0.6, len, 0.3, 1.2, 0x5e8a3a)
            // Lighter strata lines across each tier.
            b.box(0, y + 2.4, inset - 0.02, len + 0.04, 0.5, 0.1, 0x8a7a9a)
          }
          for (const [x, h, w] of teeth) b.spike(x, -31, 27, w, h, w, ROCK[3])
          b.sway = 0.25
          for (const x of roots) {
            const h = 3 + Math.abs(x % 5)
            b.box(x, -3 - h, 0.5, 0.12, h, 0.12, 0x5a3a24)
            b.box(x + 0.4, -2.5 - h * 0.7, 0.4, 0.1, h * 0.7, 0.1, 0x3f7a3a)
          }
          b.sway = 0
          if (gem !== null) {
            b.glow = CRYSTAL
            b.hip(gem, -12, 3.2, 0.9, 1.6, 0.9, 0x7ff6ff)
            b.hip(gem + 0.8, -12.4, 3.4, 0.6, 1.0, 0.6, 0x7ff6ff)
            b.glow = null
          }
          if (fall) {
            // A thin waterfall pouring off the edge into the clouds.
            b.box(0, -0.05, 0.6, 3.2, 0.12, 1.4, 0x5aa8d8)
            b.glow = FALL
            b.box(0, -46, -0.3, 2.6, 46, 0.4, 0x8fd0f8)
            b.box(0.9, -46, -0.5, 0.5, 46, 0.3, 0xe8f8ff)
            b.glow = null
          }
        })
      )
    }
  }
}

/** Little islands drifting round the big one, each with a tree, a shrine or a crystal. */
export function skyIslands(plan: Plan, r: Rng) {
  const spots: Vec2[] = []
  for (let i = 0; i < 14; i++) {
    const side = i % 4
    const t = range(r, 0.08, 0.92)
    const out = range(r, 45, 120)
    const p: Vec2 =
      side === 0
        ? [BOUNDS.minX + t * (BOUNDS.maxX - BOUNDS.minX), BOUNDS.minZ - out]
        : side === 1
          ? [BOUNDS.maxX + out, BOUNDS.minZ + t * (BOUNDS.maxZ - BOUNDS.minZ)]
          : side === 2
            ? [BOUNDS.minX + t * (BOUNDS.maxX - BOUNDS.minX), BOUNDS.maxZ + out]
            : [BOUNDS.minX - out, BOUNDS.minZ + t * (BOUNDS.maxZ - BOUNDS.minZ)]
    spots.push(p)
  }
  for (const p of spots) {
    const rad = range(r, 5, 13)
    const y = range(r, -14, 10)
    const kind = r.pick(["tree", "shrine", "crystal", "tree"] as const)
    const species = r.pick(["kachnar", "jacaranda", "mango", "pine"] as const)
    plan.add(p[0], p[1], (k) =>
      place(k, p[0], p[1], 0, () => {
        const { b } = k
        b.cyl(0, y - 0.8, 0, rad, rad * 0.96, 0.8, 0x6fae4a, 9)
        b.cyl(0, y - 3, 0, rad * 0.9, rad, 2.2, 0x7a5a3a, 9)
        b.cyl(0, y - 3 - rad * 1.6, 0, 0.6, rad * 0.9, rad * 1.6, ROCK[1], 9)
        if (kind === "shrine") {
          for (const x of [-1.6, 1.6]) b.box(x, y, 0, 0.5, 3.2, 0.5, 0xb3261e)
          b.box(0, y + 3.2, 0, 4.6, 0.35, 0.7, 0x1b1b1d)
          b.box(0, y + 2.6, 0, 3.6, 0.25, 0.4, 0xb3261e)
        } else if (kind === "crystal") {
          b.glow = CRYSTAL
          b.hip(0, y, 0, 1.4, 3.2, 1.4, 0x7ff6ff)
          b.hip(1.2, y, 0.6, 0.8, 1.8, 0.8, 0x7ff6ff)
          b.glow = null
        }
      })
    )
    if (kind === "tree") plan.add(p[0], p[1], (k) => place(k, 0, y, 0, () => tree(k, p[0], p[1], species, 0.9)))
  }
}

/** Fast-travel places, and where their warp crystals stand. */
export const WARPS = ["isbt", "chowk", "cakehouse", "lake", "monastery"] as const

/**
 * A stone ring with a rune circle for each warp crystal (the crystal itself
 * floats and turns, drawn by the game). Placed before the town is filled,
 * so houses and trees keep clear of them.
 */
export function warpStones(plan: Plan, r: Rng) {
  const friend = plan.marks.get("friend")
  const want: Record<(typeof WARPS)[number], Vec2> = {
    isbt: add(ISBT.centre, add(scale(ISBT.dir, 14), scale(right(ISBT.dir), -94))),
    chowk: beside("turner", 36, -9).p,
    cakehouse: beside("turner", 1108, -10).p,
    lake: friend ? add(friend.p, add(scale(friend.d, -6), scale(right(friend.d), 7))) : [260, 330],
    monastery: add(MONASTERY.gate, [-16, 22]),
  }
  for (const id of WARPS) {
    const p = freeSpot(plan, want[id])
    plan.marks.set(`warp-${id}`, { p, d: [0, 1] })
    plan.solid(makeBox(p[0], p[1], 2.4, 2.4))
    plan.spots.push({ id: `warp:${id}`, at: p, radius: 3.2, label: "Warp crystal", verb: "Warp" })
    plan.add(p[0], p[1], (k) =>
      place(k, p[0], p[1], 0, () => {
        const { b } = k
        b.cyl(0, 0, 0, 1.7, 1.6, 0.3, 0x9a94a8, 8)
        b.cyl(0, 0.3, 0, 1.2, 1.1, 0.35, 0xb8b2c4, 8)
        b.glow = CRYSTAL
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2
          b.box(Math.cos(a) * 1.45, 0.3, Math.sin(a) * 1.45, 0.22, 0.04, 0.22, 0x7ff6ff)
        }
        b.cyl(0, 0.66, 0, 0.9, 0.9, 0.02, 0x7ff6ff, 12, true)
        b.glow = null
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4
          b.box(Math.cos(a) * 1.5, 0.3, Math.sin(a) * 1.5, 0.3, 1.1, 0.3, 0x8a8498)
        }
      })
    )
    for (let i = 0; i < 2; i++) {
      const f = add(p, [range(r, -4, 4), range(r, -4, 4)])
      if (!plan.taken.hits(makeBox(f[0], f[1], 2, 2)) && plan.offRoad(f, 1)) plan.add(f[0], f[1], (k) => place(k, f[0], f[1], 0, () => flowers(k)))
    }
  }
}

function freeSpot(plan: Plan, p: Vec2): Vec2 {
  for (let rad = 0; rad < 30; rad += 1) {
    for (let a = 0; a < Math.PI * 2; a += 0.4) {
      const q: Vec2 = [p[0] + Math.cos(a) * rad, p[1] + Math.sin(a) * rad]
      if (plan.offRoad(q, 1.5) && !plan.taken.hits(makeBox(q[0], q[1], 5, 5))) return q
    }
  }
  return p
}
