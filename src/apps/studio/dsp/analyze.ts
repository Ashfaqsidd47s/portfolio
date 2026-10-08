import type { Cue } from "./captions"
import { fft, hann } from "./fft"

/**
 * Turns a recording into the numbers the Studio works with. Everything runs
 * on 16 kHz mono with one frame every 10 ms:
 * - loudness (dB) per frame,
 * - pitch (f0) per frame with a confidence, via YIN on an 8 kHz copy,
 * - a 0–4 kHz spectrogram (128 bins, one byte each) for display,
 * - speech / speech-over-music / music / silence regions, helped by captions.
 */

export const SR = 16_000
export const HOP = 160 // 10 ms
export const BINS = 128 // 0–4 kHz, 31.25 Hz each
const SPEC_N = 512

export type Analysis = {
  duration: number
  frames: number
  db: Float32Array
  f0: Float32Array
  conf: Float32Array
  spec: Uint8Array
  /** Loudness under which a frame counts as quiet (10th percentile). */
  floor: number
}

export type RegionKind = "speech" | "speech-music" | "music" | "silence"
export type Region = { start: number; end: number; kind: RegionKind }

export const frameTime = (i: number) => (i * HOP) / SR

/** Halve the sample rate with a short windowed-sinc low-pass first. */
export function decimate2(x: Float32Array): Float32Array {
  const taps = [-0.0067, 0, 0.0473, 0, -0.1418, 0, 0.6012, 1, 0.6012, 0, -0.1418, 0, 0.0473, 0, -0.0067]
  const norm = taps.reduce((a, b) => a + b, 0)
  const h = taps.map((t) => t / norm)
  const out = new Float32Array(Math.floor(x.length / 2))
  const half = (h.length - 1) / 2
  for (let i = 0; i < out.length; i++) {
    let acc = 0
    const c = i * 2
    for (let k = 0; k < h.length; k++) {
      const j = c + k - half
      if (j >= 0 && j < x.length) acc += x[j] * h[k]
    }
    out[i] = acc
  }
  return out
}

/**
 * YIN pitch for one frame (de Cheveigné & Kawahara, 2002): the cumulative
 * mean normalised difference, first dip under `threshold`, refined by a
 * parabola. Returns [Hz, confidence 0–1]; Hz is 0 when unvoiced.
 */
export function yin(x: Float32Array, start: number, sr: number, { minHz = 70, maxHz = 500, window = 240, threshold = 0.15 } = {}): [number, number] {
  const tauMin = Math.floor(sr / maxHz)
  const tauMax = Math.min(Math.ceil(sr / minHz), x.length - start - window - 1)
  if (tauMax <= tauMin + 2) return [0, 0]
  const d = new Float32Array(tauMax + 1)
  for (let tau = 1; tau <= tauMax; tau++) {
    let s = 0
    for (let j = 0; j < window; j++) {
      const diff = x[start + j] - x[start + j + tau]
      s += diff * diff
    }
    d[tau] = s
  }
  // Cumulative mean normalisation.
  let running = 0
  d[0] = 1
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau]
    d[tau] = running > 0 ? (d[tau] * tau) / running : 1
  }
  let tau = -1
  for (let t = tauMin; t <= tauMax; t++) {
    if (d[t] < threshold) {
      while (t + 1 <= tauMax && d[t + 1] < d[t]) t++
      tau = t
      break
    }
  }
  if (tau === -1) {
    // No dip under the threshold: take the global minimum, but call it unvoiced if it is weak.
    let best = tauMin
    for (let t = tauMin; t <= tauMax; t++) if (d[t] < d[best]) best = t
    if (d[best] > 0.35) return [0, Math.max(0, 1 - d[best])]
    tau = best
  }
  const a = d[tau - 1] ?? d[tau]
  const b = d[tau]
  const c = d[tau + 1] ?? d[tau]
  const shift = (a - c) / (2 * (a - 2 * b + c) || 1)
  const refined = tau + (Math.abs(shift) < 1 ? shift : 0)
  return [sr / refined, Math.max(0, Math.min(1, 1 - b))]
}

export function analyze(x: Float32Array, onProgress?: (p: number) => void): Analysis {
  const frames = Math.max(0, Math.floor((x.length - SPEC_N) / HOP))
  const db = new Float32Array(frames)
  const f0 = new Float32Array(frames)
  const conf = new Float32Array(frames)
  const spec = new Uint8Array(frames * BINS)
  const x8 = decimate2(x)
  const win = hann(SPEC_N)
  const re = new Float32Array(SPEC_N)
  const im = new Float32Array(SPEC_N)

  for (let i = 0; i < frames; i++) {
    const s = i * HOP
    // Loudness over the central 25 ms.
    let e = 0
    for (let j = 0; j < 400; j++) e += x[s + 56 + j] ** 2
    db[i] = 10 * Math.log10(e / 400 + 1e-12)

    // Spectrogram column.
    for (let j = 0; j < SPEC_N; j++) {
      re[j] = x[s + j] * win[j]
      im[j] = 0
    }
    fft(re, im)
    for (let k = 0; k < BINS; k++) {
      const mag = Math.hypot(re[k * 2], im[k * 2]) + Math.hypot(re[k * 2 + 1], im[k * 2 + 1])
      const level = 20 * Math.log10(mag + 1e-9) // roughly -60…+40
      spec[i * BINS + k] = Math.max(0, Math.min(255, Math.round((level + 50) * 2.8)))
    }

    if (i % 2000 === 0) onProgress?.(i / frames)
  }

  // The noise floor, ignoring digital silence (gaps of exact zeros).
  const sorted = Float32Array.from(db.filter((v) => v > -90)).sort()
  const floor = sorted[Math.floor(sorted.length * 0.1)] ?? -60

  // Pitch only where there's something to hear: saves time on silence.
  const audible = Math.min(floor + 10, -45)
  for (let i = 0; i < frames; i++) {
    if (db[i] < audible) continue
    const [hz, c] = yin(x8, Math.floor((i * HOP) / 2) + 20, SR / 2)
    f0[i] = hz
    conf[i] = c
  }
  smoothPitch(f0, conf)
  onProgress?.(1)
  return { duration: x.length / SR, frames, db, f0, conf, spec, floor }
}

