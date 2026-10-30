import * as THREE from "three"
import { Character, FRIEND, ME } from "./actors/character"
import { Markers } from "./actors/markers"
import { Traffic } from "./actors/traffic"
import { Environment, type EnvEvent, type WeatherKind } from "./env"
import type { Surroundings } from "./audio"
import { LAKE, PLACES, START, add, nearest, norm, right, scale, type Vec2 } from "./geo"
import type { Signs } from "./kit/signs"
import { View } from "./render/view"
import { bought, choose, finale, FRIEND_NAME, newStory, objective, PLAYER_NAME, talk, type Line, type Scene, type StoryState } from "./story"
import { WARPS } from "./world/fantasy"
import type { Plan } from "./world/plan"

/**
 * One walk through the town: the player, their friend, the traffic, the
 * weather and the story. The React shell feeds it input and reads `hud`
 * each frame; anything the shell should react to arrives as an event.
 */

export type Controls = { move: [number, number]; run: boolean }

export type Dialogue = { speaker: string; who: Line["who"]; text: string; choices?: { id: string; label: string }[]; last: boolean }

export type GameEvent =
  | { type: "place"; name: string; note: string }
  | { type: "objective"; text: string | null }
  | { type: "dialogue"; dialogue: Dialogue | null }
  | { type: "toast"; title: string; sub?: string }
  | { type: "weather"; kind: WeatherKind }
  | { type: "thunder"; delay: number; strength: number }
  | { type: "step"; wet: boolean; run: boolean }
  | { type: "achievement"; title: string }
  /** Stepped up to a warp crystal: open the map to choose where to go. */
  | { type: "warp" }

export type Hud = {
  /** Interaction available: what pressing E would do. */
  prompt: { label: string; verb: string } | null
  /** The objective's direction on screen (radians, 0 = up) and distance. */
  arrow: { angle: number; distance: number; onScreen: boolean } | null
  /** Labels over heads, in CSS px. */
  friend: { x: number; y: number; visible: boolean; bubble: string | null }
  player: { x: number; z: number; heading: number }
  place: string
  /** For the minimap: where she is, where you're headed, which way the camera looks. */
  friendAt: Vec2
  target: Vec2 | null
  bearing: number
}

const RADIUS = 0.32
const WALK = 4.2
const RUN = 8.6

export class Game {
  readonly view: View
  readonly env: Environment
  readonly controls: Controls = { move: [0, 0], run: false }
  readonly story: StoryState = newStory()
  readonly hud: Hud = {
    prompt: null,
    arrow: null,
    friend: { x: 0, y: 0, visible: false, bubble: null },
    player: { x: START[0], z: START[1], heading: 0 },
    place: "",
    friendAt: [0, 0],
    target: null,
    bearing: 0,
  }
  private plan: Plan
  private me: Character
  private friend: Character
  private traffic: Traffic
  private markers: Markers
  private pos: Vec2 = [...START]
  private friendPos: Vec2
  private friendSeat: { p: Vec2; d: Vec2 }
  private friendState: "seated" | "standing" | "following" | "waiting" = "seated"
  private noticed = false
  private bubble: { text: string; t: number } | null = null
  private emit: (e: GameEvent) => void
  private scene: { lines: Line[]; i: number; choices?: Scene["choices"]; onEnd?: () => void } | null = null
  private placeId = ""
  private stepClock = 0
  private feeding = 0
  private travelling: { to: Vec2; t: number; moved: boolean } | null = null
  private lastObjective: string | null = null
  private headV = new THREE.Vector3()

  constructor(canvas: HTMLCanvasElement, plan: Plan, signs: Signs, atlas: THREE.Texture | null, emit: (e: GameEvent) => void) {
    this.plan = plan
    this.emit = emit
    this.env = new Environment()
    this.view = new View(canvas, plan, signs, atlas)
    this.me = new Character(ME, this.view.mats.actor)
    this.friend = new Character(FRIEND, this.view.mats.actor)
    this.traffic = new Traffic(plan, this.view.mats.world)
    this.markers = new Markers(WARPS.map((id) => plan.marks.get(`warp-${id}`)?.p ?? START))
    this.view.scene.add(this.me.root, this.friend.root, this.traffic.group, this.markers.group)

    this.friendSeat = plan.marks.get("friend") ?? { p: [270, 330] as Vec2, d: [0, 1] as Vec2 }
    this.friendPos = [...this.friendSeat.p]
    this.friend.pose = "sit"
    this.friend.yaw = this.friend.targetYaw = Math.atan2(this.friendSeat.d[0], this.friendSeat.d[1])

    // Start out front, facing Saharanpur Road.
    this.me.yaw = this.me.targetYaw = Math.atan2(-0.875, -0.485)
    this.view.focus.set(this.pos[0], 0, this.pos[1])
    this.syncActors()
    this.view.prime()
  }

