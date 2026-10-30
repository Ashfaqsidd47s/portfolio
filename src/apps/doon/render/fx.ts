import * as THREE from "three"
import { inside, type Polygon, type Vec2 } from "../geo"
import { Builder } from "../kit/builder"
import { WATER_Y } from "./water"

/** Little living things: the lake's fountain and ducks, rain splashes, fireflies. */

function points(n: number, size: number, additive = false) {
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3))
  const m = new THREE.PointsMaterial({
    size,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: additive,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: !additive,
  })
  const p = new THREE.Points(g, m)
  p.frustumCulled = false
  return p
}

const NIGHT_COLOURS = [new THREE.Color(0x60b0ff), new THREE.Color(0xff70c0), new THREE.Color(0xffd060), new THREE.Color(0x80ffb0)]

export class Fountain {
  readonly points: THREE.Points
  private v: Float32Array
  private n = 320
  private c: Vec2

  constructor(centre: Vec2) {
    this.c = centre
    this.points = points(this.n, 2)
    this.v = new Float32Array(this.n * 3)
    const pos = this.points.geometry.getAttribute("position") as THREE.BufferAttribute
    for (let i = 0; i < this.n; i++) {
      this.spawn(i, pos)
      // Spread the first jets through their arc.
      pos.setY(i, WATER_Y + Math.random() * 5)
    }
  }

  private spawn(i: number, pos: THREE.BufferAttribute) {
    const a = Math.random() * Math.PI * 2
    const centre = i % 4 === 0
    const r = centre ? 0.1 : 0.5
    pos.setXYZ(i, this.c[0] + Math.cos(a) * r, WATER_Y + 0.6, this.c[1] + Math.sin(a) * r)
    const out = centre ? 0.25 : 1.1 + Math.random() * 0.5
    this.v[i * 3] = Math.cos(a) * out
    this.v[i * 3 + 1] = centre ? 9 + Math.random() * 1.5 : 5.2 + Math.random() * 1.2
    this.v[i * 3 + 2] = Math.sin(a) * out
  }

  update(dt: number, night: number, time: number) {
    const pos = this.points.geometry.getAttribute("position") as THREE.BufferAttribute
    const col = this.points.geometry.getAttribute("color") as THREE.BufferAttribute
    const lit = NIGHT_COLOURS[Math.floor(Math.max(0, time) / 4) % NIGHT_COLOURS.length]
    const day = new THREE.Color(0xe8f4ff)
    const c = day.clone().lerp(lit, night * 0.85).multiplyScalar(1 + night * 1.6)
    for (let i = 0; i < this.n; i++) {
      this.v[i * 3 + 1] -= 9.8 * dt
      pos.setXYZ(i, pos.getX(i) + this.v[i * 3] * dt, pos.getY(i) + this.v[i * 3 + 1] * dt, pos.getZ(i) + this.v[i * 3 + 2] * dt)
      if (pos.getY(i) < WATER_Y) this.spawn(i, pos)
      col.setXYZ(i, c.r, c.g, c.b)
    }
    pos.needsUpdate = true
    col.needsUpdate = true
  }
}

export class Splashes {
  readonly points: THREE.Points
  private life: Float32Array
  private n = 160
  private water: Polygon[]

  constructor(water: Polygon[]) {
    this.water = water
    this.points = points(this.n, 2)
    this.life = new Float32Array(this.n)
    const col = this.points.geometry.getAttribute("color") as THREE.BufferAttribute
    for (let i = 0; i < this.n; i++) col.setXYZ(i, 0.85, 0.9, 1.0)
    col.needsUpdate = true
  }

  update(dt: number, rain: number, at: Vec2, span: number) {
    const pos = this.points.geometry.getAttribute("position") as THREE.BufferAttribute
    const live = Math.floor(this.n * Math.min(1, rain * 1.2))
    for (let i = 0; i < this.n; i++) {
      this.life[i] -= dt
      if (i >= live) {
        pos.setY(i, -50)
        continue
      }
      if (this.life[i] <= 0) {
        this.life[i] = 0.12 + Math.random() * 0.2
        const x = at[0] + (Math.random() - 0.5) * span
        const z = at[1] + (Math.random() - 0.5) * span
        const wet = this.water.some((w) => inside(w, [x, z]))
        pos.setXYZ(i, x, wet ? WATER_Y + 0.02 : 0.12, z)
      }
    }
    pos.needsUpdate = true
  }
}