/**
 * Clean up the pitch track: a 5-frame median inside each voiced run, then
 * drop frames more than half an octave off that median (octave errors),
 * then drop voiced blips shorter than 40 ms.
 */
function smoothPitch(f0: Float32Array, conf: Float32Array) {
  const n = f0.length
  const med = new Float32Array(n)
  const win: number[] = []
  for (let i = 0; i < n; i++) {
    if (!f0[i]) continue
    win.length = 0
    for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) if (f0[j]) win.push(f0[j])
    win.sort((a, b) => a - b)
    med[i] = win[win.length >> 1]
  }
  for (let i = 0; i < n; i++) {
    if (!f0[i]) continue
    if (Math.abs(Math.log2(f0[i] / med[i])) > 0.5) {
      f0[i] = 0
      conf[i] = 0
    } else f0[i] = med[i]
  }
  let run = 0
  for (let i = 0; i <= n; i++) {
    if (i < n && f0[i] > 0 && conf[i] > 0.5) run++
    else {
      if (run > 0 && run < 4) for (let j = i - run; j < i; j++) f0[j] = 0
      run = 0
    }
  }
}

/**
 * Label each second as speech, speech over music, music or silence, then
 * merge into regions. Clean speech has gaps between words that fall to the
 * noise floor; background music fills them in. Captions, when loaded,
 * say whether anyone is talking at all: text means yes, [Music] or no cue
 * means no.
 */
export function classifyRegions(a: Analysis, cues: Cue[] = []): Region[] {
  const perSec = 100
  const seconds = Math.floor(a.frames / perSec)
  const labels: RegionKind[] = []
  for (let s = 0; s < seconds; s++) {
    const from = Math.max(0, (s - 0.5) * perSec)
    const to = Math.min(a.frames, (s + 1.5) * perSec)
    const levels = Array.from(a.db.subarray(from, to)).sort((p, q) => p - q)
    const median = levels[Math.floor(levels.length / 2)]
    let quiet = 0
    let voiced = 0
    for (let i = from; i < to; i++) {
      if (a.db[i] < a.floor + 10) quiet++
      if (a.f0[i] > 0 && a.conf[i] > 0.6) voiced++
    }
    const n = to - from
    const t = s + 0.5
    const cue = cues.find((c) => c.start <= t + 0.5 && c.end > t - 0.5)
    // Music is pitched too, so with captions loaded they decide whether
    // anyone is talking; without them, a voiced share does.
    const talking = cues.length > 0 ? Boolean(cue && !cue.sound) : voiced / n > 0.25
    let kind: RegionKind
    if (cue?.sound) kind = "music"
    else if (median < a.floor + 6) kind = "silence"
    else if (talking) kind = quiet / n >= 0.08 ? "speech" : "speech-music"
    else kind = median > a.floor + 12 ? "music" : "silence"
    labels.push(kind)
  }

  let regions: Region[] = []
  for (let s = 0; s < labels.length; s++) {
    const last = regions[regions.length - 1]
    if (last && last.kind === labels[s]) last.end = s + 1
    else regions.push({ start: s, end: s + 1, kind: labels[s] })
  }
  // Fold blips shorter than 2 s into the region before them.
  for (let pass = 0; pass < 2; pass++) {
    const merged: Region[] = []
    for (const r of regions) {
      const last = merged[merged.length - 1]
      if (last && (r.end - r.start < 2 || last.kind === r.kind)) last.end = r.end
      else merged.push({ ...r })
    }
    regions = merged
  }
  if (regions.length) regions[regions.length - 1].end = a.duration
  return regions
}

export type VoiceStats = {
  cleanSpeech: number
  speechTotal: number
  medianHz: number
  lowHz: number
  highHz: number
  /** Music that opens the file and where talking resumes after it, if any. */
  intro?: { start: number; end: number }
}

const percentile = (xs: number[], p: number) => (xs.length ? xs[Math.min(xs.length - 1, Math.floor(xs.length * p))] : 0)

export function voiceStats(a: Analysis, regions: Region[]): VoiceStats {
  const pitches: number[] = []
  for (const r of regions) {
    if (r.kind !== "speech") continue
    for (let i = Math.floor(r.start * 100); i < Math.min(a.frames, r.end * 100); i++) if (a.f0[i] > 0 && a.conf[i] > 0.7) pitches.push(a.f0[i])
  }
  pitches.sort((p, q) => p - q)
  const len = (k: RegionKind[]) => regions.filter((r) => k.includes(r.kind)).reduce((s, r) => s + r.end - r.start, 0)
  const introMusic = regions.find((r) => r.kind === "music" && r.start < 60 && r.end - r.start >= 5)
  return {
    cleanSpeech: len(["speech"]),
    speechTotal: len(["speech", "speech-music"]),
    medianHz: percentile(pitches, 0.5),
    lowHz: percentile(pitches, 0.05),
    highHz: percentile(pitches, 0.95),
    intro: introMusic && { start: introMusic.start, end: introMusic.end },
  }
}

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
export function noteName(hz: number) {
  if (!hz) return "—"
  const midi = Math.round(69 + 12 * Math.log2(hz / 440))
  return `${NOTES[midi % 12]}${Math.floor(midi / 12) - 1}`
}
