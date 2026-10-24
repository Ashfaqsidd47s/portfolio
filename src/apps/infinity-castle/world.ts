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
  type Dock,
  type Edge,
  type EdgeStyle,
  type HallStyle,
  type Room,
  type RoomKind,
  type ShiftPlan,
  type Spur,
  type Stray,
  type Vec3,
} from "./castle"
import {
  buildNetwork,
  carAt,
  carOrient,
  carSeat,
  linePoint,
  segments,
  SEGMENT,
  type CarKind,
  type CarSpec,
  type DeckKind,
  type HallKind,
  type HallSpec,
  type Lane,
  type LineSpec,
  type Network,
} from "./lines"
import { TURNED, apply, orientBox, sameUp, sideVector, unapply, upOf, type Mat3 } from "./orient"
import type { Body, Box, Up } from "./physics"
import { turn } from "./render/builder"
import { DOOR_H, DOOR_W, PART_COUNT, ROOF_PART, TRAP_PART, WALL, WALL_H, doorPart, gatePart, type Template } from "./render/kit"

/**
 * The castle in motion. Each room and passage is a block with a live
 * position, how far its doors, rail gates and trapdoor are open, and (for
 * passages) how far it has unfolded. A strum is a timeline of tweens on
 * those numbers; the renderer draws them and the physics collides with
 * them, so what you see is what you stand on.
 *
 * Strays (rooms turned over) are blocks with an orientation; a spur is a
 * bridge stretched from a hall to a stray's door, and a dock one from a
 * room to a line's deck.
 *
 * The lines (see `lines.ts`) are blocks too: deck segments and great halls
 * that stay put, and cars that slide along their decks all the time.
 * Everything with an orientation pulls toward its own floor: `zoneOf`
 * says which way is up for whatever a collision box belongs to.
 */

export type TemplateKey = RoomKind | EdgeStyle | HallStyle | DeckKind | CarKind | HallKind

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
  dock?: Dock
  /** A segment of a line's deck. */
  line?: LineSpec
  /** A building riding a line. */
  car?: { line: LineSpec; lane: Lane; spec: CarSpec }
  great?: HallSpec
  /** The room Nakime sends up to catch a fall, until it joins the castle. */
  catcher?: boolean
  /** How far from its centre a block's boxes reach (for gathering them). */
  reach: number
  /** 0–1: a passage unfolds out of its lower room. */
  extend: number
  open: Float32Array
  /** Fades out, then is removed. */
  dying: boolean
  /** How far the finale has lifted a fixed block so far. */
  lifted?: number
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

export const UPRIGHT: Up = { axis: 1, sign: 1 }

/** Plain halls are built in a style; other rooms by their kind. */
export const roomTemplate = (room: Room): TemplateKey => (room.kind === "hall" ? room.style : room.kind)

/** How close (centre to surface) another building's floor must be to take you, walking into it. */
const CAPTURE = 1.05
/** The catching room's physics owner, until it joins the castle. */
export const CATCHER_OWNER = 90000

export class World {
  readonly castle: Castle
  readonly blocks = new Map<string, Block>()
  private templates: Map<TemplateKey, Template>
  private tweens: Tween[] = []
  private clock = 0
  private nextEdgeOwner = 100000
  readonly network: Network
  /** Which way is up for each owner's boxes; null for strays (their doors decide). */
  private zones = new Map<number, Up | null>()
  /** Velocity of the room sent up to catch a fall. */
  catcherVel: Vec3 = [0, 0, 0]
  /** The finale drags the lines up with everything else, from this time. */
  private liftFrom = Infinity

  constructor(castle: Castle, templates: Map<TemplateKey, Template>) {
    this.castle = castle
    this.templates = templates
    this.network = buildNetwork(castle)
    for (const room of castle.rooms.values()) this.addRoom(room)
    for (const edge of castle.edges.values()) this.addEdge(edge, 1)
    for (const stray of castle.strays) this.addStray(stray)
    for (const spur of castle.spurs()) this.addSpur(spur, 1)
    for (const dock of castle.docks()) this.addDock(dock, 1)
    this.addNetwork()
    this.settleOpenings()
  }

  private put(block: Block, up: Up | null) {
    this.blocks.set(block.key, block)
    this.zones.set(block.owner, up)
    return block
  }

  /** Which way is up for whatever owns a box: rooms and passages are upright, lines and cars their own way. */
  zoneOf(owner: number): Up | null | undefined {
    return this.zones.get(owner)
  }

