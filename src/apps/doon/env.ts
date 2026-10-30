/**
 * Time of day and weather. The sun follows real solar geometry for
 * Dehradun (30.28° N, 78° E, clocks on IST), so a winter evening goes red
 * at the hour it really does, around 5:20 pm in December. Weather blends
 * between presets; in auto it changes on its own every few game hours.
 *
 * Pure: no three.js, no DOM. The renderer reads `Environment.state`.
 */

export type RGB = [number, number, number]

export type WeatherKind = "clear" | "cloudy" | "rain" | "mist"
export const WEATHER_KINDS: WeatherKind[] = ["clear", "cloudy", "rain", "mist"]

type Weather = { cloud: number; rain: number; mist: number; wind: number }

const PRESETS: Record<WeatherKind, Weather> = {
  clear: { cloud: 0.06, rain: 0, mist: 0, wind: 0.2 },
  cloudy: { cloud: 0.78, rain: 0, mist: 0.12, wind: 0.45 },
  rain: { cloud: 0.96, rain: 1, mist: 0.28, wind: 0.75 },
  mist: { cloud: 0.42, rain: 0, mist: 1, wind: 0.08 },
}

/** How often auto weather picks each kind (a Doon winter: mostly clear, foggy mornings, the odd shower). */
const AUTO_WEIGHTS: [WeatherKind, number][] = [
  ["clear", 0.42],
  ["cloudy", 0.24],
  ["rain", 0.2],
  ["mist", 0.14],
]

const LAT = 30.28
const LON = 78.0
/** IST's meridian. */
const ZONE_LON = 82.5
const RAD = Math.PI / 180

export type Sun = {
  /** Degrees above the horizon. */
  elevation: number
  /** Degrees clockwise from north. */
  azimuth: number
  /** Unit vector toward the sun: x east, y up, z south. */
  dir: [number, number, number]
}

/** Where the sun is at `minutes` past midnight (IST) on day `day` of the year. */
export function sunAt(minutes: number, day: number): Sun {
  const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (day + 10)) * RAD
  const b = ((2 * Math.PI) / 364) * (day - 81)
  const eot = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b)
  const solar = minutes + 4 * (LON - ZONE_LON) + eot
  const hour = (solar / 60 - 12) * 15 * RAD
  const lat = LAT * RAD
  const sinE = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hour)
  const e = Math.asin(Math.max(-1, Math.min(1, sinE)))
  const cosA = (Math.sin(decl) - Math.sin(e) * Math.sin(lat)) / (Math.cos(e) * Math.cos(lat))
  let a = Math.acos(Math.max(-1, Math.min(1, cosA)))
  if (Math.sin(hour) > 0) a = 2 * Math.PI - a
  return {
    elevation: e / RAD,
    azimuth: a / RAD,
    dir: [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)],
  }
}

// ── light by sun height ─────────────────────────────────────────────────────

type Look = {
  sun: RGB
  sunI: number
  sky: RGB
  ground: RGB
  hemiI: number
  top: RGB
  bottom: RGB
  tint: RGB
  sat: number
}

const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]

/** Keyed on the sun's elevation in degrees. Between keys the looks blend. */
const LOOKS: [number, Look][] = [
  [-18, { sun: hex(0x9fb4ff), sunI: 0.5, sky: hex(0x2c3c70), ground: hex(0x101020), hemiI: 0.62, top: hex(0x05071a), bottom: hex(0x141a3a), tint: hex(0xb4c2ff), sat: 0.82 }],
  [-9, { sun: hex(0x9aa4ff), sunI: 0.42, sky: hex(0x46508e), ground: hex(0x1a1830), hemiI: 0.66, top: hex(0x0d1236), bottom: hex(0x3a2f62), tint: hex(0xc8d0ff), sat: 0.9 }],
  [-3, { sun: hex(0xff8a7a), sunI: 0.32, sky: hex(0x7a6ab0), ground: hex(0x2a2030), hemiI: 0.78, top: hex(0x26306e), bottom: hex(0xff8a6a), tint: hex(0xeee4ff), sat: 1.04 }],
  [1, { sun: hex(0xff6236), sunI: 2.3, sky: hex(0x958ccc), ground: hex(0x5a4034), hemiI: 0.95, top: hex(0x3a4a96), bottom: hex(0xff6a3a), tint: hex(0xffeee6), sat: 1.12 }],
  [6, { sun: hex(0xffa060), sunI: 2.8, sky: hex(0xa4b4e0), ground: hex(0x6a5440), hemiI: 1.0, top: hex(0x5a7ac8), bottom: hex(0xffb070), tint: hex(0xfff4ea), sat: 1.1 }],
  [16, { sun: hex(0xffe0b4), sunI: 2.9, sky: hex(0xb0c8f0), ground: hex(0x5e5040), hemiI: 1.0, top: hex(0x6a9ae0), bottom: hex(0xe8d8c0), tint: hex(0xfff8f0), sat: 1.06 }],
  [40, { sun: hex(0xfff4e0), sunI: 3.1, sky: hex(0xb8d4ff), ground: hex(0x645a48), hemiI: 1.08, top: hex(0x5a96e8), bottom: hex(0xd8e8f8), tint: hex(0xffffff), sat: 1.04 }],
]

