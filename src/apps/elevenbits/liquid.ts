/**
 * The landing page's stage: one full-bleed WebGL canvas that shows one
 * "slide" at a time (the 11bits wordmark, then each featured lot) and melts
 * from one to the next like ink poured through water.
 *
 * - A slide is a texture drawn into a rectangle of the stage, cover- or
 *   contain-fitted. Its edges ripple with the image, so a photo bleeds into
 *   the dark rather than sliding as a card.
 * - Changing slide runs a noise-thresholded dissolve: both images are pushed
 *   along a swirling flow field, and the front between them glows champagne
 *   and throws off sparks.
 * - The pointer stirs a flowmap (a small ping-pong framebuffer of velocity
 *   that fades each frame), which drags the image's pixels after the cursor
 *   with a touch of colour fringing, like a hand through still water.
 *
 * Plain WebGL (1 or 2) with GLSL ES 1.00, so it runs nearly everywhere.
 */

export type Fit = "cover" | "contain"

export type Slide = {
  /** Image URL, or a canvas drawn in the page (the wordmark). */
  source: string | HTMLCanvasElement
  /** Where the image sits, in CSS px from the stage's top-left. */
  rect: { x: number; y: number; w: number; h: number }
  fit: Fit
  /** Drawn when the image can't be fetched, so the stage never shows a hole. */
  fallback: () => HTMLCanvasElement
}

type Tex = { tex: WebGLTexture; aspect: number }

const VERT = /* glsl */ `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const NOISE = /* glsl */ `
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}`

/** Fades the previous velocity field and stirs in the pointer's motion. */
const FLOW_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPrev;
uniform vec2 uMouse;
uniform vec2 uVelocity;
uniform float uAspect;
uniform float uFalloff;
uniform float uDissipation;
void main() {
  vec4 prev = texture2D(uPrev, vUv);
  vec2 v = (prev.rg - 0.5) * 2.0 * uDissipation;
  vec2 d = (vUv - uMouse) * vec2(uAspect, 1.0);
  float stamp = smoothstep(uFalloff, 0.0, length(d));
  v += uVelocity * stamp;
  v = clamp(v, -1.0, 1.0);
  float energy = clamp(prev.b * uDissipation + stamp * length(uVelocity) * 4.0, 0.0, 1.0);
  gl_FragColor = vec4(v * 0.5 + 0.5, energy, 1.0);
}`

const MAIN_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uA;
uniform sampler2D uB;
uniform sampler2D uFlow;
uniform vec4 uRectA;
uniform vec4 uRectB;
uniform vec2 uFitA;
uniform vec2 uFitB;
uniform vec2 uRes;
uniform float uProgress;
uniform float uTime;
uniform vec2 uMouse;
uniform float uHover;
uniform float uLoadedA;
uniform float uLoadedB;
${NOISE}

// x: image aspect, y: 1 for contain, 0 for cover.
vec4 sampleSlide(sampler2D tex, vec4 rect, vec2 fit, vec2 uv) {
  vec2 local = (uv - rect.xy) / rect.zw;
  float ra = (rect.z * uRes.x) / (rect.w * uRes.y);
  float ia = fit.x;
  vec2 scale = fit.y > 0.5
    ? (ra > ia ? vec2(ra / ia, 1.0) : vec2(1.0, ia / ra))
    : (ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0));
  vec2 st = (local - 0.5) * scale + 0.5;
  vec2 px = 1.5 / (rect.zw * uRes);
  vec2 edge = smoothstep(vec2(0.0), px, local) * smoothstep(vec2(0.0), px, 1.0 - local);
  float inside = edge.x * edge.y;
  if (fit.y > 0.5) {
    vec2 e2 = step(0.0, st) * step(st, vec2(1.0));
    inside *= e2.x * e2.y;
  }
  vec4 c = texture2D(tex, clamp(st, 0.0, 1.0));
  return vec4(c.rgb, c.a * inside);
}

vec3 champagne = vec3(0.86, 0.72, 0.47);