  start() {
    this.pushObjective()
    this.emit({ type: "toast", title: "ISBT Dehradun", sub: "You've just got off the bus from Saharanpur." })
  }

  // ── input from the shell ──────────────────────────────────────────────────

  /** E / Space / tap: advance dialogue, or use what's in front of you. */
  interact() {
    if (this.travelling) return
    if (this.scene) {
      if (this.scene.choices && this.scene.i >= this.scene.lines.length - 1) return
      this.scene.i++
      this.showLine()
      return
    }
    const near = this.nearestSpot()
    if (!near) return
    this.use(near.id)
  }

  pick(id: string) {
    if (!this.scene) return
    const end = this.scene.onEnd
    this.scene = null
    const reply = choose(this.story, id)
    this.afterChoice(id)
    if (reply) this.play(reply, end)
    else {
      this.emit({ type: "dialogue", dialogue: null })
      end?.()
    }
    this.pushObjective()
  }

  private afterChoice(id: string) {
    if (id === "walk" || id === "follow") this.friendState = "following"
    if (id === "wait") this.friendState = "waiting"
  }

  travel(placeId: string) {
    const to = this.travelPoint(placeId)
    if (!to || this.scene) return
    this.travelling = { to, t: 0, moved: false }
  }

  /** Drag on the view: turn the camera round you and tilt it. */
  orbit(dx: number, dy: number) {
    this.view.orbit(dx, dy)
  }

  zoomBy(f: number) {
    this.view.zoom = Math.max(14, Math.min(72, this.view.zoom * f))
  }

  setWeather(kind: WeatherKind | "auto") {
    this.env.setWeather(kind)
  }

  resize(w: number, h: number, dpr: number) {
    this.view.resize(w, h, dpr)
  }

  // ── the frame ─────────────────────────────────────────────────────────────

  update(dt: number) {
    dt = Math.max(0, Math.min(dt, 0.1))
    this.env.update(dt, (e: EnvEvent) => this.emit(e.type === "weather" ? { type: "weather", kind: e.kind } : e))

    if (this.travelling) this.stepTravel(dt)
    else if (!this.scene) this.movePlayer(dt)
    else {
      this.me.pose = "idle"
      this.me.speed = 0
    }

    this.updateFriend(dt)
    this.traffic.update(dt, [this.pos, this.friendPos])
    this.feeding = Math.max(0, this.feeding - dt)
    this.view.ducks.update(dt, performance.now() / 1000, this.feeding > 0 ? this.feedPoint() : null)

    this.me.update(dt)
    this.friend.update(dt)
    this.syncActors()
    const st = this.story
    const hasNews = st.stage === "arrive" || st.stage === "return" || (st.stage === "errand" && st.patties)
    this.markers.update(performance.now() / 1000, this.targetPoint(), this.pos, {
      p: this.friendPos,
      y: this.friendState === "seated" ? 2.5 : 2.95,
      show: hasNews && !this.scene,
    }, this.view.camera)

    // The camera trails a touch behind you.
    const f = this.view.focus
    const k = Math.min(1, dt * 6)
    f.x += (this.pos[0] - f.x) * k
    f.z += (this.pos[1] - f.z) * k

    this.headV.set(this.pos[0], 1.2, this.pos[1])
    this.view.update(dt, this.env.state, this.headV)
    this.view.render(this.env.state)

    this.checkPlace()
    this.checkStory()
    this.updateHud()
  }

  private movePlayer(dt: number) {
    const [mx, my] = this.controls.move
    const mag = Math.min(1, Math.hypot(mx, my))
    if (mag < 0.08) {
      this.me.pose = "idle"
      this.me.speed = 0
      return
    }
    const { up, right: r } = this.view.axes()
    const dir = norm([up[0] * my + r[0] * mx, up[1] * my + r[1] * mx])
    const speed = (this.controls.run ? RUN : WALK) * mag
    const step: Vec2 = [dir[0] * speed * dt, dir[1] * speed * dt]
    const next = this.plan.collision.move(this.pos, step, RADIUS)
    const moved = Math.hypot(next[0] - this.pos[0], next[1] - this.pos[1])
    this.pos = next
    this.me.targetYaw = Math.atan2(dir[0], dir[1])
    this.me.speed = moved / dt
    this.me.pose = this.controls.run && mag > 0.5 ? "run" : "walk"

    this.stepClock -= moved
    if (this.stepClock <= 0) {
      this.stepClock = this.controls.run ? 1.3 : 0.95
      this.emit({ type: "step", wet: this.env.state.wet > 0.3, run: this.controls.run })
    }
  }

