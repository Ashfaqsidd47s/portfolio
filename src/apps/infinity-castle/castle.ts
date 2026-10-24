import { createRng } from "@/os/kernel/rng"

/**
 * The Infinity Castle as data: rooms on a 3D lattice, joined by bridges,
 * enclosed corridors and long stairs. Nakime's biwa reshapes it — `shift`
 * slides rooms to new lattice nodes and re-wires the passages — while
 * keeping every room reachable from every other.
 *
 * No three.js here: the view and the physics read this model.
 *
 * Lattice coordinates are [x, level, z]. Bridges and stairs live in the
 * gaps between horizontally adjacent nodes; a stair climbs one level. Each
 * room has a veranda all round, so passages land in lanes: bridges in the
 * middle of a side, opposite the door, and stairs off to the right of the
 * way they climb. Two passages can't collide — a stair and a bridge run
 * side by side, and stairs that share a gap climb in parallel, a floor
 * apart — so any two neighbouring rooms can always be joined.
 */

/** Metres between neighbouring room centres. */
export const CELL = 24
/** Metres between levels. */
export const LEVEL = 10
/** Half-width of a room's platform. */
export const ROOM_R = 5.8
/** Length of a bridge, corridor or stair: the gap between two platforms. */
export const SPAN = CELL - 2 * ROOM_R
/** How far right of a side's middle a stair runs, looking up it. */
export const STAIR_LANE = 3.3

export type Vec3 = [number, number, number]
export type Node = [number, number, number]

/** 0 = +x, 1 = +z, 2 = −x, 3 = −z. */
export type Dir = 0 | 1 | 2 | 3
export const DIRS: readonly [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
]
export const opposite = (d: Dir) => ((d + 2) % 4) as Dir

export type Landmark = "kokushibo" | "doma" | "akaza"
/** A hall has walls, a roof and a trapdoor; a terrace is an open-air stage. */
export type RoomKind = "hall" | "terrace" | Landmark | "nakime"
export const LANDMARKS: readonly Landmark[] = ["kokushibo", "doma", "akaza"]
export const isLandmark = (kind: RoomKind): kind is Landmark => (LANDMARKS as readonly string[]).includes(kind)

export type Room = { id: number; kind: RoomKind; node: Node; variant: number }

export type EdgeStyle = "bridge" | "corridor" | "stair"
export type Edge = {
  key: string
  /** For a stair, the lower room. */
  a: number
  b: number
  /** The side of `a` that faces `b`. */
  dir: Dir
  style: EdgeStyle
}

export type Move = { id: number; from: Node; to: Node }
export type ShiftPlan = { moves: Move[]; removed: Edge[]; added: Edge[] }

export type CastleSize = { x: number; y: number; z: number }

export type ShiftOptions = {
  /** Rooms that must not move (the player is in, on or next to them). */
  lockedRooms?: ReadonlySet<number>
  /** Passages that must survive (the player is on them). */
  lockedEdges?: ReadonlySet<string>
  /** Reject a slide, e.g. one whose path or destination crosses the player. */
  blocked?: (from: Node, to: Node) => boolean
  /** How many rooms to slide in all. */
  count?: number
  /**
   * Rooms to slide before any others, even if they're locked: to a given
   * node, or anywhere `avoid` allows. `blocked` doesn't apply to them.
   */
  first?: { id: number; to?: Node; avoid?: (n: Node) => boolean }[]
}

export const nodeKey = (n: Node) => `${n[0]},${n[1]},${n[2]}`
export const nodeCenter = (n: Node): Vec3 => [n[0] * CELL, n[1] * LEVEL, n[2] * CELL]
const sameNode = (a: Node, b: Node) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]

/** The side of `from` that faces a horizontally adjacent `to`, or null. */
export function sideTowards(from: Node, to: Node): Dir | null {
  const dx = to[0] - from[0]
  const dz = to[2] - from[2]
  if (Math.abs(dx) + Math.abs(dz) !== 1 || Math.abs(to[1] - from[1]) > 1) return null
  return DIRS.findIndex(([x, z]) => x === dx && z === dz) as Dir
}

class UnionFind {
  private parent = new Map<number, number>()
  find(x: number): number {
    let p = this.parent.get(x) ?? x
    if (p !== x) {
      p = this.find(p)
      this.parent.set(x, p)
    }
    return p
  }
  union(a: number, b: number) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return false
    this.parent.set(ra, rb)
    return true
  }
}

export class Castle {
  readonly size: CastleSize
  readonly rooms = new Map<number, Room>()
  readonly edges = new Map<string, Edge>()
  /** Nakime's chamber sits above the top level, in the middle. Fixed. */
  readonly nakimeNode: Node
  readonly nakimeId: number
  /** Her chamber stays sealed until every Upper Moon's room has been found. */
  nakimeOpen = false
  private byNode = new Map<string, number>()
  private rng: ReturnType<typeof createRng>
  private nextId = 1