void main() {
  vec2 uv = vUv;
  vec2 aspect = vec2(uRes.x / uRes.y, 1.0);

  // Pointer flow: drags pixels after the cursor.
  vec4 flow = texture2D(uFlow, uv);
  vec2 f = (flow.rg - 0.5) * 2.0;
  float energy = flow.b;

  // A slow water surface under everything, stronger where the pointer rests.
  float t = uTime;
  vec2 swirl = vec2(fbm(uv * 3.0 + vec2(t * 0.05, 0.0)), fbm(uv * 3.0 + vec2(0.0, t * 0.05) + 7.3)) - 0.5;
  float md = length((uv - uMouse) * aspect);
  float ripple = sin(md * 60.0 - t * 5.0) * exp(-md * 7.0) * uHover;
  vec2 rippleDir = normalize((uv - uMouse) * aspect + 1e-5) / aspect;

  vec2 base = uv - f * 0.11 + swirl * 0.004 + rippleDir * ripple * 0.004;

  // The transition: a noise front sweeps up the stage; each image is pushed
  // along the flow field, hardest mid-way.
  float p = uProgress;
  float wave = sin(p * 3.14159);
  float n = fbm(uv * vec2(2.2, 2.8) + swirl * 2.0 + vec2(0.0, t * 0.03));
  float front = n * 0.75 + (1.0 - uv.y) * 0.25;
  float th = p * 1.5 - 0.25;
  float mixv = smoothstep(th + 0.06, th - 0.06, front);
  float band = 1.0 - smoothstep(0.0, 0.07, abs(front - th));
  band *= wave;

  vec2 push = (swirl * 0.6 + vec2(0.0, 0.25)) * wave;
  vec2 uvA = base + push * 0.18 * mixv + vec2(sin(uv.y * 18.0 + t * 2.0), 0.0) * 0.012 * wave;
  vec2 uvB = base - push * 0.18 * (1.0 - mixv) + vec2(sin(uv.y * 14.0 - t * 2.0), 0.0) * 0.012 * wave;

  // Colour fringing follows the pointer's speed.
  vec2 fr = f * 0.012 + push * 0.0015;
  vec4 a = sampleSlide(uA, uRectA, uFitA, uvA);
  a.r = sampleSlide(uA, uRectA, uFitA, uvA + fr).r;
  a.b = sampleSlide(uA, uRectA, uFitA, uvA - fr).b;
  vec4 b = sampleSlide(uB, uRectB, uFitB, uvB);
  b.r = sampleSlide(uB, uRectB, uFitB, uvB + fr).r;
  b.b = sampleSlide(uB, uRectB, uFitB, uvB - fr).b;
  a.a *= uLoadedA;
  b.a *= uLoadedB;

  // Ink-dark ground with a faint warm smoke.
  float smoke = fbm(uv * 1.6 + swirl + vec2(t * 0.02, -t * 0.015));
  vec3 bg = vec3(0.027, 0.025, 0.024) + champagne * pow(smoke, 3.0) * 0.07;
  bg += champagne * 0.05 * exp(-length((uv - vec2(0.5, 0.45)) * aspect) * 2.2);

  vec3 col = bg;
  col = mix(col, a.rgb, a.a * (1.0 - mixv));
  col = mix(col, b.rgb, b.a * mixv);

  // Caustic highlights where the water is stirred.
  float caustic = pow(abs(sin((uv.x + uv.y + f.x * 0.6) * 40.0 + t)), 18.0) * energy;
  col += champagne * caustic * 0.25;
  col += champagne * length(f) * 0.08;

  // The dissolving front: a glowing seam that breaks into sparks.
  vec2 cell = floor(uv * uRes / 2.0);
  float spark = step(0.975, hash(cell + floor(t * 14.0))) * band;
  col += champagne * band * 0.45 + vec3(1.0, 0.93, 0.8) * spark * 0.8;

  // Vignette and grain.
  float vig = smoothstep(1.25, 0.35, length((uv - 0.5) * aspect * 0.95));
  col *= mix(0.55, 1.0, vig);
  col += (hash(uv * uRes + fract(t) * 100.0) - 0.5) * 0.035;

  gl_FragColor = vec4(col, 1.0);
}`

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader failed to compile")
  }
  return shader
}

function program(gl: WebGLRenderingContext, frag: string) {
  const p = gl.createProgram()!
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag))
  gl.bindAttribLocation(p, 0, "aPos")
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link failed")
  const uniforms = new Map<string, WebGLUniformLocation | null>()
  const u = (name: string) => {
    if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(p, name))
    return uniforms.get(name)!
  }
  return { p, u }
}

type Target = { fb: WebGLFramebuffer; tex: WebGLTexture }

const FLOW_SIZE = 128
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export class LiquidStage {
  private gl: WebGLRenderingContext
  private main: ReturnType<typeof program>
  private flow: ReturnType<typeof program>
  private flowTargets: [Target, Target]
  private cache = new Map<string | HTMLCanvasElement, Promise<Tex>>()
  private blank: Tex
  private width = 1
  private height = 1
  private time = 0

  private a: { slide: Slide; tex: Tex } | null = null
  private b: { slide: Slide; tex: Tex } | null = null
  private progress = 1
  private duration = 1.6
  private queued: Slide | null = null
  private loading = false

  private mouse = { x: 0.5, y: 0.5 }
  private velocity = { x: 0, y: 0 }
  private hover = 0
  private hovering = false
  private lastMove = 0
  private canvas: HTMLCanvasElement
  private reduced: boolean

  constructor(canvas: HTMLCanvasElement, reduced: boolean) {
    this.canvas = canvas
    this.reduced = reduced
    const opts: WebGLContextAttributes = { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: "high-performance" }
    const gl = (canvas.getContext("webgl2", opts) ?? canvas.getContext("webgl", opts)) as WebGLRenderingContext | null
    if (!gl) throw new Error("WebGL is not available")
    this.gl = gl
    this.main = program(gl, MAIN_FRAG)
    this.flow = program(gl, FLOW_FRAG)

    const quad = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, quad)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    this.flowTargets = [this.target(), this.target()]
    this.blank = { tex: this.upload(blankCanvas()), aspect: 1 }
  }

  /** A float framebuffer when the GPU can render to one, else 8-bit (the field is encoded either way). */
  private target(): Target {
    const gl = this.gl
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    const fb = gl.createFramebuffer()!
    const tryFormat = (setup: () => void) => {
      setup()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
      return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
    }
    const isGl2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext
    const half =
      isGl2 &&
      gl.getExtension("EXT_color_buffer_float") &&
      tryFormat(() => {
        const g2 = gl as WebGL2RenderingContext
        g2.texImage2D(g2.TEXTURE_2D, 0, g2.RGBA16F, FLOW_SIZE, FLOW_SIZE, 0, g2.RGBA, g2.HALF_FLOAT, null)
      })
    if (!half) {
      tryFormat(() => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, FLOW_SIZE, FLOW_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null))
    }
    // Start at rest: velocity 0 encodes as 0.5.
    gl.viewport(0, 0, FLOW_SIZE, FLOW_SIZE)
    gl.clearColor(0.5, 0.5, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { fb, tex }
  }

  private upload(source: TexImageSource) {
    const gl = this.gl
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return tex
  }

  /** Loads (once) and uploads a slide's image, falling back to its drawn card. */
  load(slide: Slide): Promise<Tex> {
    const key = slide.source
    let pending = this.cache.get(key)
    if (!pending) {
      pending = new Promise<TexImageSource>((resolve) => {
        if (typeof key !== "string") return resolve(key)
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.decoding = "async"
        img.onload = () => resolve(img)
        img.onerror = () => resolve(slide.fallback())
        img.src = key
      }).then((source) => {
        const w = "naturalWidth" in source ? source.naturalWidth : (source as HTMLCanvasElement).width
        const h = "naturalHeight" in source ? source.naturalHeight : (source as HTMLCanvasElement).height
        try {
          return { tex: this.upload(source), aspect: w / h }
        } catch {
          // A tainted image (no CORS headers) can't be uploaded.
          const card = slide.fallback()
          return { tex: this.upload(card), aspect: card.width / card.height }
        }
      })
      this.cache.set(key, pending)
    }
    return pending
  }

  /** Shows a slide: melts into it, or puts it up at once the first time. */
  async show(slide: Slide) {
    if (this.loading) {
      this.queued = slide
      return
    }
    this.loading = true
    const tex = await this.load(slide)
    this.loading = false
    if (!this.b) {
      // The first slide rises out of the dark.
      this.b = { slide, tex }
      this.progress = this.reduced ? 1 : 0
      this.duration = 2.6
    } else {
      this.duration = 1.7
      // Mid-melt: settle into whichever image is mostly showing, then go on.
      if (this.progress < 0.5) this.b = this.a
      this.a = this.b
      this.b = { slide, tex }
      this.progress = this.reduced ? 1 : 0
    }
    const next = this.queued
    this.queued = null
    if (next && next !== slide) void this.show(next)
  }

  /** The current slides moved (the stage was resized). */
  relayout(rects: { a?: Slide["rect"]; b: Slide["rect"] }) {
    if (this.b) this.b.slide = { ...this.b.slide, rect: rects.b }
    if (this.a && rects.a) this.a.slide = { ...this.a.slide, rect: rects.a }
  }

  resize(width: number, height: number, dpr: number) {
    this.width = Math.max(1, width)
    this.height = Math.max(1, height)
    this.canvas.width = Math.round(this.width * dpr)
    this.canvas.height = Math.round(this.height * dpr)
  }

  /** Pointer position in CSS px over the stage. */
  pointer(x: number, y: number) {
    const nx = x / this.width
    const ny = 1 - y / this.height
    const now = performance.now()
    const dt = Math.max(8, now - this.lastMove)
    if (this.lastMove && now - this.lastMove < 120) {
      // Velocity in stage-heights per ~frame, smoothed.
      const vx = ((nx - this.mouse.x) / dt) * 16 * (this.width / this.height)
      const vy = ((ny - this.mouse.y) / dt) * 16
      this.velocity.x += (vx * 5 - this.velocity.x) * 0.6
      this.velocity.y += (vy * 5 - this.velocity.y) * 0.6
    }
    this.lastMove = now
    this.mouse = { x: nx, y: ny }
    this.hovering = true
  }

  leave() {
    this.hovering = false
  }

  get transitioning() {
    return this.progress < 1
  }

  frame(dt: number) {
    const gl = this.gl
    dt = Math.min(dt, 1 / 20)
    this.time += dt
    if (this.progress < 1) this.progress = Math.min(1, this.progress + dt / this.duration)
    this.hover += ((this.hovering && !this.reduced ? 1 : 0) - this.hover) * Math.min(1, dt * 4)

    // Flowmap step.
    const [read, write] = this.flowTargets
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fb)
    gl.viewport(0, 0, FLOW_SIZE, FLOW_SIZE)
    gl.useProgram(this.flow.p)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, read.tex)
    gl.uniform1i(this.flow.u("uPrev"), 0)
    gl.uniform2f(this.flow.u("uMouse"), this.mouse.x, this.mouse.y)
    const k = this.reduced ? 0 : 1
    gl.uniform2f(this.flow.u("uVelocity"), this.velocity.x * k, this.velocity.y * k)
    gl.uniform1f(this.flow.u("uAspect"), this.width / this.height)
    gl.uniform1f(this.flow.u("uFalloff"), 0.22)
    gl.uniform1f(this.flow.u("uDissipation"), Math.pow(0.93, dt * 60))
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    this.flowTargets = [write, read]
    this.velocity.x *= Math.pow(0.8, dt * 60)
    this.velocity.y *= Math.pow(0.8, dt * 60)

    // Main pass.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.useProgram(this.main.p)
    const a = this.a
    const b = this.b
    const bind = (unit: number, name: string, tex: Tex) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, tex.tex)
      gl.uniform1i(this.main.u(name), unit)
    }
    bind(0, "uA", a?.tex ?? this.blank)
    bind(1, "uB", b?.tex ?? this.blank)
    bind(2, "uFlow", { tex: write.tex, aspect: 1 })
    const rect = (name: string, r: Slide["rect"] | undefined) => {
      const v = r ?? { x: 0, y: 0, w: 1, h: 1 }
      gl.uniform4f(this.main.u(name), v.x / this.width, 1 - (v.y + v.h) / this.height, v.w / this.width, v.h / this.height)
    }
    rect("uRectA", a?.slide.rect)
    rect("uRectB", b?.slide.rect)
    gl.uniform2f(this.main.u("uFitA"), a?.tex.aspect ?? 1, a?.slide.fit === "contain" ? 1 : 0)
    gl.uniform2f(this.main.u("uFitB"), b?.tex.aspect ?? 1, b?.slide.fit === "contain" ? 1 : 0)
    gl.uniform2f(this.main.u("uRes"), this.canvas.width, this.canvas.height)
    gl.uniform1f(this.main.u("uProgress"), easeInOut(this.progress))
    gl.uniform1f(this.main.u("uTime"), this.time)
    gl.uniform2f(this.main.u("uMouse"), this.mouse.x, this.mouse.y)
    gl.uniform1f(this.main.u("uHover"), this.hover)
    gl.uniform1f(this.main.u("uLoadedA"), a ? 1 : 0)
    gl.uniform1f(this.main.u("uLoadedB"), b ? 1 : 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  /**
   * Frees the GPU objects but keeps the context: a canvas hands back the same
   * context forever, so losing it would leave a remounted stage nothing to draw with.
   */
  dispose() {
    const gl = this.gl
    void Promise.all(this.cache.values()).then((texs) => texs.forEach((t) => gl.deleteTexture(t.tex)))
    this.cache.clear()
    gl.deleteTexture(this.blank.tex)
    for (const t of this.flowTargets) {
      gl.deleteFramebuffer(t.fb)
      gl.deleteTexture(t.tex)
    }
    gl.deleteProgram(this.main.p)
    gl.deleteProgram(this.flow.p)
  }
}

function blankCanvas() {
  const c = document.createElement("canvas")
  c.width = c.height = 2
  return c
}
