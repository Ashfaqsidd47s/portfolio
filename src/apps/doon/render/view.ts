import * as THREE from "three"
import { createRng } from "@/os/kernel/rng"
import type { EnvState, RGB } from "../env"
import { BOUNDS, LAKE, MONASTERY, type Vec2 } from "../geo"
import { Builder } from "../kit/builder"
import type { Signs } from "../kit/signs"
import { CHUNK, chunkKey, type Piece, type Plan } from "../world/plan"
import { Ducks, Fireflies, Fountain, Motes, Petals, Splashes } from "./fx"
import { Ground } from "./ground"
import { makeMaterials, U, type Materials } from "./materials"
import { Post } from "./post"
import { makeWater } from "./water"

/**
 * Renderer, camera and the streamed town. The camera is orthographic and
 * orbits the player like a third-person camera: drag to turn it round and
 * tilt it between a low view and a near top-down one. Each frame the scene is
 * rendered small into a target, with the camera snapped to that target's
 * pixel grid, and the post pass scales it up.
 */

const DIST = 420
const PITCH_MIN = (22 * Math.PI) / 180
const PITCH_MAX = (68 * Math.PI) / 180

type Chunk = { group: THREE.Group; meshes: THREE.Mesh[] }

const linear = (c: RGB) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace)

