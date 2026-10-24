import * as THREE from "three"
import { Castle, CELL, DIRS, LANDMARKS, LEVEL, nodeCenter, nodeKey, type Landmark, type Node, type Vec3 } from "./castle"
import type { CastleAudio } from "./audio"
import { sameUp, upOf } from "./orient"
import type { ScoreMode } from "./score"
import { RING_TOP } from "./lines"
import { BODY, createBody, depenetrate, liftOnto, step, upVector, type Body, type Box, type Up } from "./physics"
import type { Output } from "./render/output"
import { ROOF_PART, TRAP_PART, doorPart } from "./render/kit"
import { CastleView, buildTemplates } from "./render/view"
import { CATCHER_OWNER, World, type Block } from "./world"

/**
 * One visit to the castle: the endless fall behind the title, the drop
 * down the well and through the void into a hall whose roof Nakime tears
 * open, walking the castle while she rearranges it (and the rooms she has
 * turned over, where the floor is a wall), finding the three Upper Moons'
 * rooms, and reaching her.
 *
 * Every building pulls toward its own floor: walk into a wall that is
 * some other building's floor (a deck standing on end, a hall on its side,
 * a carriage tipped over) and gravity turns to it. Fall off everything
 * and Nakime won't let you land: you fall on and on down the shafts
 * between the rooms while she strums faster and faster, until she sends
 * somewhere to come down — a hall slid under you, a bridge, a train path,
 * or a room rushing up out of the dark to catch you.
 */

export type Phase = "title" | "intro" | "play" | "finale" | "ended"

export type Stats = { seconds: number; metres: number; strums: number; falls: number; rooms: number }

export type GameEvent =
  | { type: "toast"; title: string; sub?: string }
  | { type: "found"; kind: Landmark; found: Landmark[] }
  | { type: "phase"; phase: Phase }
  | { type: "strum" }
  | { type: "titlecard" }
  | { type: "drop"; active: boolean }
  | { type: "ended"; stats: Stats }

export type Hud = {
  /** Screen angle to the scent, radians clockwise from up. */
  scent: number
  /** The target is roughly straight ahead. */
  ahead: boolean
  distance: number
  target: string
  /** 0–1, how fast you're falling. */
  fall: number
}

export type Controls = {
  /** x: strafe right, y: forward; each −1…1. */
  move: [number, number]
  run: boolean
  jump: boolean
  /** Radians to turn, accumulated since the last frame. */
  look: [number, number]
}

export const LANDMARK_NAMES: Record<Landmark | "nakime", { title: string; rank: string }> = {
  kokushibo: { title: "Kokushibo's moon hall", rank: "Upper One · 上弦の壱" },
  doma: { title: "Doma's lotus pond", rank: "Upper Two · 上弦の弐" },
  akaza: { title: "Akaza's ring", rank: "Upper Three · 上弦の参" },
  nakime: { title: "Nakime", rank: "Upper Four · 上弦の肆" },
}

const ROOM_TURNS: Up[] = [
  { axis: 1, sign: -1 },
  { axis: 0, sign: 1 },
  { axis: 0, sign: -1 },
  { axis: 2, sign: 1 },
  { axis: 2, sign: -1 },
]

const MUSIC: Record<Phase, ScoreMode> = { title: "off", intro: "wait", play: "chase", finale: "finale", ended: "off" }

const WALK = 4.6
const RUN = 8.2
const UPRIGHT: Up = { axis: 1, sign: 1 }

/** The drop: where it starts above the landing hall, and how it runs. */
const DROP_HEIGHT = 230
/** The well scrolls past this fast behind the title. */
const TITLE_SPEED = 11
/** Seconds down the well before it blows apart. */
const BREAK_AT = 2.7
const DROP_SPEED = 44
/** Physics takes over this far above the landing hall's tatami. */
const HANDOFF = 7.6

const smooth = (t: number) => {
  const k = Math.max(0, Math.min(1, t))
  return k * k * (3 - 2 * k)
}

type DropState = { y: number; v: number; t: number; broke: boolean; opened: boolean; kick: number }

/** A fall being caught: the room sent up, and how far along it is. */
type Catch = { block: Block; t: number; landedAt: number; settling: boolean }

/** Falling this long with nothing below, and the endless fall begins. */
const CATCH_AFTER = 1.1
/** Falling speed in the endless fall: slow enough to watch the castle go by. */
const FALL_TERMINAL = 30
/** Below this you're under the castle, and the fall loops round to the top. */
const WRAP_BELOW = -14

/**
 * Somewhere Nakime has put under you: where on it you'll come down, its
 * surface, and the underside of whatever is overhead (the fall in starts below that).
 */
type Landing = { kind: "hall" | "bridge" | "line"; block: Block; spot: [number, number]; top: number; ceiling: number }

/**
 * The endless fall. While it lasts you're drawn into the empty shafts
 * between the rooms, the castle rearranges itself faster and faster round
 * you, and every time you drop out of the bottom you're falling in at the
 * top again, until she sends something to meet you.
 */
type Freefall = {
  /** When she starts offering somewhere to land. */
  until: number
  nextStrum: number
  interval: number
  /** The empty shaft you're drawn into, or null to just fall. */
  column: [number, number] | null
  landing: Landing | null
  /** Times round the loop since the landing was offered. */
  misses: number
  wraps: number
}

/** Distance from a vertical line at (x, z) to a slide from a to b, across the floor. */
function columnDistance(x: number, z: number, a: Vec3, b: Vec3) {
  return segmentDistance([x, 0, z], [a[0], 0, a[2]], [b[0], 0, b[2]])
}

function segmentDistance(p: Vec3, a: Vec3, b: Vec3) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
  const len = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / len))
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t)
}

export class Game {
  readonly castle: Castle
  readonly world: World
  readonly view: CastleView
  phase: Phase = "title"
  readonly input: Controls = { move: [0, 0], run: false, jump: false, look: [0, 0] }
  reduced = false

  private output: Output
  private audio: CastleAudio
  private emit: (e: GameEvent) => void
  private body: Body
  private yaw = 0
  private pitch = 0
  private frame = new THREE.Quaternion()
  private frameTarget = new THREE.Quaternion()
  private time = 0
  private phaseTime = 0
  private pulse = 0
  private pulseT = 10
  private strums = 0
  private lastStrum = -100
  private walked = 0
  private nextStrumAt = 34
  private stepDist = 0
  private bob = 0
  private dip = 0
  private shake = 0
  private black = 0
  private white = 0
  private fov = 74
  private boxes: Box[] = []
  private flipped: { room: number; until: number } | null = null
  private relocating = 0
  private found = new Set<Landmark>()
  private visited = new Set<number>()
  private stats = { metres: 0, falls: 0, start: 0 }
  private pending: { at: number; fn: () => void }[] = []
  /** The opening fall, while it's scripted; null once physics has you. */
  private drop: DropState | null = null
  /** The landing hall's column is kept clear (and the hall still) until you're in. */
  private holding = true
  private titleYaw = Math.random() * Math.PI * 2
  private kickT = 0
  /** The far castle's own clock: it steps on every strum, and fast while you fall. */
  private farStep = 0
  private farT = 10
  /** Seconds left of lifting the gaze after the landing. */
  private settle = 0
  private roll = 0
  private strayNoted = false
  private noted = new Set<string>()
  private airTime = 0
  private catching: Catch | null = null
  private freefall: Freefall | null = null

