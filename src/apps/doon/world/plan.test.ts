import { describe, expect, it } from "vitest"
import { CANTT_GATE, ISBT, LAKE, MONASTERY, PLACES, START, SURVEYED, inside } from "../geo"
import { Builder } from "../kit/builder"
import { NoSigns } from "../kit/signs"
import { createRng } from "@/os/kernel/rng"
import { buildPlan } from "./plan"

const plan = buildPlan(new NoSigns())

describe("the plan", () => {
  it("is the same every time", () => {
    const again = buildPlan(new NoSigns())
    expect(again.pieces.length).toBe(plan.pieces.length)
    expect(again.roads.map((r) => r.id)).toEqual(plan.roads.map((r) => r.id))
  })

  it("fills the town", () => {
    expect(plan.pieces.length).toBeGreaterThan(3000)
    expect(plan.roads.filter((r) => r.kind === "lane").length).toBeGreaterThan(10)
    expect(plan.lamps.length).toBeGreaterThan(100)
  })

  it("keeps the surveyed landmarks where they were surveyed", () => {
    expect(Math.hypot(ISBT.centre[0] - SURVEYED.isbt[0], ISBT.centre[1] - SURVEYED.isbt[1])).toBe(0)
    // ISBT to Clement Town is about 2 km by road (published distance).
    const isbtToCantt = Math.hypot(SURVEYED.isbt[0] - CANTT_GATE[0], SURVEYED.isbt[1] - CANTT_GATE[1])
    expect(isbtToCantt).toBeGreaterThan(1100)
    expect(isbtToCantt).toBeLessThan(2400)
  })

  it("starts you somewhere you can stand, and the friend's bench is by the lake", () => {
    expect(plan.collision.free(START[0], START[1], 0.35)).toBe(true)
    const seat = plan.marks.get("friend")!
    expect(seat).toBeDefined()
    expect(Math.hypot(seat.p[0] - LAKE.centre[0], seat.p[1] - LAKE.centre[1])).toBeLessThan(LAKE.rx + 10)
    for (const id of ["cakehouse", "rajkumar", "stupa", "fountain"]) expect(plan.marks.has(id)).toBe(true)
  })

  it("leaves every shop counter and place reachable", () => {
    for (const s of plan.spots) {
      const ok = [0, 1, 2, 3, 4, 5, 6, 7].some((i) => {
        const a = (i / 8) * Math.PI * 2
        return plan.collision.free(s.at[0] + Math.cos(a) * 0.8, s.at[1] + Math.sin(a) * 0.8, 0.35)
      })
      expect(ok, s.id).toBe(true)
    }
    for (const p of PLACES.filter((p) => p.travel)) expect(p.at).toBeDefined()
  })

  it("puts the monastery outside the cantonment and the lake inside it", () => {
    expect(inside(plan.zones.find((z) => z.kind === "cantt")!.poly, MONASTERY.centre)).toBe(false)
    expect(inside(plan.zones.find((z) => z.kind === "cantt")!.poly, LAKE.centre)).toBe(true)
  })

  it("draws the landmarks and a sample of the rest without throwing", () => {
    const b = new Builder()
    const s = new Builder(Math.random, true)
    // Landmarks come first in the list; then every 25th generated piece.
    plan.pieces.forEach((p, i) => {
      if (i < 1500 || i % 25 === 0) p.build({ b, s, signs: plan.signs, r: createRng(p.seed) })
    })
    expect(b.count).toBeGreaterThan(100_000)
    expect(s.count).toBeGreaterThan(100)
    expect(b.pos.every(Number.isFinite)).toBe(true)
  })
})
