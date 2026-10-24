/**
 * The chase: an original battle score for the castle, synthesised like the
 * rest of its sound. Odaiko and shime drums drive it, a biwa saws away at
 * a sixteenth-note riff, and a low men's chorus chants over the top in long
 * "nooo" calls answered by quick "to-no-no-no"s. Everything is in the same
 * in scale (A B♭ D E F) as Nakime's idle melody, so the two sit together.
 *
 * Layers come in by intensity: just the chant while waiting, the drums and
 * biwa once the chase is on, the fast shime and fills when you run or fall.
 */

export type ScoreMode = "off" | "wait" | "chase" | "finale"

export type Rig = {
  ctx: BaseAudioContext
  /** Dry music bus. */
  out: AudioNode
  /** Reverb send. */
  verb: AudioNode
  noise: AudioBuffer
  biwa: (freq: number) => AudioBuffer | undefined
}

const BPM = 152
const STEP = 60 / BPM / 4
const LOOKAHEAD = 0.35

// The in scale on A.
const A2 = 110
const Bb2 = 116.5
const D3 = 146.8
const E3 = 164.8
const F3 = 174.6
const A3 = 220
const Bb3 = 233.1
const D4 = 293.7
const E4 = 329.6
const F4 = 349.2

/** X strong, x soft, . rest; one bar of sixteenths. */
const ODAIKO = ["X..X..X.X.x.X...", "X..X..X.X.x.X..x", "X..X..X.X.x.X...", "X..X..X.XxXxXXXX"]
const SHIME = "x.x.X.x.x.x.X.x."
const SHIME_FAST = "xxXxxxXxxxXxxxXx"

const _ = 0
const RIFF = [
  [A2, A2, _, A2, Bb2, _, A2, _, A2, A2, _, A2, E3, _, F3, E3],
  [A2, A2, _, A2, Bb2, _, A2, _, A2, A2, _, A2, E3, _, F3, E3],
  [D3, D3, _, D3, E3, _, D3, _, Bb2, Bb2, _, Bb2, A2, _, Bb2, A2],
  [A2, A2, _, A2, Bb2, _, A2, _, D3, _, E3, _, F3, E3, D3, Bb2],
]

/** [bar, step, pitch, length in steps, syllable], over an eight-bar cycle. */
type Call = [number, number, number, number, "n" | "t"]
const CHANT: Call[] = [
  [0, 0, D4, 12, "n"],
  [0, 12, A3, 2, "t"],
  [0, 14, Bb3, 2, "n"],
  [1, 0, A3, 4, "n"],
  [1, 4, F3, 8, "n"],

  [2, 0, E4, 12, "n"],
  [2, 12, D4, 2, "t"],
  [2, 14, E4, 2, "n"],
  [3, 0, F4, 4, "n"],
  [3, 4, E4, 12, "n"],

  [4, 0, A3, 12, "n"],
  [4, 12, F3, 2, "t"],
  [4, 14, E3, 2, "n"],
  [5, 0, D3, 4, "n"],
  [5, 4, E3, 8, "n"],

  [6, 0, F4, 12, "n"],
  [6, 12, E4, 2, "t"],
  [6, 14, D4, 2, "n"],
  [7, 0, Bb3, 4, "n"],
  [7, 4, A3, 12, "n"],
]

/** How far a layer is in, 0–1, at this intensity. */
const layer = (level: number, from: number) => Math.max(0, Math.min(1, (level - from) / 0.15))

export class Score {
  mode: ScoreMode = "off"
  private rig: Rig
  private level = 0
  private target = 0
  private step = 0
  private next = 0
  private finaleAt = 0

  constructor(rig: Rig) {
    this.rig = rig
  }

  /** The finale ends the score itself, so this can change mid-tick. */
  private get live() {
    return this.mode !== "off"
  }

  /** 0–1: how hard the chase is going. */
  setIntensity(level: number) {
    this.target = Math.max(0, Math.min(1, level))
  }

  setMode(mode: ScoreMode) {
    if (mode === this.mode) return
    const was = this.mode
    this.mode = mode
    const now = this.rig.ctx.currentTime
    if (was === "off") {
      // Come in on a downbeat.
      this.step = 0
      this.next = now + 0.08
      this.level = mode === "chase" ? 0.5 : 0
    }
    if (mode === "finale") this.finaleAt = now
  }