  private addNetwork() {
    const base = (key: string, template: TemplateKey, pos: Vec3, orient: Mat3, reach: number): Block => ({
      key,
      owner: this.nextEdgeOwner++,
      template,
      pos,
      q: 0,
      orient,
      extend: 1,
      open: new Float32Array(PART_COUNT),
      dying: false,
      seed: (this.nextEdgeOwner * 0.618) % 1,
      turnT: 1,
      stretch: 1,
      reach,
    })
    for (const line of this.network.lines) {
      const { count, stretch } = segments(line)
      for (let i = 0; i < count; i++) {
        const s = (i + 0.5) * SEGMENT * stretch
        const block = base(`l${line.key}:${i}`, line.deck, linePoint(line, s, 0, 0), line.orient, 16)
        block.stretch = stretch
        block.line = line
        this.put(block, upOf(line.orient))
      }
      line.lanes.forEach((lane, li) => {
        lane.cars.forEach((spec, ci) => {
          const block = base(`c${line.key}:${li}:${ci}`, spec.kind, [0, 0, 0], carOrient(line, spec), 12)
          block.car = { line, lane, spec }
          this.put(block, upOf(block.orient!))
        })
      })
    }
    for (const hall of this.network.halls) {
      const block = base(`g${hall.key}`, hall.kind, hall.pos, hall.orient, 34)
      block.great = hall
      this.put(block, upOf(hall.orient))
    }
    this.moveCars()
  }

  /** Every car to where its schedule has it now. */
  private moveCars() {
    const lift = this.clock > this.liftFrom ? ((this.clock - this.liftFrom) / 5) ** 2 * 400 : 0
    for (const block of this.blocks.values()) {
      if (block.line || block.great) {
        if (lift) block.pos = [block.pos[0], block.pos[1] + lift - (block.lifted ?? 0), block.pos[2]]
        block.lifted = lift
        continue
      }
      if (!block.car) continue
      const { line, lane, spec } = block.car
      const at = carAt(line, lane, spec, this.clock)
      const seat = carSeat(spec, lane)
      const p = linePoint(line, at.s, seat.across, seat.up)
      block.pos = [p[0], p[1] + lift, p[2]]
      block.extend = at.extend
    }
  }

