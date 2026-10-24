import {
  CELL,
  Castle,
  DIRS,
  LEVEL,
  ROOM_R,
  STAIR_LANE,
  nodeCenter,
  opposite,
  type Edge,
  type EdgeStyle,
  type Room,
  type RoomKind,
  type ShiftPlan,
  type Vec3,
} from "./castle"
import type { Box } from "./physics"
import { turn } from "./render/builder"
import { CAR_HALF, COUPLER, PART_COUNT, TRAP_PART, WALL, doorPart, gatePart, type CarKind, type Template } from "./render/kit"

/**
 * The castle in motion. Each room and passage is a block with a live
 * position, how far its doors, rail gates and trapdoor are open, and (for
 * passages) how far it has unfolded. A strum is a timeline of tweens on
 * those numbers; the renderer draws them and the physics collides with
 * them, so what you see is what you stand on.
 */

export type TemplateKey = RoomKind | EdgeStyle | CarKind

/**
 * A train of halls that never stops: it runs a straight track round the
 * outside of the lattice, out into the fog and back in at the far end.
 */
export type Train = {
  /** Where the track starts; it runs `length` metres along `dir`. */
  from: Vec3
  dir: Vec3
  length: number
  speed: number
  /** How far along the track the lead carriage is. */
  s: number
  cars: { block: Block; behind: number }[]
}

export type Block = {
  key: string
  /** Physics owner id: the room id, or 100000+ for passages. */
  owner: number
  template: TemplateKey
  room?: Room
  edge?: Edge
  /** A carriage: the train it belongs to. */
  train?: Train
  pos: Vec3
  /** Quarter turns about +y (passages run along their room's side). */
  q: number
  /** 0–1: a passage unfolds out of its lower room. */
  extend: number
  open: Float32Array
  /** Fades out, then is removed. */
  dying: boolean
  /** Variety for the shader: fusuma painting, lantern colour. */
  seed: number
}

