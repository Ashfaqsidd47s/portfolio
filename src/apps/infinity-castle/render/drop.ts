import * as THREE from "three"
import { ROTATIONS, TURNED } from "../orient"
import { Builder, MAT } from "./builder"
import { MAX_LIGHTS, WARM, doorPart, lantern, type Template } from "./kit"

/**
 * The way in: a fall down a well of stacked rooms, their floors cut away
 * — shoji and gold-cloud fusuma walls, polished ledges, lanterns — that
 * keeps turning and slamming its doors as you drop. Then Nakime strums,
 * the well blows apart, and you fall on through the open void past rooms
 * tumbling every which way, into the castle.
 *
 * Everything here is drawn with the castle's own material, in the column
 * the visitor falls down.
 */

/** Half the width of the well, and the height of one storey of it. */
export const WELL = 3.4
export const STOREY = 4.4
const STOREYS = 16

/**
 * One wall of a storey, facing in from x = WELL. Floor ledges and corner
 * posts are a quarter each (a pinwheel), so four walls turned to the four
 * sides close the well. The middle pair of panels slide (part 1), opening
 * on a lit alcove.
 */
function buildWall(kind: number): Template {
  const S = WELL
  const H = STOREY
  const b = new Builder()
  // The same lights in every kind, so walls can swap shapes under one material.
  b.light([S - 1.5, 2.3, 0], WARM)
  b.light([S - 1.1, 0.7, -2.2], [0.6, 0.3, 0.14])
  b.light([S + 0.8, 2.2, 0], [1.0, 0.38, 0.16])

  const outer = kind === 1 ? MAT.fusuma : MAT.shoji
  const inner = kind === 2 ? MAT.fusuma : MAT.shoji
  // Ledge: polished boards with a lacquered lip round the hole.
  b.box([S - 0.9, -0.34, -S], [S + 0.3, -0.07, S - 0.9], MAT.woodDark)
  b.box([S - 0.9, -0.07, -S], [S + 0.3, 0, S - 0.9], MAT.woodLight, { grain: true })
  b.box([S - 0.97, -0.36, -S], [S - 0.9, 0.03, S - 0.9], MAT.lacquer, { grain: true })
  // Sill, the fixed outer panels and the sliding middle pair.
  b.box([S - 0.14, 0, -S], [S + 0.02, 0.3, S], MAT.woodDark, { grain: true })
  b.box([S - 0.05, 0.3, -S], [S, 3.0, -1.7], outer)
  b.box([S - 0.05, 0.3, 1.7], [S, 3.0, S], outer)
  for (const sgn of [-1, 1]) {
    b.moving(doorPart(0), [0, 0, sgn * 1.55], () => {
      const [z0, z1] = sgn < 0 ? [-1.7, 0] : [0, 1.7]
      b.box([S - 0.13, 0.31, z0], [S - 0.07, 2.99, z1], inner)
      b.box([S - 0.15, 0.31, sgn < 0 ? z0 : z1 - 0.06], [S - 0.06, 2.99, sgn < 0 ? z0 + 0.06 : z1], MAT.woodDark)
    })
  }
  // The alcove behind them: lacquer, a painted back wall, a lantern.
  b.box([S, 0, -1.85], [S + 1.7, 0.3, 1.85], MAT.woodDark, { top: MAT.woodLight })
  b.box([S + 1.6, 0.3, -1.85], [S + 1.75, 3.05, 1.85], MAT.fusuma)
  b.box([S, 0.3, -1.85], [S + 1.6, 3.05, -1.7], MAT.lacquer)
  b.box([S, 0.3, 1.7], [S + 1.6, 3.05, 1.85], MAT.lacquer)
  b.box([S, 3.0, -1.85], [S + 1.75, 3.12, 1.85], MAT.woodDark)
  lantern(b, S + 0.85, 3.0, 0, 0.85, 0.05)
  // Lintel, the glowing transom, the great beam with its gold nail covers.
  b.box([S - 0.18, 3.0, -S], [S + 0.04, 3.2, S], MAT.woodDark, { grain: true })
  b.box([S - 0.04, 3.2, -S], [S, 3.9, S], MAT.shoji)
  b.box([S - 0.24, 3.9, -S], [S + 0.04, H, S], MAT.woodDark, { grain: true })
  for (const z of [-S + 0.55, -1.7, 1.7, S - 0.55]) {
    b.box([S - 0.28, 4.06, z - 0.09], [S - 0.23, 4.24, z + 0.09], MAT.gold)
    b.box([S - 0.18, 0.08, z - 0.08], [S - 0.13, 0.22, z + 0.08], MAT.gold)
  }
  // Corner post.
  b.box([S - 0.32, -0.34, -S - 0.05], [S + 0.06, H, -S + 0.3], MAT.woodDark, { grain: true })
  // Some walls hang a lantern into the well.
  if (kind === 0) lantern(b, S - 0.75, 3.9, -2.3, 0.8, 0.3)
  return { geometry: b.geometry(), boxes: [], lights: b.lights.slice(0, MAX_LIGHTS) }
}

