import * as THREE from "three"
import { CELL, LEVEL, type Vec3 } from "../castle"
import type { Block, TemplateKey, World } from "../world"
import { Builder, turn } from "./builder"
import { MAX_LIGHTS, PART_COUNT, buildCar, buildEdge, buildRoom, type Template } from "./kit"
import {
  castleFragment,
  castleVertex,
  emberFragment,
  emberVertex,
  farFragment,
  farVertex,
  glowFragment,
  glowVertex,
  skyFragment,
  skyVertex,
} from "./shaders"

/** Fog colours: amber haze level with you, soot above, a cold abyss below. */
const FOG = {
  uFogUp: { value: new THREE.Color(0.018, 0.011, 0.009) },
  uFogMid: { value: new THREE.Color(0.075, 0.04, 0.022) },
  uFogDown: { value: new THREE.Color(0.006, 0.012, 0.018) },
  uFogDensity: { value: 0.0105 },
}

export function buildTemplates() {
  const map = new Map<TemplateKey, Template>()
  for (const k of ["hall", "terrace", "akaza", "doma", "kokushibo", "nakime"] as const) map.set(k, buildRoom(k))
  for (const k of ["bridge", "corridor", "stair"] as const) map.set(k, buildEdge(k))
  for (const k of ["carriage", "deck", "great"] as const) map.set(k, buildCar(k))
  return map
}

export type FrameFx = { time: number; pulse: number; strum: number; strumT: number; fall: number; pixel: number; glow: number }

export class CastleView {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(74, 1, 0.05, 1400)
  private templates: Map<TemplateKey, Template>
  private base: THREE.ShaderMaterial
  private meshes = new Map<string, THREE.Mesh>()
  private far: THREE.Mesh
  private glows: THREE.Points
  private embers: THREE.Points
  private sky: THREE.Mesh
  private shared = {
    uTime: { value: 0 },
    uPulse: { value: 0 },
    uStrum: { value: 0 },
    uStrumT: { value: 10 },
    uPixel: { value: 600 },
    uFall: { value: 0 },
  }