  constructor(seed: number, output: Output, audio: CastleAudio, emit: (e: GameEvent) => void) {
    this.castle = new Castle(seed)
    for (const n of this.castle.landingColumn()) this.castle.hold.add(nodeKey(n))
    const templates = buildTemplates()
    this.world = new World(this.castle, templates)
    const land = this.castle.rooms.get(this.castle.landingId)!.node
    const [lx, ly, lz] = nodeCenter(land)
    // The rooms tumbling past the fall stay above the ring's overhead deck.
    const top = Math.max((this.castle.size.y + 1) * LEVEL + 8, RING_TOP + 14)
    this.view = new CastleView(
      templates,
      this.castle.size,
      { column: [lx, lz], node: [land[0], land[2]], span: [top, ly + DROP_HEIGHT - 70] },
      this.world.network.keepOut
    )
    this.output = output
    this.audio = audio
    this.emit = emit
    this.body = createBody([0, 0, 0])
  }

  private get landing() {
    return this.world.roomBlock(this.castle.landingId)!
  }

  /** Eye height at the top of the fall. */
  private get dropTop() {
    return this.landing.pos[1] + DROP_HEIGHT
  }

  // ── Phases ─────────────────────────────────────────────────────────────

  private setPhase(phase: Phase) {
    this.phase = phase
    this.phaseTime = 0
    this.audio.setMusicMode(MUSIC[phase])
    this.emit({ type: "phase", phase })
  }

  private later(seconds: number, fn: () => void) {
    this.pending.push({ at: this.time + seconds, fn })
  }

  /** Into the castle: the floor of the well gives way and you fall. */
  start() {
    const land = this.landing
    this.frame.identity()
    this.frameTarget.identity()
    this.stats.start = this.time
    this.setPhase("intro")
    if (this.reduced) {
      // No plunge: open your eyes on the tatami.
      this.view.drop.mode = "off"
      this.body = createBody([land.pos[0] + 0.01, land.pos[1] + BODY.halfHeight + 0.02, land.pos[2] + 0.01])
      this.yaw = Math.PI * 0.25
      this.pitch = -0.1
      this.black = 1
      this.release()
      this.emit({ type: "toast", title: "A hall in the castle", sub: "Somewhere, a biwa is tuned." })
      return
    }
    const [cx, cz] = this.view.drop.centre
    this.drop = { y: this.dropTop, v: TITLE_SPEED, t: 0, broke: false, opened: false, kick: 0.2 }
    this.body = createBody([cx, this.drop.y - BODY.eye, cz])
    this.yaw = this.titleYaw
    this.pitch = -1.38
    this.audio.strum(true)
    this.audio.rumble(BREAK_AT + 1)
    this.shake = 0.6
    this.pulse = 0.7
    this.pulseT = 0
    this.emit({ type: "drop", active: true })
  }

  /** You're in: let the castle use the landing column again, and shut the roof. */
  private release() {
    if (!this.holding) return
    this.holding = false
    this.castle.hold.clear()
    const land = this.landing
    if (land.open[ROOF_PART] > 0) {
      this.later(0.8, () => {
        this.world.setPart(land, ROOF_PART, 0, 0, 0.6)
        this.later(0.55, () => this.audio.slam(3))
      })
    }
  }

