import * as THREE from "three"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { OutputPass } from "three/addons/postprocessing/OutputPass.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js"
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js"
import { finalFragment, finalVertex } from "./shaders"

export type PostFx = {
  time: number
  /** 0–1, the strum's strength, decaying. */
  pulse: number
  /** Seconds since the strum. */
  pulseT: number
  /** 0–1, how fast the visitor is falling. */
  fall: number
  black: number
  white: number
}

/**
 * Renderer and post: scene → bloom (the lanterns) → grading pass → tone
 * mapping and sRGB. Resolution adapts to keep the frame rate up: it drops
 * when frames run long and creeps back when there's headroom.
 */
export class Output {
  readonly renderer: THREE.WebGLRenderer
  private composer: EffectComposer
  private render: RenderPass
  private bloom: UnrealBloomPass
  private final: ShaderPass
  private width = 1
  private height = 1
  private dpr = 1
  /** Fraction of the device pixel ratio actually rendered. */
  private scale: number
  private maxScale: number
  private frameMs = 16
  private sinceAdjust = 0
  motion = 1

  constructor(canvas: HTMLCanvasElement, opts: { phone: boolean }) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", stencil: false })
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.setClearColor(0x000000, 1)
    this.maxScale = opts.phone ? 0.75 : 1
    this.scale = opts.phone ? 0.6 : 0.85
    this.composer = new EffectComposer(this.renderer)
    this.render = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera())
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 0.62)
    this.final = new ShaderPass(
      new THREE.ShaderMaterial({
        vertexShader: finalVertex,
        fragmentShader: finalFragment,
        uniforms: {
          tDiffuse: { value: null },
          uResolution: { value: new THREE.Vector2(1, 1) },
          uTime: { value: 0 },
          uPulse: { value: 0 },
          uPulseT: { value: 10 },
          uFall: { value: 0 },
          uBlack: { value: 0 },
          uWhite: { value: 0 },
          uMotion: { value: 1 },
        },
      })
    )
    this.composer.addPass(this.render)
    this.composer.addPass(this.bloom)
    this.composer.addPass(this.final)
    this.composer.addPass(new OutputPass())
  }

  /** Effective device pixels per CSS pixel, for sizing point sprites. */
  get pixelRatio() {
    return this.dpr * this.scale
  }

  resize(width: number, height: number, dpr: number) {
    this.width = Math.max(1, Math.round(width))
    this.height = Math.max(1, Math.round(height))
    this.dpr = Math.min(dpr, 2)
    this.apply()
  }

  private apply() {
    const pr = this.dpr * this.scale
    this.renderer.setPixelRatio(pr)
    this.renderer.setSize(this.width, this.height, false)
    this.composer.setPixelRatio(pr)
    this.composer.setSize(this.width, this.height)
    this.bloom.resolution.set((this.width * pr) / 2, (this.height * pr) / 2)
    ;(this.final.uniforms.uResolution.value as THREE.Vector2).set(this.width * pr, this.height * pr)
  }

  draw(scene: THREE.Scene, camera: THREE.PerspectiveCamera, fx: PostFx, dt: number) {
    this.render.scene = scene
    this.render.camera = camera
    const u = this.final.uniforms
    u.uTime.value = fx.time
    u.uPulse.value = fx.pulse
    u.uPulseT.value = fx.pulseT
    u.uFall.value = fx.fall
    u.uBlack.value = fx.black
    u.uWhite.value = fx.white
    u.uMotion.value = this.motion
    this.bloom.strength = 0.85 + fx.pulse * 0.9
    this.composer.render(dt)
    this.adapt(dt)
  }

  private adapt(dt: number) {
    this.frameMs += (dt * 1000 - this.frameMs) * 0.05
    this.sinceAdjust += dt
    if (this.sinceAdjust < 1.5) return
    let next = this.scale
    if (this.frameMs > 24 && this.scale > 0.45) next = this.scale - 0.1
    else if (this.frameMs < 14 && this.scale < this.maxScale) next = Math.min(this.maxScale, this.scale + 0.05)
    if (next !== this.scale) {
      this.scale = next
      this.sinceAdjust = 0
      this.apply()
    }
  }

  dispose() {
    this.composer.dispose()
    this.renderer.dispose()
  }
}