  private updateFriend(dt: number) {
    const fr = this.friend
    const d = Math.hypot(this.pos[0] - this.friendPos[0], this.pos[1] - this.friendPos[1])
    const faceMe = Math.atan2(this.pos[0] - this.friendPos[0], this.pos[1] - this.friendPos[1])

    if (this.bubble) {
      this.bubble.t -= dt
      if (this.bubble.t <= 0) this.bubble = null
    }

    switch (this.friendState) {
      case "seated": {
        fr.pose = "sit"
        if (!this.noticed && d < 16) {
          this.noticed = true
          this.friendState = "standing"
          this.friendPos = add(this.friendSeat.p, scale(this.friendSeat.d, -0.7))
          this.say(this.story.stage === "arrive" ? `${PLAYER_NAME}! Over here!` : "Hey!", 3)
          this.waveFor(2.4)
        }
        break
      }
      case "standing":
      case "waiting": {
        if (fr.pose !== "wave") fr.pose = "idle"
        if (d < 10) fr.targetYaw = faceMe
        // Back to the bench if you wander far off while she's waiting there.
        if (this.friendState === "standing" && d > 40 && this.story.stage !== "walk") {
          this.friendState = "seated"
          this.noticed = false
          this.friendPos = [...this.friendSeat.p]
          fr.targetYaw = Math.atan2(this.friendSeat.d[0], this.friendSeat.d[1])
        }
        break
      }
      case "following": {
        // Walk a little behind and to the side of you.
        const back = norm([Math.sin(this.me.yaw), Math.cos(this.me.yaw)])
        const goal = add(this.pos, add(scale(back, -1.5), scale(right(back), 0.9)))
        const gx = goal[0] - this.friendPos[0]
        const gz = goal[1] - this.friendPos[1]
        const gd = Math.hypot(gx, gz)
        if (d > 30) {
          // Lost you: catch up out of sight.
          const spot = this.freeNear(goal)
          if (spot) this.friendPos = spot
          break
        }
        if (gd > 0.6) {
          const speed = Math.min(RUN * 1.05, Math.max(WALK * 0.8, gd * 2.2))
          const step: Vec2 = [(gx / gd) * Math.min(gd, speed * dt), (gz / gd) * Math.min(gd, speed * dt)]
          const next = this.plan.collision.move(this.friendPos, step, RADIUS)
          const moved = Math.hypot(next[0] - this.friendPos[0], next[1] - this.friendPos[1])
          this.friendPos = next
          fr.targetYaw = Math.atan2(gx, gz)
          fr.speed = moved / dt
          fr.pose = speed > WALK * 1.3 ? "run" : "walk"
        } else {
          fr.pose = "idle"
          fr.speed = 0
          if (d < 4) fr.targetYaw = faceMe
        }
        break
      }
    }
  }

  private waveFor(seconds: number) {
    this.friend.pose = "wave"
    window.setTimeout(() => {
      if (this.friend.pose === "wave") this.friend.pose = "idle"
    }, seconds * 1000)
  }

  private say(text: string, seconds: number) {
    this.bubble = { text, t: seconds }
  }

  private syncActors() {
    this.me.root.position.set(this.pos[0], 0, this.pos[1])
    const seat = this.friendState === "seated"
    this.friend.root.position.set(this.friendPos[0], seat ? 0.05 : 0, this.friendPos[1])
  }

  // ── places, spots and the story ───────────────────────────────────────────

  private checkPlace() {
    let best: (typeof PLACES)[number] | null = null
    for (const p of PLACES) {
      const d = Math.hypot(p.at[0] - this.pos[0], p.at[1] - this.pos[1])
      if (d < p.radius && (!best || p.radius < best.radius)) best = p
    }
    let id = best?.id ?? ""
    let name = best?.name ?? ""
    let note = best?.note ?? ""
    if (!best) {
      const near = this.plan.nearestRoad(this.pos)
      if (near.dist < 4) {
        id = near.road.id
        name = near.road.name
        note = near.road.kind === "lane" ? "Clement Town" : "Dehradun"
      } else {
        id = this.placeId
        name = this.hud.place
      }
    }
    if (id !== this.placeId && name) {
      this.placeId = id
      this.hud.place = name
      this.emit({ type: "place", name, note })
    }
  }

