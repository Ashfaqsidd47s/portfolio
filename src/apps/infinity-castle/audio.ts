/**
 * The castle's sound, synthesised in Web Audio: no samples.
 *
 * Nakime's biwa is a Karplus–Strong string struck hard with a bachi
 * (a burst of bright noise), with a buzzing, slightly bent attack like the
 * instrument's sawari. Each strum is the "be-BENG": a grace note, then the
 * main note, then its octave. The castle answers with a long echo.
 * Underneath: a low drone, sliding fusuma, rumbling rooms, wooden steps,
 * wind when falling, and her idle melody, positioned where she sits.
 * Over it all, the chase score (score.ts), on its own bus so it can be
 * turned off separately — or, if the site ships one at TRACK, a recording.
 */

import { Score, type ScoreMode } from "./score"

type Vec3 = [number, number, number]

const SR = 44100

/** An optional recorded score; if it's absent the synthesised one plays. */
const TRACK = `${import.meta.env.BASE_URL}audio/infinity-castle.mp3`
const TRACK_LEVEL: Record<ScoreMode, number> = { off: 0, wait: 0.5, chase: 1, finale: 0 }
/** The score sits under the castle's own sounds. */
const MUSIC_LEVEL = 0.4

function pluck(freq: number, seconds: number, opts: { buzz: number; bright: number; decay: number }) {
  const n = Math.floor(SR * seconds)
  const out = new Float32Array(n)
  const period = Math.max(2, Math.round(SR / freq))
  const line = new Float32Array(period)
  // A hard bachi strike: bright noise, shaped.
  for (let i = 0; i < period; i++) {
    const t = i / period
    line[i] = (Math.random() * 2 - 1) * (1 - t * (1 - opts.bright)) * Math.sin(Math.PI * t) ** 0.3
  }
  let idx = 0
  let prev = 0
  for (let i = 0; i < n; i++) {
    const cur = line[idx]
    const next = line[(idx + 1) % period]
    // Averaging filter with loss: the string's decay.
    let v = (cur + next) * 0.5 * opts.decay
    // Sawari: the string buzzing against the fret, strongest early on.
    const env = Math.exp(-i / (SR * 0.35))
    v += Math.sign(v) * Math.min(Math.abs(v), 0.25) * opts.buzz * env * 0.12
    line[idx] = v
    out[i] = cur * 0.7 + prev * 0.3
    prev = cur
    idx = (idx + 1) % period
  }
  // Attack transient: the plectrum's slap on the body.
  for (let i = 0; i < Math.min(n, 900); i++) out[i] += (Math.random() * 2 - 1) * (1 - i / 900) ** 3 * 0.6
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]))
  for (let i = 0; i < n; i++) out[i] /= peak || 1
  return out
}

/** A hall-ish impulse response: decaying noise, darker as it fades. */
function impulse(ctx: AudioContext, seconds: number) {
  const n = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, n, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    let lp = 0
    for (let i = 0; i < n; i++) {
      const t = i / n
      const k = 0.15 + 0.8 * t
      lp = lp * k + (Math.random() * 2 - 1) * (1 - k)
      d[i] = lp * (1 - t) ** 2.4 * 3
    }
  }
  return buf
}

export class CastleAudio {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private verb!: ConvolverNode
  private verbSend!: GainNode
  private wind!: GainNode
  private windFilter!: BiquadFilterNode
  private noise!: AudioBuffer
  private notes = new Map<number, AudioBuffer>()
  private nakime!: PannerNode
  private melodyTimer = 0
  private muted = false
  private musicBus!: GainNode
  private musicOn = true
  private score: Score | null = null
  private scoreMode: ScoreMode = "off"
  private track: HTMLAudioElement | null = null
  private trackGain: GainNode | null = null

  get ready() {
    return this.ctx !== null
  }

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
    this.master.gain.value = this.muted ? 0 : 0.8
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    this.master.connect(comp).connect(ctx.destination)
    this.verb = ctx.createConvolver()
    this.verb.buffer = impulse(ctx, 3.6)
    this.verbSend = ctx.createGain()
    this.verbSend.gain.value = 0.55
    this.verbSend.connect(this.verb).connect(this.master)

    const n = ctx.sampleRate * 2
    this.noise = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1

