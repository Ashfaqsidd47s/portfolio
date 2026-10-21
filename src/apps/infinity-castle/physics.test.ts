import { describe, expect, it } from "vitest"
import { BODY, blocked, createBody, depenetrate, halfExtents, step, type Box, type Vec3 } from "./physics"

const box = (min: Vec3, max: Vec3, owner = 1): Box => ({ min, max, owner })
const floor = box([-50, -1, -50], [50, 0, 50])
const DT = 1 / 60
const run = (frames: number, fn: () => void) => {
  for (let i = 0; i < frames; i++) fn()
}
const feet = (y: number) => y - BODY.halfHeight

describe("physics", () => {
  it("falls onto a floor and stands on it", () => {
    const body = createBody([0, 5, 0])
    let landed = 0
    run(120, () => (landed = Math.max(landed, step(body, [floor], [0, 0, 0], false, DT).landed)))
    expect(body.grounded).toBe(true)
    expect(feet(body.pos[1])).toBeCloseTo(0, 2)
    expect(landed).toBeGreaterThan(5)
  })

  it("doesn't tunnel through a thin floor at full speed", () => {
    const body = createBody([0, 400, 0])
    body.vel[1] = -BODY.terminal
    const thin = box([-5, -0.3, -5], [5, 0, 5])
    run(600, () => step(body, [thin], [0, 0, 0], false, DT))
    expect(feet(body.pos[1])).toBeCloseTo(0, 2)
  })

  it("is stopped by a wall", () => {
    const body = createBody([0, BODY.halfHeight, 0])
    const wall = box([2, 0, -5], [2.2, 4, 5])
    run(180, () => step(body, [floor, wall], [6, 0, 0], false, DT))
    expect(body.pos[0] + BODY.radius).toBeLessThanOrEqual(2)
    expect(body.pos[0]).toBeGreaterThan(1.5)
  })

  it("walks up and back down a stair", () => {
    const steps: Box[] = [floor]
    for (let i = 0; i < 20; i++) steps.push(box([2 + i * 0.5, -1, -2], [2.5 + i * 0.5, (i + 1) * 0.42, 2]))
    steps.push(box([12, -1, -2], [40, 20 * 0.42, 2]))
    const body = createBody([0, BODY.halfHeight + 0.01, 0])
    run(200, () => step(body, steps, [5, 0, 0], false, DT))
    expect(body.pos[0]).toBeGreaterThan(12)
    expect(feet(body.pos[1])).toBeCloseTo(8.4, 1)
    let airborne = 0
    run(300, () => {
      step(body, steps, [-5, 0, 0], false, DT)
      if (!body.grounded) airborne++
    })
    expect(body.pos[0]).toBeLessThan(2)
    expect(feet(body.pos[1])).toBeCloseTo(0, 1)
    // Snapping keeps the feet on the treads on the way down.
    expect(airborne).toBeLessThan(10)
  })

  it("won't climb something taller than a step", () => {
    const body = createBody([0, BODY.halfHeight + 0.01, 0])
    const ledge = box([2, 0, -5], [4, 0.8, 5])
    run(120, () => step(body, [floor, ledge], [5, 0, 0], false, DT))
    expect(body.pos[0]).toBeLessThan(2)
  })

  it("jumps only from the ground", () => {
    const body = createBody([0, BODY.halfHeight + 0.01, 0])
    run(10, () => step(body, [floor], [0, 0, 0], false, DT))
    expect(step(body, [floor], [0, 0, 0], true, DT).jumped).toBe(true)
    expect(step(body, [floor], [0, 0, 0], true, DT).jumped).toBe(false)
    let peak = 0
    run(90, () => {
      step(body, [floor], [0, 0, 0], false, DT)
      peak = Math.max(peak, feet(body.pos[1]))
    })
    expect(peak).toBeGreaterThan(0.9)
    expect(body.grounded).toBe(true)
  })

  it("falls sideways onto a wall when gravity turns", () => {
    const body = createBody([0, 2, 0])
    body.up = { axis: 0, sign: 1 }
    const wall = box([-6, -10, -10], [-5, 10, 10], 7)
    run(120, () => step(body, [wall], [0, 0, 0], false, DT))
    expect(body.grounded).toBe(true)
    expect(body.ground).toBe(7)
    expect(body.pos[0] - BODY.halfHeight).toBeCloseTo(-5, 2)
    // Walking now moves across the wall, along y and z.
    const y = body.pos[1]
    run(60, () => step(body, [wall], [0, 4, 0], false, DT))
    expect(body.pos[1]).toBeGreaterThan(y + 2)
  })

  it("stands on a ceiling when gravity points up", () => {
    const body = createBody([0, 2, 0])
    body.up = { axis: 1, sign: -1 }
    const ceiling = box([-5, 4, -5], [5, 4.5, 5])
    run(120, () => step(body, [ceiling], [0, 0, 0], false, DT))
    expect(body.grounded).toBe(true)
    expect(body.pos[1] + BODY.halfHeight).toBeCloseTo(4, 2)
  })

  it("is pushed out of a box it ends up inside", () => {
    const body = createBody([0, 1, 0])
    const door = box([-0.1, 0, -2], [0.2, 3, 2])
    depenetrate(body, [door])
    expect(blocked(body.pos, halfExtents(body.up), [door])).toBe(false)
    expect(body.pos[0]).toBeCloseTo(-0.4, 2)
  })
})