  /** Would a room sliding this way cross the fall into the castle? */
  private crossesFall(from: Node, to: Node) {
    const [cx, cz] = this.view.drop.centre
    const a = nodeCenter(from)
    const b = nodeCenter(to)
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      const x = a[0] + (b[0] - a[0]) * t
      const y = a[1] + (b[1] - a[1]) * t
      const z = a[2] + (b[2] - a[2]) * t
      if (Math.abs(x - cx) < 14 && Math.abs(z - cz) < 14 && y > this.landing.pos[1] - 2) return true
    }
    return false
  }

  // ── Nakime ─────────────────────────────────────────────────────────────

  /** A strum of the biwa: the castle rearranges itself. */
  strum(opts: { heavy?: boolean; intro?: boolean; manual?: boolean } = {}) {
    if (this.phase === "finale" || this.phase === "ended") return
    if (opts.manual && (this.time - this.lastStrum < 3.5 || this.world.busy || this.drop)) return
    // While a room is catching you, or you're in the endless fall, the castle waits.
    if ((this.catching || this.freefall) && !opts.intro) return
    const p = this.body.pos
    const playing = this.phase !== "title"
    const near = playing
      ? this.world.near(p, 3)
      : { rooms: new Set<number>(), edges: new Set<string>(), strays: new Set<number>() }
    if (this.flipped) near.rooms.add(this.flipped.room)
    if (this.holding) near.rooms.add(this.castle.landingId)
    // Will the floor open under you this time, and will she clear the way below?
    const drop = playing && !opts.intro && !this.flipped && !this.holding ? this.planDrop() : null
    for (const id of drop?.evict ?? []) near.rooms.delete(id)
    const plan = this.castle.shift({
      lockedRooms: near.rooms,
      lockedEdges: near.edges,
      lockedStrays: near.strays,
      blocked: (from: Node, to: Node) => {
        if (this.holding && this.crossesFall(from, to)) return true
        if (!playing) return false
        const a = nodeCenter(from)
        const b = nodeCenter(to)
        a[1] += 2
        b[1] += 2
        return segmentDistance(p, a, b) < 13
      },
      count: 3 + Math.floor(Math.random() * 3) + (drop?.evict.length ?? 0),
      first: drop?.evict.map((id) => ({ id, avoid: drop.avoid })),
    })
    const { length, arrive } = this.world.play(plan, {
      cascadeFrom: playing ? p : undefined,
      still: near.rooms,
      // A drop doesn't keep you waiting on the trapdoor.
      tempo: drop?.evict.length ? 0.55 : 1,
    })
    this.strums++
    this.lastStrum = this.time
    this.farStep++
    this.farT = 0
    this.walked = 0
    this.nextStrumAt = 30 + Math.random() * 18
    this.pulse = 1
    this.pulseT = 0
    this.shake = this.reduced ? 0 : 0.35
    this.audio.strum(opts.heavy)
    this.audio.slam(2 + Math.min(4, plan.removed.length))
    this.audio.rumble(Math.max(1.5, length))
    if (playing) this.audio.musicHit()
    this.emit({ type: "strum" })
    if (!playing || opts.intro) return

    if (drop) {
      // The trap opens once whatever was below has slid out of the way.
      const gone = drop.evict.filter((id) => arrive.has(id))
      const at = Math.max(0.45, ...gone.map((id) => arrive.get(id)! - 0.45))
      this.world.setPart(drop.block, TRAP_PART, 1, at, 0.15)
      this.world.setPart(drop.block, TRAP_PART, 0, at + 4.5, 0.4)
      const open = !drop.evict.length || arrive.has(drop.evict[0])
      this.later(at, () =>
        this.emit({
          type: "toast",
          title: "The floor gives way",
          sub: open ? "Nakime pulls the room below out from under you." : "Nakime opens the tatami under you.",
        })
      )
      return
    }
    if (this.flipped) {
      this.later(0.4, () => this.unflip())
      return
    }
    const room = this.world.roomContaining(p, -0.4)
    if (room?.kind === "hall" && this.body.grounded && Math.random() < 0.32) this.turnRoom(room.id)
  }

  /**
   * Whether this strum opens the trapdoor under you (half the time you're
   * standing on one). Usually she also slides away the rooms beneath, so
   * there's nothing to land on and the fall goes on.
   */
  private planDrop() {
    const p = this.body.pos
    const room = this.world.roomContaining(p, -0.4)
    if (!room || room.kind !== "hall" || !this.body.grounded) return null
    const block = this.world.roomBlock(room.id)!
    const onTrap = Math.abs(p[0] - block.pos[0]) < 1.2 && Math.abs(p[2] - block.pos[2]) < 1.2
    if (!onTrap || Math.random() >= 0.5) return null
    const [x, k, z] = room.node
    const below = [...this.castle.rooms.values()]
      .filter((r) => r.node[0] === x && r.node[2] === z && r.node[1] < k)
      .sort((a, b) => b.node[1] - a.node[1])
    const fall = !below.length || Math.random() < 0.65
    return {
      block,
      evict: fall ? below.slice(0, 2).map((r) => r.id) : [],
      // Out of your column, and not up beside you.
      avoid: (n: Node) => (n[0] === x && n[2] === z) || n[1] >= k,
    }
  }

  // ── The endless fall ───────────────────────────────────────────────────

  private beginFreefall() {
    if (this.freefall || this.catching || this.phase !== "play") return
    if (!sameUp(this.body.up, UPRIGHT)) {
      this.setGravity(UPRIGHT)
      this.body.vel = [this.body.vel[0] * 0.2, -Math.min(22, Math.hypot(...this.body.vel)), this.body.vel[2] * 0.2]
    }
    this.flipped = null
    const { x, z } = this.castle.size
    const p = this.body.pos
    const inside = p[0] > -CELL * 0.5 && p[0] < (x - 0.5) * CELL && p[2] > -CELL * 0.5 && p[2] < (z - 0.5) * CELL
    this.freefall = {
      until: this.time + 6 + Math.random() * 8,
      nextStrum: this.time + 0.6,
      interval: 2.4,
      column: inside ? this.shaft(p) : null,
      landing: null,
      misses: 0,
      wraps: 0,
    }
    this.body.terminal = FALL_TERMINAL
    this.stats.falls++
    this.audio.strum(true)
    this.audio.rumble(3)
    this.emit({ type: "strum" })
    this.emit({ type: "toast", title: "Falling", sub: "There's nothing below. The castle won't let you land." })
  }

  /** The middle of the empty shaft between four rooms nearest a point (or a random one). */
  private shaft(p: Vec3, random = false): [number, number] {
    const { x, z } = this.castle.size
    const pick = (v: number, n: number) =>
      (random ? Math.floor(Math.random() * (n - 1)) : Math.max(0, Math.min(n - 2, Math.round(v / CELL - 0.5)))) + 0.5
    return [pick(p[0], x) * CELL, pick(p[2], z) * CELL]
  }

  /** In the air: drawn into the shaft (or over the landing), braking above it, and the castle shifting faster. */
  private fallSteer(dt: number): Vec3 {
    const ff = this.freefall!
    const body = this.body
    const spot = ff.landing?.spot ?? ff.column
    const want: Vec3 = [0, 0, 0]
    if (spot) {
      want[0] = Math.max(-13, Math.min(13, (spot[0] - body.pos[0]) * 3))
      want[2] = Math.max(-13, Math.min(13, (spot[1] - body.pos[2]) * 3))
    }
    const k = 1 - Math.exp(-dt * 6)
    body.vel[0] += (want[0] - body.vel[0]) * k
    body.vel[2] += (want[2] - body.vel[2]) * k
    if (ff.landing) {
      // Come down on it at a speed you'd walk away from.
      const gap = body.pos[1] - BODY.halfHeight - ff.landing.top
      const cap = Math.sqrt(14 ** 2 + 2 * 26 * Math.max(0, gap))
      if (-body.vel[1] > cap) body.vel[1] = -cap
    }

    // Faster and faster, until she settles on somewhere to put you.
    if (!ff.landing && this.time < ff.until && this.time >= ff.nextStrum && !this.world.moving) {
      this.fallStrum(ff)
      ff.interval = Math.max(0.8, ff.interval * 0.8)
      ff.nextStrum = this.time + ff.interval
    }
    return want
  }

  /** A strum while you fall: quicker each time, and nothing slides through your shaft. */
  private fallStrum(ff: Freefall) {
    const p = this.body.pos
    const col = ff.column
    const near = this.world.near(p, 3)
    const plan = this.castle.shift({
      lockedRooms: near.rooms,
      lockedEdges: near.edges,
      lockedStrays: near.strays,
      blocked: (from, to) => {
        const a = nodeCenter(from)
        const b = nodeCenter(to)
        return columnDistance(p[0], p[2], a, b) < 9 || (col !== null && columnDistance(col[0], col[1], a, b) < 9)
      },
      count: 4 + Math.floor(Math.random() * 4),
    })
    const tempo = Math.max(0.3, Math.min(0.9, ff.interval / 2.6))
    const { length } = this.world.play(plan, { cascadeFrom: p, tempo })
    this.strums++
    this.lastStrum = this.time
    this.farStep++
    this.farT = 0
    this.pulse = 1
    this.pulseT = 0
    this.audio.strum(ff.interval < 1.2)
    this.audio.slam(2 + Math.min(4, plan.removed.length))
    this.audio.rumble(Math.max(1, length))
    this.audio.musicHit()
    this.emit({ type: "strum" })
  }

  /** Out of the bottom of the castle: falling in at the top again, maybe over somewhere to land. */
  private wrapFall() {
    const ff = this.freefall!
    const body = this.body
    ff.wraps++
    if (ff.landing && ++ff.misses > 1) ff.landing = null
    if (!ff.landing && this.time >= ff.until && !this.world.moving) {
      const choice = this.offerLanding()
      if (choice === "catch") {
        // A room comes up out of the dark instead.
        this.endFreefall(true)
        const [sx, sz] = this.shaft(body.pos, true)
        body.pos = [sx, (this.castle.size.y + 1) * LEVEL, sz]
        body.vel = [0, -20, 0]
        this.black = Math.max(this.black, 0.8)
        this.beginCatch()
        return
      }
      ff.landing = choice
      ff.misses = 0
      if (ff.landing) {
        const what = {
          hall: ["A hall rises to meet you", "Nakime slides it under you and opens its roof."],
          bridge: ["A bridge swings beneath you", "Nakime gives you somewhere to land."],
          line: ["A train path below", "Its deck runs off into the dark. Rooms ride along it."],
        }[ff.landing.kind]
        this.emit({ type: "toast", title: what[0], sub: what[1] })
      }
    }
    let spot: [number, number]
    let y = (this.castle.size.y + 1) * LEVEL + 6
    if (ff.landing) {
      spot = ff.landing.spot
      y = Math.min(y, ff.landing.top + 60, ff.landing.ceiling - 4)
    } else {
      spot = ff.column = this.shaft(body.pos, true)
      if (ff.wraps === 1) this.emit({ type: "toast", title: "Still falling", sub: "Nakime strums faster and faster." })
    }
    body.pos = [spot[0], y, spot[1]]
    body.vel = [0, body.vel[1], 0]
    this.black = Math.max(this.black, 0.8)
    this.audio.strum(true)
    this.pulse = Math.max(this.pulse, 0.7)
    this.pulseT = 0
  }

  /** Somewhere to come down, at random: a hall, a bridge, a train path, or a room sent up to catch you. */
  private offerLanding(): Landing | "catch" | null {
    const weights = { hall: 0.35, bridge: 0.2, line: 0.2, catch: 0.25 }
    const kinds = Object.keys(weights) as (keyof typeof weights)[]
    const order: (keyof typeof weights)[] = []
    while (order.length < kinds.length) {
      const left = kinds.filter((k) => !order.includes(k))
      let r = Math.random() * left.reduce((sum, k) => sum + weights[k], 0)
      order.push(left.find((k) => (r -= weights[k]) <= 0) ?? left[0])
    }
    for (const kind of order) {
      if (kind === "catch") return "catch"
      const landing = kind === "hall" ? this.offerHall() : kind === "bridge" ? this.offerBridge() : this.offerLine()
      if (landing) return landing
    }
    return "catch"
  }

  /** Nothing in this lattice column above `level`: no room, stray or line. */
  private openAbove(x: number, z: number, level: number) {
    for (let k = level + 1; k <= this.castle.size.y; k++) {
      const n: Node = [x, k, z]
      if (this.castle.roomAt(n) || this.castle.isReserved(n)) return false
    }
    return true
  }

  /** A plain hall (one whose roof can open) slid into a free node with open sky above. */
  private offerHall(): Landing | null {
    const halls = [...this.castle.rooms.values()]
      .filter((r) => r.kind === "hall" && r.style === "hall")
      .sort(() => Math.random() - 0.5)
    for (const room of halls) {
      const [x, k, z] = room.node
      const options: Node[] = []
      for (let dx = -2; dx <= 2; dx++)
        for (let dz = -2; dz <= 2; dz++)
          for (let dk = -1; dk <= 1; dk++) {
            const n: Node = [x + dx, k + dk, z + dz]
            if (n[1] > 3 || !this.castle.inBounds(n) || this.castle.roomAt(n) || this.castle.isReserved(n)) continue
            // Its own column would still have it overhead.
            if (n[0] === x && n[2] === z && dk < 0) continue
            if (this.openAbove(n[0], n[2], n[1]) && this.castle.touchesMaze(n, room)) options.push(n)
          }
      if (!options.length) continue
      const to = options[Math.floor(Math.random() * options.length)]
      const plan = this.castle.shift({ first: [{ id: room.id, to }], count: 1 })
      this.world.play(plan, { tempo: 0.3 })
      if (!plan.moves.some((m) => m.id === room.id)) continue
      const block = this.world.roomBlock(room.id)!
      this.world.setPart(block, ROOF_PART, 1, 0.2, 0.55)
      const c = nodeCenter(to)
      const ceiling = this.ceiling(c[0], c[2], block.owner, c[1] + 8)
      if (ceiling - c[1] < 25) continue
      return { kind: "hall", block, spot: [c[0], c[2]], top: c[1], ceiling }
    }
    return null
  }

  /** The underside of the lowest thing over (x, z) above height `above`, other than `owner`. */
  private ceiling(x: number, z: number, owner: number, above: number) {
    const over = this.world.solidsAt(x, z, 1).filter((b) => b.owner !== owner && b.min[1] > above)
    return Math.min(...over.map((b) => b.min[1]), Infinity)
  }

  private offerBridge(): Landing | null {
    const bridges = [...this.world.blocks.values()]
      .filter((b) => b.edge?.style === "bridge" && !b.dying && b.extend > 0.999)
      .sort(() => Math.random() - 0.5)
    for (const block of bridges) {
      const a = this.castle.rooms.get(block.edge!.a)!
      const c = nodeCenter(a.node)
      const [dx, dz] = DIRS[block.edge!.dir]
      const x = c[0] + (dx * CELL) / 2
      const z = c[2] + (dz * CELL) / 2
      // The first thing a fall down here would hit has to be the bridge.
      if (this.world.solidsAt(x, z, 0.5).some((b) => b.owner !== block.owner && b.max[1] > c[1] + 0.2 && b.min[1] < c[1] + 25)) continue
      const ceiling = this.ceiling(x, z, block.owner, c[1] + 0.2)
      if (ceiling - c[1] < 25) continue
      return { kind: "bridge", block, spot: [x, z], top: c[1], ceiling }
    }
    return null
  }

  /** A stretch of a level train path's deck, on its centreline, with nothing overhead. */
  private offerLine(): Landing | null {
    const decks = [...this.world.blocks.values()]
      .filter((b) => b.line && sameUp(upOf(b.orient!), UPRIGHT))
      .sort(() => Math.random() - 0.5)
    const { x, z } = this.castle.size
    for (const block of decks) {
      const [px, py, pz] = block.pos
      // Over the castle, not out at the ends.
      if (px < -CELL * 0.5 || px > (x - 0.5) * CELL || pz < -CELL * 0.5 || pz > (z - 0.5) * CELL) continue
      // The ring's floor has its overhead deck far above: the fall comes in under that.
      const ceiling = this.ceiling(px, pz, block.owner, py + 0.5)
      if (ceiling - py < 25) continue
      return { kind: "line", block, spot: [px, pz], top: py, ceiling }
    }
    return null
  }

  /** On something at last: back to ordinary gravity and speed. */
  private endFreefall(quiet = false) {
    const ff = this.freefall
    if (!ff) return
    this.freefall = null
    this.body.terminal = undefined
    if (quiet) return
    if (ff.landing?.kind === "hall") {
      const block = ff.landing.block
      this.later(0.8, () => {
        this.world.setPart(block, ROOF_PART, 0, 0, 0.6)
        this.later(0.55, () => this.audio.slam(3))
      })
    }
    const on = this.world.blockByOwner(this.body.ground)
    if (!ff.landing || on !== ff.landing.block) {
      this.emit({ type: "toast", title: "Somewhere, at last", sub: "The castle let you land." })
    }
  }

  /** The room you're in turns over: its doors slam and a wall becomes the floor. */
  private turnRoom(roomId: number) {
    const block = this.world.roomBlock(roomId)!
    for (let side = 0; side < 4; side++) {
      this.world.cancel(block, doorPart(side))
      this.world.setPart(block, doorPart(side), 0, 0.05, 0.14)
    }
    this.flipped = { room: roomId, until: this.time + 25 }
    const up = ROOM_TURNS[Math.floor(Math.random() * ROOM_TURNS.length)]
    this.later(0.55, () => {
      this.setGravity(up)
      this.emit({
        type: "toast",
        title: up.axis === 1 ? "The room turns over" : "The room tips on its side",
        sub: "Walk it off — the next strum turns it back.",
      })
    })
  }

  private unflip() {
    if (!this.flipped) return
    const block = this.world.roomBlock(this.flipped.room)
    this.flipped = null
    this.setGravity({ axis: 1, sign: 1 })
    if (block) this.reopen(block.owner, 0.6)
  }

  private reopen(roomId: number, at: number) {
    this.world.reopen(this.world.roomBlock(roomId)!, at)
  }

  private setGravity(up: Up) {
    const from = new THREE.Vector3(...upVector(this.body.up))
    const to = new THREE.Vector3(...upVector(up))
    if (from.equals(to)) return
    const turn = new THREE.Quaternion()
    if (from.dot(to) < -0.99) {
      // Upside down: roll over the way you're facing.
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.frameTarget).applyAxisAngle(from, this.yaw)
      turn.setFromAxisAngle(fwd.normalize(), Math.PI)
    } else {
      turn.setFromUnitVectors(from, to)
    }
    this.frameTarget.premultiply(turn)
    this.body.up = up
    this.body.grounded = false
    if (this.reduced) {
      this.frame.copy(this.frameTarget)
      this.black = 1
    }
    this.world.collect(this.body.pos, 6, this.boxes)
    depenetrate(this.body, this.boxes)
  }

  /** Off the edge of everything: Nakime catches you and drops you somewhere. */
  private relocate() {
    this.relocating = 0.8
    this.stats.falls++
    this.later(0.45, () => {
      this.release()
      this.world.removeCatcher()
      this.catching = null
      this.endFreefall(true)
      const halls = [...this.castle.rooms.values()].filter((r) => r.kind === "hall")
      const fresh = halls.filter((r) => !this.visited.has(r.id))
      const pool = fresh.length ? fresh : halls
      const room = pool[Math.floor(Math.random() * pool.length)]
      const pos = this.world.roomBlock(room.id)!.pos
      this.flipped = null
      this.body = createBody([pos[0] + 1.6, pos[1] + 2.4, pos[2] + 1.6])
      this.frame.identity()
      this.frameTarget.identity()
      this.pitch = -0.3
      this.audio.strum(true)
      this.pulse = 0.8
      this.pulseT = 0
      this.emit({ type: "toast", title: "Nakime moves you", sub: "A door opens beneath you, somewhere else." })
    })
  }

  // ── The loop ───────────────────────────────────────────────────────────

  update(dt: number) {
    // A frame's timestamp can come in before the loop's start: never run time backwards.
    dt = Math.max(0, Math.min(dt, 1 / 20))
    this.advance(dt)
    this.draw(dt)
  }

  /** Moves the simulation on without drawing. */
  advance(dt: number) {
    this.time += dt
    this.phaseTime += dt
    this.pulseT += dt
    this.pulse = Math.max(0, this.pulse - dt * 0.7)
    this.shake = Math.max(0, this.shake - dt)
    this.black = Math.max(0, this.black - dt * 2.2)
    for (const job of this.pending.filter((j) => j.at <= this.time)) {
      this.pending.splice(this.pending.indexOf(job), 1)
      job.fn()
    }
    this.audio.tickMusic(dt)

    // The far castle steps quickly round anyone falling.
    const rate = this.drop ? 5 : this.phase === "title" ? 1.6 : this.hud.fall > 0.25 ? 4 : 1
    this.farT += dt * rate
    if (rate > 1 && this.farT > 2.4 && !this.reduced) {
      this.farStep++
      this.farT = 0
    }

    // Where everything that moves was, so whatever you stand on carries you.
    const before = new Map<number, Vec3>()
    for (const b of this.world.blocks.values()) if (b.room || b.car || b.catcher) before.set(b.owner, b.pos)
    this.world.update(dt)

    switch (this.phase) {
      case "title":
        this.updateTitle(dt)
        if (this.time - this.lastStrum > 7) this.strum()
        break
      case "intro":
      case "play":
        if (this.drop) this.updateDrop(dt)
        else this.updatePlayer(dt, before)
        break
      case "finale":
        this.updateFinale(dt)
        break
      case "ended":
        break
    }
  }

  /** Behind the title: falling, endlessly, down the well. */
  private updateTitle(dt: number) {
    const [cx, cz] = this.view.drop.centre
    const y = this.dropTop
    this.titleYaw += dt * (this.reduced ? 0.02 : 0.07)
    const cam = this.view.camera
    cam.position.set(cx, y, cz)
    cam.up.set(0, 1, 0)
    cam.quaternion
      .setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.titleYaw)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1.38))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(this.time * 0.4) * 0.06))
    cam.fov = 78
    this.view.drop.update(dt, y, this.reduced ? 2 : TITLE_SPEED)
    this.kickT -= dt
    if (this.kickT <= 0 && !this.reduced) {
      this.view.drop.kick(0.3)
      this.kickT = 1.1 + Math.random() * 0.6
    }
    this.hud.fall = this.reduced ? 0 : 0.18
  }

  /** The scripted fall: down the well, through the void, in through the roof. */
  private updateDrop(dt: number) {
    const d = this.drop!
    d.t += dt
    this.yaw -= this.input.look[0]
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - this.input.look[1]))
    this.input.look[0] = 0
    this.input.look[1] = 0
    this.input.jump = false

    const land = this.landing
    const left = d.y - (land.pos[1] + HANDOFF + BODY.eye)
    const cruise = d.t < BREAK_AT ? TITLE_SPEED + (DROP_SPEED - TITLE_SPEED) * smooth(d.t / (BREAK_AT - 0.3)) : DROP_SPEED
    // Brake in time to come in through the roof at a survivable speed.
    const brake = Math.sqrt(16 ** 2 + 2 * 30 * Math.max(0, left))
    d.v += (Math.min(cruise, brake) - d.v) * (1 - Math.exp(-dt * 5))
    d.y -= d.v * dt
    this.view.drop.update(dt, d.y, d.v)

    // Nakime's hand on everything round you, faster and faster.
    d.kick -= dt
    if (d.kick <= 0) {
      const k = d.broke ? 0.85 : 0.4 + 0.6 * smooth(d.t / BREAK_AT)
      this.view.drop.kick(k)
      d.kick = d.broke ? 0.45 : 0.5 - 0.32 * smooth(d.t / BREAK_AT)
      if (!d.broke) this.audio.slam(1)
    }
    if (!d.broke && d.t >= BREAK_AT) {
      d.broke = true
      this.view.drop.shatter(d.y)
      this.strum({ heavy: true, intro: true })
      this.shake = 1
      this.audio.setMusicMode("chase")
      this.later(0.5, () => this.emit({ type: "titlecard" }))
    }
    if (!d.opened && left < 75) {
      // The hall below splits its roof open to take you.
      d.opened = true
      this.world.setPart(land, ROOF_PART, 1, 0, 0.55)
      this.audio.strum(true)
      this.audio.slam(4)
      this.pulse = 1
      this.pulseT = 0
      this.emit({ type: "strum" })
    }

    const [cx, cz] = this.view.drop.centre
    this.body.pos = [cx, d.y - BODY.eye, cz]
    this.body.vel = [0, -d.v, 0]
    if (left <= 0) {
      this.drop = null
      this.body.grounded = false
      this.emit({ type: "drop", active: false })
    }

    const fall = Math.max(0, Math.min(1, (d.v - 6) / 30))
    this.shake = Math.max(this.shake, fall * 0.45)
    this.roll = Math.sin(d.t * 1.7) * 0.07 * fall
    this.audio.setWind(fall)
    this.audio.setMusicIntensity(d.broke ? 1 : 0.7)
    this.hud.fall = fall
    this.placeCamera(fall, dt)
    this.updateScent()
  }

  private updatePlayer(dt: number, before: Map<number, Vec3>) {
    const body = this.body
    // What's left of the well, still flying apart.
    this.view.drop.update(dt, this.view.camera.position.y, 0)
    // Turning.
    this.yaw -= this.input.look[0]
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - this.input.look[1]))
    this.input.look[0] = 0
    this.input.look[1] = 0
    if (this.settle > 0) {
      // Just landed: lift the eyes from the floor you fell onto.
      this.settle -= dt
      this.pitch += (-0.12 - this.pitch) * (1 - Math.exp(-dt * 3.5))
    }
    this.frame.slerp(this.frameTarget, 1 - Math.exp(-dt * (this.reduced ? 30 : 4.5)))

    // Ride whatever you stand on when Nakime moves it.
    if (body.grounded && before.has(body.ground)) {
      const now = this.world.blockByOwner(body.ground)?.pos
      const was = before.get(body.ground)!
      // (A looping car that wrapped round has folded away: nothing to ride.)
      if (now && Math.hypot(now[0] - was[0], now[1] - was[1], now[2] - was[2]) < 6) {
        for (let i = 0; i < 3; i++) body.pos[i] += now[i] - was[i]
      }
    }

    // Wish velocity across the current floor.
    const q = new THREE.Quaternion().copy(this.frameTarget)
    const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw)
    q.multiply(yawQ)
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q)
    const [mx, my] = this.freefall ? [0, 0] : this.input.move
    const len = Math.hypot(mx, my)
    const speed = (this.input.run ? RUN : WALK) * Math.min(1, len)
    const dir = fwd.multiplyScalar(my).add(right.multiplyScalar(mx))
    if (len > 0) dir.normalize()
    let wish: Vec3 = [dir.x * speed, dir.y * speed, dir.z * speed]
    if (this.freefall) wish = this.fallSteer(dt)

    this.world.collect(body.pos, 4, this.boxes)
    liftOnto(body, this.boxes)
    depenetrate(body, this.boxes)
    const was: Vec3 = [...body.pos]
    const res = step(body, this.boxes, wish, this.input.jump, dt)
    this.input.jump = false
    const u = body.up.axis
    const moved = Math.hypot(...was.map((v, i) => (i === u ? 0 : body.pos[i] - v)))

    // Landing in a catching room: it was moving with you, so it's a soft one.
    const landed = this.catching && body.ground === this.catching.block.owner ? Math.min(res.landed, 7) : res.landed
    if (landed > 4) {
      this.audio.land(landed)
      this.dip = Math.min(0.35, landed * 0.012)
      if (landed > 14) this.shake = Math.max(this.shake, this.reduced ? 0 : 0.7)
    }
    this.airTime = body.grounded ? 0 : this.airTime + dt
    if (this.holding && body.grounded) {
      this.release()
      this.settle = 1.3
    }
    this.followFloor()
    if (body.grounded) {
      this.walked += moved
      this.stats.metres += moved
      this.stepDist += moved
      this.bob += moved * 1.9
      if (this.stepDist > (this.input.run ? 1.05 : 0.8)) {
        this.stepDist = 0
        const room = this.world.roomContaining(body.pos)
        this.audio.step(!room)
      }
    }
    this.dip = Math.max(0, this.dip - dt * 1.2)
    const fallSpeed = -body.up.sign * body.vel[u]
    const fall = body.grounded ? 0 : Math.max(0, Math.min(1, (fallSpeed - 6) / 30))
    // A long fall shakes: the wind, and the castle shifting round you.
    if (!this.reduced) this.shake = Math.max(this.shake, fall * 0.4)
    this.roll *= Math.exp(-dt * 4)
    this.audio.setWind(fall)
    // The score drives harder when you run, fall, or the castle has just moved.
    const running = this.input.run && body.grounded && moved > dt * WALK * 0.5
    this.audio.setMusicIntensity(Math.max(running ? 0.95 : 0.65, fall > 0.1 ? 1 : 0, this.time - this.lastStrum < 4 ? 0.9 : 0))

    if (this.phase === "intro" && body.grounded && this.phaseTime > 4 && fallSpeed <= 0 && this.time - this.lastStrum > 2.5) {
      this.setPhase("play")
      this.emit({
        type: "toast",
        title: "The Infinity Castle",
        sub: "Follow the scent to the three Upper Moons. Every so often, Nakime will strum.",
      })
    }

    if (this.phase === "play") {
      // Nakime strums as you wander, or when you've lingered too long.
      if (!this.freefall && (this.walked > this.nextStrumAt || this.time - this.lastStrum > 50)) this.strum()
      this.discover()
      if (this.flipped && this.time > this.flipped.until) this.unflip()
      this.notice()
      if (
        !this.catching &&
        !this.freefall &&
        this.relocating <= 0 &&
        this.airTime > CATCH_AFTER &&
        fallSpeed > 12 &&
        this.world.clearBelow(body.pos, 34)
      ) {
        this.beginFreefall()
      }
    }
    if (this.freefall) {
      if (body.grounded) this.endFreefall()
      else if (body.pos[1] < WRAP_BELOW) this.wrapFall()
    }
    if (this.catching) this.updateCatch(dt)

    // Fell out of the castle?
    const { x, y, z } = this.castle.size
    const p = body.pos
    const out =
      p[1] < -LEVEL * 3 ||
      p[1] > (y + 3) * LEVEL ||
      p[0] < -CELL * 2.2 ||
      p[0] > (x + 1.2) * CELL ||
      p[2] < -CELL * 2.2 ||
      p[2] > (z + 1.2) * CELL
    // (While a room is catching you, you're in hand: only a fall into the abyss ends it.)
    const caught = this.catching && p[1] > -LEVEL * 30
    if (out && this.relocating <= 0 && !caught && !this.freefall) {
      // Off the edge of everything and falling: the endless fall, if down is down.
      if (this.phase === "play" && !body.grounded && fallSpeed > 10 && sameUp(body.up, UPRIGHT)) this.beginFreefall()
      else this.relocate()
    }
    if (this.relocating > 0) {
      this.relocating -= dt
      this.black = Math.max(this.black, Math.min(1, 1 - Math.abs(this.relocating - 0.4) * 2.5))
    }

    this.placeCamera(fall, dt)
    this.hud.fall = fall
    this.updateScent()
  }

  /** The biwa, and a room rushes up out of the dark to catch the fall. */
  private beginCatch() {
    const body = this.body
    const wasUp = !sameUp(body.up, UPRIGHT)
    if (wasUp) {
      // It comes from below, so down is down again first.
      this.setGravity(UPRIGHT)
      body.vel = [body.vel[0] * 0.2, -Math.min(22, Math.hypot(...body.vel)), body.vel[2] * 0.2]
    }
    this.flipped = null
    const p = body.pos
    const block = this.world.spawnCatcher([p[0], p[1] - BODY.halfHeight - 14, p[2]])
    this.catching = { block, t: 0, landedAt: 0, settling: false }
    this.audio.strum(true)
    this.audio.rumble(2.5)
    this.pulse = 1
    this.pulseT = 0
    this.emit({ type: "strum" })
    this.emit({ type: "toast", title: "Be-ben", sub: "A room rushes up out of the dark to catch you." })
  }

  /**
   * The catching room: it chases the fall from below, takes you in through
   * its open roof, slows to a stop with you aboard, and then Nakime sets it
   * into the castle beside the maze.
   */
  private updateCatch(dt: number) {
    const c = this.catching!
    const body = this.body
    const block = c.block
    c.t += dt
    if (c.settling) return
    if (!c.landedAt) {
      if (body.grounded && body.ground === block.owner) {
        c.landedAt = c.t
        this.world.setPart(block, ROOF_PART, 0, 0.5, 0.6)
        this.later(1.05, () => this.audio.slam(3))
        return
      }
      if (c.t > 5) {
        this.relocate()
        return
      }
      // Stay under the visitor, and close in from below at a gentle speed.
      const gap = body.pos[1] - BODY.halfHeight - block.pos[1]
      const approach = gap > 6 ? 24 : 4 + gap * 2.5
      this.world.catcherVel = [(body.pos[0] - block.pos[0]) * 5, body.vel[1] + approach, (body.pos[2] - block.pos[2]) * 5]
      return
    }
    // Aboard: brake to a stop.
    const v = this.world.catcherVel
    const k = Math.exp(-dt * 2.4)
    this.world.catcherVel = [v[0] * k, v[1] * k, v[2] * k]
    if (Math.hypot(...this.world.catcherVel) > 0.4 || c.t - c.landedAt < 1.6) return
    c.settling = true
    this.world.catcherVel = [0, 0, 0]
    const placed = this.castle.adopt(block.pos)
    if (!placed) {
      this.relocate()
      return
    }
    const room = this.world.adoptCatcher(placed.room)
    if (body.ground === CATCHER_OWNER) body.ground = room.owner
    const to = nodeCenter(placed.room.node)
    const dist = Math.hypot(to[0] - room.pos[0], (to[1] - room.pos[1]) * 1.5, to[2] - room.pos[2])
    const dur = 1.4 + dist * 0.02
    this.world.slide(room, to, 0.3, dur)
    this.audio.strum()
    this.audio.rumble(dur + 0.5)
    this.pulse = 0.8
    this.pulseT = 0
    this.emit({ type: "strum" })
    this.later(0.3 + dur + 0.05, () => {
      this.world.play({ moves: [], removed: [], added: placed.edges, turned: [] })
      this.audio.slam(2)
      this.catching = null
      this.emit({ type: "toast", title: "Set down in the castle", sub: "Nakime slots the room in among the others." })
    })
  }

  /** First time on a line, aboard a car or in a great hall: say what it is. */
  private notice() {
    if (!this.body.grounded) return
    const kind = this.world.kindOf(this.body.ground)
    if (kind === "room" || kind === "other" || this.noted.has(kind)) return
    this.noted.add(kind)
    const say = {
      line: ["A train path", "Rooms run along it like carriages. Step aboard as one slides past."],
      car: ["Aboard", "It carries you along the line. Walk off its open end to get down."],
      great: ["A great hall", "Pillars, two tiers of walls, and its own floor to stand on."],
    }[kind]
    this.emit({ type: "toast", title: say[0], sub: say[1] })
  }

  /**
   * Gravity follows the room you're in: inside a stray its floor is the
   * floor; walk into another building's floor and it takes you; back on a
   * stray's bridge, or in an upright hall, down is down again.
   */
  private followFloor() {
    const body = this.body
    const stray = this.world.strayContaining(body.pos)
    if (stray) {
      const up = upOf(stray.orient!)
      if (sameUp(up, body.up)) return
      this.setGravity(up)
      this.audio.slam(1)
      if (!this.strayNoted) {
        this.strayNoted = true
        this.emit({
          type: "toast",
          title: up.axis === 1 ? "Up is down in here" : "The wall is the floor",
          sub: "A room Nakime turned over. Its bridge sets you right again.",
        })
      }
      return
    }
    if (this.flipped) return
    const next = this.world.floorAhead(body, this.boxes)
    if (next) {
      this.setGravity(next)
      this.audio.slam(1)
      if (!this.noted.has("gravity")) {
        this.noted.add("gravity")
        this.emit({
          type: "toast",
          title: next.axis === 1 && next.sign > 0 ? "Down is down again" : "Its floor is your floor",
          sub: "Every building pulls toward its own floor. Walk into one that stands on end and it takes you.",
        })
      }
      return
    }
    if (sameUp(body.up, UPRIGHT)) return
    if (this.world.spurAt(body.pos) || this.world.roomContaining(body.pos, -0.4)) this.setGravity(UPRIGHT)
  }

  private placeCamera(fall: number, dt: number) {
    const body = this.body
    const cam = this.view.camera
    const up = new THREE.Vector3(...upVector(body.up))
    const bobAmp = this.reduced || !body.grounded ? 0 : 0.045
    const eye = up.clone().multiplyScalar(BODY.eye - this.dip + Math.sin(this.bob * Math.PI) * bobAmp)
    cam.position.set(body.pos[0] + eye.x, body.pos[1] + eye.y, body.pos[2] + eye.z)
    const q = this.frame.clone()
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw))
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.pitch))
    if (this.roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.roll))
    if (this.shake > 0) {
      const s = this.shake * 0.02
      q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s)))
    }
    cam.quaternion.copy(q)
    const target = 74 + (this.input.run && body.grounded ? 6 : 0) + fall * (this.drop ? 24 : 16)
    this.fov += (target - this.fov) * 0.08
    cam.fov = this.fov
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q)
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(q)
    this.audio.listen([cam.position.x, cam.position.y, cam.position.z], [f.x, f.y, f.z], [u.x, u.y, u.z])
    const nak = this.world.roomBlock(this.castle.nakimeId)!.pos
    this.audio.tickMelody(dt, [nak[0], nak[1] + 1.8, nak[2] - 3.4])
  }

  private discover() {
    const room = this.world.roomContaining(this.body.pos, -0.3)
    if (!room) return
    this.visited.add(room.id)
    if (room.kind === "nakime") {
      const pos = this.world.roomBlock(room.id)!.pos
      const d = Math.hypot(this.body.pos[0] - pos[0], this.body.pos[2] - (pos[2] - 3.4))
      if (d < 2.6) this.beginFinale()
      return
    }
    if (room.kind === "hall" || this.found.has(room.kind)) return
    this.found.add(room.kind)
    const name = LANDMARK_NAMES[room.kind]
    this.emit({ type: "found", kind: room.kind, found: [...this.found] })
    this.emit({ type: "toast", title: name.title, sub: name.rank })
    this.audio.strum(true)
    this.pulse = Math.max(this.pulse, 0.6)
    this.pulseT = 0
    if (this.found.size === LANDMARKS.length) {
      this.castle.nakimeOpen = true
      this.later(3.5, () => {
        this.strum({ heavy: true })
        this.emit({ type: "toast", title: "Nakime's chamber opens", sub: "Above everything, a stair now climbs to her." })
      })
    }
  }

  /** Reaching her: the castle is forced up to the surface, and the dawn comes in. */
  private beginFinale() {
    this.setPhase("finale")
    this.emit({ type: "toast", title: "Nakime", sub: "Her eye opens. The castle rises." })
    for (let i = 0; i < 5; i++) this.later(i * 0.55, () => {
      this.audio.strum(i % 2 === 0)
      this.pulse = 1
      this.pulseT = 0
      this.shake = 0.6
    })
    this.audio.rumble(7)
    for (const b of this.world.blocks.values()) {
      if (!(b.room || b.stray) || b.room?.kind === "nakime") continue
      const d = Math.hypot(b.pos[0] - this.body.pos[0], b.pos[2] - this.body.pos[2])
      const to: Vec3 = [b.pos[0], b.pos[1] + 400, b.pos[2]]
      this.world.slide(b, to, 1 + d * 0.02 + Math.random() * 0.6, 5, (t) => t * t)
    }
    for (const b of this.world.blocks.values()) if (b.edge || b.spur || b.dock) this.world.fold(b, 0.6 + Math.random() * 0.6)
    this.world.removeCatcher()
    this.catching = null
    this.endFreefall(true)
    this.world.liftLines(1.2)
  }

  private updateFinale(dt: number) {
    this.white = Math.max(0, Math.min(1, (this.phaseTime - 2.5) / 3.5))
    this.shake = Math.max(this.shake, 0.25)
    const nak = this.world.roomBlock(this.castle.nakimeId)!.pos
    const cam = this.view.camera
    const look = new THREE.Vector3(nak[0], nak[1] + 1.6, nak[2] - 3.4)
    const m = new THREE.Matrix4().lookAt(cam.position, look, new THREE.Vector3(0, 1, 0))
    const want = new THREE.Quaternion().setFromRotationMatrix(m)
    cam.quaternion.slerp(want, 1 - Math.exp(-dt * 2))
    cam.position.y += dt * (this.phaseTime > 2 ? 2 : 0)
    if (this.phaseTime > 6.5) {
      this.setPhase("ended")
      this.emit({
        type: "ended",
        stats: {
          seconds: this.time - this.stats.start,
          metres: this.stats.metres,
          strums: this.strums,
          falls: this.stats.falls,
          rooms: this.visited.size,
        },
      })
    }
  }

  readonly hud: Hud = { scent: 0, ahead: false, distance: 0, target: "", fall: 0 }

  /** Tanjiro's nose: which way to the next Upper Moon (or to Nakime). */
  private updateScent() {
    const left = LANDMARKS.filter((k) => !this.found.has(k))
    const eye = this.view.camera.position
    let best: { pos: Vec3; name: string; d: number } | null = null
    const targets = left.length
      ? left.map((k) => ({ room: this.castle.landmark(k), name: LANDMARK_NAMES[k].title }))
      : [{ room: this.castle.rooms.get(this.castle.nakimeId)!, name: "Nakime" }]
    for (const t of targets) {
      const pos = this.world.roomBlock(t.room.id)!.pos
      const d = Math.hypot(pos[0] - eye.x, pos[1] + 1.5 - eye.y, pos[2] - eye.z)
      if (!best || d < best.d) best = { pos, name: t.name, d }
    }
    if (!best) return
    const v = new THREE.Vector3(best.pos[0], best.pos[1] + 1.5, best.pos[2]).sub(eye)
    v.applyQuaternion(this.view.camera.quaternion.clone().invert())
    this.hud.scent = Math.atan2(v.x, v.y)
    this.hud.ahead = v.z < 0 && Math.hypot(v.x, v.y) < -v.z * 0.18
    this.hud.distance = best.d
    this.hud.target = best.name
  }

  private draw(dt: number) {
    const cam = this.view.camera
    this.view.sync(this.world, {
      time: this.time,
      pulse: this.pulse,
      strum: this.farStep,
      strumT: this.farT,
      fall: this.hud.fall,
      // Pixels per metre at 1 m: point sprites are sized in metres.
      pixel: (this.output.renderer.domElement.height || 600) / (2 * Math.tan((cam.fov * Math.PI) / 360)),
      glow: 1,
    })
    cam.updateProjectionMatrix()
    this.output.draw(
      this.view.scene,
      cam,
      {
        time: this.time,
        pulse: this.pulse,
        pulseT: this.pulseT,
        fall: this.hud.fall,
        black: this.black,
        white: this.white,
      },
      dt
    )
  }

  setAspect(aspect: number) {
    this.view.camera.aspect = aspect
    this.view.camera.updateProjectionMatrix()
  }

  dispose() {
    this.view.dispose()
  }
}
