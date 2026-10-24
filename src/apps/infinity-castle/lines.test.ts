import { describe, expect, it } from "vitest"
import { Castle, nodeKey } from "./castle"
import { CAR_LENGTH, carAt, shuttleAt } from "./lines"
import { BODY, createBody, liftOnto, step, type Box } from "./physics"
import { buildTemplates } from "./render/view"
import { World, type Block } from "./world"

const templates = buildTemplates()

const boxesOf = (world: World, block: Block) =>
  world.collect(world.blockCentre(block), 4).filter((b) => b.owner === block.owner)

const overlap = (a: Box, b: Box, tol = 0.06) =>
  a.min[0] < b.max[0] - tol &&
  a.max[0] > b.min[0] + tol &&
  a.min[1] < b.max[1] - tol &&
  a.max[1] > b.min[1] + tol &&
  a.min[2] < b.max[2] - tol &&
  a.max[2] > b.min[2] + tol

const isNetwork = (b: Block) => Boolean(b.line || b.car || b.great)

describe("Lines", () => {
  it("keeps the lines' rows clear of rooms, and the fall in off them", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const castle = new Castle(seed)
      expect(castle.rows).toHaveLength(2)
      for (const r of castle.rooms.values()) expect(castle.isLine(r.node)).toBe(false)
      for (const s of castle.strays) expect(castle.isLine(s.node)).toBe(false)
      const land = castle.rooms.get(castle.landingId)!
      for (const row of castle.rows) expect(land.node[row.axis === 0 ? 2 : 0]).not.toBe(row.at)
      expect(castle.isConnected()).toBe(true)
      for (let i = 0; i < 20; i++) {
        castle.shift({ count: 5 })
        for (const r of castle.rooms.values()) expect(castle.isLine(r.node)).toBe(false)
      }
    }
  })

  it("docks every room beside a line", () => {
    const castle = new Castle(4)
    for (const d of castle.docks()) {
      const room = castle.rooms.get(d.anchor)!
      const row = castle.rows[d.line]
      expect(room.node[1]).toBe(row.level)
      expect(Math.abs(room.node[row.axis === 0 ? 2 : 0] - row.at)).toBe(1)
      expect(d.len).toBeGreaterThan(10)
    }
  })

  it("never runs a deck, car or great hall through the castle", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const castle = new Castle(seed)
      const world = new World(castle, templates)
      const fixed: Box[] = []
      for (const b of world.blocks.values()) if (!isNetwork(b)) fixed.push(...boxesOf(world, b))
      const check = (b: Block, against: Box[], t: number) => {
        for (const a of boxesOf(world, b)) {
          const hit = against.find((f) => overlap(a, f))
          if (hit) throw new Error(`seed ${seed}: ${b.key} hits ${hit.owner} at t=${t.toFixed(2)}`)
        }
      }
      // Decks and halls stay put; each car is checked against what's near its line.
      const cars = [...world.blocks.values()].filter((b) => b.car)
      for (const b of world.blocks.values()) if (b.line || b.great) check(b, fixed, 0)
      const near = new Map<Block, Box[]>()
      for (const c of cars) {
        const line = c.car!.line
        const end = [0, 1, 2].map((k) => line.origin[k] + line.orient[k * 3] * line.length)
        const lo = [0, 1, 2].map((k) => Math.min(line.origin[k], end[k]) - 12)
        const hi = [0, 1, 2].map((k) => Math.max(line.origin[k], end[k]) + 12)
        near.set(c, fixed.filter((f) => [0, 1, 2].every((k) => f.max[k] > lo[k] && f.min[k] < hi[k])))
      }
      for (let t = 0; t < 70; t += 1) {
        world.update(1)
        for (const c of cars) if (c.extend >= 0.999) check(c, near.get(c)!, t)
      }
    }
  }, 60000)

  it("keeps cars on different lanes, and the train's cars, apart", () => {
    const castle = new Castle(2)
    const world = new World(castle, templates)
    const cars = [...world.blocks.values()].filter((b) => b.car)
    for (let t = 0; t < 120; t += 0.5) {
      world.update(0.5)
      const boxes = cars.filter((c) => c.extend >= 0.999).map((c) => ({ c, boxes: boxesOf(world, c) }))
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const hit = boxes[i].boxes.some((a) => boxes[j].boxes.some((b) => overlap(a, b)))
          if (hit) throw new Error(`${boxes[i].c.key} hits ${boxes[j].c.key} at t=${t}`)
        }
      }
    }
  }, 30000)

  it("loops fold away at the ends and shuttles pause at their stops", () => {
    const castle = new Castle(3)
    const world = new World(castle, templates)
    const ring = world.network.lines.find((l) => l.key === "ring-floor")!
    const lane = ring.lanes[0]
    for (let t = 0; t < 200; t += 0.37) {
      const at = carAt(ring, lane, lane.cars[0], t)
      expect(at.s).toBeGreaterThanOrEqual(0)
      expect(at.s).toBeLessThanOrEqual(ring.length)
      const half = (CAR_LENGTH[lane.cars[0].kind] / 2) * at.extend
      expect(at.s - half).toBeGreaterThanOrEqual(-0.01)
      expect(at.s + half).toBeLessThanOrEqual(ring.length + 0.01)
    }
    const cross = world.network.lines.find((l) => l.key === "cross")!
    const m = cross.lanes[0].motion
    if (m.kind !== "shuttle") throw new Error("the z-line shuttles")
    expect(shuttleAt(m, 0)).toBe(m.from)
    expect(shuttleAt(m, 1)).toBe(m.from)
    let max = -Infinity
    for (let t = 0; t < 120; t += 0.25) max = Math.max(max, shuttleAt(m, t))
    expect(max).toBeCloseTo(m.to, 1)
  })

  it("turns gravity onto a standing deck you walk into", () => {
    const castle = new Castle(6)
    const world = new World(castle, templates)
    const floor = world.network.lines.find((l) => l.key === "ring-floor")!
    const east = world.network.lines.find((l) => l.key === "ring-east")!
    // Stand on the ring's floor near its far end and walk at the standing deck.
    const body = createBody([east.origin[0] - 3, floor.origin[1] + BODY.halfHeight + 0.01, floor.origin[2]])
    const boxes: Box[] = []
    let turned = null
    for (let i = 0; i < 120 && !turned; i++) {
      world.collect(body.pos, 4, boxes)
      step(body, boxes, [4, 0, 0], false, 1 / 60)
      turned = world.floorAhead(body, boxes)
    }
    expect(turned).toEqual({ axis: 0, sign: -1 })
  })
})