const mixN = (a: number, b: number, t: number) => a + (b - a) * t
const mix3 = (a: RGB, b: RGB, t: number): RGB => [mixN(a[0], b[0], t), mixN(a[1], b[1], t), mixN(a[2], b[2], t)]
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

function lookAt(elevation: number): Look {
  if (elevation <= LOOKS[0][0]) return LOOKS[0][1]
  for (let i = 1; i < LOOKS.length; i++) {
    const [e1, b] = LOOKS[i]
    if (elevation <= e1) {
      const [e0, a] = LOOKS[i - 1]
      const t = (elevation - e0) / (e1 - e0)
      return {
        sun: mix3(a.sun, b.sun, t),
        sunI: mixN(a.sunI, b.sunI, t),
        sky: mix3(a.sky, b.sky, t),
        ground: mix3(a.ground, b.ground, t),
        hemiI: mixN(a.hemiI, b.hemiI, t),
        top: mix3(a.top, b.top, t),
        bottom: mix3(a.bottom, b.bottom, t),
        tint: mix3(a.tint, b.tint, t),
        sat: mixN(a.sat, b.sat, t),
      }
    }
  }
  return LOOKS[LOOKS.length - 1][1]
}

const grey = (c: RGB, amount: number, level: number): RGB => {
  const l = (c[0] + c[1] + c[2]) / 3
  return mix3(c, [l * level, l * level, l * level], amount)
}

// ── the state the renderer reads ────────────────────────────────────────────

export type EnvState = {
  minutes: number
  sun: Sun
  /** The light that casts shadows: the sun by day, the moon by night. */
  keyDir: [number, number, number]
  keyColor: RGB
  keyIntensity: number
  hemiSky: RGB
  hemiGround: RGB
  hemiIntensity: number
  skyTop: RGB
  skyBottom: RGB
  tint: RGB
  saturation: number
  /** 0 by day, 1 once the street lights are fully on. */
  night: number
  cloud: number
  rain: number
  mist: number
  wind: number
  /** How wet the ground is: rises in rain, dries after. */
  wet: number
  /** Lightning, 0–1, decaying. */
  flash: number
}

export type EnvEvent = { type: "thunder"; delay: number; strength: number } | { type: "weather"; kind: WeatherKind }

/** December 21st, the heart of a Doon winter. */
export const WINTER_DAY = 355

export class Environment {
  /** Minutes past midnight, IST. */
  minutes: number
  day = WINTER_DAY
  /** Game minutes per real second. */
  speed = 1
  paused = false
  auto = true
  target: WeatherKind
  private weather: Weather
  private wet = 0
  private flash = 0
  private nextFlash = 6
  /** Game minutes until auto weather picks again. */
  private untilChange: number
  private rand: () => number
  readonly state: EnvState

  constructor(opts: { minutes?: number; weather?: WeatherKind; rand?: () => number } = {}) {
    this.minutes = opts.minutes ?? 16 * 60 + 45
    this.target = opts.weather ?? "clear"
    this.weather = { ...PRESETS[this.target] }
    this.rand = opts.rand ?? Math.random
    this.untilChange = 150 + this.rand() * 120
    this.state = {} as EnvState
    this.compute()
  }

  setWeather(kind: WeatherKind | "auto") {
    if (kind === "auto") {
      this.auto = true
      this.untilChange = 120 + this.rand() * 180
      return
    }
    this.auto = false
    this.target = kind
  }

  /** Jumps straight to the target weather (no blend). */
  settle() {
    this.weather = { ...PRESETS[this.target] }
    this.wet = this.target === "rain" ? 1 : 0
    this.compute()
  }

