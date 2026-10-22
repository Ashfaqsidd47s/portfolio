import {
  CELL,
  Castle,
  DIRS,
  LEVEL,
  ROOM_R,
  SPAN,
  STAIR_LANE,
  nodeCenter,
  opposite,
  type Edge,
  type EdgeStyle,
  type Room,
  type RoomKind,
  type ShiftPlan,
  type Spur,
  type Stray,
  type Vec3,
} from "./castle"
import { TURNED, apply, orientBox, sideVector, unapply, type Mat3 } from "./orient"
import type { Box } from "./physics"
import { turn } from "./render/builder"
import { DOOR_H, DOOR_W, PART_COUNT, TRAP_PART, WALL, WALL_H, doorPart, gatePart, type Template } from "./render/kit"

/**
 * The castle in motion. Each room and passage is a block with a live
 * position, how far its doors, rail gates and trapdoor are open, and (for
 * passages) how far it has unfolded. A strum is a timeline of tweens on
 * those numbers; the renderer draws them and the physics collides with
 * them, so what you see is what you stand on.
 *
 * Strays (rooms turned over) are blocks with an orientation; a spur is a
 * bridge stretched from a hall to a stray's door.
 */

export type TemplateKey = RoomKind | EdgeStyle

export type Block = {
  key: string
  /** Physics owner id: the room id, or 100000+ for passages. */
  owner: number
  template: TemplateKey
  room?: Room
  edge?: Edge
  pos: Vec3
  /** Quarter turns about +y (passages run along their room's side). */
  q: number
  /** A stray's orientation (its frame to the world); upright blocks have none. */
  orient?: Mat3
  /** While a stray turns over: the orientation it turns from. */
  turnFrom?: Mat3
  /** 0–1 through a turn; 1 when settled. Turning blocks aren't solid. */
  turnT: number
  /** Length multiplier along the block's run (spurs reach into a stray's doorway). */
  stretch: number
  stray?: Stray
  spur?: Spur
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
  /** A part index, or "extend", "pos" or "turn". */
  prop: number | "extend" | "pos" | "turn"
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

/** How far a spur runs: from a hall's platform edge into the stray's doorway. */
const SPUR_RUN = CELL - ROOM_R - WALL
const SPUR_STRETCH = SPUR_RUN / SPAN

/**
 * Where a stray sits relative to its node: shifted so that every door that
 * faces sideways has its sill level with the bridges and its middle on
 * their line. (A turned room's doors are all alike, so one offset serves.)
 */
export function strayOffset(m: Mat3): Vec3 {
  for (let d = 0; d < 4; d++) {
    const n = apply(m, sideVector(d))
    if (n[1] !== 0) continue
    // The doorway, in the side's frame, then in the room's, then the world's.
    const [ax, az] = turn(d, WALL - 0.2, -DOOR_W)
    const [bx, bz] = turn(d, ROOM_R, DOOR_W)
    const box = orientBox(m, [Math.min(ax, bx), 0, Math.min(az, bz)], [Math.max(ax, bx), DOOR_H, Math.max(az, bz)])
    const across = n[0] !== 0 ? 2 : 0
    const out: Vec3 = [0, -box.min[1], 0]
    out[across] = -(box.min[across] + box.max[across]) / 2
    return out
  }
  return [0, 0, 0]
}

const plus = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export class World {
  readonly castle: Castle
  readonly blocks = new Map<string, Block>()
  private templates: Map<TemplateKey, Template>
  private tweens: Tween[] = []
  private clock = 0
  private nextEdgeOwner = 100000

  constructor(castle: Castle, templates: Map<TemplateKey, Template>) {
    this.castle = castle
    this.templates = templates
    for (const room of castle.rooms.values()) this.addRoom(room)
    for (const edge of castle.edges.values()) this.addEdge(edge, 1)
    for (const stray of castle.strays) this.addStray(stray)
    for (const spur of castle.spurs()) this.addSpur(spur, 1)
    this.settleOpenings()
  }

  get time() {
    return this.clock
  }

  roomBlock(id: number) {
    return this.blocks.get(`r${id}`)
  }

  strayBlock(id: number) {
    return this.blocks.get(`x${id}`)
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
      turnT: 1,
      stretch: 1,
    }
    this.blocks.set(block.key, block)
  }

  private addStray(stray: Stray) {
    const orient = TURNED[stray.orient]
    const block: Block = {
      key: `x${stray.id}`,
      owner: stray.id,
      template: "hall",
      stray,
      pos: plus(nodeCenter(stray.node), strayOffset(orient)),
      q: 0,
      orient,
      extend: 1,
      open: new Float32Array(PART_COUNT),
      dying: false,
      seed: (stray.id * 0.377) % 1,
      turnT: 1,
      stretch: 1,
    }
    this.blocks.set(block.key, block)
  }

  private addSpur(spur: Spur, extend: number) {
    const anchor = this.castle.rooms.get(spur.anchor)!
    const block: Block = {
      key: `s${spur.key}`,
      owner: this.nextEdgeOwner++,
      template: "bridge",
      spur,
      pos: edgeOrigin(anchor, spur.dir),
      q: spur.dir,
      extend,
      open: new Float32Array(PART_COUNT),
      dying: false,
      seed: (this.nextEdgeOwner * 0.618) % 1,
      turnT: 1,
      stretch: SPUR_STRETCH,
    }
    this.blocks.set(block.key, block)
    return block
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
      turnT: 1,
      stretch: 1,
    }
    this.blocks.set(block.key, block)
    return block
  }

  /** Rooms and strays: everything with doors. */
  private *doorBlocks() {
    for (const room of this.castle.rooms.values()) yield this.roomBlock(room.id)!
    for (const stray of this.castle.strays) yield this.strayBlock(stray.id)!
  }

  /** What a room's (or stray's) doors and gates should be, given its passages. */
  private wanted(block: Block, spurs = this.castle.spurs()) {
    const open = new Float32Array(PART_COUNT)
    if (block.room) {
      for (const e of this.castle.edgesOf(block.room.id)) {
        for (const l of landings(e)) {
          if (l.room !== block.room.id) continue
          open[doorPart(l.side)] = 1
          open[gatePart(l.side, l.lane)] = 1
        }
      }
    }
    for (const s of spurs) {
      if (s.anchor === block.room?.id) {
        open[doorPart(s.dir)] = 1
        open[gatePart(s.dir, 1)] = 1
      } else if (s.stray === block.stray?.id) {
        open[doorPart(s.side)] = 1
        open[gatePart(s.side, 1)] = 1
      }
    }
    return open
  }

  /** Snap every room's openings to its passages (at build time). */
  private settleOpenings() {
    for (const block of this.doorBlocks()) {
      const want = this.wanted(block)
      // Doors and gates only: the trapdoor and roof keep their own state.
      for (let p = 1; p < TRAP_PART; p++) block.open[p] = want[p]
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
  play(plan: ShiftPlan, opts: { cascadeFrom?: Vec3; still?: ReadonlySet<number> } = {}): number {
    const rnd = () => Math.random()
    const arrive = new Map<number, number>()
    let end = 1

    const spurs = this.castle.spurs()
    const keep = new Set(spurs.map((s) => `s${s.key}`))
    const gone = [...plan.removed.map((e) => this.blocks.get(`e${e.key}`))]
    for (const block of this.blocks.values()) if (block.spur && !block.dying && !keep.has(block.key)) gone.push(block)
    for (const block of gone) {
      if (!block) continue
      block.dying = true
      const at = 0.25 + rnd() * 0.2
      this.tween({ block, prop: "extend", from: block.extend, to: 0, at, dur: 0.55, ease: easeIn, done: () => this.blocks.delete(block.key) })
    }

    // Doors first: whatever loses its passage slams shut. A stray about
    // to turn over shuts every door.
    const turning = new Set(plan.turned.map((t) => t.id))
    for (const block of this.doorBlocks()) {
      const want = block.stray && turning.has(block.stray.id) ? new Float32Array(PART_COUNT) : this.wanted(block, spurs)
      for (let p = 1; p < TRAP_PART; p++) {
        if (want[p] < 0.5 && block.open[p] > 0.5) this.setPart(block, p, 0, 0.05 + rnd() * 0.25, 0.16, easeIn)
      }
    }

    for (const t of plan.turned) {
      const block = this.strayBlock(t.id)!
      const stray = block.stray!
      const delay = 0.6 + rnd() * 0.4
      const dur = 1.5
      block.turnFrom = TURNED[t.from]
      block.orient = TURNED[t.to]
      block.turnT = 0
      this.tween({ block, prop: "turn", from: 0, to: 1, at: delay, dur, ease: easeInOut })
      const to = plus(nodeCenter(stray.node), strayOffset(block.orient))
      this.tween({ block, prop: "pos", from: block.pos, to, at: delay, dur, ease: easeInOut })
      arrive.set(t.id, delay + dur)
      end = Math.max(end, delay + dur)
    }

    for (const m of plan.moves) {
      const block = this.roomBlock(m.id)!
      const delay = 0.85 + rnd() * 0.45
      const from = nodeCenter(m.from)
      const to = nodeCenter(m.to)
      const dist = Math.hypot(to[0] - from[0], (to[1] - from[1]) * 1.5, to[2] - from[2])
      const dur = 1.0 + dist * 0.025
      this.tween({ block, prop: "pos", from, to, at: delay, dur, ease: easeInOut })
      arrive.set(m.id, delay + dur)
      end = Math.max(end, delay + dur)
    }

    for (const s of spurs) {
      if (this.blocks.has(`s${s.key}`)) continue
      const start = Math.max(arrive.get(s.anchor) ?? 0.95, arrive.get(s.stray) ?? 0.95) + 0.1
      const block = this.addSpur(s, 0)
      this.tween({ block, prop: "extend", from: 0, to: 1, at: start, dur: 0.6, ease: easeOutBack })
      const anchor = this.roomBlock(s.anchor)!
      const stray = this.strayBlock(s.stray)!
      this.setPart(anchor, doorPart(s.dir), 1, start - 0.2, 0.3)
      this.setPart(anchor, gatePart(s.dir, 1), 1, start - 0.15, 0.3)
      this.setPart(stray, doorPart(s.side), 1, start + 0.3, 0.3)
      this.setPart(stray, gatePart(s.side, 1), 1, start + 0.35, 0.3)
      end = Math.max(end, start + 0.65)
    }

    for (const e of plan.added) {
      const start = Math.max(arrive.get(e.a) ?? 0.95, arrive.get(e.b) ?? 0.95) + 0.05
      const block = this.addEdge(e, 0)
      this.tween({ block, prop: "extend", from: 0, to: 1, at: start, dur: 0.55, ease: easeOutBack })
      for (const l of landings(e)) {
        const room = this.roomBlock(l.room)!
        this.setPart(room, doorPart(l.side), 1, start - 0.2, 0.3)
        this.setPart(room, gatePart(l.side, l.lane), 1, start - 0.15, 0.3)
      }
      end = Math.max(end, start + 0.55)
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
          const at = 0.05 + d * 0.012
          this.setPart(block, p, 0, at, 0.14, easeIn)
          this.setPart(block, p, 1, at + 0.5 + rnd() * 0.4, 0.3)
        }
      }
    }
    return end
  }

  update(dt: number) {
    this.clock += dt
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
      } else if (t.prop === "turn") {
        t.block.turnT = (t.from as number) + ((t.to as number) - (t.from as number)) * t.ease(k)
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

  // ── Physics ────────────────────────────────────────────────────────────

  /** Collision boxes of every block near a point, in world space. */
  collect(p: Vec3, radius: number, out: Box[] = []): Box[] {
    out.length = 0
    for (const block of this.blocks.values()) {
      if (block.dying || block.extend < 0.999 || block.turnT < 1) continue
      const reach = radius + 16
      const c = this.blockCentre(block)
      if (Math.abs(c[0] - p[0]) > reach || Math.abs(c[1] - p[1]) > reach || Math.abs(c[2] - p[2]) > reach) continue
      const tpl = this.templates.get(block.template)!
      for (const b of tpl.boxes) {
        if (b.part && block.open[b.part] >= 0.5) continue
        if (block.orient) {
          const o = orientBox(block.orient, b.min, b.max)
          out.push({ min: plus(o.min, block.pos), max: plus(o.max, block.pos), owner: block.owner })
          continue
        }
        const k = block.stretch
        const [ax, az] = turn(block.q, b.min[0] * k, b.min[2])
        const [bx, bz] = turn(block.q, b.max[0] * k, b.max[2])
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
    if (block.room || block.stray) return block.pos
    const [x, z] = turn(block.q, 6.2 * block.stretch, 0)
    return [block.pos[0] + x, block.pos[1] + LEVEL / 2, block.pos[2] + z]
  }

  /** The stray whose walls enclose a point, measured in its own frame. */
  strayContaining(p: Vec3, margin = -0.25): Block | undefined {
    for (const stray of this.castle.strays) {
      const block = this.strayBlock(stray.id)!
      if (block.turnT < 1) continue
      const l = unapply(block.orient!, [p[0] - block.pos[0], p[1] - block.pos[1], p[2] - block.pos[2]])
      if (Math.abs(l[0]) < WALL + margin && Math.abs(l[2]) < WALL + margin && l[1] > -0.4 && l[1] < WALL_H) return block
    }
    return undefined
  }

  /** The spur a point is on, short of the stray's doorway: there, down is down again. */
  spurAt(p: Vec3): Block | undefined {
    for (const block of this.blocks.values()) {
      if (!block.spur || block.dying || block.extend < 0.999) continue
      const [dx, dz] = DIRS[block.q]
      const rel = [p[0] - block.pos[0], p[2] - block.pos[2]]
      const along = rel[0] * dx + rel[1] * dz
      const across = Math.abs(rel[0] * -dz + rel[1] * dx)
      const dy = p[1] - block.pos[1]
      if (along > -1 && along < SPUR_RUN - 0.25 && across < 1.7 && dy > -1.5 && dy < 3.4) return block
    }
    return undefined
  }

  blockByOwner(owner: number) {
    for (const b of this.blocks.values()) if (b.owner === owner) return b
    return undefined
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

  /** Rooms, passages and strays within reach of a point: they must not move under it. */
  near(p: Vec3, margin: number) {
    const rooms = new Set<number>()
    const edges = new Set<string>()
    const strays = new Set<number>()
    // In or by a stray (or on its spur), its halls must stay to let you out.
    const keepStray = (id: number) => {
      strays.add(id)
      for (const s of this.castle.spurs()) if (s.stray === id) rooms.add(s.anchor)
    }
    for (const block of this.blocks.values()) {
      if (block.stray) {
        const d = Math.max(...[0, 1, 2].map((i) => Math.abs(p[i] - block.pos[i])))
        if (d < 9 + margin) keepStray(block.stray.id)
        continue
      }
      if (block.spur) {
        const [dx, dz] = DIRS[block.q]
        const rel = [p[0] - block.pos[0], p[2] - block.pos[2]]
        const along = rel[0] * dx + rel[1] * dz
        const across = Math.abs(rel[0] * -dz + rel[1] * dx)
        const dy = p[1] - block.pos[1]
        if (along > -margin && along < SPUR_RUN + margin && across < 2 + margin && dy > -3 - margin && dy < 4 + margin) {
          rooms.add(block.spur.anchor)
          keepStray(block.spur.stray)
        }
        continue
      }
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
    return { rooms, edges, strays }
  }
}