export class Fireflies {
  readonly points: THREE.Points
  private n = 70
  private home: Float32Array

  constructor(centres: Vec2[]) {
    this.points = points(this.n, 2, true)
    this.home = new Float32Array(this.n * 3)
    for (let i = 0; i < this.n; i++) {
      const c = centres[i % centres.length]
      const a = Math.random() * Math.PI * 2
      const r = 20 + Math.random() * 60
      this.home[i * 3] = c[0] + Math.cos(a) * r
      this.home[i * 3 + 1] = 0.6 + Math.random() * 2.2
      this.home[i * 3 + 2] = c[1] + Math.sin(a) * r
    }
  }

  update(time: number, amount: number) {
    const pos = this.points.geometry.getAttribute("position") as THREE.BufferAttribute
    const col = this.points.geometry.getAttribute("color") as THREE.BufferAttribute
    for (let i = 0; i < this.n; i++) {
      const t = time * 0.4 + i * 1.7
      pos.setXYZ(i, this.home[i * 3] + Math.sin(t) * 2.5, this.home[i * 3 + 1] + Math.sin(t * 1.7) * 0.5, this.home[i * 3 + 2] + Math.cos(t * 0.8) * 2.5)
      const blink = Math.max(0, Math.sin(time * 2.2 + i * 2.3)) * amount * 2.2
      col.setXYZ(i, 0.8 * blink, 1.0 * blink, 0.35 * blink)
    }
    pos.needsUpdate = true
    col.needsUpdate = true
  }
}

type Duck = { mesh: THREE.Mesh; c: Vec2; r: number; a: number; speed: number; p: Vec2; yaw: number }

export class Ducks {
  readonly group = new THREE.Group()
  private ducks: Duck[] = []
  private lake: Polygon

  constructor(lake: Polygon, centre: Vec2, material: THREE.Material) {
    this.lake = lake
    const kinds: [number, number][] = [[0xf6f4ee, 0xf6f4ee], [0x8a6a4a, 0x2e7d4f], [0xf6f4ee, 0xf6f4ee], [0x7a5a3a, 0x6a4a2a]]
    for (let i = 0; i < 8; i++) {
      const [body, head] = kinds[i % kinds.length]
      const small = i >= 6
      const b = new Builder()
      const s = small ? 0.6 : 1
      b.box(0, 0, 0, 0.3 * s, 0.22 * s, 0.48 * s, body)
      b.box(0, 0.16 * s, 0.2 * s, 0.16 * s, 0.18 * s, 0.16 * s, head)
      b.box(0, 0.2 * s, 0.32 * s, 0.07 * s, 0.05 * s, 0.1 * s, 0xf2994a)
      b.box(0, 0.16 * s, -0.24 * s, 0.14 * s, 0.1 * s, 0.1 * s, body)
      const mesh = new THREE.Mesh(b.geometry()!, material)
      mesh.castShadow = true
      this.group.add(mesh)
      const a = Math.random() * Math.PI * 2
      const c: Vec2 = [centre[0] + (Math.random() - 0.5) * 40, centre[1] + (Math.random() - 0.5) * 24]
      this.ducks.push({ mesh, c, r: 4 + Math.random() * 8, a, speed: (0.15 + Math.random() * 0.15) * (i % 2 ? 1 : -1), p: [...c] as Vec2, yaw: 0 })
    }
  }

  update(dt: number, time: number, feed: Vec2 | null) {
    this.ducks.forEach((d, i) => {
      let want: Vec2
      if (feed) {
        want = [feed[0] + Math.cos(i * 1.3) * 1.6, feed[1] + Math.sin(i * 1.3) * 1.6]
      } else {
        d.a += d.speed * dt
        want = [d.c[0] + Math.cos(d.a) * d.r, d.c[1] + Math.sin(d.a) * d.r]
      }
      const dx = want[0] - d.p[0]
      const dz = want[1] - d.p[1]
      const dist = Math.hypot(dx, dz)
      const step = Math.min(dist, (feed ? 1.6 : 0.9) * dt)
      if (dist > 0.05) {
        const nx = d.p[0] + (dx / dist) * step
        const nz = d.p[1] + (dz / dist) * step
        if (inside(this.lake, [nx, nz])) d.p = [nx, nz]
        const target = Math.atan2(dx, dz)
        let dy = target - d.yaw
        dy = Math.atan2(Math.sin(dy), Math.cos(dy))
        d.yaw += dy * Math.min(1, dt * 3)
      }
      d.mesh.position.set(d.p[0], WATER_Y + 0.02 + Math.sin(time * 2 + i) * 0.03, d.p[1])
      d.mesh.rotation.y = d.yaw
    })
  }
}

