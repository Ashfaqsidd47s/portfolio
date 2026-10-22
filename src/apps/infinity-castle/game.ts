import * as THREE from "three"
import { Castle, CELL, LANDMARKS, LEVEL, nodeCenter, nodeKey, type Landmark, type Node, type Vec3 } from "./castle"
import type { CastleAudio } from "./audio"
import { sameUp, upOf } from "./orient"
import type { ScoreMode } from "./score"
import { BODY, createBody, depenetrate, step, upVector, type Body, type Box, type Up } from "./physics"
import type { Output } from "./render/output"
import { ROOF_PART, TRAP_PART, doorPart } from "./render/kit"
import { CastleView, buildTemplates } from "./render/view"
import { World } from "./world"

/**
 * One visit to the castle: the endless fall behind the title, the drop
 * down the well and through the void into a hall whose roof Nakime tears
 * open, walking the castle while she rearranges it (and the rooms she has
 * turned over, where the floor is a wall), finding the three Upper Moons'
 * rooms, and reaching her.
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

  constructor(seed: number, output: Output, audio: CastleAudio, emit: (e: GameEvent) => void) {
    this.castle = new Castle(seed)
    for (const n of this.castle.landingColumn()) this.castle.hold.add(nodeKey(n))
    const templates = buildTemplates()
    this.world = new World(this.castle, templates)
    const land = this.castle.rooms.get(this.castle.landingId)!.node
    const [lx, ly, lz] = nodeCenter(land)
    const top = (this.castle.size.y + 1) * LEVEL + 8
    this.view = new CastleView(templates, this.castle.size, {
      column: [lx, lz],
      node: [land[0], land[2]],
      span: [top, ly + DROP_HEIGHT - 70],
    })
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
    const p = this.body.pos
    const playing = this.phase !== "title"
    const near = playing
      ? this.world.near(p, 3)
      : { rooms: new Set<number>(), edges: new Set<string>(), strays: new Set<number>() }
    if (this.flipped) near.rooms.add(this.flipped.room)
    if (this.holding) near.rooms.add(this.castle.landingId)
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
      count: 3 + Math.floor(Math.random() * 3),
    })
    const length = this.world.play(plan, { cascadeFrom: playing ? p : undefined, still: near.rooms })
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

    if (this.flipped) {
      this.later(0.4, () => this.unflip())
      return
    }
    const room = this.world.roomContaining(p, -0.4)
    if (!room || room.kind !== "hall" || !this.body.grounded) return
    const roll = Math.random()
    const below = [...this.castle.rooms.values()].some(
      (r) => r.node[0] === room.node[0] && r.node[2] === room.node[2] && r.node[1] < room.node[1]
    )
    const block = this.world.roomBlock(room.id)!
    const onTrap = Math.abs(p[0] - block.pos[0]) < 1.2 && Math.abs(p[2] - block.pos[2]) < 1.2
    if (roll < 0.5 && below && onTrap) {
      this.world.setPart(block, TRAP_PART, 1, 0.45, 0.15)
      this.world.setPart(block, TRAP_PART, 0, 4.5, 0.4)
      this.later(0.4, () => this.emit({ type: "toast", title: "The floor gives way", sub: "Nakime opens the tatami under you." }))
    } else if (roll < 0.32) {
      this.turnRoom(room.id)
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
    const block = this.world.roomBlock(roomId)!
    const open = this.castle.openSides(roomId)
    open.forEach((o, side) => o && this.world.setPart(block, doorPart(side), 1, at, 0.3))
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

    const before = new Map<number, Vec3>()
    for (const b of this.world.blocks.values()) if (b.room) before.set(b.owner, b.pos)
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
      if (now) for (let i = 0; i < 3; i++) body.pos[i] += now[i] - was[i]
    }

    // Wish velocity across the current floor.
    const q = new THREE.Quaternion().copy(this.frameTarget)
    const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw)
    q.multiply(yawQ)
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q)
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q)
    const [mx, my] = this.input.move
    const len = Math.hypot(mx, my)
    const speed = (this.input.run ? RUN : WALK) * Math.min(1, len)
    const dir = fwd.multiplyScalar(my).add(right.multiplyScalar(mx))
    if (len > 0) dir.normalize()
    const wish: Vec3 = [dir.x * speed, dir.y * speed, dir.z * speed]

    this.world.collect(body.pos, 4, this.boxes)
    depenetrate(body, this.boxes)
    const was: Vec3 = [...body.pos]
    const res = step(body, this.boxes, wish, this.input.jump, dt)
    this.input.jump = false
    const u = body.up.axis
    const moved = Math.hypot(...was.map((v, i) => (i === u ? 0 : body.pos[i] - v)))

    if (res.landed > 4) {
      this.audio.land(res.landed)
      this.dip = Math.min(0.35, res.landed * 0.012)
      if (res.landed > 14) this.shake = Math.max(this.shake, this.reduced ? 0 : 0.7)
    }
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
      if (this.walked > this.nextStrumAt || this.time - this.lastStrum > 50) this.strum()
      this.discover()
      if (this.flipped && this.time > this.flipped.until) this.unflip()
    }

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
    if (out && this.relocating <= 0) this.relocate()
    if (this.relocating > 0) {
      this.relocating -= dt
      this.black = Math.max(this.black, Math.min(1, 1 - Math.abs(this.relocating - 0.4) * 2.5))
    }

    this.placeCamera(fall, dt)
    this.hud.fall = fall
    this.updateScent()
  }

  /**
   * Gravity follows the room you're in: inside a stray its floor is the
   * floor; back on its bridge, or in an upright hall, down is down again.
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
    if (this.flipped || sameUp(body.up, UPRIGHT)) return
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
    for (const b of this.world.blocks.values()) if (b.edge || b.spur) this.world.fold(b, 0.6 + Math.random() * 0.6)
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
