import { add, along, CANTONMENT, inside, lengthOf, nearest, right, scale, type Road, type Vec2 } from "../geo"
import type { Builder } from "../kit/builder"
import type { Plan } from "./plan"

/**
 * Road surfaces as pieces of about 24 m: asphalt, lane markings, the median
 * on the highways, kerbs and footpaths (kerbs painted black and white inside
 * the cantonment, as the army does), zebra crossings near the chowk.
 */

const STEP = 3
const PIECE = 24

const LEVEL: Record<Road["kind"], number> = { highway: 0.05, main: 0.06, lane: 0.04 }
const ASPHALT: Record<Road["kind"], number> = { highway: 0x45464b, main: 0x505055, lane: 0x77736a }

export function roadPieces(plan: Plan) {
  for (const road of plan.roads) {
    const L = lengthOf(road.points)
    const others = plan.roads.filter((r) => r !== road)
    /** Within a junction: skip kerbs and paint there. */
    const atJunction = (p: Vec2, pad: number) => others.some((o) => nearest(o.points, p).dist < o.width / 2 + pad)
    for (let s0 = 0; s0 < L; s0 += PIECE) {
      const s1 = Math.min(L, s0 + PIECE)
      const mid = along(road.points, (s0 + s1) / 2).p
      plan.add(mid[0], mid[1], (k) => {
        const { b } = k
        const y = LEVEL[road.kind]
        const hw = road.width / 2
        b.jitter = 0.05
        for (let s = s0; s < s1 - 0.01; s += STEP) {
          const e = Math.min(s1, s + STEP)
          const A = along(road.points, s)
          const B = along(road.points, e)
          const ra = right(A.d)
          const rb = right(B.d)
          const corner = (p: Vec2, r: Vec2, off: number): number[] => {
            const q = add(p, scale(r, off))
            return [q[0], y, q[1]]
          }
          // Asphalt: a quad from left edge to right edge (seen from above, counter-clockwise).
          b.quadL([corner(A.p, ra, -hw), corner(A.p, ra, hw), corner(B.p, rb, hw), corner(B.p, rb, -hw)], ASPHALT[road.kind])
          const cantt = inside(CANTONMENT, A.p)
          const junction = atJunction(A.p, 3)

          if (!junction && road.kind !== "lane") {
            const dash = Math.floor(s / STEP) % 3 === 0
            if (road.divider) {
              // A raised median with painted kerbs and a few shrubs.
              strip(b, A.p, B.p, ra, rb, -0.6, 0.6, y, 0.34, Math.floor(s / STEP) % 2 ? 0x1b1b1d : 0xf2c94c)
              strip(b, A.p, B.p, ra, rb, -0.45, 0.45, y + 0.34, 0.02, 0x6a8a3a)
              for (const lane of [-hw / 2, hw / 2]) if (dash) strip(b, A.p, B.p, ra, rb, lane - 0.08, lane + 0.08, y, 0.012, 0xe8e8e0)
            } else if (dash) {
              strip(b, A.p, B.p, ra, rb, -0.08, 0.08, y, 0.012, 0xf2f2ea)
            }
            if (road.kind === "highway") {
              strip(b, A.p, B.p, ra, rb, -hw + 0.3, -hw + 0.45, y, 0.012, 0xf2f2ea)
              strip(b, A.p, B.p, ra, rb, hw - 0.45, hw - 0.3, y, 0.012, 0xf2f2ea)
            }
            // Kerb stones and the footpath behind them.
            const odd = Math.floor(s / STEP) % 2 === 1
            const kerb = cantt ? (odd ? 0x1b1b1d : 0xf4f1e8) : odd ? 0x8f8a80 : 0xa39e94
            for (const side of [-1, 1]) {
              const a = side * hw
              const k0 = Math.min(a, a + side * 0.35)
              const k1 = Math.max(a, a + side * 0.35)
              strip(b, A.p, B.p, ra, rb, k0, k1, 0, 0.2, kerb)
              if (!cantt) {
                const f0 = side > 0 ? hw + 0.35 : -hw - 2.4
                const f1 = side > 0 ? hw + 2.4 : -hw - 0.35
                strip(b, A.p, B.p, ra, rb, f0, f1, 0, 0.14, odd ? 0xb3a796 : 0xa8907c)
              }
            }
          }
        }
        b.jitter = 0
        // A speed breaker every so often inside the cantonment.
        const m = along(road.points, (s0 + s1) / 2)
        if (road.id === "turner" && inside(CANTONMENT, m.p) && Math.floor(s0 / PIECE) % 6 === 0) {
          const A = along(road.points, (s0 + s1) / 2 - 0.4)
          const B = along(road.points, (s0 + s1) / 2 + 0.4)
          for (let i = 0; i < 6; i++) {
            const o0 = -hw + (i * road.width) / 6
            strip(b, A.p, B.p, right(A.d), right(B.d), o0, o0 + road.width / 6, y, 0.1, i % 2 ? 0x1b1b1d : 0xf2c94c)
          }
        }
      })
    }
    // Zebra crossings near the chowk end of the main roads.
    if (road.id === "turner" || road.id === "shimla-bypass") zebra(plan, road, 18)
    if (road.id === "saharanpur") {
      zebra(plan, road, 175)
      zebra(plan, road, 225)
    }
  }
}

/** A flat (or raised) strip between offsets o0 and o1 across the road, from A to B. */
function strip(
  b: Builder,
  A: Vec2,
  B: Vec2,
  ra: Vec2,
  rb: Vec2,
  o0: number,
  o1: number,
  y: number,
  h: number,
  hex: number
) {
  const p = (P: Vec2, r: Vec2, o: number, yy: number) => {
    const q = add(P, scale(r, o))
    return [q[0], yy, q[1]]
  }
  const top = y + h
  b.quadL([p(A, ra, o0, top), p(A, ra, o1, top), p(B, rb, o1, top), p(B, rb, o0, top)], hex)
  if (h > 0.05) {
    b.quadL([p(A, ra, o1, y), p(B, rb, o1, y), p(B, rb, o1, top), p(A, ra, o1, top)], hex)
    b.quadL([p(B, rb, o0, y), p(A, ra, o0, y), p(A, ra, o0, top), p(B, rb, o0, top)], hex)
  }
}

function zebra(plan: Plan, road: Road, s: number) {
  const { p, d } = along(road.points, s)
  const r = right(d)
  plan.add(p[0], p[1], (k) => {
    const y = LEVEL[road.kind] + 0.014
    for (let o = -road.width / 2 + 0.6; o < road.width / 2 - 0.4; o += 1.0) {
      const A = add(p, scale(d, -1.5))
      const B = add(p, scale(d, 1.5))
      strip(k.b, A, B, r, r, o, o + 0.5, y, 0, 0xf4f4ee)
    }
  })
}