/** Magic motes: gold and cyan sparks drifting up round you, brighter at dusk. */
export class Motes {
  readonly points: THREE.Points
  private n = 45
  private seed: Float32Array

  constructor() {
    this.points = points(this.n, 2, true)
    this.seed = new Float32Array(this.n * 4)
    for (let i = 0; i < this.seed.length; i++) this.seed[i] = Math.random()
  }

  update(time: number, at: THREE.Vector3, span: number, amount: number) {
    const pos = this.points.geometry.getAttribute("position") as THREE.BufferAttribute
    const col = this.points.geometry.getAttribute("color") as THREE.BufferAttribute
    for (let i = 0; i < this.n; i++) {
      const [a, b, c, d] = [this.seed[i * 4], this.seed[i * 4 + 1], this.seed[i * 4 + 2], this.seed[i * 4 + 3]]
      const life = (time * (0.05 + d * 0.06) + a) % 1
      // Fixed to a grid that wraps round the focus, so they don't follow you.
      const gx = Math.floor((at.x - (b - 0.5) * span) / span) * span + (b - 0.5) * span + span / 2
      const gz = Math.floor((at.z - (c - 0.5) * span) / span) * span + (c - 0.5) * span + span / 2
      pos.setXYZ(i, gx + Math.sin(time * 0.7 + a * 9) * 1.5, 0.3 + life * 7, gz + Math.cos(time * 0.6 + b * 9) * 1.5)
      const tw = Math.max(0, Math.sin(time * 3 + d * 30)) * Math.sin(life * Math.PI) * amount * 2.4
      if (i % 3 === 0) col.setXYZ(i, 0.45 * tw, 1.0 * tw, 1.1 * tw)
      else col.setXYZ(i, 1.2 * tw, 0.95 * tw, 0.45 * tw)
    }
    pos.needsUpdate = true
    col.needsUpdate = true
  }
}

/** Blossom petals drifting down on the wind. */
export class Petals {
  readonly points: THREE.Points
  private n = 60
  private seed: Float32Array

  constructor() {
    this.points = points(this.n, 2)
    this.seed = new Float32Array(this.n * 4)
    for (let i = 0; i < this.seed.length; i++) this.seed[i] = Math.random()
    const col = this.points.geometry.getAttribute("color") as THREE.BufferAttribute
    for (let i = 0; i < this.n; i++) {
      const pink = i % 4 !== 0
      col.setXYZ(i, pink ? 1.0 : 0.72, pink ? 0.62 : 0.6, pink ? 0.78 : 0.95)
    }
    col.needsUpdate = true
  }

  update(time: number, at: THREE.Vector3, span: number, amount: number, wind: number) {
    const pos = this.points.geometry.getAttribute("position") as THREE.BufferAttribute
    const live = Math.floor(this.n * amount)
    for (let i = 0; i < this.n; i++) {
      if (i >= live) {
        pos.setY(i, -50)
        continue
      }
      const [a, b, c, d] = [this.seed[i * 4], this.seed[i * 4 + 1], this.seed[i * 4 + 2], this.seed[i * 4 + 3]]
      const fall = (time * (0.04 + d * 0.03) + a) % 1
      const drift = fall * (6 + wind * 18)
      const gx = Math.floor((at.x - (b - 0.5) * span) / span) * span + (b - 0.5) * span + span / 2
      const gz = Math.floor((at.z - (c - 0.5) * span) / span) * span + (c - 0.5) * span + span / 2
      pos.setXYZ(i, gx + drift + Math.sin(time * 2 + a * 20) * 0.6, 14 * (1 - fall), gz + drift * 0.4 + Math.cos(time * 1.7 + b * 20) * 0.6)
    }
    pos.needsUpdate = true
  }
}