export class View {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000)
  readonly mats: Materials
  private rt: THREE.WebGLRenderTarget
  private post = new Post()
  private sun = new THREE.DirectionalLight(0xffffff, 2)
  private hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1)
  private pool: THREE.PointLight[] = []
  private poolTimer = 0
  private chunks = new Map<string, Chunk>()
  private index: Map<string, Piece[]>
  private ground: Ground
  private plan: Plan
  private signs: Signs
  private water: ReturnType<typeof makeWater>
  readonly fountain: Fountain
  readonly ducks: Ducks
  private splashes: Splashes
  private fireflies: Fireflies
  private motes = new Motes()
  private petals = new Petals()
  private cssW = 1
  private cssH = 1
  private dpr = 1
  /** Device pixels per scene pixel (a whole number). */
  private pixel = 3
  private rtW = 1
  private rtH = 1
  /** World metres shown top to bottom. */
  zoom = 30
  private zoomNow = 30
  /** Where the camera sits round the focus (radians; 0 = east, π/2 = south) and how high, with eased copies. */
  private yaw = (3 * Math.PI) / 4
  private yawNow = (3 * Math.PI) / 4
  private pitch = (35 * Math.PI) / 180
  private pitchNow = (35 * Math.PI) / 180
  readonly focus = new THREE.Vector3()
  private time = 0
  /** 0–1: fades the picture to black (fast travel). */
  fade = 0

  constructor(canvas: HTMLCanvasElement, plan: Plan, signs: Signs, atlas: THREE.Texture | null) {
    this.plan = plan
    this.signs = signs
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false })
    this.renderer.setPixelRatio(1)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.BasicShadowMap
    this.renderer.setClearColor(0x000000, 1)
    this.rt = this.makeTarget(2, 2)
    this.mats = makeMaterials(atlas)
    this.index = plan.chunks()
    this.ground = new Ground(plan)

    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.04
    this.scene.add(this.sun, this.sun.target, this.hemi)
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight(0xffc880, 0, 24, 1.5)
      this.pool.push(l)
      this.scene.add(l)
    }

    this.water = makeWater(plan.water)
    for (const m of this.water.meshes) this.scene.add(m)
    const fountainAt = plan.marks.get("fountain")?.p ?? LAKE.centre
    this.fountain = new Fountain(fountainAt)
    this.ducks = new Ducks(plan.water[0] ?? [], fountainAt, this.mats.actor)
    this.splashes = new Splashes(plan.water)
    this.fireflies = new Fireflies([LAKE.centre, LAKE.centre, MONASTERY.centre])
    this.scene.add(this.fountain.points, this.ducks.group, this.splashes.points, this.fireflies.points, this.motes.points, this.petals.points)
  }

  private makeTarget(w: number, h: number) {
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    })
    rt.depthTexture = new THREE.DepthTexture(w, h)
    rt.depthTexture.type = THREE.UnsignedIntType
    rt.depthTexture.minFilter = THREE.NearestFilter
    rt.depthTexture.magFilter = THREE.NearestFilter
    return rt
  }

  resize(w: number, h: number, dpr: number) {
    this.cssW = Math.max(1, w)
    this.cssH = Math.max(1, h)
    this.dpr = dpr
    const dw = Math.round(this.cssW * dpr)
    const dh = Math.round(this.cssH * dpr)
    this.renderer.setSize(dw, dh, false)
    // Pixel size from the screen's area, so a phone and a big monitor both get chunky pixels.
    this.pixel = Math.max(2, Math.round(Math.sqrt(dw * dh) / 420))
    this.rtW = Math.ceil(dw / this.pixel) + 2
    this.rtH = Math.ceil(dh / this.pixel) + 2
    this.rt.dispose()
    this.rt = this.makeTarget(this.rtW, this.rtH)
  }

  /** Orbit by a drag: `dx` turns round the focus, `dy` tilts (radians). */
  orbit(dx: number, dy: number) {
    this.yaw += dx
    this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch + dy))
  }

  /** The camera's horizontal heading as a unit vector from the camera toward the focus. */
  heading(): Vec2 {
    return [-Math.cos(this.yawNow), -Math.sin(this.yawNow)]
  }

  /** Compass bearing the camera looks along (radians clockwise from north), for the minimap. */
  get bearing() {
    const [x, z] = this.heading()
    return Math.atan2(x, -z)
  }

  /** World direction for screen-up and screen-right on the ground. */
  axes(): { up: Vec2; right: Vec2 } {
    const f = this.heading()
    return { up: f, right: [-f[1], f[0]] }
  }

  update(dt: number, env: EnvState, playerHead: THREE.Vector3) {
    this.time += dt
    this.zoomNow += (this.zoom - this.zoomNow) * Math.min(1, dt * 8)
    const ease = Math.min(1, dt * 16)
    this.yawNow += (this.yaw - this.yawNow) * ease
    this.pitchNow += (this.pitch - this.pitchNow) * ease

    this.placeCamera()
    this.stream()
    this.light(env, dt)

    // Shared uniforms.
    U.uTime.value = this.time
    U.uWind.value = env.wind
    U.uNight.value = env.night
    U.uWet.value = env.wet
    U.uSky.value.copy(linear(env.skyBottom)).multiplyScalar(0.6)
    const pv = playerHead.clone().applyMatrix4(this.camera.matrixWorldInverse)
    U.uPlayerView.value.copy(pv)
    U.uFadeR.value = Math.max(4.5, this.zoomNow * 0.16)

    const w = this.water.material.uniforms
    w.uTime.value = this.time
    w.uSkyTop.value.copy(linear(env.skyTop))
    w.uSkyBottom.value.copy(linear(env.skyBottom))
    w.uSun.value.set(...env.keyDir)
    w.uSunColor.value.copy(linear(env.keyColor)).multiplyScalar(env.keyIntensity * 0.4 * (1 - env.cloud * 0.8))
    const cd = new THREE.Vector3()
    this.camera.getWorldDirection(cd)
    w.uCamDir.value.copy(cd)
    w.uRain.value = env.rain
    w.uNight.value = env.night
    w.uWind.value = env.wind

    this.fountain.update(dt, env.night, this.time)
    this.splashes.update(dt, env.rain, [this.focus.x, this.focus.z], this.zoomNow * 1.4)
    this.fireflies.update(this.time, env.night * (1 - env.rain) * (1 - env.mist * 0.6))
    const dry = (1 - env.rain) * (1 - env.mist * 0.5)
    const dusk = Math.max(0.35, 1 - Math.abs(env.sun.elevation - 2) / 25)
    this.motes.update(this.time, this.focus, this.zoomNow * 1.6, dry * dusk)
    this.petals.update(this.time, this.focus, this.zoomNow * 1.6, dry * 0.5, env.wind)
  }

  private placeCamera() {
    const a = this.yawNow
    const pitch = this.pitchNow
    const H = this.zoomNow
    // `zoom` spans the window's shorter side, so a phone held upright isn't zoomed in.
    const upp = H / (Math.min(this.cssW, this.cssH) * this.dpr / this.pixel)
    const halfW = (this.rtW * upp) / 2
    const halfH = (this.rtH * upp) / 2
    const cam = this.camera
    cam.left = -halfW
    cam.right = halfW
    cam.top = halfH
    cam.bottom = -halfH
    cam.near = 1
    cam.far = DIST * 2
    cam.updateProjectionMatrix()

    const T = this.focus
    const off = new THREE.Vector3(Math.cos(a) * Math.cos(pitch), Math.sin(pitch), Math.sin(a) * Math.cos(pitch)).multiplyScalar(DIST)
    cam.position.copy(T).add(off)
    cam.up.set(0, 1, 0)
    cam.lookAt(T)
    cam.updateMatrixWorld()

    // Snap to the scene's pixel grid; hand the remainder to the post pass.
    const R = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0)
    const Up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1)
    const tr = T.dot(R)
    const tu = T.dot(Up)
    const fr = tr - Math.round(tr / upp) * upp
    const fu = tu - Math.round(tu / upp) * upp
    cam.position.addScaledVector(R, -fr).addScaledVector(Up, -fu)
    cam.updateMatrixWorld()
    const p = this.post.material.uniforms
    p.uOffset.value.set(fr / upp, fu / upp)
  }

  /** Builds chunks coming into view and frees ones far behind. */
  private stream() {
    // A low camera sees further across the ground.
    const reach = Math.max(110, (this.zoomNow * 1.1) / Math.sin(this.pitchNow) + 20)
    const fx = this.focus.x
    const fz = this.focus.z
    const want: [string, number, number, number][] = []
    for (let cx = Math.floor((fx - reach) / CHUNK); cx <= Math.floor((fx + reach) / CHUNK); cx++) {
      for (let cz = Math.floor((fz - reach) / CHUNK); cz <= Math.floor((fz + reach) / CHUNK); cz++) {
        // The sky islets float up to ~130 m beyond the edge.
        if ((cx + 1) * CHUNK < BOUNDS.minX - 140 || cx * CHUNK > BOUNDS.maxX + 140) continue
        if ((cz + 1) * CHUNK < BOUNDS.minZ - 140 || cz * CHUNK > BOUNDS.maxZ + 140) continue
        const d = Math.hypot((cx + 0.5) * CHUNK - fx, (cz + 0.5) * CHUNK - fz)
        if (d < reach + CHUNK * 0.7) want.push([chunkKey(cx, cz), cx, cz, d])
      }
    }
    want.sort((a, b) => a[3] - b[3])
    const start = performance.now()
    let built = 0
    for (const [key, cx, cz] of want) {
      if (this.chunks.has(key)) continue
      // A couple per frame, more if the area is empty (just arrived).
      if (built >= 2 && performance.now() - start > (this.chunks.size < 6 ? 400 : 6)) break
      this.buildChunk(key, cx, cz)
      built++
    }
    for (const [key, chunk] of this.chunks) {
      const [cx, cz] = key.split(",").map(Number)
      const d = Math.hypot((cx + 0.5) * CHUNK - fx, (cz + 0.5) * CHUNK - fz)
      if (d > reach + CHUNK * 2) {
        this.scene.remove(chunk.group)
        for (const m of chunk.meshes) m.geometry.dispose()
        this.chunks.delete(key)
      }
    }
  }

  /** Builds every chunk in reach now (after a jump), rather than over the next frames. */
  prime() {
    for (let i = 0; i < 40; i++) {
      const before = this.chunks.size
      this.stream()
      if (this.chunks.size === before) break
    }
  }

  private buildChunk(key: string, cx: number, cz: number) {
    const rng = createRng(cx * 73856093 + cz * 19349663)
    const b = new Builder(rng.next)
    const s = new Builder(rng.next, true)
    for (const p of this.index.get(key) ?? []) p.build({ b, s, signs: this.signs, r: createRng(p.seed) })
    const group = new THREE.Group()
    const meshes: THREE.Mesh[] = []
    const g = b.geometry()
    if (g) {
      const m = new THREE.Mesh(g, this.mats.world)
      m.castShadow = true
      m.receiveShadow = true
      meshes.push(m)
    }
    const sg = s.geometry()
    if (sg) {
      const m = new THREE.Mesh(sg, this.mats.signs)
      m.receiveShadow = true
      meshes.push(m)
    }
    const gg = this.ground.build(cx, cz)
    if (gg) {
      const m = new THREE.Mesh(gg, this.mats.ground)
      m.receiveShadow = true
      meshes.push(m)
    }
    for (const m of meshes) {
      m.matrixAutoUpdate = false
      group.add(m)
    }
    this.scene.add(group)
    this.chunks.set(key, { group, meshes })
  }

  private light(env: EnvState, dt: number) {
    const T = this.focus
    const span = Math.max(48, (this.zoomNow * 0.8) / Math.sin(this.pitchNow))
    const sc = this.sun.shadow.camera
    sc.left = -span
    sc.right = span
    sc.top = span
    sc.bottom = -span
    sc.near = 1
    sc.far = 500
    sc.updateProjectionMatrix()

    // Snap the shadow camera to its texels so shadows don't crawl as you walk.
    const L = new THREE.Vector3(...env.keyDir).normalize()
    const lr = new THREE.Vector3(0, 1, 0).cross(L).normalize()
    if (lr.lengthSq() < 0.5) lr.set(1, 0, 0)
    const lu = L.clone().cross(lr).normalize()
    const texel = (span * 2) / this.sun.shadow.mapSize.x
    const t = T.clone()
    const a = t.dot(lr)
    const b = t.dot(lu)
    t.addScaledVector(lr, Math.round(a / texel) * texel - a).addScaledVector(lu, Math.round(b / texel) * texel - b)
    this.sun.target.position.copy(t)
    this.sun.position.copy(t).addScaledVector(L, 220)
    this.sun.target.updateMatrixWorld()

    this.sun.color.copy(linear(env.keyColor))
    this.sun.intensity = env.keyIntensity
    this.hemi.color.copy(linear(env.hemiSky))
    this.hemi.groundColor.copy(linear(env.hemiGround))
    this.hemi.intensity = env.hemiIntensity * 1.15

    // Street lamps near the camera get real lights after dark.
    this.poolTimer -= dt
    if (this.poolTimer <= 0) {
      this.poolTimer = 0.4
      const near = this.plan.lamps
        .map((l) => [l, Math.hypot(l[0] - T.x, l[2] - T.z)] as const)
        .sort((x, y) => x[1] - y[1])
        .slice(0, this.pool.length)
      this.pool.forEach((light, i) => {
        const l = near[i]
        if (l) light.position.set(l[0][0], l[0][1] - 0.4, l[0][2])
      })
    }
    for (const light of this.pool) light.intensity = env.night * 26
  }

  render(env: EnvState) {
    const r = this.renderer
    r.setRenderTarget(this.rt)
    r.render(this.scene, this.camera)

    const p = this.post.material.uniforms
    p.tColor.value = this.rt.texture
    p.tDepth.value = this.rt.depthTexture
    p.uRes.value.set(this.rtW, this.rtH)
    p.uScale.value = this.pixel
    p.uNear.value = this.camera.near
    p.uFar.value = this.camera.far
    p.uInvViewProj.value.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse).invert()
    p.uTime.value = this.time
    p.uRain.value = env.rain
    p.uMist.value = env.mist
    p.uCloud.value = env.cloud
    p.uNight.value = env.night
    p.uFlash.value = env.flash
    p.uWind.value = env.wind
    p.uSat.value = env.saturation
    p.uTint.value.setRGB(env.tint[0], env.tint[1], env.tint[2])
    p.uSkyTop.value.copy(linear(env.skyTop))
    p.uSkyBottom.value.copy(linear(env.skyBottom))
    p.uMistColor.value.copy(linear(env.skyBottom)).lerp(new THREE.Color(0.78, 0.8, 0.84), 0.75).multiplyScalar(0.55 + (1 - env.night) * 0.5)
    p.uFade.value = this.fade
    this.post.render(r)
  }

  /** Where a world point lands on the canvas, in CSS pixels (the inverse of the post pass's mapping). */
  toScreen(v: THREE.Vector3): { x: number; y: number } {
    const p = v.clone().project(this.camera)
    const off = this.post.material.uniforms.uOffset.value as THREE.Vector2
    const dx = ((p.x * 0.5 + 0.5) * this.rtW - 1 - off.x) * this.pixel
    const dy = ((p.y * 0.5 + 0.5) * this.rtH - 1 - off.y) * this.pixel
    return { x: dx / this.dpr, y: this.cssH - dy / this.dpr }
  }

  get loaded() {
    return this.chunks.size
  }

  dispose() {
    for (const c of this.chunks.values()) for (const m of c.meshes) m.geometry.dispose()
    this.chunks.clear()
    this.mats.dispose()
    this.water.material.dispose()
    for (const m of this.water.meshes) m.geometry.dispose()
    this.post.dispose()
    this.rt.dispose()
    this.renderer.dispose()
  }
}