  setMinutes(m: number) {
    this.minutes = ((m % 1440) + 1440) % 1440
    this.compute()
  }

  update(dt: number, emit?: (e: EnvEvent) => void) {
    const gameMinutes = this.paused ? 0 : dt * this.speed
    this.minutes = (this.minutes + gameMinutes) % 1440

    if (this.auto && !this.paused) {
      this.untilChange -= gameMinutes
      if (this.untilChange <= 0) {
        this.target = this.pick()
        this.untilChange = 120 + this.rand() * 200
        emit?.({ type: "weather", kind: this.target })
      }
    }

    // Weather drifts toward its target over about 20 seconds.
    const to = PRESETS[this.target]
    const k = 1 - Math.exp(-dt / 7)
    for (const key of ["cloud", "rain", "mist", "wind"] as const) {
      this.weather[key] += (to[key] - this.weather[key]) * k
    }

    const rain = this.weather.rain
    this.wet = clamp01(this.wet + dt * (rain > 0.2 ? rain / 14 : -(1 - this.weather.cloud * 0.5) / 80))

    // Lightning in heavy rain; thunder follows by however far away it was.
    this.flash = Math.max(0, this.flash - dt * 3.2)
    if (rain > 0.75) {
      this.nextFlash -= dt
      if (this.nextFlash <= 0) {
        const strength = 0.55 + this.rand() * 0.45
        this.flash = strength
        this.nextFlash = 7 + this.rand() * 16
        emit?.({ type: "thunder", delay: 0.4 + this.rand() * 2.5, strength })
      }
    }
    this.compute()
  }

  private pick(): WeatherKind {
    const options = AUTO_WEIGHTS.filter(([k]) => k !== this.target)
    const total = options.reduce((s, [, w]) => s + w, 0)
    let r = this.rand() * total
    for (const [k, w] of options) {
      r -= w
      if (r <= 0) return k
    }
    return options[0][0]
  }

  private compute() {
    const sun = sunAt(this.minutes, this.day)
    const { cloud, rain, mist, wind } = this.weather
    const look = lookAt(sun.elevation)

    // Below the horizon the moon takes over: roughly opposite the sun.
    const moonUp = smooth(-2, -10, sun.elevation)
    const moon: [number, number, number] = norm3([-sun.dir[0] * 0.6 + 0.25, 0.75, -sun.dir[2] * 0.6 + 0.2])
    const sunDir: [number, number, number] = norm3([sun.dir[0], Math.max(sun.dir[1], 0.05), sun.dir[2]])
    const keyDir = norm3(lerp3(sunDir, moon, moonUp))

    const overcast = clamp01(cloud * 0.85 + rain * 0.15)
    const dim = 1 - overcast * 0.72
    const night = smooth(4, -6, sun.elevation)
    // Street lights come on early under dark cloud.
    const lamps = clamp01(night + overcast * 0.35 * smooth(18, 4, sun.elevation))

    const s = this.state
    s.minutes = this.minutes
    s.sun = sun
    s.keyDir = keyDir
    s.keyColor = grey(look.sun, overcast * 0.7, 1.1)
    s.keyIntensity = look.sunI * dim * (sun.elevation < -1 ? 1 : smooth(-1.5, 1, sun.elevation) * 0.85 + 0.15)
    s.hemiSky = grey(look.sky, overcast * 0.6, 0.95)
    s.hemiGround = look.ground
    s.hemiIntensity = look.hemiI * (1 + overcast * 0.35) * (1 - rain * 0.12)
    s.skyTop = grey(look.top, overcast * 0.65, 0.8)
    s.skyBottom = grey(look.bottom, overcast * 0.6 + mist * 0.2, 1)
    s.tint = mix3(look.tint, [0.86, 0.92, 1.0], overcast * 0.45)
    s.saturation = look.sat * (1 - overcast * 0.22 - mist * 0.12)
    s.night = lamps
    s.cloud = cloud
    s.rain = rain
    s.mist = mist
    s.wind = wind
    s.wet = this.wet
    s.flash = this.flash
  }
}

function norm3(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

const lerp3 = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  mixN(a[0], b[0], t),
  mixN(a[1], b[1], t),
  mixN(a[2], b[2], t),
]

/** "5:24 pm" */
export function clockLabel(minutes: number) {
  const m = Math.floor(minutes) % 1440
  const h = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2, "0")
  return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? "am" : "pm"}`
}
