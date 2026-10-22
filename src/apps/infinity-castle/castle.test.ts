import { describe, expect, it } from "vitest"
import { Castle, LANDMARKS, nodeKey } from "./castle"

describe("Castle", () => {
  it("builds a connected maze with all three Upper Moon rooms", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const castle = new Castle(seed)
      expect(castle.isConnected()).toBe(true)
      for (const kind of LANDMARKS) expect(castle.landmark(kind)).toBeDefined()
      expect(castle.rooms.size).toBeGreaterThan(40)
    }
  })

  it("keeps one room per node, inside the lattice", () => {
    const castle = new Castle(7)
    const seen = new Set<string>()
    for (const r of castle.rooms.values()) {
      if (r.kind !== "nakime") expect(castle.inBounds(r.node)).toBe(true)
      expect(seen.has(nodeKey(r.node))).toBe(false)
      seen.add(nodeKey(r.node))
    }
  })

  it("stairs always run up from their first room", () => {
    const castle = new Castle(3)
    for (const e of castle.edges.values()) {
      const a = castle.rooms.get(e.a)!.node
      const b = castle.rooms.get(e.b)!.node
      if (e.style === "stair") expect(b[1]).toBe(a[1] + 1)
      else expect(b[1]).toBe(a[1])
    }
  })

  it("stays connected through many strums", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const castle = new Castle(seed)
      for (let i = 0; i < 40; i++) {
        const plan = castle.shift({ count: 5 })
        expect(castle.isConnected()).toBe(true)
          for (const m of plan.moves) expect(castle.rooms.get(m.id)!.node).toEqual(m.to)
      }
    }
  })

  it("never moves a locked room or drops a locked passage", () => {
    const castle = new Castle(11)
    const here = castle.entryRoom()
    const passage = castle.edgesOf(here)[0]
    for (let i = 0; i < 30; i++) {
      const before = [...castle.rooms.get(here)!.node]
      const plan = castle.shift({ lockedRooms: new Set([here]), lockedEdges: new Set([passage.key]), count: 6 })
      expect(castle.rooms.get(here)!.node).toEqual(before)
      expect(castle.edges.has(passage.key)).toBe(true)
      expect(plan.moves.some((m) => m.id === passage.a || m.id === passage.b)).toBe(false)
    }
  })

  it("respects a blocked slide", () => {
    const castle = new Castle(5)
    const plan = castle.shift({ blocked: () => true, count: 6 })
    expect(plan.moves).toHaveLength(0)
  })

  it("reports passages that were removed and added", () => {
    const castle = new Castle(9)
    const before = new Set(castle.edges.keys())
    const plan = castle.shift({ count: 5 })
    for (const e of plan.removed) expect(before.has(e.key) && !castle.edges.has(e.key)).toBe(true)
    for (const e of plan.added) expect(!before.has(e.key) && castle.edges.has(e.key)).toBe(true)
  })

  it("opens a stair to Nakime once her chamber is unsealed", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const castle = new Castle(seed)
      expect(castle.edgesOf(castle.nakimeId)).toHaveLength(0)
      castle.nakimeOpen = true
      castle.shift({ count: 4 })
      expect(castle.edgesOf(castle.nakimeId).length).toBeGreaterThan(0)
      expect(castle.isConnected()).toBe(true)
      expect(castle.hops(castle.entryRoom(), castle.nakimeId)).toBeGreaterThan(0)
    }
  })

  it("drops the visitor from a room with something below it", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const castle = new Castle(seed)
      const entry = castle.rooms.get(castle.entryRoom())!
      expect(entry.kind).toBe("hall")
      const below = [...castle.rooms.values()].some(
        (r) => r.node[0] === entry.node[0] && r.node[2] === entry.node[2] && r.node[1] < entry.node[1]
      )
      expect(below).toBe(true)
    }
  })
})
