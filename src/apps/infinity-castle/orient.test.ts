import { describe, expect, it } from "vitest"
import { ROTATIONS, TURNED, apply, orientBox, sideFacing, sideVector, unapply, upOf } from "./orient"
import { ROOM_R } from "./castle"
import { turn } from "./render/builder"
import { DOOR_H, DOOR_W, WALL } from "./render/kit"
import { strayOffset } from "./world"

describe("orientations", () => {
  it("are the 24 turns of a cube, 20 of them not upright", () => {
    expect(new Set(ROTATIONS.map((m) => m.join())).size).toBe(24)
    for (const m of ROTATIONS) {
      const det =
        m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6])
      expect(det).toBe(1)
    }
    expect(TURNED).toHaveLength(20)
    expect(TURNED.filter((m) => upOf(m).axis === 1 && upOf(m).sign < 0)).toHaveLength(4)
  })

  it("map into the room's frame and back", () => {
    for (const m of TURNED) expect(unapply(m, apply(m, [1, 2, 3]))).toEqual([1, 2, 3])
  })

  it("find the side facing a way, if any does", () => {
    for (const m of TURNED) {
      const flat = [0, 1, 2, 3].filter((d) => apply(m, sideVector(d))[1] === 0)
      // Upside down, every side faces sideways; on its side, two do.
      expect(flat).toHaveLength(upOf(m).axis === 1 ? 4 : 2)
      for (const d of flat) expect(sideFacing(m, apply(m, sideVector(d)))).toBe(d)
      expect(sideFacing(m, [0, 1, 0])).toBe(upOf(m).axis === 1 ? -1 : sideFacing(m, [0, 1, 0]))
    }
  })

  it("set every turned room's sideways doors level with the bridges", () => {
    for (const m of TURNED) {
      const off = strayOffset(m)
      for (let d = 0; d < 4; d++) {
        const n = apply(m, sideVector(d))
        if (n[1] !== 0) continue
        // The doorway, from the wall out to the platform's edge, in the room's frame.
        const [ax, az] = turn(d, WALL, -DOOR_W)
        const [bx, bz] = turn(d, ROOM_R, DOOR_W)
        const box = orientBox(m, [Math.min(ax, bx), 0, Math.min(az, bz)], [Math.max(ax, bx), DOOR_H, Math.max(az, bz)])
        // Its sill is at bridge level, and it's centred on the bridge.
        expect(box.min[1] + off[1]).toBeCloseTo(0)
        const across = n[0] !== 0 ? 2 : 0
        expect(box.min[across] + box.max[across] + 2 * off[across]).toBeCloseTo(0)
      }
    }
  })
})
