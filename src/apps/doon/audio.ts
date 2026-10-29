import type { EnvState } from "./env"

/**
 * The town's sound, all synthesised: rain and wind from filtered noise,
 * birds by day, crickets at night, thunder after lightning, horns near the
 * big roads, a singing bowl near the monastery, and your footsteps.
 */

export type Surroundings = {
  /** 0–1: how close the nearest busy road is. */
  traffic: number
  /** 0–1: how close the Great Stupa is. */
  monastery: number
  /** 0–1: how close the lake is. */
  lake: number
}

export class Soundscape {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private rain!: GainNode
  private wind!: GainNode
  private hum!: GainNode
  private noise!: AudioBuffer
  private muted = false
  private birdT = 2
  private cricketT = 0
  private hornT = 4
  private bowlT = 6
  private duckT = 5

  /** Must be called from a user gesture. */
  start() {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.7
    this.master.connect(ctx.destination)

    const len = ctx.sampleRate * 2
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1

    this.rain = this.loop([["highpass", 500], ["lowpass", 5200]], 0)
    this.wind = this.loop([["bandpass", 380]], 0)
    this.hum = this.loop([["lowpass", 220]], 0)
  }

  private loop(filters: [BiquadFilterType, number][], gain: number) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    let node: AudioNode = src
    for (const [type, f] of filters) {
      const b = ctx.createBiquadFilter()
      b.type = type
      b.frequency.value = f
      node.connect(b)
      node = b
    }
    const g = ctx.createGain()
    g.gain.value = gain
    node.connect(g)
    g.connect(this.master)
    src.start()
    return g
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.1)
  }

  suspend() {
    void this.ctx?.suspend()
  }

  resume() {
    void this.ctx?.resume()
  }

  update(dt: number, env: EnvState, around: Surroundings) {
    const ctx = this.ctx
    if (!ctx || ctx.state !== "running") return
    const t = ctx.currentTime
    this.rain.gain.setTargetAtTime(env.rain * 0.32, t, 0.5)
    this.wind.gain.setTargetAtTime(0.012 + env.wind * 0.05 + env.mist * 0.01, t, 0.8)
    this.hum.gain.setTargetAtTime(around.traffic * 0.12, t, 0.6)

    const day = 1 - env.night
    const dry = 1 - Math.min(1, env.rain * 1.5)
    this.birdT -= dt
    if (this.birdT <= 0) {
      this.birdT = 0.6 + Math.random() * 3.5 / Math.max(0.15, day * dry)
      if (day * dry > 0.3) this.bird()
    }
    this.cricketT -= dt
    if (this.cricketT <= 0) {
      this.cricketT = 0.35 + Math.random() * 0.4
      if (env.night * dry > 0.4) this.cricket(env.night * dry)
    }
    this.hornT -= dt
    if (this.hornT <= 0) {
      this.hornT = 3 + Math.random() * 9
      if (around.traffic > 0.25) this.horn(around.traffic)
    }
    this.bowlT -= dt
    if (this.bowlT <= 0) {
      this.bowlT = 7 + Math.random() * 8
      if (around.monastery > 0.1) this.bowl(around.monastery)
    }
    this.duckT -= dt
    if (this.duckT <= 0) {
      this.duckT = 4 + Math.random() * 8
      if (around.lake > 0.3 && dry > 0.5) this.quack(around.lake)
    }
  }

  private env(g: GainNode, peak: number, attack: number, decay: number) {
    const t = this.ctx!.currentTime
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  }

  private tone(type: OscillatorType, freq: number, peak: number, attack: number, decay: number, glide?: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = freq
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, ctx.currentTime + attack + decay)
    o.connect(g)
    g.connect(this.master)
    this.env(g, peak, attack, decay)
    o.start()
    o.stop(ctx.currentTime + attack + decay + 0.05)
  }

  private burst(filter: BiquadFilterType, freq: number, peak: number, attack: number, decay: number, delay = 0) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = filter
    f.frequency.value = freq
    const g = ctx.createGain()
    src.connect(f)
    f.connect(g)
    g.connect(this.master)
    const t = ctx.currentTime + delay
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
    src.start(t, Math.random())
    src.stop(t + attack + decay + 0.1)
  }

  private bird() {
    const base = 2200 + Math.random() * 1800
    const n = 2 + Math.floor(Math.random() * 4)
    for (let i = 0; i < n; i++) {
      window.setTimeout(() => this.ctx && this.tone("sine", base * (1 + Math.random() * 0.2), 0.025, 0.01, 0.09, base * 1.35), i * 110)
    }
  }

  private cricket(amount: number) {
    for (let i = 0; i < 3; i++) window.setTimeout(() => this.ctx && this.tone("sine", 4400, 0.008 * amount, 0.005, 0.03), i * 45)
  }

  private horn(amount: number) {
    const f = 380 + Math.random() * 140
    this.tone("square", f, 0.018 * amount, 0.01, 0.22)
    if (Math.random() < 0.6) window.setTimeout(() => this.ctx && this.tone("square", f, 0.018 * amount, 0.01, 0.18), 280)
  }

  private bowl(amount: number) {
    for (const [f, a] of [[262, 1], [524, 0.5], [786, 0.25], [1312, 0.12]]) this.tone("sine", f, 0.03 * amount * a, 0.02, 5.5)
  }

  private quack(amount: number) {
    this.tone("sawtooth", 520, 0.012 * amount, 0.01, 0.12, 380)
  }

  thunder(delay: number, strength: number) {
    if (!this.ctx) return
    this.burst("lowpass", 160, 0.55 * strength, 0.06, 3.2, delay)
    this.burst("lowpass", 420, 0.2 * strength, 0.01, 0.8, delay)
  }

  step(wet: boolean, run: boolean) {
    if (!this.ctx || this.ctx.state !== "running") return
    this.burst(wet ? "bandpass" : "lowpass", wet ? 1800 : 900, run ? 0.07 : 0.045, 0.004, wet ? 0.12 : 0.07)
  }

  blip() {
    if (!this.ctx || this.ctx.state !== "running") return
    this.tone("square", 880, 0.02, 0.003, 0.05)
  }

  chime() {
    if (!this.ctx) return
    ;[523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => this.ctx && this.tone("triangle", f, 0.05, 0.01, 0.5), i * 120))
  }

  dispose() {
    void this.ctx?.close()
    this.ctx = null
  }
}