  constructor(templates: Map<TemplateKey, Template>, bounds: { x: number; y: number; z: number }) {
    this.templates = templates
    this.base = new THREE.ShaderMaterial({
      vertexShader: castleVertex,
      fragmentShader: castleFragment,
      uniforms: {
        ...FOG,
        uOpen: { value: new Array(PART_COUNT).fill(0) },
        uLightPos: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
        uLightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
        uLightCount: { value: 0 },
        uLightPower: { value: 2.2 },
        uCamLocal: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uSeed: { value: 0 },
        uVariant: { value: 0 },
        uGlow: { value: 1 },
        uPulse: { value: 0 },
      },
    })
    this.camera.rotation.order = "YXZ"

    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 16),
      new THREE.ShaderMaterial({
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        uniforms: { ...FOG, uTime: this.shared.uTime },
        side: THREE.BackSide,
        depthWrite: false,
      })
    )
    this.sky.scale.setScalar(600)
    this.sky.frustumCulled = false
    this.sky.renderOrder = -10
    this.scene.add(this.sky)

    const { far, glows } = this.buildFar(bounds)
    this.far = far
    this.glows = glows
    this.embers = this.buildEmbers()
    this.scene.add(this.far, this.glows, this.embers)
  }

  // ── The near castle ────────────────────────────────────────────────────

  private meshFor(block: Block) {
    let mesh = this.meshes.get(block.key)
    if (mesh) return mesh
    const tpl = this.templates.get(block.template)!
    const mat = this.base.clone()
    const u = mat.uniforms
    Object.assign(u, FOG)
    // Cloning copies arrays shallowly, so each template gets its own lights.
    const pad = (list: Vec3[]) =>
      Array.from({ length: MAX_LIGHTS }, (_, i) => new THREE.Vector3(...(list[i] ?? [0, 0, 0])))
    u.uLightPos = { value: pad(tpl.lights.map((l) => l.pos)) }
    u.uLightCol = { value: pad(tpl.lights.map((l) => l.color)) }
    u.uOpen = { value: new Array(PART_COUNT).fill(0) }
    u.uLightCount.value = tpl.lights.length
    u.uSeed.value = block.seed
    u.uVariant.value = block.room ? (block.seed * 7.31) % 1 : 0
    mesh = new THREE.Mesh(tpl.geometry, mat)
    mesh.rotation.y = (-block.q * Math.PI) / 2
    mesh.matrixAutoUpdate = true
    this.meshes.set(block.key, mesh)
    this.scene.add(mesh)
    return mesh
  }

  sync(world: World, fx: FrameFx) {
    const cam = this.camera.position
    const seen = new Set<string>()
    for (const block of world.blocks.values()) {
      seen.add(block.key)
      const mesh = this.meshFor(block)
      const e = Math.max(block.extend, 0.001)
      mesh.position.set(...block.pos)
      mesh.scale.set(e, block.template === "stair" ? e : 1, 1)
      // Carriages out at the ends of their tracks are lost in the fog anyway.
      const far = block.train && Math.hypot(cam.x - block.pos[0], cam.z - block.pos[2]) > 320
      mesh.visible = block.extend > 0.002 && !far
      const u = (mesh.material as THREE.ShaderMaterial).uniforms
      const open = u.uOpen.value as number[]
      for (let i = 0; i < PART_COUNT; i++) open[i] = block.open[i]
      const rel = [cam.x - block.pos[0], cam.z - block.pos[2]]
      const [lx, lz] = turn(-block.q, rel[0], rel[1])
      u.uCamLocal.value.set(lx / e, (cam.y - block.pos[1]) / (block.template === "stair" ? e : 1), lz)
      u.uTime.value = fx.time
      u.uPulse.value = fx.pulse
      u.uGlow.value = fx.glow
    }
    for (const [key, mesh] of this.meshes) {
      if (seen.has(key)) continue
      this.scene.remove(mesh)
      ;(mesh.material as THREE.Material).dispose()
      this.meshes.delete(key)
    }
    this.shared.uTime.value = fx.time
    this.shared.uPulse.value = fx.pulse
    this.shared.uStrum.value = fx.strum
    this.shared.uStrumT.value = fx.strumT
    this.shared.uPixel.value = fx.pixel
    this.shared.uFall.value = fx.fall
    this.sky.position.copy(cam)
  }

  // ── The castle beyond reach ────────────────────────────────────────────

  private buildFar(bounds: { x: number; y: number; z: number }) {
    // One simplified room: platform, walls, hipped roof, stilts.
    const b = new Builder()
    b.box([-5.8, -0.7, -5.8], [5.8, 0, 5.8], 0)
    b.box([-4.6, 0, -4.6], [4.6, 3.4, 4.6], 0)
    b.box([-5.3, 3.4, -5.3], [5.3, 3.7, 5.3], 0)
    for (let d = 0; d < 4; d++) {
      b.frame(d, [0, 0, 0], () => b.quad([5.3, 3.7, 5.3], [5.3, 3.7, -5.3], [1.1, 6.2, -1.1], [1.1, 6.2, 1.1], 0))
    }
    const src = b.geometry()
    const geo = new THREE.InstancedBufferGeometry()
    geo.setAttribute("position", src.getAttribute("position"))
    geo.setAttribute("normal", src.getAttribute("normal"))

    const offsets: number[] = []
    const steps: number[] = []
    const orients: number[] = []
    const seeds: number[] = []
    const gPos: number[] = []
    const gStep: number[] = []
    const gSeed: number[] = []
    const gSize: number[] = []
    let s = 12345
    const rnd = () => {
      s = (s * 16807) % 2147483647
      return s / 2147483647
    }
    const inside = (i: number, k: number, j: number) =>
      i >= -1 && i <= bounds.x && j >= -1 && j <= bounds.z && k >= -2 && k <= bounds.y + 1
    const R = 13
    for (let i = -R; i < bounds.x + R; i++) {
      for (let j = -R; j < bounds.z + R; j++) {
        for (let k = -20; k < bounds.y + 20; k++) {
          if (inside(i, k, j)) continue
          // Keep the train tracks round the castle clear.
          if ((i === -1 || i === bounds.x || j === -1 || j === bounds.z) && k >= -2 && k <= bounds.y + 1) continue
          const di = Math.max(-1 - i, i - bounds.x, 0)
          const dj = Math.max(-1 - j, j - bounds.z, 0)
          const dk = Math.max(-2 - k, k - bounds.y - 1, 0) / 3
          const d = Math.hypot(di, dj, dk)
          if (rnd() > 0.3 / (1 + d * 0.35)) continue
          // Alternate node: one cell over, Nakime's way.
          const axis = Math.floor(rnd() * 3)
          const dir = rnd() < 0.5 ? -1 : 1
          const step: Vec3 = [0, 0, 0]
          step[axis] = dir * (axis === 1 ? LEVEL : CELL)
          const ni = i + (axis === 0 ? dir : 0)
          const nj = j + (axis === 2 ? dir : 0)
          const nk = k + (axis === 1 ? dir : 0)
          if (inside(ni, nk, nj)) step[axis] = 0
          const r = rnd()
          const orient = r < 0.66 ? 0 : r < 0.8 ? 1 : 2 + Math.floor(rnd() * 4)
          const seed = rnd()
          const o: Vec3 = [i * CELL, k * LEVEL, j * CELL]
          offsets.push(...o)
          steps.push(...step)
          orients.push(orient)
          seeds.push(seed)
          // Its lanterns: over each door and under the stilts.
          for (let side = 0; side < 4; side++) {
            const [x, z] = turn(side, 5.2, 0)
            const p = orientJs([x, 2.7, z], orient)
            gPos.push(o[0] + p[0], o[1] + p[1], o[2] + p[2])
            gStep.push(...step)
            gSeed.push(seed)
            gSize.push(1.4)
          }
          if (rnd() < 0.5) {
            const p = orientJs([0, -3.5, 0], orient)
            gPos.push(o[0] + p[0], o[1] + p[1], o[2] + p[2])
            gStep.push(...step)
            gSeed.push(seed)
            gSize.push(2.6)
          }
        }
      }
    }
    geo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(new Float32Array(offsets), 3))
    geo.setAttribute("aStep", new THREE.InstancedBufferAttribute(new Float32Array(steps), 3))
    geo.setAttribute("aOrient", new THREE.InstancedBufferAttribute(new Float32Array(orients), 1))
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(new Float32Array(seeds), 1))
    geo.instanceCount = seeds.length
    const far = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: farVertex,
        fragmentShader: farFragment,
        uniforms: { ...FOG, uTime: this.shared.uTime, uStrum: this.shared.uStrum, uStrumT: this.shared.uStrumT },
        side: THREE.DoubleSide,
      })
    )
    far.frustumCulled = false

    const gGeo = new THREE.BufferGeometry()
    gGeo.setAttribute("position", new THREE.Float32BufferAttribute(gPos, 3))
    gGeo.setAttribute("aStep", new THREE.Float32BufferAttribute(gStep, 3))
    gGeo.setAttribute("aSeed", new THREE.Float32BufferAttribute(gSeed, 1))
    gGeo.setAttribute("aSize", new THREE.Float32BufferAttribute(gSize, 1))
    const glows = new THREE.Points(
      gGeo,
      new THREE.ShaderMaterial({
        vertexShader: glowVertex,
        fragmentShader: glowFragment,
        uniforms: {
          ...FOG,
          uTime: this.shared.uTime,
          uStrum: this.shared.uStrum,
          uStrumT: this.shared.uStrumT,
          uPixel: this.shared.uPixel,
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    )
    glows.frustumCulled = false
    return { far, glows }
  }

  private buildEmbers() {
    const n = 420
    const pos = new Float32Array(n * 3)
    const seed = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 36
      pos[i * 3 + 1] = (Math.random() - 0.5) * 36
      pos[i * 3 + 2] = (Math.random() - 0.5) * 36
      seed[i] = Math.random()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1))
    const pts = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: emberVertex,
        fragmentShader: emberFragment,
        uniforms: { uTime: this.shared.uTime, uPixel: this.shared.uPixel, uFall: this.shared.uFall },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    )
    pts.frustumCulled = false
    return pts
  }

  dispose() {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.material) (m.material as THREE.Material).dispose()
    })
    for (const t of this.templates.values()) t.geometry.dispose()
    this.far.geometry.dispose()
    this.glows.geometry.dispose()
    this.embers.geometry.dispose()
    this.sky.geometry.dispose()
  }
}

/** Mirror of the far shader's `orient`: stands a room upside down or on a side. */
function orientJs(p: Vec3, o: number): Vec3 {
  if (o === 0) return p
  if (o === 1) return [p[0], -p[1], -p[2]]
  if (o === 2) return [p[1], -p[0], p[2]]
  if (o === 3) return [-p[1], p[0], p[2]]
  if (o === 4) return [p[0], -p[2], p[1]]
  return [p[0], p[2], -p[1]]
}