  constructor(seed: number, size: CastleSize = { x: 5, y: 6, z: 5 }) {
    this.size = size
    this.rng = createRng(seed)
    this.nakimeNode = [Math.floor(size.x / 2), size.y, Math.floor(size.z / 2)]
    this.nakimeId = this.addRoom("nakime", this.nakimeNode).id
    this.generate()
  }

  // ── Queries ────────────────────────────────────────────────────────────

  roomAt(n: Node) {
    const id = this.byNode.get(nodeKey(n))
    return id === undefined ? undefined : this.rooms.get(id)
  }

  inBounds(n: Node) {
    const { x, y, z } = this.size
    return n[0] >= 0 && n[0] < x && n[1] >= 0 && n[1] < y && n[2] >= 0 && n[2] < z
  }

  /** Which of a room's four sides have a passage, and so an open door. */
  openSides(id: number): [boolean, boolean, boolean, boolean] {
    const sides: [boolean, boolean, boolean, boolean] = [false, false, false, false]
    for (const e of this.edges.values()) {
      if (e.a === id) sides[e.dir] = true
      else if (e.b === id) sides[opposite(e.dir)] = true
    }
    return sides
  }

  edgesOf(id: number) {
    return [...this.edges.values()].filter((e) => e.a === id || e.b === id)
  }

  /** Rooms that take part in the maze right now. */
  private graphRooms() {
    return [...this.rooms.values()].filter((r) => r.kind !== "nakime" || this.nakimeOpen)
  }

  /** Every room can reach every other through passages. */
  isConnected() {
    const rooms = this.graphRooms()
    if (rooms.length < 2) return true
    const uf = new UnionFind()
    for (const e of this.edges.values()) uf.union(e.a, e.b)
    const root = uf.find(rooms[0].id)
    return rooms.every((r) => uf.find(r.id) === root)
  }

  /** Shortest number of passages between two rooms, or -1. */
  hops(from: number, to: number) {
    const adj = new Map<number, number[]>()
    for (const e of this.edges.values()) {
      adj.set(e.a, [...(adj.get(e.a) ?? []), e.b])
      adj.set(e.b, [...(adj.get(e.b) ?? []), e.a])
    }
    const seen = new Map([[from, 0]])
    const queue = [from]
    while (queue.length) {
      const cur = queue.shift()!
      if (cur === to) return seen.get(cur)!
      for (const next of adj.get(cur) ?? []) {
        if (!seen.has(next)) {
          seen.set(next, seen.get(cur)! + 1)
          queue.push(next)
        }
      }
    }
    return -1
  }

  landmark(kind: Landmark) {
    return [...this.rooms.values()].find((r) => r.kind === kind)!
  }

  /**
   * A room high in the castle with another room somewhere below it in the
   * same column, so a visitor dropped through its floor lands on something.
   */
  entryRoom() {
    const halls = [...this.rooms.values()].filter((r) => r.kind === "hall")
    const below = (r: Room) => {
      for (let k = r.node[1] - 1; k >= 0; k--) {
        if (this.roomAt([r.node[0], k, r.node[2]])) return r.node[1] - k
      }
      return 0
    }
    // Highest first, then the longest fall that still ends on a roof.
    const ranked = halls
      .map((r) => ({ r, drop: below(r) }))
      .filter((c) => c.drop > 0)
      .sort((p, q) => q.r.node[1] - p.r.node[1] || q.drop - p.drop)
    return (ranked[0]?.r ?? halls[0]).id
  }

  // ── Building ───────────────────────────────────────────────────────────

  private addRoom(kind: RoomKind, node: Node) {
    const room: Room = { id: this.nextId++, kind, node, variant: this.rng.next() }
    this.rooms.set(room.id, room)
    this.byNode.set(nodeKey(node), room.id)
    return room
  }

  private candidateNeighbours(n: Node): Node[] {
    const out: Node[] = []
    for (const [dx, dz] of DIRS) for (const dk of [-1, 0, 1]) out.push([n[0] + dx, n[1] + dk, n[2] + dz])
    return out
  }

