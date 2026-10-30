import { BOUNDS, inside, type Polygon } from "../geo"
import { Builder } from "../kit/builder"
import { fbm2, hash2 } from "../kit/noise"
import { CHUNK, type Plan, type Zone } from "../world/plan"

/**
 * The ground of one chunk: 2 m tiles, each a colour picked from the zone
 * it's in (ISBT concrete, monastery paving, cantonment lawn, meadow with
 * flowers and bare earth elsewhere), with the lake bed sunk below the bank.
 */

const CELL = 2
const BED = -1.3

type Indexed = { zone: Zone; minX: number; maxX: number; minZ: number; maxZ: number }

export class Ground {
  private zones: Indexed[]
  private water: Polygon[]
  private plan: Plan

  constructor(plan: Plan) {
    this.plan = plan
    this.zones = plan.zones.map((zone) => {
      const xs = zone.poly.map((p) => p[0])
      const zs = zone.poly.map((p) => p[1])
      return { zone, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }
    })
    this.water = plan.water
  }

  private zoneAt(x: number, z: number): Zone["kind"] | null {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const q = this.zones[i]
      if (x < q.minX || x > q.maxX || z < q.minZ || z > q.maxZ) continue
      if (inside(q.zone.poly, [x, z])) return q.zone.kind
    }
    return null
  }

  private wet(x: number, z: number) {
    return this.water.some((w) => inside(w, [x, z]))
  }

  private colour(x: number, z: number): number {
    const n = fbm2(x * 0.035, z * 0.035)
    const h = hash2(Math.floor(x / CELL), Math.floor(z / CELL))
    switch (this.zoneAt(x, z)) {
      case "isbt":
        return n > 0.66 ? 0x7f7a72 : h > 0.5 ? 0x9c968c : 0x948e84
      case "courtyard":
        return (Math.floor(x / CELL) + Math.floor(z / CELL)) % 2 ? 0xcbc2b0 : 0xbfb6a4
      case "monastery":
        return h > 0.5 ? 0x6cb44c : 0x76bc52
      case "cantt":
        return n > 0.72 ? 0xa89668 : h > 0.5 ? 0x6cb24a : 0x64a844
      case "parade":
        return h > 0.5 ? 0xb59a6a : 0xab9062
      case "lawn":
        return h > 0.5 ? 0x7cc256 : 0x86c95c
      case "path":
        return h > 0.5 ? 0xc4b294 : 0xbaa88a
      default: {
        const near = this.plan.nearestRoad([x, z]).dist
        if (near < 2.2) return h > 0.5 ? 0xb09468 : 0xa4895e
        if (n > 0.66) return h > 0.5 ? 0xb39a68 : 0xa88e5e
        // Meadow: lush greens.
        const g = fbm2(x * 0.08 + 40, z * 0.08)
        return g > 0.62 ? 0x8cc95e : g > 0.42 ? (h > 0.5 ? 0x74b84e : 0x7cbf54) : h > 0.5 ? 0x62a646 : 0x6aad4a
      }
    }
  }

  /** Builds chunk (cx, cz)'s ground, or null outside the map. */
  build(cx: number, cz: number) {
    const x0 = Math.max(BOUNDS.minX, cx * CHUNK)
    const z0 = Math.max(BOUNDS.minZ, cz * CHUNK)
    const x1 = Math.min(BOUNDS.maxX, (cx + 1) * CHUNK)
    const z1 = Math.min(BOUNDS.maxZ, (cz + 1) * CHUNK)
    if (x1 <= x0 || z1 <= z0) return null
    const b = new Builder()
    const nx = Math.ceil((x1 - x0) / CELL)
    const nz = Math.ceil((z1 - z0) / CELL)
    const hs: number[] = []
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const x = Math.min(x1, x0 + i * CELL)
        const z = Math.min(z1, z0 + j * CELL)
        hs.push(this.wet(x, z) ? BED : 0)
      }
    }
    const H = (i: number, j: number) => hs[j * (nx + 1) + i]
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const xa = x0 + i * CELL
        const za = z0 + j * CELL
        const xb = Math.min(x1, xa + CELL)
        const zb = Math.min(z1, za + CELL)
        const sunk = H(i, j) + H(i + 1, j) + H(i, j + 1) + H(i + 1, j + 1) < -0.1
        const c = sunk ? (this.wet((xa + xb) / 2, (za + zb) / 2) ? 0x4a4a38 : 0x7a6a4a) : this.colour((xa + xb) / 2, (za + zb) / 2)
        b.quadL(
          [
            [xa, H(i, j), za],
            [xa, H(i, j + 1), zb],
            [xb, H(i + 1, j + 1), zb],
            [xb, H(i + 1, j), za],
          ],
          c
        )
      }
    }
    return b.geometry()
  }
}
