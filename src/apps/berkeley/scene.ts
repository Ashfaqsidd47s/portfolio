import { buildGem, drawGem, drawGlint, drawWire, traceSilhouette, TINTS, type Cut, type Gem, type Tint } from "./gem"

/**
 * The Berkeley Diamonds canvas: a loading intro, then a garden where every
 * letter typed grows a gold stem with a diamond opening at its tip.
 *
 * All timing runs on the scene's own clock, which only moves while frames are
 * drawn: hide the window mid-intro and it picks up where it left off.
 */

const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif"
const IVORY = "#f2e9d6"
const GOLD = "#d9b46a"

/** Intro beats, in seconds. */
const INTRO = {
  wire: [0.15, 1.55],
  fill: [1.15, 2.25],
  sweep: [2.0, 2.9],
  lift: [2.3, 3.2],
  word: 2.55,
  sub: 3.05,
  load: [0.1, 3.4],
  exit: [4.1, 4.8],
} as const
export const INTRO_LENGTH = INTRO.exit[1]

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const span = (t: number, [a, b]: readonly [number, number]) => clamp01((t - a) / (b - a))
const easeOut = (t: number) => 1 - (1 - t) ** 3
const easeIn = (t: number) => t * t * t
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeBack = (t: number) => {
  const c = 1.5
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}
/** Rises over `rise` seconds, falls over `fall`: a glint's brightness at age `t`. */
const pulse = (t: number, rise: number, fall: number) =>
  t < 0 ? 0 : t < rise ? easeOut(t / rise) : t < rise + fall ? 1 - easeIn((t - rise) / fall) : 0

/** Small deterministic noise, so a letter's stone doesn't change between frames. */
function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const CUTS: Cut[] = ["round", "oval", "round", "pear", "marquise", "round", "emerald"]
const FANCY: Tint[] = [TINTS.pink, TINTS.canary, TINTS.blue, TINTS.champagne, TINTS.green]

/** Each character always grows the same stone: vowels in fancy colours, the rest white. */
export function stoneFor(ch: string): { cut: Cut; tint: Tint; big: boolean } {
  const code = ch.codePointAt(0) ?? 0
  const lower = ch.toLowerCase()
  const tint = /[aeiou]/.test(lower)
    ? FANCY[code % FANCY.length]
    : /\d/.test(ch)
      ? TINTS.blue
      : TINTS.white
  return { cut: CUTS[code % CUTS.length], tint, big: ch !== lower }
}

const gemCache = new Map<Cut, Gem>()
const gemOf = (cut: Cut) => {
  let gem = gemCache.get(cut)
  if (!gem) gemCache.set(cut, (gem = buildGem(cut, 12)))
  return gem
}

type Sprout = {
  id: number
  ch: string
  born: number
  died?: number
  gem?: Gem
  tint: Tint
  big: boolean
  /** Random draws, fixed at birth. */
  r: [number, number, number, number]
  x: number
  y: number
  size: number
  /** Where its stem leaves the ground. */
  rootX: number
  placed: boolean
}

type Mote = { x: number; y: number; r: number; v: number; p: number }

export type SceneOptions = {
  reduced: boolean
  onIntroEnd: () => void
}

export class Scene {
  private ctx: CanvasRenderingContext2D
  private w = 1
  private h = 1
  private dpr = 1
  private clock = 0
  private intro: number | null = null
  private sprouts: Sprout[] = []
  private nextId = 1
  private shimmer = -10
  private motes: Mote[] = []
  private hero = buildGem("round", 16)
  private bg: CanvasGradient | null = null
  private stemPaint: CanvasGradient | null = null
  private opts: SceneOptions

  focused = false
  hint = "Click and start typing"

  constructor(canvas: HTMLCanvasElement, opts: SceneOptions) {
    this.ctx = canvas.getContext("2d")!
    this.opts = opts
    for (let i = 0; i < 38; i++) {
      this.motes.push({ x: hash(i * 3.1), y: hash(i * 7.7), r: 0.4 + hash(i * 1.3) * 1.3, v: 0.006 + hash(i * 5.9) * 0.018, p: hash(i) * 6.28 })
    }
  }

  get introPlaying() {
    return this.intro !== null
  }