  /** A strum of the castle: the drums answer with a hit. */
  hit() {
    if (this.mode === "off") return
    const at = this.rig.ctx.currentTime + 0.02
    this.odaiko(at, 1.1)
    this.crash(at, 0.25)
  }

  /** Schedules ahead; call every frame. */
  tick(dt: number) {
    if (!this.live) return
    this.level += (this.target - this.level) * (1 - Math.exp(-dt * 1.2))
    const now = this.rig.ctx.currentTime
    // Fell behind (a stall, a hidden tab): rejoin rather than catch up.
    if (this.next < now) this.next = now + 0.05
    while (this.next < now + LOOKAHEAD && this.live) {
      this.play(this.step, this.next)
      this.step++
      this.next += STEP
    }
  }

  private play(n: number, at: number) {
    const s = n % 16
    const bar = Math.floor(n / 16)
    if (this.mode === "finale") return this.finale(s, at)

    const level = this.mode === "wait" ? Math.min(this.level, 0.3) : this.level
    const chant = layer(level, 0.1)
    const drums = layer(level, 0.35)
    const riff = layer(level, 0.5)
    const fast = layer(level, 0.8)

    if (chant > 0) {
      for (const [b, st, f, len, syl] of CHANT) if (b === bar % 8 && st === s) this.voice(at, f, len * STEP, 0.22 * chant, syl)
    }
    if (drums > 0) {
      const pattern = fast > 0 ? ODAIKO[bar % 4] : ODAIKO[bar % 4 === 3 ? 0 : bar % 4]
      const c = pattern[s]
      if (c !== ".") this.odaiko(at, (c === "X" ? 0.9 : 0.45) * drums)
      const sh = (fast > 0.5 ? SHIME_FAST : SHIME)[s]
      if (sh !== ".") this.shime(at, (sh === "X" ? 0.35 : 0.18) * drums)
      if (s === 0 && bar % 8 === 0) this.crash(at, 0.12 * drums)
    }
    if (riff > 0) {
      const f = RIFF[bar % 4][s]
      if (f) this.pluck(at, f, (s % 4 === 0 ? 0.5 : 0.32) * riff)
    }
  }

  /** The castle rising: a drum roll that swells for five seconds, then one last hit. */
  private finale(s: number, at: number) {
    const t = at - this.finaleAt
    if (t < 5) {
      const swell = 0.3 + (t / 5) * 0.7
      this.odaiko(at, (s % 4 === 0 ? 0.9 : 0.5) * swell)
      if (s % 2 === 0) this.shime(at, 0.25 * swell)
      if (s === 0) this.voice(at, t < 2.5 ? A3 : D4, 16 * STEP, 0.25 * swell, "n")
      return
    }
    this.odaiko(at, 1.3)
    this.crash(at, 0.4)
    for (const f of [A2, E3, A3]) this.voice(at, f, 3.5, 0.2, "n")
    this.mode = "off"
  }

  // ── Instruments ───────────────────────────────────────────────────────

