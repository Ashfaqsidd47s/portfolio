import { describe, expect, it } from "vitest"
import { Castle, DIRS, LANDMARKS, nodeKey, type Node } from "./castle"
import { TURNED, apply, sideVector } from "./orient"

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
    const here = castle.landingId
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
      expect(castle.hops(castle.landingId, castle.nakimeId)).toBeGreaterThan(0)
    }
  })

  it("drops the visitor into a hall with nothing above it", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const castle = new Castle(seed)
      const land = castle.rooms.get(castle.landingId)!
      expect(land.kind).toBe("hall")
      for (const n of castle.landingColumn()) expect(castle.roomAt(n)).toBeUndefined()
    }
  })

  it("keeps held nodes clear through strums", () => {
    const castle = new Castle(4)
    for (const n of castle.landingColumn()) castle.hold.add(nodeKey(n))
    for (let i = 0; i < 40; i++) {
      castle.shift({ lockedRooms: new Set([castle.landingId]), count: 6 })
      for (const n of castle.landingColumn()) expect(castle.roomAt(n)).toBeUndefined()
    }
  })

  it("sets turned-over rooms in empty nodes, with empty nodes above and below, for good", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const castle = new Castle(seed)
      expect(castle.strays.length).toBeGreaterThan(2)
      const check = () => {
        for (const s of castle.strays) {
          expect(TURNED[s.orient][4]).not.toBe(1)
          for (const dk of [-1, 0, 1]) {
            const n: Node = [s.node[0], s.node[1] + dk, s.node[2]]
            expect(castle.roomAt(n)).toBeUndefined()
            expect(castle.isReserved(n)).toBe(true)
          }
        }
      }
      check()
      for (let i = 0; i < 25; i++) {
        castle.shift({ count: 6 })
        check()
        expect(castle.isConnected()).toBe(true)
      }
    }
  })

  it("bridges a stray only from a hall beside it, to a door that faces the hall", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const castle = new Castle(seed)
      // Each stray starts within reach, where there's a hall beside it.
      expect(new Set(castle.spurs().map((s) => s.stray)).size).toBeGreaterThan(2)
      for (let i = 0; i < 10; i++) {
        for (const spur of castle.spurs()) {
          const stray = castle.strays.find((s) => s.id === spur.stray)!
          const anchor = castle.rooms.get(spur.anchor)!
          const [dx, dz] = DIRS[spur.dir]
          expect(anchor.kind).toBe("hall")
          expect(anchor.node).toEqual([stray.node[0] - dx, stray.node[1], stray.node[2] - dz])
          expect(apply(TURNED[stray.orient], sideVector(spur.side)).map((v) => v + 0)).toEqual([0 - dx, 0, 0 - dz])
          // The hall has no passage of its own on that side.
          for (const e of castle.edgesOf(anchor.id)) {
            const side = e.a === anchor.id ? e.dir : (e.dir + 2) % 4
            expect(side).not.toBe(spur.dir)
          }
        }
        castle.shift({ count: 5 })
      }
    }
  })

  it("leaves a locked stray as it is", () => {
    const castle = new Castle(8)
    const locked = new Set(castle.strays.map((s) => s.id))
    const before = castle.strays.map((s) => s.orient)
    for (let i = 0; i < 20; i++) expect(castle.shift({ lockedStrays: locked }).turned).toHaveLength(0)
    expect(castle.strays.map((s) => s.orient)).toEqual(before)
  })
})