  /** The finale: the lines and their halls rise with the castle. */
  liftLines(at: number) {
    this.liftFrom = this.clock + at
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
      template: roomTemplate(room),
      room,
      pos: nodeCenter(room.node),
      q: 0,
      extend: 1,
      open: new Float32Array(PART_COUNT),
      dying: false,
      seed: room.variant,
      turnT: 1,
      stretch: 1,
      reach: 16,
    }
    this.put(block, UPRIGHT)
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
      reach: 16,
    }
    this.put(block, null)
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
      reach: 16,
    }
    return this.put(block, UPRIGHT)
  }

  private addDock(dock: Dock, extend: number) {
    const anchor = this.castle.rooms.get(dock.anchor)!
    const block: Block = {
      key: `d${dock.key}`,
      owner: this.nextEdgeOwner++,
      template: "bridge",
      dock,
      pos: edgeOrigin(anchor, dock.dir),
      q: dock.dir,
      extend,
      open: new Float32Array(PART_COUNT),
      dying: false,
      seed: (this.nextEdgeOwner * 0.618) % 1,
      turnT: 1,
      stretch: dock.len / SPAN,
      reach: 16,
    }
    return this.put(block, UPRIGHT)
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
      reach: 16,
    }
    return this.put(block, UPRIGHT)
  }

  /** Rooms and strays: everything with doors. */
  private *doorBlocks() {
    for (const room of this.castle.rooms.values()) yield this.roomBlock(room.id)!
    for (const stray of this.castle.strays) yield this.strayBlock(stray.id)!
  }

  /** What a room's (or stray's) doors and gates should be, given its passages. */
  private wanted(block: Block, spurs = this.castle.spurs(), docks = this.castle.docks()) {
    const open = new Float32Array(PART_COUNT)
    for (const d of docks) {
      if (d.anchor !== block.room?.id) continue
      open[doorPart(d.dir)] = 1
      open[gatePart(d.dir, 1)] = 1
    }
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

  /** Opens whatever doors and gates a room's passages, bridges and docks want. */
  reopen(block: Block, at: number) {
    const want = this.wanted(block)
    for (let p = 1; p < TRAP_PART; p++) if (want[p] > 0.5) this.setPart(block, p, 1, at, 0.3)
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

    const spurs = this.castle.spurs()
    const docks = this.castle.docks()
    const keep = new Set([...spurs.map((s) => `s${s.key}`), ...docks.map((d) => `d${d.key}`)])
    const gone = [...plan.removed.map((e) => this.blocks.get(`e${e.key}`))]
    for (const block of this.blocks.values()) if ((block.spur || block.dock) && !block.dying && !keep.has(block.key)) gone.push(block)
    for (const block of gone) {
      if (!block) continue
      block.dying = true
      const at = (0.25 + rnd() * 0.2) * k
      this.tween({ block, prop: "extend", from: block.extend, to: 0, at, dur: 0.55 * k, ease: easeIn, done: () => this.blocks.delete(block.key) })
    }

    // Doors first: whatever loses its passage slams shut. A stray about
    // to turn over shuts every door.
    const turning = new Set(plan.turned.map((t) => t.id))
    for (const block of this.doorBlocks()) {
      const want = block.stray && turning.has(block.stray.id) ? new Float32Array(PART_COUNT) : this.wanted(block, spurs, docks)
      for (let p = 1; p < TRAP_PART; p++) {
        if (want[p] < 0.5 && block.open[p] > 0.5) this.setPart(block, p, 0, (0.05 + rnd() * 0.25) * k, 0.16, easeIn)
      }
    }

    for (const t of plan.turned) {
      const block = this.strayBlock(t.id)!
      const stray = block.stray!
      const delay = (0.6 + rnd() * 0.4) * k
      const dur = 1.5 * k
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
      const delay = (0.85 + rnd() * 0.45) * k
      const from = nodeCenter(m.from)
      const to = nodeCenter(m.to)
      const dist = Math.hypot(to[0] - from[0], (to[1] - from[1]) * 1.5, to[2] - from[2])
      const dur = (1.0 + dist * 0.025) * k
      this.tween({ block, prop: "pos", from, to, at: delay, dur, ease: easeInOut })
      arrive.set(m.id, delay + dur)
      end = Math.max(end, delay + dur)
    }

    for (const s of spurs) {
      if (this.blocks.has(`s${s.key}`)) continue
      const start = Math.max(arrive.get(s.anchor) ?? 0.95 * k, arrive.get(s.stray) ?? 0.95 * k) + 0.1
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

    for (const d of docks) {
      if (this.blocks.has(`d${d.key}`)) continue
      const start = (arrive.get(d.anchor) ?? 0.95 * k) + 0.1
      const block = this.addDock(d, 0)
      this.tween({ block, prop: "extend", from: 0, to: 1, at: start, dur: 0.6, ease: easeOutBack })
      const anchor = this.roomBlock(d.anchor)!
      this.setPart(anchor, doorPart(d.dir), 1, start - 0.2, 0.3)
      this.setPart(anchor, gatePart(d.dir, 1), 1, start - 0.15, 0.3)
      end = Math.max(end, start + 0.65)
    }

    for (const e of plan.added) {
      const start = Math.max(arrive.get(e.a) ?? 0.95 * k, arrive.get(e.b) ?? 0.95 * k) + 0.05
      const block = this.addEdge(e, 0)
      this.tween({ block, prop: "extend", from: 0, to: 1, at: start, dur: 0.55 * k, ease: easeOutBack })
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
    this.moveCars()
    const c = this.blocks.get("catcher")
    if (c) {
      const v = this.catcherVel
      c.pos = [c.pos[0] + v[0] * dt, c.pos[1] + v[1] * dt, c.pos[2] + v[2] * dt]
    }
  }

  // ── The catch ──────────────────────────────────────────────────────────

  /** A hall flies up out of the dark under someone falling: roof open, doors shut. */
  spawnCatcher(pos: Vec3) {
    this.removeCatcher()
    const block: Block = {
      key: "catcher",
      owner: CATCHER_OWNER,
      template: "hall",
      pos,
      q: 0,
      extend: 1,
      open: new Float32Array(PART_COUNT),
      dying: false,
      seed: Math.random(),
      turnT: 1,
      stretch: 1,
      reach: 16,
      catcher: true,
    }
    block.open[ROOF_PART] = 1
    this.catcherVel = [0, 0, 0]
    return this.put(block, UPRIGHT)
  }

  removeCatcher() {
    const c = this.blocks.get("catcher")
    if (!c) return
    this.blocks.delete("catcher")
    this.zones.delete(c.owner)
    this.tweens = this.tweens.filter((t) => t.block !== c)
  }

  /** The catcher becomes a room of the castle (the castle has already placed it). */
  adoptCatcher(room: Room) {
    const block = this.blocks.get("catcher")!
    this.blocks.delete("catcher")
    this.zones.delete(block.owner)
    room.variant = block.seed
    block.key = `r${room.id}`
    block.owner = room.id
    block.room = room
    block.catcher = false
    this.catcherVel = [0, 0, 0]
    return this.put(block, UPRIGHT)
  }

  /** Nothing solid in a column below a point for `dist` metres (world down). */
  clearBelow(p: Vec3, dist: number) {
    const boxes = this.collect([p[0], p[1] - dist / 2, p[2]], dist / 2 + 2, [])
    return !boxes.some(
      (b) =>
        b.min[0] < p[0] + 1.5 &&
        b.max[0] > p[0] - 1.5 &&
        b.min[2] < p[2] + 1.5 &&
        b.max[2] > p[2] - 1.5 &&
        b.max[1] < p[1] &&
        b.max[1] > p[1] - dist
    )
  }

  /**
   * Another building's floor the body is walking (or jumping, or falling)
   * into: within reach of its centre and coming closer. That building's
   * gravity takes over — the wall you walk into becomes the floor.
   */
  floorAhead(body: Body, boxes: readonly Box[]): Up | null {
    let best: { up: Up; d: number } | null = null
    for (const b of boxes) {
      const up = this.zones.get(b.owner)
      if (!up || sameUp(up, body.up)) continue
      const { axis, sign } = up
      const face = sign > 0 ? b.max[axis] : b.min[axis]
      const d = sign * (body.pos[axis] - face)
      if (d <= 0 || d > CAPTURE || sign * body.vel[axis] > -0.5) continue
      let over = true
      for (let k = 0; k < 3; k++) {
        if (k === axis) continue
        if (body.pos[k] < b.min[k] - 0.1 || body.pos[k] > b.max[k] + 0.1) over = false
      }
      if (over && (!best || d < best.d)) best = { up, d }
    }
    return best?.up ?? null
  }

  /** What kind of thing an owner is: for telling the visitor where they've got to. */
  kindOf(owner: number): "line" | "car" | "great" | "room" | "other" {
    const b = this.blockByOwner(owner)
    if (!b) return "other"
    return b.line ? "line" : b.car ? "car" : b.great ? "great" : b.room ? "room" : "other"
  }

  get busy() {
    return this.tweens.length > 0
  }

  /** Rooms are still sliding, strays turning or passages folding (doors don't count). */
  get moving() {
    return this.tweens.some((t) => typeof t.prop !== "number")
  }

  /**
   * Every collision box over or under a vertical line through (x, z), from
   * the bottom of the castle to the top: what someone falling down that
   * line would come to.
   */
  solidsAt(x: number, z: number, r: number) {
    return this.collect([x, 40, z], 70, []).filter(
      (b) => b.min[0] < x + r && b.max[0] > x - r && b.min[2] < z + r && b.max[2] > z - r
    )
  }

  // ── Physics ────────────────────────────────────────────────────────────

  /** Collision boxes of every block near a point, in world space. */
  collect(p: Vec3, radius: number, out: Box[] = []): Box[] {
    out.length = 0
    for (const block of this.blocks.values()) {
      if (block.dying || block.extend < 0.999 || block.turnT < 1) continue
      const reach = radius + block.reach
      const c = this.blockCentre(block)
      if (Math.abs(c[0] - p[0]) > reach || Math.abs(c[1] - p[1]) > reach || Math.abs(c[2] - p[2]) > reach) continue
      const tpl = this.templates.get(block.template)!
      for (const b of tpl.boxes) {
        if (b.part && block.open[b.part] >= 0.5) continue
        if (block.orient) {
          const k = block.stretch
          const o = orientBox(block.orient, [b.min[0] * k, b.min[1], b.min[2]], [b.max[0] * k, b.max[1], b.max[2]])
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
    if (block.room || block.stray || block.orient || block.catcher) return block.pos
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
      if (block.dock) {
        const [dx, dz] = DIRS[block.q]
        const rel = [p[0] - block.pos[0], p[2] - block.pos[2]]
        const along = rel[0] * dx + rel[1] * dz
        const across = Math.abs(rel[0] * -dz + rel[1] * dx)
        const dy = p[1] - block.pos[1]
        if (along > -margin && along < block.dock.len + margin && across < 2 + margin && dy > -3 - margin && dy < 4 + margin) {
          rooms.add(block.dock.anchor)
        }
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