    this.drone()
    this.windLoop()
    this.nakime = ctx.createPanner()
    this.nakime.panningModel = "HRTF"
    this.nakime.distanceModel = "inverse"
    this.nakime.refDistance = 8
    this.nakime.rolloffFactor = 1.1
    this.nakime.connect(this.master)
    this.nakime.connect(this.verbSend)

    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = this.musicOn ? MUSIC_LEVEL : 0
    this.musicBus.connect(this.master)
    const musicVerb = ctx.createGain()
    musicVerb.gain.value = 0.5
    musicVerb.connect(this.verbSend)
    this.score = new Score({ ctx, out: this.musicBus, verb: musicVerb, noise: this.noise, biwa: (f) => this.note(f) })
    this.score.setMode(this.scoreMode)
    this.loadTrack(ctx)
  }

  /** Swaps the synthesised score for a recording, if the site has one. */
  private loadTrack(ctx: AudioContext) {
    const el = new Audio()
    el.loop = true
    el.preload = "auto"
    el.addEventListener(
      "canplaythrough",
      () => {
        if (this.ctx !== ctx) return
        this.trackGain = ctx.createGain()
        this.trackGain.gain.value = 0
        ctx.createMediaElementSource(el).connect(this.trackGain).connect(this.musicBus)
        this.track = el
        this.score?.setMode("off")
        this.setMusicMode(this.scoreMode)
      },
      { once: true }
    )
    el.src = TRACK
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05)
  }

  setMusic(on: boolean) {
    this.musicOn = on
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? MUSIC_LEVEL : 0, this.ctx.currentTime, 0.1)
  }

  /** Where the score is: waiting, chasing, or rising with the castle. */
  setMusicMode(mode: ScoreMode) {
    this.scoreMode = mode
    if (!this.ctx) return
    if (!this.track || !this.trackGain) {
      this.score?.setMode(mode)
      return
    }
    const level = TRACK_LEVEL[mode]
    this.trackGain.gain.setTargetAtTime(level, this.ctx.currentTime, mode === "finale" ? 2 : 0.6)
    if (level > 0 && this.track.paused) void this.track.play().catch(() => {})
  }

  /** 0–1: how hard the chase is going. */
  setMusicIntensity(level: number) {
    this.score?.setIntensity(level)
  }

  /** The drums answer a strum. */
  musicHit() {
    if (!this.track) this.score?.hit()
  }

  tickMusic(dt: number) {
    if (!this.ctx) return
    if (!this.track) this.score?.tick(dt)
    else if (TRACK_LEVEL[this.scoreMode] === 0 && !this.track.paused && this.trackGain!.gain.value < 0.01) this.track.pause()
  }

  suspend() {
    void this.ctx?.suspend()
    this.track?.pause()
  }

  resume() {
    void this.ctx?.resume()
    if (this.track && TRACK_LEVEL[this.scoreMode] > 0) void this.track.play().catch(() => {})
  }

  private note(freq: number) {
    const key = Math.round(freq)
    let buf = this.notes.get(key)
    if (!buf && this.ctx) {
      const data = pluck(freq, 2.6, { buzz: 1, bright: 0.85, decay: 0.9965 })
      buf = this.ctx.createBuffer(1, data.length, SR)
      buf.copyToChannel(data, 0)
      this.notes.set(key, buf)
    }
    return buf
  }

  private play(buf: AudioBuffer, at: number, gain: number, dest: AudioNode = this.master, bend = 0) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = buf
    // A bachi strike bends the note a little sharp, then it settles.
    if (bend) {
      src.playbackRate.setValueAtTime(1 + bend, at)
      src.playbackRate.exponentialRampToValueAtTime(1, at + 0.12)
    }
    const g = ctx.createGain()
    g.gain.value = gain
    src.connect(g)
    g.connect(dest)
    if (dest === this.master) g.connect(this.verbSend)
    src.start(at)
  }

  /** Be-BENG. Heavier strums add the low string. */
  strum(heavy = false) {
    if (!this.ctx) return
    const t = this.ctx.currentTime + 0.01
    const base = heavy ? 98 : 110 + Math.floor(Math.random() * 3) * 7
    this.play(this.note(base * 1.5)!, t, 0.5, this.master, 0.02)
    this.play(this.note(base)!, t + 0.11, 0.95, this.master, 0.035)
    this.play(this.note(base * 2)!, t + 0.115, 0.45)
    if (heavy) this.play(this.note(base / 2)!, t + 0.12, 0.8)
  }

  /** Fusuma banging shut, a few at once. */
  slam(count = 3) {
    if (!this.ctx) return
    const ctx = this.ctx
    for (let i = 0; i < count; i++) {
      const at = ctx.currentTime + 0.05 + i * (0.04 + Math.random() * 0.06)
      this.burst(at, 0.09, 1400 + Math.random() * 600, 0.5, "bandpass")
      this.thump(at, 90, 0.35)
    }
  }

  /** Low grinding as rooms slide. */
  rumble(seconds: number) {
    if (!this.ctx) return
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    const f = ctx.createBiquadFilter()
    f.type = "lowpass"
    f.frequency.value = 140
    const g = ctx.createGain()
    const t = ctx.currentTime
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.5, t + 0.8)
    g.gain.linearRampToValueAtTime(0.5, t + seconds - 0.6)
    g.gain.linearRampToValueAtTime(0, t + seconds)
    src.connect(f).connect(g).connect(this.master)
    src.start(t)
    src.stop(t + seconds + 0.1)
  }

  step(onWood: boolean) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.thump(t, onWood ? 150 + Math.random() * 30 : 110, onWood ? 0.12 : 0.07)
    this.burst(t, 0.03, onWood ? 2400 : 900, onWood ? 0.05 : 0.08, "bandpass")
  }

  land(strength: number) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.thump(t, 70, Math.min(0.9, 0.2 + strength * 0.03))
    this.burst(t, 0.12, 800, Math.min(0.5, strength * 0.02), "lowpass")
  }

  /** Wind rises with falling speed (0–1). */
  setWind(level: number) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.wind.gain.setTargetAtTime(level * level * 0.5, t, 0.15)
    this.windFilter.frequency.setTargetAtTime(400 + level * 1600, t, 0.2)
  }

  listen(pos: Vec3, forward: Vec3, up: Vec3) {
    if (!this.ctx) return
    const l = this.ctx.listener
    const t = this.ctx.currentTime
    if (l.positionX) {
      l.positionX.setValueAtTime(pos[0], t)
      l.positionY.setValueAtTime(pos[1], t)
      l.positionZ.setValueAtTime(pos[2], t)
      l.forwardX.setValueAtTime(forward[0], t)
      l.forwardY.setValueAtTime(forward[1], t)
      l.forwardZ.setValueAtTime(forward[2], t)
      l.upX.setValueAtTime(up[0], t)
      l.upY.setValueAtTime(up[1], t)
      l.upZ.setValueAtTime(up[2], t)
    } else {
      l.setPosition(...pos)
      l.setOrientation(...forward, ...up)
    }
  }

  /** Nakime idly picks at her biwa where she sits; louder as you near her. */
  tickMelody(dt: number, nakimePos: Vec3) {
    if (!this.ctx) return
    this.melodyTimer -= dt
    if (this.melodyTimer > 0) return
    this.melodyTimer = 2.2 + Math.random() * 3
    const t = this.ctx.currentTime
    const p = this.nakime
    if (p.positionX) {
      p.positionX.setValueAtTime(nakimePos[0], t)
      p.positionY.setValueAtTime(nakimePos[1], t)
      p.positionZ.setValueAtTime(nakimePos[2], t)
    } else {
      p.setPosition(...nakimePos)
    }
    // Miyako-bushi (in) scale on A: A B♭ D E F.
    const scale = [220, 233.1, 293.7, 329.6, 349.2, 440]
    const count = 1 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      const f = scale[Math.floor(Math.random() * scale.length)]
      this.play(this.note(f)!, t + i * 0.32, 0.6, p, 0.015)
    }
  }

  private thump(at: number, freq: number, gain: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(freq * 1.6, at)
    o.frequency.exponentialRampToValueAtTime(freq, at + 0.05)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, at)
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.18)
    o.connect(g).connect(this.master)
    o.start(at)
    o.stop(at + 0.2)
  }

  private burst(at: number, len: number, freq: number, gain: number, type: BiquadFilterType) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = 1.2
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, at)
    g.gain.exponentialRampToValueAtTime(0.001, at + len)
    src.connect(f).connect(g)
    g.connect(this.master)
    g.connect(this.verbSend)
    src.start(at, Math.random())
    src.stop(at + len + 0.02)
  }

  private drone() {
    const ctx = this.ctx!
    const g = ctx.createGain()
    g.gain.value = 0.06
    const f = ctx.createBiquadFilter()
    f.type = "lowpass"
    f.frequency.value = 260
    f.connect(g).connect(this.master)
    for (const [freq, type] of [
      [55, "sawtooth"],
      [55.4, "sawtooth"],
      [82.4, "triangle"],
    ] as const) {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.value = freq
      o.connect(f)
      o.start()
    }
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const depth = ctx.createGain()
    depth.gain.value = 120
    lfo.connect(depth).connect(f.frequency)
    lfo.start()
  }

  private windLoop() {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    src.loop = true
    this.windFilter = ctx.createBiquadFilter()
    this.windFilter.type = "bandpass"
    this.windFilter.frequency.value = 500
    this.windFilter.Q.value = 0.7
    this.wind = ctx.createGain()
    this.wind.gain.value = 0
    src.connect(this.windFilter).connect(this.wind).connect(this.master)
    src.start()
  }

  dispose() {
    this.track?.pause()
    this.track?.removeAttribute("src")
    this.track = null
    void this.ctx?.close()
    this.ctx = null
  }
}