  private odaiko(at: number, gain: number) {
    const { ctx, out, verb, noise } = this.rig
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(130, at)
    o.frequency.exponentialRampToValueAtTime(46, at + 0.3)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(gain, at + 0.004)
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.9)
    o.connect(g)
    g.connect(out)
    g.connect(verb)
    o.start(at)
    o.stop(at + 0.95)
    // The skin's slap.
    const src = ctx.createBufferSource()
    src.buffer = noise
    const f = ctx.createBiquadFilter()
    f.type = "lowpass"
    f.frequency.value = 700
    const sg = ctx.createGain()
    sg.gain.setValueAtTime(gain * 0.5, at)
    sg.gain.exponentialRampToValueAtTime(0.001, at + 0.07)
    src.connect(f).connect(sg).connect(out)
    src.start(at, Math.random())
    src.stop(at + 0.08)
  }

  private shime(at: number, gain: number) {
    const { ctx, out, verb, noise } = this.rig
    const o = ctx.createOscillator()
    o.type = "triangle"
    o.frequency.setValueAtTime(460, at)
    o.frequency.exponentialRampToValueAtTime(330, at + 0.06)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, at)
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.1)
    o.connect(g).connect(out)
    o.start(at)
    o.stop(at + 0.12)
    const src = ctx.createBufferSource()
    src.buffer = noise
    const f = ctx.createBiquadFilter()
    f.type = "bandpass"
    f.frequency.value = 3200
    f.Q.value = 1.5
    const sg = ctx.createGain()
    sg.gain.setValueAtTime(gain * 0.8, at)
    sg.gain.exponentialRampToValueAtTime(0.001, at + 0.05)
    src.connect(f).connect(sg)
    sg.connect(out)
    sg.connect(verb)
    src.start(at, Math.random())
    src.stop(at + 0.06)
  }

  /** Chappa cymbals. */
  private crash(at: number, gain: number) {
    const { ctx, out, verb, noise } = this.rig
    const src = ctx.createBufferSource()
    src.buffer = noise
    const f = ctx.createBiquadFilter()
    f.type = "highpass"
    f.frequency.value = 4500
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, at)
    g.gain.exponentialRampToValueAtTime(0.001, at + 1.4)
    src.connect(f).connect(g)
    g.connect(out)
    g.connect(verb)
    src.start(at, Math.random())
    src.stop(at + 1.45)
  }

  /** The biwa, damped short: a staccato riff, not a ringing strum. */
  private pluck(at: number, freq: number, gain: number) {
    const buf = this.rig.biwa(freq)
    if (!buf) return
    const { ctx, out, verb } = this.rig
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.setValueAtTime(1.02, at)
    src.playbackRate.exponentialRampToValueAtTime(1, at + 0.06)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, at)
    g.gain.setTargetAtTime(0, at + STEP * 1.4, 0.03)
    src.connect(g)
    g.connect(out)
    g.connect(verb)
    src.start(at)
    src.stop(at + STEP * 1.4 + 0.25)
  }

  /**
   * One sung note from a low chorus: detuned saws an octave apart through
   * "oh" formants, with vibrato. A "t" syllable starts with a consonant
   * tick; an "n" swells in.
   */
  private voice(at: number, freq: number, len: number, gain: number, syl: "n" | "t") {
    const { ctx, out, verb, noise } = this.rig
    const end = at + len
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, at)
    env.gain.linearRampToValueAtTime(gain, at + (syl === "t" ? 0.015 : Math.min(0.09, len * 0.4)))
    env.gain.setValueAtTime(gain, Math.max(at + 0.02, end - 0.04))
    env.gain.linearRampToValueAtTime(0, end + 0.22)
    env.connect(out)
    env.connect(verb)
    const mix = ctx.createGain()
    this.voiceSources(at, end + 0.25, freq, mix)
    for (const [f, q, amp] of [
      [420, 5, 1],
      [820, 7, 0.45],
      [2500, 9, 0.1],
    ]) {
      const bp = ctx.createBiquadFilter()
      bp.type = "bandpass"
      bp.frequency.value = f
      bp.Q.value = q
      const a = ctx.createGain()
      a.gain.value = amp * 2.2
      mix.connect(bp).connect(a).connect(env)
    }
    if (syl === "t") {
      const src = ctx.createBufferSource()
      src.buffer = noise
      const f = ctx.createBiquadFilter()
      f.type = "highpass"
      f.frequency.value = 3800
      const g = ctx.createGain()
      g.gain.setValueAtTime(gain * 0.6, at)
      g.gain.exponentialRampToValueAtTime(0.001, at + 0.03)
      src.connect(f).connect(g).connect(out)
      src.start(at, Math.random())
      src.stop(at + 0.04)
    }
  }

  private voiceSources(at: number, stop: number, freq: number, dest: AudioNode) {
    const { ctx } = this.rig
    const vib = ctx.createOscillator()
    vib.frequency.value = 5.1
    const depth = ctx.createGain()
    // Vibrato settles in after the attack.
    depth.gain.setValueAtTime(0, at)
    depth.gain.linearRampToValueAtTime(14, at + 0.35)
    vib.connect(depth)
    vib.start(at)
    vib.stop(stop)
    for (const [mul, cents] of [
      [1, -9],
      [1, 8],
      [0.5, 0],
    ]) {
      const o = ctx.createOscillator()
      o.type = "sawtooth"
      o.frequency.value = freq * mul
      o.detune.value = cents
      depth.connect(o.detune)
      o.connect(dest)
      o.start(at)
      o.stop(stop)
    }
  }
}