  private nearestSpot() {
    const fd = Math.hypot(this.pos[0] - this.friendPos[0], this.pos[1] - this.friendPos[1])
    if (fd < 2.6) return { id: "friend", label: FRIEND_NAME, verb: "Talk", d: fd }
    let best: { id: string; label: string; verb: string; d: number } | null = null
    for (const s of this.plan.spots) {
      const d = Math.hypot(s.at[0] - this.pos[0], s.at[1] - this.pos[1])
      if (d < s.radius && (!best || d < best.d)) best = { id: s.id, label: s.label, verb: s.verb, d }
    }
    return best
  }

  private use(id: string) {
    const env = this.env.state
    if (id.startsWith("warp:")) {
      this.emit({ type: "warp" })
      return
    }
    switch (id) {
      case "friend": {
        if (this.friendState === "seated") {
          this.friendState = "standing"
          this.noticed = true
          this.friendPos = add(this.friendSeat.p, scale(this.friendSeat.d, -0.7))
        }
        this.friend.targetYaw = Math.atan2(this.pos[0] - this.friendPos[0], this.pos[1] - this.friendPos[1])
        this.me.targetYaw = Math.atan2(this.friendPos[0] - this.pos[0], this.friendPos[1] - this.pos[1])
        this.play(talk(this.story, env))
        return
      }
      case "cakehouse":
        this.play(bought(this.story, "patties"), () => this.pushObjective())
        return
      case "rajkumar":
        this.play(bought(this.story, "mithai"))
        return
      case "isbt-chai":
        this.play(bought(this.story, "chai"))
        return
      case "isbt-enquiry": {
        const next = Math.ceil((env.minutes + 20) / 30) * 30
        const t = `${Math.floor(next / 60) % 24}:${String(next % 60).padStart(2, "0")}`
        this.play({ lines: [{ who: "narrator", text: `"Mussoorie? Next Himgiri bus at ${t}, platform 4. Delhi Volvo every hour, platform 1."` }] })
        return
      }
      case "velmed":
        this.play({ lines: [{ who: "narrator", text: "Velmed Hospital's lobby hums with a TV and a queue at the pharmacy window. Everyone's fine; you leave them to it." }] })
        return
      case "ducks":
        this.feeding = 14
        this.play({ lines: [{ who: "narrator", text: "You crumble a rusk into the water. Every duck on the lake suddenly remembers you." }] })
        return
      case "wheels":
        this.play({ lines: [{ who: "narrator", text: "You walk the row, turning each prayer wheel clockwise. Om mani padme hum, a hundred times over." }] })
        return
      case "temple":
        this.play({ lines: [{ who: "narrator", text: "Butter lamps flicker under a gold Buddha. A monk sweeps the steps without looking up." }] })
        return
      case "stupa":
        if (this.story.stage === "walk" && this.friendClose()) this.doFinale()
        else this.play({ lines: [{ who: "narrator", text: "You walk the kora round the Great Stupa, clockwise, under strings of prayer flags." }] })
        return
    }
  }

  private friendClose() {
    return Math.hypot(this.pos[0] - this.friendPos[0], this.pos[1] - this.friendPos[1]) < 12
  }

  private doFinale() {
    this.story.sawStupa = true
    this.play(finale(this.env.state), () => {
      this.story.stage = "free"
      this.pushObjective()
      this.emit({ type: "achievement", title: "An evening in Clement Town" })
    })
  }

  private checkStory() {
    // Arriving at the stupa together finishes the walk without pressing anything.
    if (this.story.stage === "walk" && !this.scene && this.friendClose()) {
      const st = this.plan.marks.get("stupa")
      if (st && Math.hypot(st.p[0] - this.pos[0], st.p[1] - this.pos[1]) < 9) this.doFinale()
    }
  }

  private pushObjective() {
    const o = objective(this.story)
    const text = o?.text ?? null
    if (text !== this.lastObjective) {
      this.lastObjective = text
      this.emit({ type: "objective", text })
    }
  }

  private targetPoint(): Vec2 | null {
    const o = objective(this.story)
    if (!o) return null
    if (o.target === "friend") return this.friendPos
    return this.plan.marks.get(o.target)?.p ?? null
  }

  // ── dialogue ──────────────────────────────────────────────────────────────

  private play(scene: Scene, onEnd?: () => void) {
    this.scene = { lines: scene.lines, i: 0, choices: scene.choices, onEnd }
    this.showLine()
  }