  resize(width: number, height: number, dpr: number) {
    const canvas = this.ctx.canvas
    this.w = Math.max(1, width)
    this.h = Math.max(1, height)
    this.dpr = dpr
    canvas.width = Math.round(this.w * dpr)
    canvas.height = Math.round(this.h * dpr)
    const g = this.ctx.createRadialGradient(this.w / 2, this.h * 0.42, 0, this.w / 2, this.h * 0.42, Math.hypot(this.w, this.h) * 0.62)
    g.addColorStop(0, "#161c2c")
    g.addColorStop(0.55, "#0c0f19")
    g.addColorStop(1, "#050609")
    this.bg = g
    const s = this.ctx.createLinearGradient(0, this.ground, 0, this.h * 0.1)
    s.addColorStop(0, "#5e4419")
    s.addColorStop(0.45, "#b88d45")
    s.addColorStop(1, "#f5e0a2")
    this.stemPaint = s
  }

  startIntro() {
    if (this.opts.reduced) {
      this.intro = null
      this.opts.onIntroEnd()
      return
    }
    this.intro = this.clock
  }

  /** Jumps to the intro's fade-out. */
  skipIntro() {
    if (this.intro === null) return
    const t = this.clock - this.intro
    if (t < INTRO.exit[0]) this.intro = this.clock - INTRO.exit[0]
  }

  /** A ripple of glints across every stone, left to right. */
  sparkle() {
    this.shimmer = this.clock
  }

  /** Keeps the shared prefix, lets the rest wilt, and plants whatever is new. */
  setText(text: string) {
    const alive = this.sprouts.filter((s) => s.died === undefined)
    const chars = [...text]
    let same = 0
    while (same < alive.length && same < chars.length && alive[same].ch === chars[same]) same++
    for (const s of alive.slice(same)) s.died = this.clock
    for (const [i, ch] of chars.slice(same).entries()) {
      const id = this.nextId++
      const stone = stoneFor(ch)
      this.sprouts.push({
        id,
        ch,
        born: this.clock + i * 0.04,
        gem: ch.trim() ? gemOf(stone.cut) : undefined,
        tint: stone.tint,
        big: stone.big,
        r: [hash(id * 1.7), hash(id * 9.3), hash(id * 4.1), hash(id * 2.9)],
        x: 0,
        y: 0,
        size: 0,
        rootX: 0,
        placed: false,
      })
    }
  }

  // ---- Frame ---------------------------------------------------------------

  frame(dt: number) {
    this.clock += Math.min(dt, 0.1)
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)