type Tween = {
  block: Block
  /** A part index, or "extend", or "pos". */
  prop: number | "extend" | "pos"
  from: number | Vec3
  to: number | Vec3
  start: number
  dur: number
  ease: (t: number) => number
  done?: () => void
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeIn = (t: number) => t * t * t
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2

const laneOf = (t: number) => (t < -1 ? 0 : t > 1 ? 2 : 1)

/** Where a passage's block sits: on the edge of its lower room's platform. */
export function edgeOrigin(a: Room, dir: number): Vec3 {
  const c = nodeCenter(a.node)
  const [x, z] = turn(dir, ROOM_R, 0)
  return [c[0] + x, c[1], c[2] + z]
}

/** The side and gate lane a passage lands on, at each of its rooms. */
export function landings(e: Edge): { side: number; lane: number; room: number }[] {
  const lane = e.style === "stair" ? -STAIR_LANE : 0
  // Seen from the far room, the lane is mirrored.
  return [
    { room: e.a, side: e.dir, lane: laneOf(lane) },
    { room: e.b, side: opposite(e.dir), lane: laneOf(-lane) },
  ]
}

export type ShiftTiming = { length: number }

export class World {
  readonly castle: Castle
  readonly blocks = new Map<string, Block>()
  private templates: Map<TemplateKey, Template>
  private tweens: Tween[] = []
  private clock = 0
  private nextEdgeOwner = 100000
  private nextCarOwner = 200000
  readonly trains: Train[] = []

  constructor(castle: Castle, templates: Map<TemplateKey, Template>) {
    this.castle = castle
    this.templates = templates
    for (const room of castle.rooms.values()) this.addRoom(room)
    for (const edge of castle.edges.values()) this.addEdge(edge, 1)
    this.settleOpenings()
    this.layTracks()
  }

  /**
   * Four tracks, one along each side of the castle just outside the
   * lattice, each at its own height so they cross without meeting. Two
   * trains on each, half a track apart.
   */
  private layTracks() {
    const { x, z } = this.castle.size
    const out = 7 * CELL
    const tracks: { from: Vec3; dir: Vec3; length: number }[] = [
      { from: [-CELL, LEVEL, -out], dir: [0, 0, 1], length: (z - 1) * CELL + 2 * out },
      { from: [x * CELL, 4 * LEVEL, (z - 1) * CELL + out], dir: [0, 0, -1], length: (z - 1) * CELL + 2 * out },
      { from: [(x - 1) * CELL + out, 2.6 * LEVEL, -CELL], dir: [-1, 0, 0], length: (x - 1) * CELL + 2 * out },
      { from: [-out, 5.2 * LEVEL, z * CELL], dir: [1, 0, 0], length: (x - 1) * CELL + 2 * out },
    ]
    for (const t of tracks) {
      const speed = 6.5 + Math.random() * 3.5
      for (let k = 0; k < 2; k++) {
        const train: Train = { ...t, speed, s: (k + Math.random() * 0.3) * (t.length / 2), cars: [] }
        const count = 4 + Math.floor(Math.random() * 3)
        let behind = 0
        for (let i = 0; i < count; i++) {
          const kind: CarKind = i === 1 && Math.random() < 0.7 ? "great" : i % 2 === 0 ? "deck" : "carriage"
          behind += i === 0 ? 0 : CAR_HALF[kind]
          const block: Block = {
            key: `t${this.trains.length}:${i}`,
            owner: this.nextCarOwner++,
            template: kind,
            train,
            pos: [...t.from],
            q: t.dir[0] > 0 ? 0 : t.dir[2] > 0 ? 1 : t.dir[0] < 0 ? 2 : 3,
            extend: 1,
            open: new Float32Array(PART_COUNT),
            dying: false,
            seed: Math.random(),
          }
          train.cars.push({ block, behind })
          this.blocks.set(block.key, block)
          behind += CAR_HALF[kind] + 2 * COUPLER
        }
        this.trains.push(train)
        this.runTrain(train, 0)
      }
    }
  }

  private runTrain(train: Train, dt: number) {
    train.s = (train.s + train.speed * dt) % train.length
    for (const { block, behind } of train.cars) {
      const d = (((train.s - behind) % train.length) + train.length) % train.length
      block.pos = [train.from[0] + train.dir[0] * d, train.from[1], train.from[2] + train.dir[2] * d]
    }
  }

  /** How fast a block is moving on its own (only carriages do). */
  velocity(block: Block): Vec3 {
    const t = block.train
    return t ? [t.dir[0] * t.speed, 0, t.dir[2] * t.speed] : [0, 0, 0]
  }

  get time() {
    return this.clock
  }

  roomBlock(id: number) {
    return this.blocks.get(`r${id}`)
  }

  private addRoom(room: Room) {
    const block: Block = {
      key: `r${room.id}`,
      owner: room.id,
      template: room.kind,
      room,
      pos: nodeCenter(room.node),
      q: 0,
      extend: 1,
      open: new Float32Array(PART_COUNT),
      dying: false,
      seed: room.variant,
    }
    this.blocks.set(block.key, block)
  }

  private addEdge(edge: Edge, extend: number) {
    const a = this.castle.rooms.get(edge.a)!
    const block: Block = {
      key: `e${edge.key}`,
      owner: this.nextEdgeOwner++,
      template: edge.style,
      edge,
      pos: edgeOrigin(a, edge.dir),
      q: edge.dir,
      extend,
      open: new Float32Array(PART_COUNT),
      dying: false,
      seed: (this.nextEdgeOwner * 0.618) % 1,
    }
    this.blocks.set(block.key, block)
    return block
  }

  /** What each room's doors and gates should be, given its passages. */
  private wanted(room: Room) {
    const open = new Float32Array(PART_COUNT)
    for (const e of this.castle.edgesOf(room.id)) {
      for (const l of landings(e)) {
        if (l.room !== room.id) continue
        open[doorPart(l.side)] = 1
        open[gatePart(l.side, l.lane)] = 1
      }
    }
    return open
  }

  /** Snap every room's openings to its passages (at build time). */
  private settleOpenings() {
    for (const room of this.castle.rooms.values()) {
      const block = this.roomBlock(room.id)!
      const want = this.wanted(room)
      for (let p = 1; p < PART_COUNT; p++) if (p !== TRAP_PART) block.open[p] = want[p]
    }
  }

  private tween(t: Omit<Tween, "start"> & { at: number }) {
    this.tweens.push({ ...t, start: this.clock + t.at })
  }

  /** Opens or closes one moving part of a room. */
  setPart(block: Block, part: number, to: number, at = 0, dur = 0.25, ease = easeInOut) {
    this.tween({ block, prop: part, from: NaN, to, at, dur, ease })
  }

  /** Slides a block somewhere (the finale lifts the whole castle). */
  slide(block: Block, to: Vec3, at: number, dur: number, ease: (t: number) => number = easeInOut) {
    this.tween({ block, prop: "pos", from: block.pos, to, at, dur, ease })
  }

  /** Folds a passage away and removes it. */
  fold(block: Block, at: number) {
    block.dying = true
    this.tween({ block, prop: "extend", from: block.extend, to: 0, at, dur: 0.5, ease: easeIn, done: () => this.blocks.delete(block.key) })
  }

  /** Drops any pending motion of one part (a turned room keeps its doors shut). */
  cancel(block: Block, part: number) {
    this.tweens = this.tweens.filter((t) => t.block !== block || t.prop !== part)
  }

  /**
   * Plays a strum's plan: doors slam on passages about to vanish, those
   * passages fold away, rooms slide to their new nodes, and new passages
   * unfold once both of their rooms have arrived. Returns its length.
   */
  play(
    plan: ShiftPlan,
    opts: { cascadeFrom?: Vec3; still?: ReadonlySet<number>; tempo?: number } = {}
  ): { length: number; arrive: Map<number, number> } {
    // Below 1, the whole strum plays faster.
    const k = opts.tempo ?? 1
    const rnd = () => Math.random()
    const arrive = new Map<number, number>()
    let end = k

    for (const e of plan.removed) {
      const block = this.blocks.get(`e${e.key}`)
      if (!block) continue
      block.dying = true
      const at = (0.25 + rnd() * 0.2) * k
      this.tween({ block, prop: "extend", from: 1, to: 0, at, dur: 0.55 * k, ease: easeIn, done: () => this.blocks.delete(block.key) })
    }

    // Doors first: whatever loses its passage slams shut.
    for (const room of this.castle.rooms.values()) {
      const block = this.roomBlock(room.id)!
      const want = this.wanted(room)
      for (let p = 1; p < PART_COUNT; p++) {
        if (p === TRAP_PART) continue
        if (want[p] < 0.5 && block.open[p] > 0.5) this.setPart(block, p, 0, (0.05 + rnd() * 0.25) * k, 0.16, easeIn)
      }
    }

    for (const m of plan.moves) {
      const block = this.roomBlock(m.id)!
      const delay = (0.85 + rnd() * 0.45) * k
      const from = nodeCenter(m.from)
      const to = nodeCenter(m.to)
      const dist = Math.hypot(to[0] - from[0], (to[1] - from[1]) * 1.5, to[2] - from[2])
      const dur = (1.0 + dist * 0.025) * k
      this.tween({ block, prop: "pos", from, to, at: delay, dur, ease: easeInOut })
      arrive.set(m.id, delay + dur)
      end = Math.max(end, delay + dur)
    }

    for (const e of plan.added) {
      const start = Math.max(arrive.get(e.a) ?? 0.95 * k, arrive.get(e.b) ?? 0.95 * k) + 0.05
      const block = this.addEdge(e, 0)
      this.tween({ block, prop: "extend", from: 0, to: 1, at: start, dur: 0.55 * k, ease: easeOutBack })
      for (const l of landings(e)) {
        const room = this.roomBlock(l.room)!
        this.setPart(room, doorPart(l.side), 1, start - 0.2 * k, 0.3 * k)
        this.setPart(room, gatePart(l.side, l.lane), 1, start - 0.15 * k, 0.3 * k)
      }
      end = Math.max(end, start + 0.55 * k)
    }

    // The famous cascade: doors all over the castle bang shut and fly open
    // again, rippling out from the visitor.
    if (opts.cascadeFrom) {
      const c = opts.cascadeFrom
      for (const room of this.castle.rooms.values()) {
        if (opts.still?.has(room.id) || plan.moves.some((m) => m.id === room.id)) continue
        const block = this.roomBlock(room.id)!
        const d = Math.hypot(block.pos[0] - c[0], block.pos[1] - c[1], block.pos[2] - c[2])
        if (d < 14 || rnd() > 0.55) continue
        for (let side = 0; side < 4; side++) {
          const p = doorPart(side)
          if (block.open[p] < 0.5) continue
          const at = (0.05 + d * 0.012) * k
          this.setPart(block, p, 0, at, 0.14, easeIn)
          this.setPart(block, p, 1, at + (0.5 + rnd() * 0.4) * k, 0.3)
        }
      }
    }
    return { length: end, arrive }
  }

  update(dt: number) {
    this.clock += dt
    for (const t of this.trains) this.runTrain(t, dt)
    const now = this.clock
    const finished: Tween[] = []
    for (const t of this.tweens) {
      if (now < t.start) continue
      const k = Math.min(1, (now - t.start) / t.dur)
      if (typeof t.prop === "number") {
        if (Number.isNaN(t.from as number)) t.from = t.block.open[t.prop]
        t.block.open[t.prop] = (t.from as number) + ((t.to as number) - (t.from as number)) * t.ease(k)
      } else if (t.prop === "extend") {
        t.block.extend = (t.from as number) + ((t.to as number) - (t.from as number)) * t.ease(k)
      } else {
        const a = t.from as Vec3
        const b = t.to as Vec3
        const e = t.ease(k)
        t.block.pos = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e]
      }
      if (k >= 1) finished.push(t)
    }
    if (finished.length) {
      this.tweens = this.tweens.filter((t) => !finished.includes(t))
      for (const t of finished) t.done?.()
    }
  }

  get busy() {
    return this.tweens.length > 0
  }

  /** Rooms are still sliding or passages still folding (doors don't count). */
  get moving() {
    return this.tweens.some((t) => typeof t.prop !== "number")
  }

  // ── Physics ────────────────────────────────────────────────────────────

  /** Collision boxes of every block near a point, in world space. */
  collect(p: Vec3, radius: number, out: Box[] = []): Box[] {
    out.length = 0
    for (const block of this.blocks.values()) {
      if (block.dying || block.extend < 0.999) continue
      const reach = radius + 18
      const c = this.blockCentre(block)
      if (Math.abs(c[0] - p[0]) > reach || Math.abs(c[1] - p[1]) > reach || Math.abs(c[2] - p[2]) > reach) continue
      const tpl = this.templates.get(block.template)!
      for (const b of tpl.boxes) {
        if (b.part && block.open[b.part] >= 0.5) continue
        const [ax, az] = turn(block.q, b.min[0], b.min[2])
        const [bx, bz] = turn(block.q, b.max[0], b.max[2])
        out.push({
          min: [Math.min(ax, bx) + block.pos[0], b.min[1] + block.pos[1], Math.min(az, bz) + block.pos[2]],
          max: [Math.max(ax, bx) + block.pos[0], b.max[1] + block.pos[1], Math.max(az, bz) + block.pos[2]],
          owner: block.owner,
        })
      }
    }
    return out
  }

  blockCentre(block: Block): Vec3 {
    if (block.room || block.train) return block.pos
    const [x, z] = turn(block.q, 6.2, 0)
    return [block.pos[0] + x, block.pos[1] + LEVEL / 2, block.pos[2] + z]
  }

  blockByOwner(owner: number) {
    for (const b of this.blocks.values()) if (b.owner === owner) return b
    return undefined
  }

  /**
   * The top of whatever solid is directly under or over a vertical line,
   * from everything in the castle (not just what's near): what someone
   * falling down that line would hit first is the highest box below them.
   */
  solidsAt(x: number, z: number, r: number) {
    const tops: { top: number; bottom: number; owner: number }[] = []
    for (const block of this.blocks.values()) {
      if (block.dying) continue
      const c = this.blockCentre(block)
      if (Math.abs(c[0] - x) > 26 || Math.abs(c[2] - z) > 26) continue
      const tpl = this.templates.get(block.template)!
      for (const b of tpl.boxes) {
        const [ax, az] = turn(block.q, b.min[0], b.min[2])
        const [bx, bz] = turn(block.q, b.max[0], b.max[2])
        const x0 = Math.min(ax, bx) + block.pos[0]
        const x1 = Math.max(ax, bx) + block.pos[0]
        const z0 = Math.min(az, bz) + block.pos[2]
        const z1 = Math.max(az, bz) + block.pos[2]
        if (x + r < x0 || x - r > x1 || z + r < z0 || z - r > z1) continue
        tops.push({ top: b.max[1] + block.pos[1], bottom: b.min[1] + block.pos[1], owner: block.owner })
      }
    }
    return tops
  }

  /** The room whose walls enclose a point (inside, not on the veranda). */
  roomContaining(p: Vec3, margin = 0): Room | undefined {
    for (const block of this.blocks.values()) {
      if (!block.room) continue
      const dx = Math.abs(p[0] - block.pos[0])
      const dz = Math.abs(p[2] - block.pos[2])
      const dy = p[1] - block.pos[1]
      if (dx < WALL + margin && dz < WALL + margin && dy > -1 && dy < 4.4) return block.room
    }
    return undefined
  }

  /** Rooms and passages within reach of a point: they must not move under it. */
  near(p: Vec3, margin: number) {
    const rooms = new Set<number>()
    const edges = new Set<string>()
    for (const block of this.blocks.values()) {
      if (block.room) {
        const dx = Math.abs(p[0] - block.pos[0])
        const dz = Math.abs(p[2] - block.pos[2])
        const dy = p[1] - block.pos[1]
        if (dx < ROOM_R + margin && dz < ROOM_R + margin && dy > -4 - margin && dy < 8 + margin) rooms.add(block.room.id)
      } else if (block.edge && !block.dying) {
        // A passage's footprint: its run out from the room, its lane, its climb.
        const lane = block.edge.style === "stair" ? -STAIR_LANE : 0
        const [ox, oz] = turn(block.q, 0, lane)
        const [dx, dz] = DIRS[block.q]
        const rel = [p[0] - block.pos[0] - ox, p[2] - block.pos[2] - oz]
        const along = rel[0] * dx + rel[1] * dz
        const across = Math.abs(rel[0] * -dz + rel[1] * dx)
        const dy = p[1] - block.pos[1]
        const span = 12.4
        if (along > -margin && along < span + margin && across < 2 + margin && dy > -3 - margin && dy < LEVEL + 3 + margin) {
          edges.add(block.edge.key)
          rooms.add(block.edge.a).add(block.edge.b)
        }
      }
    }
    return { rooms, edges }
  }
}