  private showLine() {
    const s = this.scene
    if (!s) return
    if (s.i >= s.lines.length) {
      this.scene = null
      this.emit({ type: "dialogue", dialogue: null })
      s.onEnd?.()
      this.pushObjective()
      return
    }
    const line = s.lines[s.i]
    const last = s.i === s.lines.length - 1
    this.emit({
      type: "dialogue",
      dialogue: {
        who: line.who,
        speaker: line.who === "friend" ? FRIEND_NAME : line.who === "me" ? PLAYER_NAME : "",
        text: line.text,
        choices: last ? s.choices : undefined,
        last,
      },
    })
  }

  // ── fast travel ───────────────────────────────────────────────────────────

  /** Fast travel lands you beside that place's warp crystal. */
  private travelPoint(id: string): Vec2 | null {
    const warp = this.plan.marks.get(`warp-${id}`)
    if (!warp) return null
    return this.freeNear(add(warp.p, [2.6, 2.6]))
  }

  private freeNear(p: Vec2): Vec2 | null {
    for (let r = 0; r < 20; r += 0.7) {
      for (let a = 0; a < Math.PI * 2; a += 0.5) {
        const q: Vec2 = [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r]
        if (this.plan.collision.free(q[0], q[1], RADIUS + 0.1)) return q
      }
    }
    return null
  }

  private stepTravel(dt: number) {
    const t = this.travelling!
    t.t += dt
    this.me.pose = "idle"
    this.view.fade = t.t < 0.35 ? t.t / 0.35 : Math.max(0, 1 - (t.t - 0.55) / 0.4)
    if (!t.moved && t.t >= 0.35) {
      t.moved = true
      this.pos = [...t.to]
      if (this.friendState === "following") {
        const spot = this.freeNear(add(this.pos, [1.2, 1.2]))
        if (spot) this.friendPos = spot
      }
      this.view.focus.set(this.pos[0], 0, this.pos[1])
      this.view.prime()
    }
    if (t.t > 1) {
      this.travelling = null
      this.view.fade = 0
    }
  }

  private feedPoint(): Vec2 {
    const s = this.plan.spots.find((x) => x.id === "ducks")
    const p = s?.at ?? this.pos
    const c = this.plan.marks.get("fountain")?.p ?? p
    return add(p, scale(norm([c[0] - p[0], c[1] - p[1]]), 4))
  }

  /** How near the busy roads, the stupa and the lake are, for the sound. */
  surroundings(): Surroundings {
    let road = Infinity
    for (const r of this.plan.roads) if (r.kind !== "lane") road = Math.min(road, nearest(r.points, this.pos).dist - r.width / 2)
    const stupa = this.plan.marks.get("stupa")?.p ?? LAKE.centre
    const clamp = (v: number) => Math.max(0, Math.min(1, v))
    return {
      traffic: clamp(1 - road / 70),
      monastery: clamp(1 - Math.hypot(stupa[0] - this.pos[0], stupa[1] - this.pos[1]) / 160),
      lake: clamp(1 - Math.hypot(LAKE.centre[0] - this.pos[0], LAKE.centre[1] - this.pos[1]) / 140),
    }
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  private updateHud() {
    const h = this.hud
    const near = this.scene || this.travelling ? null : this.nearestSpot()
    h.prompt = near ? { label: near.label, verb: near.verb } : null

    const target = this.targetPoint()
    if (target) {
      const dx = target[0] - this.pos[0]
      const dz = target[1] - this.pos[1]
      const { up, right: r } = this.view.axes()
      const sx = dx * r[0] + dz * r[1]
      const sy = dx * up[0] + dz * up[1]
      const screen = this.view.toScreen(new THREE.Vector3(target[0], 1.5, target[1]))
      h.arrow = { angle: Math.atan2(sx, sy), distance: Math.hypot(dx, dz), onScreen: screen.x > 0 && screen.y > 0 && Math.hypot(dx, dz) < this.view.zoom * 0.6 }
    } else {
      h.arrow = null
    }

    const fs = this.view.toScreen(new THREE.Vector3(this.friendPos[0], this.friendState === "seated" ? 1.95 : 2.35, this.friendPos[1]))
    const fd = Math.hypot(this.pos[0] - this.friendPos[0], this.pos[1] - this.friendPos[1])
    h.friend.x = fs.x
    h.friend.y = fs.y
    h.friend.visible = fd < this.view.zoom * 1.1
    h.friend.bubble = this.bubble?.text ?? null
    h.player.x = this.pos[0]
    h.player.z = this.pos[1]
    h.player.heading = this.me.yaw
    h.friendAt = this.friendPos
    h.target = target
    h.bearing = this.view.bearing
  }

  dispose() {
    this.markers.dispose()
    this.traffic.dispose()
    this.view.dispose()
  }
}