type Wall = {
  mesh: THREE.Mesh
  open: number
  target: number
  /** After the break: drift and spin, in the storey's frame. */
  vel: THREE.Vector3
  spin: THREE.Vector3
  delay: number
}

type Storey = {
  group: THREE.Group
  walls: Wall[]
  /** Quarter turns about the well's axis, animated. */
  yawFrom: number
  yawTo: number
  yawT: number
  yawDur: number
  /** Which wrap it's on, so a storey that comes round again is rebuilt. */
  lap: number
}

type Tumbler = {
  mesh: THREE.Mesh
  from: THREE.Quaternion
  to: THREE.Quaternion
  t: number
  dur: number
  drift: THREE.Vector3
}

export type MakeMaterial = (tpl: Template, seed: number) => THREE.ShaderMaterial

const tmp = new THREE.Vector3()
const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export class Drop {
  readonly group = new THREE.Group()
  /** Loop: the well wraps round the camera, endless. Broken: it flies apart. */
  mode: "loop" | "broken" | "off" = "loop"
  private kinds: Template[]
  private storeys: Storey[] = []
  private tumblers: Tumbler[] = []
  private column: [number, number]
  private scroll = 0
  private brokeAt = 0
  private clock = 0

  constructor(make: MakeMaterial, hall: Template, column: [number, number], span: [number, number]) {
    this.column = column
    this.kinds = [0, 1, 2].map(buildWall)
    for (let i = 0; i < STOREYS; i++) {
      const group = new THREE.Group()
      const walls: Wall[] = []
      for (let d = 0; d < 4; d++) {
        const kind = Math.floor(Math.random() * 3)
        const mesh = new THREE.Mesh(this.kinds[kind].geometry, make(this.kinds[kind], Math.random()))
        mesh.rotation.y = (-d * Math.PI) / 2
        group.add(mesh)
        const open = Math.random() < 0.3 ? 1 : 0
        walls.push({ mesh, open, target: open, vel: new THREE.Vector3(), spin: new THREE.Vector3(), delay: 0 })
      }
      this.group.add(group)
      this.storeys.push({ group, walls, yawFrom: 0, yawTo: 0, yawT: 1, yawDur: 0.3, lap: 0 })
    }
    // Rooms adrift in the void below the well, every which way up.
    const [lo, hi] = span
    const count = 24
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(hall.geometry, make(hall, Math.random()))
      const angle = (i / count) * Math.PI * 2 * 2.618 + rnd(-0.3, 0.3)
      const radius = rnd(12.5, 26)
      mesh.position.set(column[0] + Math.cos(angle) * radius, lo + ((i + rnd(0, 0.8)) / count) * (hi - lo), column[1] + Math.sin(angle) * radius)
      const m = i % 4 === 0 ? ROTATIONS[Math.floor(Math.random() * 4)] : TURNED[Math.floor(Math.random() * TURNED.length)]
      const q = quatOf(m)
      mesh.quaternion.copy(q)
      const open = (mesh.material as THREE.ShaderMaterial).uniforms.uOpen.value as number[]
      for (let side = 0; side < 4; side++) open[doorPart(side)] = Math.random() < 0.5 ? 1 : 0
      this.group.add(mesh)
      this.tumblers.push({
        mesh,
        from: q.clone(),
        to: q.clone(),
        t: 1,
        dur: 0.4,
        drift: new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(0.04, 0.14)),
      })
    }
  }

  /** Where the well sits: the column the visitor falls down. */
  get centre() {
    return this.column
  }

  /**
   * Nakime's hand on the well: storeys turn a quarter, panels slam open or
   * shut, a few drifting rooms flip over. `strength` 0–1 sets how much.
   */
  kick(strength: number) {
    for (const s of this.storeys) {
      if (Math.random() < 0.25 + strength * 0.45 && s.yawT >= 1) {
        s.yawFrom = s.yawTo
        s.yawTo += (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.2 * strength ? 2 : 1)
        s.yawT = 0
        s.yawDur = 0.42 - strength * 0.2
      }
      for (const w of s.walls) if (Math.random() < 0.15 + strength * 0.3) w.target = 1 - w.target
    }
    for (const t of this.tumblers) {
      if (t.t < 1 || Math.random() > 0.3 + strength * 0.4) continue
      const axis = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)][Math.floor(Math.random() * 3)]
      t.from.copy(t.mesh.quaternion)
      t.to.copy(t.mesh.quaternion).premultiply(new THREE.Quaternion().setFromAxisAngle(axis, (Math.PI / 2) * (Math.random() < 0.5 ? -1 : 1)))
      t.t = 0
      t.dur = 0.5 - strength * 0.25
    }
  }

  /** The strum that ends the well: every wall blows outward and tumbles away. */
  shatter(camY: number) {
    if (this.mode !== "loop") return
    this.mode = "broken"
    this.brokeAt = this.clock
    for (const s of this.storeys) {
      const depth = Math.abs(s.group.position.y - camY)
      s.walls.forEach((w, d) => {
        const out = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), (-d * Math.PI) / 2)
        w.vel.copy(out.multiplyScalar(rnd(14, 30))).add(new THREE.Vector3(rnd(-3, 3), rnd(-2, 9), rnd(-3, 3)))
        w.spin.set(rnd(-2.4, 2.4), rnd(-1.2, 1.2), rnd(-2.4, 2.4))
        w.delay = depth * 0.006 + rnd(0, 0.08)
        w.target = 1
      })
    }
  }

  /**
   * Moves the well. While it loops it is laid out round `camY`, scrolling
   * past at `speed` m/s; once broken its pieces fly on by themselves.
   */
  update(dt: number, camY: number, speed: number) {
    this.clock += dt
    this.group.visible = this.mode !== "off"
    if (this.mode === "off") return
    const H = STOREY
    const loop = STOREYS * H
    if (this.mode === "loop") {
      this.scroll += speed * dt
      this.storeys.forEach((s, i) => {
        const pos = i * H + this.scroll
        const lap = Math.floor(pos / loop)
        // From two storeys above the eye down through the rest.
        const y = camY + 2 * H - (loop - (pos % loop))
        if (lap !== s.lap) {
          s.lap = lap
          this.rebuild(s)
        }
        s.group.position.set(this.column[0], y, this.column[1])
      })
    } else if (this.clock - this.brokeAt > 6) {
      this.mode = "off"
    }

    for (const s of this.storeys) {
      if (s.yawT < 1) s.yawT = Math.min(1, s.yawT + dt / s.yawDur)
      s.group.rotation.y = ((s.yawFrom + (s.yawTo - s.yawFrom) * ease(s.yawT)) * Math.PI) / 2
      for (const w of s.walls) {
        // Panels slam: quick and linear.
        w.open += Math.sign(w.target - w.open) * Math.min(Math.abs(w.target - w.open), dt / 0.16)
        if (this.mode !== "broken" || this.clock - this.brokeAt < w.delay) continue
        w.mesh.position.addScaledVector(w.vel, dt)
        w.vel.y -= 6 * dt
        w.mesh.rotateX(w.spin.x * dt)
        w.mesh.rotateY(w.spin.y * dt)
        w.mesh.rotateZ(w.spin.z * dt)
      }
    }
    for (const t of this.tumblers) {
      if (t.t < 1) {
        t.t = Math.min(1, t.t + dt / t.dur)
        t.mesh.quaternion.slerpQuaternions(t.from, t.to, ease(t.t))
      } else {
        // A slow roll between flips.
        tmp.copy(t.drift).multiplyScalar(dt)
        t.mesh.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(tmp.x, tmp.y, tmp.z)))
      }
    }
  }

  /** A storey coming round again gets new walls and turns. */
  private rebuild(s: Storey) {
    s.yawFrom = s.yawTo = Math.floor(Math.random() * 4)
    s.yawT = 1
    for (const w of s.walls) {
      const kind = this.kinds[Math.floor(Math.random() * 3)]
      w.mesh.geometry = kind.geometry
      const u = (w.mesh.material as THREE.ShaderMaterial).uniforms
      u.uSeed.value = Math.random()
      u.uVariant.value = Math.random()
      w.open = w.target = Math.random() < 0.3 ? 1 : 0
    }
  }

  /** Per-frame shader inputs: the camera in each mesh's frame, its doors. */
  sync(cam: THREE.Vector3, fx: { time: number; pulse: number }) {
    if (!this.group.visible) return
    this.group.updateMatrixWorld()
    const each = (mesh: THREE.Mesh, open?: number) => {
      const u = (mesh.material as THREE.ShaderMaterial).uniforms
      u.uCamLocal.value.copy(mesh.worldToLocal(tmp.copy(cam)))
      u.uTime.value = fx.time
      u.uPulse.value = fx.pulse
      if (open !== undefined) (u.uOpen.value as number[])[doorPart(0)] = open
    }
    for (const s of this.storeys) for (const w of s.walls) each(w.mesh, w.open)
    for (const t of this.tumblers) each(t.mesh)
  }

  dispose() {
    for (const k of this.kinds) k.geometry.dispose()
    this.group.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.material) (m.material as THREE.Material).dispose()
    })
  }
}

const quatCache = new Map<string, THREE.Quaternion>()

/** A quarter-turn orientation as a quaternion. */
export function quatOf(m: readonly number[]): THREE.Quaternion {
  const key = m.join()
  let q = quatCache.get(key)
  if (!q) {
    const m4 = new THREE.Matrix4().set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1)
    q = new THREE.Quaternion().setFromRotationMatrix(m4)
    quatCache.set(key, q)
  }
  return q.clone()
}