  /** The passage two rooms would get, ignoring whether its gap is free. */
  private makeEdge(p: Room, q: Room): Edge | null {
    const side = sideTowards(p.node, q.node)
    if (side === null) return null
    // A stair always runs from its lower room.
    const [a, b] = q.node[1] < p.node[1] ? [q, p] : [p, q]
    const dir = sideTowards(a.node, b.node)!
    const ids = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`
    const key = `${ids}@${nodeKey(a.node)}>${nodeKey(b.node)}`
    const style: EdgeStyle =
      a.node[1] !== b.node[1] ? "stair" : this.rng.chance(0.4) ? "corridor" : "bridge"
    return { key, a: a.id, b: b.id, dir, style }
  }

  private generate() {
    const { x, y, z } = this.size
    const target = Math.round(x * y * z * 0.42)
    const start = this.addRoom("hall", [Math.floor(x / 2), Math.floor(y / 2), Math.floor(z / 2)])
    const placed: Room[] = [start]
    for (let attempt = 0; placed.length < target && attempt < 20000; attempt++) {
      const from = this.rng.pick(placed)
      const n = this.rng.pick(this.candidateNeighbours(from.node))
      if (!this.inBounds(n) || this.roomAt(n)) continue
      const room = this.addRoom("hall", n)
      const edge = this.makeEdge(from, room)!
      this.edges.set(edge.key, edge)
      placed.push(room)
    }
    // A few loops, so it's a maze rather than a tree.
    for (const p of placed) {
      for (const n of this.candidateNeighbours(p.node)) {
        const q = this.roomAt(n)
        if (!q || q.kind === "nakime" || q.id < p.id || !this.rng.chance(0.3)) continue
        const e = this.makeEdge(p, q)!
        if (!this.edges.has(e.key)) this.edges.set(e.key, e)
      }
    }
    this.placeLandmarks(placed)
    // Some of the plain rooms are open-air stages instead of halls.
    for (const r of placed) if (r.kind === "hall" && this.rng.chance(0.24)) r.kind = "terrace"
  }

  /** Upper One lives deepest, Upper Three highest, each far from the others. */
  private placeLandmarks(placed: Room[]) {
    const { y } = this.size
    const bands: [Landmark, number, number][] = [
      ["kokushibo", 0, Math.max(0, Math.floor(y / 3) - 1)],
      ["doma", Math.floor(y / 3), Math.floor((2 * y) / 3) - 1],
      ["akaza", Math.floor((2 * y) / 3), y - 2],
    ]
    const taken: Room[] = []
    for (const [kind, lo, hi] of bands) {
      const pool = placed.filter((r) => r.kind === "hall" && !taken.includes(r))
      const inBand = pool.filter((r) => r.node[1] >= lo && r.node[1] <= Math.max(lo, hi))
      const choices = inBand.length ? inBand : pool
      // Farthest from the landmarks already placed, with a little chance.
      const far = (r: Room) =>
        taken.reduce((m, t) => Math.min(m, Math.abs(t.node[0] - r.node[0]) + Math.abs(t.node[2] - r.node[2])), 9) +
        this.rng.next()
      const room = choices.reduce((best, r) => (far(r) > far(best) ? r : best))
      room.kind = kind
      taken.push(room)
    }
  }

  // ── Nakime's biwa ──────────────────────────────────────────────────────

  /** Rooms joined by "could have a passage", regardless of gaps. */
  private adjacencyConnected(rooms: Room[]) {
    if (rooms.length < 2) return true
    const seen = new Set([rooms[0].id])
    const queue = [rooms[0]]
    while (queue.length) {
      const r = queue.shift()!
      for (const n of this.candidateNeighbours(r.node)) {
        const q = this.roomAt(n)
        if (q && !seen.has(q.id) && rooms.includes(q)) {
          seen.add(q.id)
          queue.push(q)
        }
      }
    }
    return seen.size === rooms.length
  }

  /** A room at `n` would have a neighbour to join (other than itself). */
  touchesMaze(n: Node, self: Room) {
    return this.candidateNeighbours(n).some((m) => {
      const q = this.roomAt(m)
      return q && q !== self && (q.kind !== "nakime" || this.nakimeOpen)
    })
  }

  private moveRoom(room: Room, to: Node) {
    this.byNode.delete(nodeKey(room.node))
    room.node = to
    this.byNode.set(nodeKey(to), room.id)
  }

  /**
   * One strum: slide a few rooms to new nodes and re-wire the passages.
   * Rooms keep their passages when neither end moved (most of the time),
   * the maze stays connected, and locked rooms and passages stay put.
   */
  shift(opts: ShiftOptions = {}): ShiftPlan {
    const lockedRooms = opts.lockedRooms ?? new Set<number>()
    const lockedEdges = opts.lockedEdges ?? new Set<string>()
    const blocked = opts.blocked ?? (() => false)
    const count = opts.count ?? 4
    // Rooms at either end of a locked passage can't move either.
    const pinned = new Set(lockedRooms)
    // Rooms that must stay whatever `first` says: ends of a locked passage, Nakime's feet.
    const held = new Set<number>()
    for (const key of lockedEdges) {
      const e = this.edges.get(key)
      if (e) {
        pinned.add(e.a).add(e.b)
        held.add(e.a).add(e.b)
      }
    }

    const moves: Move[] = []
    const movable = [...this.rooms.values()].filter((r) => r.kind !== "nakime" && !pinned.has(r.id))
    this.shuffle(movable)

    const tryMove = (room: Room, targets: Node[], check = blocked) => {
      const from = room.node
      this.byNode.delete(nodeKey(from))
      // Nakime hangs off the maze by the rooms at her feet, which are pinned.
      const rest = this.graphRooms().filter((r) => r !== room && r.kind !== "nakime")
      if (!this.adjacencyConnected(rest)) {
        this.byNode.set(nodeKey(from), room.id)
        return false
      }
      const options = targets.filter(
        (n) => !this.roomAt(n) && !sameNode(n, from) && this.touchesMaze(n, room) && !check(from, n)
      )
      this.byNode.set(nodeKey(from), room.id)
      if (!options.length) return false
      // Prefer short slides: the castle rearranges itself locally.
      const dist = (n: Node) => Math.abs(n[0] - from[0]) + Math.abs(n[1] - from[1]) + Math.abs(n[2] - from[2])
      options.sort((p, q) => dist(p) - dist(q) + (this.rng.next() - 0.5) * 3)
      const to = options[0]
      this.moveRoom(room, to)
      moves.push({ id: room.id, from, to })
      return true
    }

    // Once her chamber opens, someone has to stand at the foot of its stairs.
    if (this.nakimeOpen) {
      const [cx, cy, cz] = this.nakimeNode
      const feet: Node[] = DIRS.map(([dx, dz]) => [cx + dx, cy - 1, cz + dz])
      if (!feet.some((n) => this.roomAt(n))) {
        for (const room of movable) if (tryMove(room, feet)) break
      }
      for (const n of feet) {
        const r = this.roomAt(n)
        if (r) {
          pinned.add(r.id)
          held.add(r.id)
        }
      }
    }

    const all = this.allNodes()
    for (const f of opts.first ?? []) {
      const room = this.rooms.get(f.id)
      if (!room || room.kind === "nakime" || held.has(room.id) || moves.some((m) => m.id === room.id)) continue
      if (tryMove(room, f.to ? [f.to] : this.shuffle(all.filter((n) => !f.avoid?.(n))), () => false)) pinned.add(room.id)
    }
    for (const room of movable) {
      if (moves.length >= count) break
      if (pinned.has(room.id) || moves.some((m) => m.id === room.id)) continue
      if (isLandmark(room.kind) && !this.rng.chance(0.3)) continue
      tryMove(room, this.shuffle(all.slice()))
    }

    const old = [...this.edges.values()]
    const next = this.rewire(old, new Set(moves.map((m) => m.id)), lockedEdges)
    const removed = old.filter((e) => !next.has(e.key))
    const added = [...next.values()].filter((e) => !this.edges.has(e.key))
    this.edges.clear()
    for (const [k, e] of next) this.edges.set(k, e)
    return { moves, removed, added }
  }

  /**
   * New passages for the current room layout: locked passages stay, then a
   * spanning tree grown preferring passages that already exist (so most of
   * the castle stays as the visitor left it), then a few loops.
   */
  private rewire(old: Edge[], moved: Set<number>, locked: ReadonlySet<string>) {
    const surviving = new Set(old.filter((e) => !moved.has(e.a) && !moved.has(e.b)).map((e) => e.key))
    const candidates: Edge[] = []
    for (const p of this.graphRooms()) {
      for (const n of this.candidateNeighbours(p.node)) {
        const q = this.roomAt(n)
        if (!q || q.id < p.id || (q.kind === "nakime" && !this.nakimeOpen)) continue
        const e = this.makeEdge(p, q)
        if (e) candidates.push(this.edges.get(e.key) ?? e)
      }
    }
    const next = new Map<string, Edge>()
    const uf = new UnionFind()
    const add = (e: Edge) => {
      next.set(e.key, e)
      uf.union(e.a, e.b)
    }
    for (const e of candidates) if (locked.has(e.key) && surviving.has(e.key)) add(e)
    const preferred = this.shuffle(candidates.filter((e) => surviving.has(e.key) && this.rng.chance(0.75)))
    const others = this.shuffle(candidates.filter((e) => !preferred.includes(e)))
    for (const e of [...preferred, ...others]) if (uf.find(e.a) !== uf.find(e.b)) add(e)
    for (const e of candidates) {
      if (!next.has(e.key) && this.rng.chance(surviving.has(e.key) ? 0.6 : 0.2)) add(e)
    }
    return next
  }

  private allNodes() {
    const out: Node[] = []
    const { x, y, z } = this.size
    for (let i = 0; i < x; i++) for (let k = 0; k < y; k++) for (let j = 0; j < z; j++) out.push([i, k, j])
    return out
  }

  private shuffle<T>(list: T[]) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
    return list
  }
}