    if (this.intro !== null) {
      const t = this.clock - this.intro
      if (t >= INTRO_LENGTH) {
        this.intro = null
        this.opts.onIntroEnd()
      } else {
        const exit = easeInOut(span(t, INTRO.exit))
        if (exit > 0) this.drawGarden(dt)
        ctx.save()
        ctx.globalAlpha = 1 - exit
        this.drawIntro(t, exit, dt)
        ctx.restore()
        return
      }
    }
    this.drawGarden(dt)
  }

  private get ground() {
    return this.h - Math.min(120, Math.max(72, this.h * 0.2))
  }

  private backdrop() {
    const ctx = this.ctx
    ctx.fillStyle = this.bg ?? "#07080d"
    ctx.fillRect(0, 0, this.w, this.h)
  }

  private drawMotes(dt: number) {
    const ctx = this.ctx
    ctx.save()
    ctx.globalCompositeOperation = "lighter"
    ctx.fillStyle = "#fff4dc"
    for (const m of this.motes) {
      if (!this.opts.reduced) {
        m.y -= m.v * dt
        if (m.y < -0.02) m.y += 1.04
      }
      ctx.globalAlpha = 0.08 + 0.22 * Math.sin(this.clock * 0.9 + m.p) ** 2
      ctx.beginPath()
      ctx.arc(m.x * this.w, m.y * this.h, m.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // ---- Intro ---------------------------------------------------------------

  private drawIntro(t: number, exit: number, dt: number) {
    const { ctx, w, h } = this
    this.backdrop()
    // Once the garden shows through, it has already moved the motes this frame.
    this.drawMotes(exit > 0 ? 0 : dt)

    const size = Math.min(140, Math.max(48, Math.min(w, h) * 0.16))
    const lift = easeInOut(span(t, INTRO.lift)) * h * 0.08
    const cx = w / 2
    const cy = h * 0.42 - lift
    const pose = {
      x: cx,
      y: cy,
      scale: size * (1 + exit * 0.35),
      spin: 0.4 + t * 0.55,
      tilt: 0.36,
      tint: TINTS.white,
      phase: 1.3,
      reveal: easeInOut(span(t, INTRO.fill)),
    }

    // A pinpoint of light opens first; the stone is drawn out of it.
    drawGlint(ctx, cx, cy, size * 1.1 * easeOut(clamp01(t / 0.35)), pulse(t, 0.3, 0.6))

    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 2.4)
    halo.addColorStop(0, `rgba(190,210,255,${0.1 * pose.reveal})`)
    halo.addColorStop(1, "rgba(190,210,255,0)")
    ctx.fillStyle = halo
    ctx.fillRect(cx - size * 2.4, cy - size * 2.4, size * 4.8, size * 4.8)

    const projected = drawGem(ctx, this.hero, pose)
    const wireFade = 1 - 0.8 * span(t, [1.6, 2.4])
    drawWire(ctx, this.hero, { ...pose, alpha: wireFade }, easeInOut(span(t, INTRO.wire)), "rgba(240,218,160,0.9)")

    // A band of light runs across the finished stone.
    const sweep = span(t, INTRO.sweep)
    if (sweep > 0 && sweep < 1) {
      const bx = cx - size * 1.8 + easeInOut(sweep) * size * 3.6
      const band = ctx.createLinearGradient(bx - size * 0.45, cy - size * 0.3, bx + size * 0.45, cy + size * 0.3)
      band.addColorStop(0, "rgba(255,255,255,0)")
      band.addColorStop(0.5, "rgba(255,255,255,0.7)")
      band.addColorStop(1, "rgba(255,255,255,0)")
      ctx.save()
      ctx.beginPath()
      traceSilhouette(ctx, projected)
      ctx.clip()
      ctx.globalCompositeOperation = "lighter"
      ctx.fillStyle = band
      ctx.fillRect(cx - size * 2, cy - size * 2, size * 4, size * 4)
      ctx.restore()
    }

    // Then it catches the light: one big flash, two small ones, and a slow repeat.
    const { hot } = projected
    drawGlint(ctx, hot.x, hot.y, size * 0.75, pulse(t - 2.55, 0.18, 0.55))
    drawGlint(ctx, cx - size * 0.62, cy - size * 0.18, size * 0.38, pulse(t - 2.75, 0.15, 0.45))
    drawGlint(ctx, cx + size * 0.3, cy + size * 0.32, size * 0.3, pulse(t - 2.9, 0.15, 0.45))
    drawGlint(ctx, hot.x, hot.y, size * 0.5, pulse(t - 3.7, 0.2, 0.5))

    // Wordmark: BERKELEY rises in letter by letter while its tracking closes up.
    const fs = Math.min(64, Math.max(26, w * 0.075))
    const wordY = h * 0.42 - h * 0.08 + size * 0.95 + fs
    const tracking = fs * (0.62 - 0.3 * easeOut(span(t, [INTRO.word, INTRO.word + 1.3])))
    const gold = ctx.createLinearGradient(cx - fs * 4, 0, cx + fs * 4, 0)
    const shine = clamp01((t - 3.0) / 1.2)
    gold.addColorStop(0, "#a8813c")
    gold.addColorStop(clamp01(0.15 + shine * 0.7), "#fbecc0")
    gold.addColorStop(1, "#a8813c")
    this.trackedText("BERKELEY", cx, wordY, `500 ${fs}px ${SERIF}`, tracking, (i) => {
      const a = easeOut(span(t, [INTRO.word + i * 0.07, INTRO.word + i * 0.07 + 0.55]))
      return { alpha: a, dy: (1 - a) * fs * 0.3, fill: gold }
    })

    // Hairline rules open out from a small diamond, then the subtitle.
    const rules = easeInOut(span(t, [2.9, 3.6]))
    const ruleY = wordY + fs * 0.42
    if (rules > 0) {
      const len = fs * 2.3 * rules
      const gap = fs * 0.22
      ctx.save()
      ctx.strokeStyle = GOLD
      ctx.globalAlpha *= 0.75
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx - gap, ruleY)
      ctx.lineTo(cx - gap - len, ruleY)
      ctx.moveTo(cx + gap, ruleY)
      ctx.lineTo(cx + gap + len, ruleY)
      ctx.stroke()
      const d = fs * 0.075 * rules
      ctx.fillStyle = "#f6e3a8"
      ctx.beginPath()
      ctx.moveTo(cx, ruleY - d)
      ctx.lineTo(cx + d, ruleY)
      ctx.lineTo(cx, ruleY + d)
      ctx.lineTo(cx - d, ruleY)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
    const sub = easeOut(span(t, [INTRO.sub, INTRO.sub + 0.7]))
    const fs2 = Math.max(10, fs * 0.3)
    this.trackedText("DIAMONDS", cx, ruleY + fs2 * 2.1, `500 ${fs2}px ${SERIF}`, fs2 * 0.75, () => ({
      alpha: sub * 0.9,
      dy: (1 - sub) * 6,
      fill: IVORY,
    }))

    // Loading readout: a counter and a hairline that fills.
    const load = easeInOut(span(t, INTRO.load))
    const readout = 1 - span(t, [3.55, 3.95])
    if (readout > 0) {
      const barW = Math.min(160, w * 0.36)
      const by = h - Math.max(36, h * 0.08)
      ctx.save()
      ctx.globalAlpha *= readout
      ctx.fillStyle = "rgba(217,180,106,0.18)"
      ctx.fillRect(cx - barW / 2, by, barW, 1)
      ctx.fillStyle = GOLD
      ctx.fillRect(cx - barW / 2, by, barW * load, 1)
      ctx.restore()
      this.trackedText(`${String(Math.round(load * 100)).padStart(2, "0")}%`, cx, by - 12, `500 11px ${SERIF}`, 3, () => ({
        alpha: readout * 0.7,
        dy: 0,
        fill: IVORY,
      }))
    }
  }

  /** Text drawn letter by letter, so each one can fade and the spacing can animate. */
  private trackedText(
    text: string,
    cx: number,
    y: number,
    font: string,
    tracking: number,
    style: (i: number) => { alpha: number; dy: number; fill: string | CanvasGradient }
  ) {
    const ctx = this.ctx
    ctx.save()
    ctx.font = font
    ctx.textBaseline = "alphabetic"
    const widths = [...text].map((c) => ctx.measureText(c).width)
    const total = widths.reduce((a, b) => a + b, 0) + tracking * (widths.length - 1)
    let x = cx - total / 2
    const base = ctx.globalAlpha
    ;[...text].forEach((c, i) => {
      const { alpha, dy, fill } = style(i)
      if (alpha > 0) {
        ctx.globalAlpha = base * alpha
        ctx.fillStyle = fill
        ctx.fillText(c, x, y + dy)
      }
      x += widths[i] + tracking
    })
    ctx.restore()
  }

  // ---- Garden --------------------------------------------------------------

  private drawGarden(dt: number) {
    const { ctx, w, h } = this
    const now = this.clock
    const reduced = this.opts.reduced
    const ground = this.ground
    this.backdrop()
    this.drawMotes(dt)

    // Ground: a gold hairline that fades out at both ends.
    const line = ctx.createLinearGradient(0, 0, w, 0)
    line.addColorStop(0, "rgba(217,180,106,0)")
    line.addColorStop(0.5, "rgba(217,180,106,0.55)")
    line.addColorStop(1, "rgba(217,180,106,0)")
    ctx.fillStyle = line
    ctx.fillRect(w * 0.04, ground, w * 0.92, 1)

    // Typed text, centred under the ground, sized to fit.
    this.sprouts = this.sprouts.filter((s) => s.died === undefined || now - s.died < 0.6)
    const alive = this.sprouts.filter((s) => s.died === undefined)
    const text = alive.map((s) => s.ch).join("")
    const band = h - ground
    ctx.font = `italic 400 100px ${SERIF}`
    const at100 = ctx.measureText(text || " ").width
    const fs = Math.min(44, Math.max(14, Math.min(band * 0.42, (w * 0.86 * 100) / Math.max(at100, 1))))
    const font = `italic 400 ${fs}px ${SERIF}`
    ctx.font = font
    const baseline = ground + band * 0.5 + fs * 0.3
    const textW = ctx.measureText(text).width
    let x = w / 2 - textW / 2

    ctx.save()
    ctx.textBaseline = "alphabetic"
    for (const s of alive) {
      const cw = ctx.measureText(s.ch).width
      s.rootX = x + cw / 2
      const a = reduced ? 1 : easeOut(clamp01((now - s.born) / 0.35))
      ctx.globalAlpha = a
      ctx.fillStyle = IVORY
      ctx.fillText(s.ch, x, baseline + (1 - a) * 8)
      x += cw
    }
    ctx.restore()

    const blink = Math.floor(now * 1.8) % 2 === 0
    if (!text) {
      ctx.save()
      ctx.font = font
      ctx.textAlign = "center"
      ctx.fillStyle = IVORY
      ctx.globalAlpha = 0.42
      ctx.fillText(this.focused ? "Type a word and watch it bloom" : this.hint, w / 2, baseline)
      ctx.restore()
    }
    if (this.focused && blink) {
      const cx = text ? x + 2 : w / 2 - ctx.measureText("Type a word and watch it bloom").width / 2 - 6
      ctx.fillStyle = GOLD
      ctx.fillRect(cx, baseline - fs * 0.72, 1.5, fs * 0.86)
    }

    // Where each stone wants to be: spread across the width, at mixed heights.
    const stones = alive.filter((s) => s.gem)
    const m = stones.length
    const base = Math.min(38, Math.max(16, Math.min(w, h) * 0.055))
    const crowd = Math.min(1.1, Math.max(0.55, 1.25 - m * 0.016))
    const top = h * 0.1
    const ease = reduced ? 1 : Math.min(1, dt * 5)
    stones.forEach((s, k) => {
      const size = base * crowd * (0.85 + s.r[0] * 0.3) * (s.big ? 1.22 : 1)
      const slot = (w * 0.84) / Math.max(m, 1)
      const tx = m === 1 ? w / 2 : w * 0.08 + slot * (k + 0.5) + (s.r[1] - 0.5) * slot * 0.5
      const reach = ground - top - size * 1.4
      const ty = ground - size * 0.8 - reach * (0.3 + 0.62 * ((s.r[2] + (k % 2) * 0.35) % 1))
      if (!s.placed) {
        s.x = tx
        s.y = ty
        s.size = size
        s.placed = true
      } else {
        s.x += (tx - s.x) * ease
        s.y += (ty - s.y) * ease
        s.size += (size - s.size) * ease
      }
    })

    const living = this.sprouts.filter((s) => s.gem && s.placed)
    // Stems first, so no stem crosses in front of a stone.
    for (const s of living) this.drawStem(s, now, ground)
    // Higher stones further back.
    for (const s of [...living].sort((a, b) => a.y - b.y)) this.drawStone(s, now)
  }

  private growth(s: Sprout, now: number) {
    if (this.opts.reduced) {
      const gone = s.died !== undefined ? 1 - clamp01((now - s.died) / 0.2) : 1
      return { stem: gone, leaf: [gone, gone], bloom: gone, reveal: gone, unwind: 0, alpha: gone }
    }
    const a = now - s.born
    let stem = easeOut(clamp01(a / 0.75))
    let leaf = [0, 1].map((i) => easeBack(clamp01((a - 0.38 - i * 0.12) / 0.45)))
    const open = clamp01((a - 0.48) / 0.85)
    let bloom = easeBack(open)
    let alpha = clamp01(open * 3)
    if (s.died !== undefined) {
      const k = 1 - easeIn(clamp01((now - s.died) / 0.5))
      stem = Math.min(stem, k)
      leaf = leaf.map((l) => Math.min(l, k))
      bloom *= k
      alpha *= k
    }
    return { stem, leaf, bloom, reveal: clamp01((a - 0.5) / 0.7), unwind: (1 - easeOut(open)) * 5, alpha }
  }

  private tip(s: Sprout, now: number) {
    const sway = this.opts.reduced ? 0 : Math.sin(now * 0.9 + s.r[3] * 6.28) * s.size * 0.12
    return { x: s.x + sway, y: s.y }
  }

  private drawStem(s: Sprout, now: number, ground: number) {
    const ctx = this.ctx
    const g = this.growth(s, now)
    if (g.stem <= 0) return
    const tip = this.tip(s, now)
    const p0x = s.rootX
    const p0y = ground - 1
    const p3x = tip.x
    const p3y = tip.y + s.size * 0.58
    const rise = p0y - p3y
    const c1x = p0x
    const c1y = p0y - rise * 0.5
    const c2x = p3x
    const c2y = p3y + rise * 0.32
    const at = (t: number): [number, number] => {
      const u = 1 - t
      return [
        u * u * u * p0x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * p3x,
        u * u * u * p0y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * p3y,
      ]
    }

    ctx.save()
    ctx.strokeStyle = this.stemPaint ?? GOLD
    ctx.lineWidth = Math.max(1.1, s.size * 0.055)
    ctx.lineCap = "round"
    ctx.beginPath()
    const steps = 28
    for (let i = 0; i <= steps; i++) {
      const [x, y] = at((i / steps) * g.stem)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Two gold leaves, each set with a single tiny stone.
    const side = s.r[3] > 0.5 ? 1 : -1
    ;[0.36, 0.6].forEach((t, i) => {
      const grow = g.leaf[i]
      if (grow <= 0 || g.stem < t) return
      const [bx, by] = at(t)
      const [nx, ny] = at(t + 0.02)
      const dir = Math.atan2(ny - by, nx - bx) + (i % 2 ? -side : side) * 0.95
      const len = s.size * 0.62 * grow
      const ux = Math.cos(dir)
      const uy = Math.sin(dir)
      const tx = bx + ux * len
      const ty = by + uy * len
      const mx = bx + ux * len * 0.5
      const my = by + uy * len * 0.5
      const wv = len * 0.26
      const leaf = ctx.createLinearGradient(bx, by, tx, ty)
      leaf.addColorStop(0, "#8a6526")
      leaf.addColorStop(1, "#f1d58f")
      ctx.fillStyle = leaf
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.quadraticCurveTo(mx - uy * wv, my + ux * wv, tx, ty)
      ctx.quadraticCurveTo(mx + uy * wv, my - ux * wv, bx, by)
      ctx.fill()
      ctx.fillStyle = "rgba(255,255,255,0.9)"
      ctx.beginPath()
      ctx.arc(bx + ux * len * 0.58, by + uy * len * 0.58, Math.max(0.7, len * 0.07), 0, Math.PI * 2)
      ctx.fill()
    })

    // A small gold collar where the stem meets the stone.
    if (g.bloom > 0.05) {
      ctx.fillStyle = "#e9c97f"
      ctx.globalAlpha = g.alpha
      ctx.beginPath()
      ctx.ellipse(p3x, p3y, s.size * 0.09, s.size * 0.05, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  private drawStone(s: Sprout, now: number) {
    const ctx = this.ctx
    const g = this.growth(s, now)
    if (g.bloom <= 0.01 || !s.gem) return
    const tip = this.tip(s, now)
    const scale = s.size * g.bloom
    const dying = s.died !== undefined ? clamp01((now - s.died) / 0.5) : 0
    const y = tip.y - dying * s.size * 0.6

    // Soft light under the stone, in its own colour.
    const halo = ctx.createRadialGradient(tip.x, y, 0, tip.x, y, scale * 2.2)
    halo.addColorStop(0, `hsla(${s.tint.h},${Math.max(30, s.tint.s)}%,75%,${0.16 * g.alpha})`)
    halo.addColorStop(1, `hsla(${s.tint.h},${s.tint.s}%,75%,0)`)
    ctx.fillStyle = halo
    ctx.fillRect(tip.x - scale * 2.2, y - scale * 2.2, scale * 4.4, scale * 4.4)

    const reduced = this.opts.reduced
    const spin = s.r[0] * 6.28 + (reduced ? 0 : now * (0.25 + s.r[1] * 0.35) * (s.r[2] > 0.5 ? 1 : -1) + g.unwind)
    const { hot } = drawGem(ctx, s.gem, {
      x: tip.x,
      y,
      scale,
      spin,
      tilt: 0.42 + s.r[3] * 0.12,
      tint: s.tint,
      phase: s.r[2] * 10,
      alpha: g.alpha,
      reveal: reduced ? 1 : g.reveal,
    })
    if (reduced || s.died !== undefined) return

    // Flash once when fully open, now and then after, and on Enter's ripple.
    const age = now - s.born
    const period = 3.2 + s.r[1] * 3.5
    const idle = (age + s.r[0] * period) % period
    const ripple = now - this.shimmer - (tip.x / this.w) * 0.7
    const flash = Math.max(pulse(age - 1.15, 0.15, 0.5), pulse(idle - period + 0.7, 0.2, 0.5) * 0.8, pulse(ripple, 0.12, 0.5))
    drawGlint(ctx, hot.x, hot.y, scale * 0.9, flash)
  }
}