describe("boarding", () => {
  it("a floor sliding under your feet lifts you onto it", () => {
    const body = createBody([0, BODY.halfHeight + 0.001, 0])
    const ground: Box = { min: [-50, -1, -50], max: [50, 0, 50], owner: 1 }
    // A car's floor, 0.4 m up, arriving from the side.
    const car: Box = { min: [-0.2, 0.3, -2.5], max: [12, 0.4, 2.5], owner: 2 }
    liftOnto(body, [ground, car])
    for (let i = 0; i < 10; i++) step(body, [ground, car], [0, 0, 0], false, 1 / 60)
    expect(body.pos[1] - BODY.halfHeight).toBeCloseTo(0.4, 1)
    expect(body.ground).toBe(2)
  })

  it("doesn't climb a wall that slides into you", () => {
    const body = createBody([0, BODY.halfHeight + 0.001, 0])
    const wall: Box = { min: [-0.2, 0, -2.5], max: [0.1, 3, 2.5], owner: 2 }
    liftOnto(body, [wall])
    expect(body.pos[1]).toBeCloseTo(BODY.halfHeight + 0.001, 3)
  })
})

describe("Castle.adopt", () => {
  it("sets a caught room into a free node by the maze, joined to it", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const castle = new Castle(seed)
      const before = castle.rooms.size
      const placed = castle.adopt([-60, -40, -60])!
      expect(placed).not.toBeNull()
      expect(castle.rooms.size).toBe(before + 1)
      expect(castle.isReserved(placed.room.node) || castle.isLine(placed.room.node)).toBe(false)
      expect(castle.inBounds(placed.room.node)).toBe(true)
      expect(placed.edges.length).toBeGreaterThan(0)
      expect(castle.isConnected()).toBe(true)
      const keys = new Set([...castle.rooms.values()].map((r) => nodeKey(r.node)))
      expect(keys.size).toBe(castle.rooms.size)
    }
  })
})
