import { HOP, SR } from "./analyze"
import { fft, hann } from "./fft"

/**
 * "Rebuild from metadata": throw the audio away and make it again from the
 * numbers alone. Per 10 ms frame we keep only
 * - the pitch (f0) and how voiced the frame is, and
 * - a smooth spectral envelope (the shape of the voice: 40 cepstral numbers).
 * Voiced sound is a bank of harmonics at multiples of f0, each as loud as
 * the envelope says; unvoiced sound is noise shaped by the same envelope.
 * It's a simple vocoder: robotic, but the voice is recognisably there.
 */

const N = 512
const KEEP = 40 // cepstral coefficients kept: the envelope's level of detail

export type VoiceFrames = {
  f0: Float32Array
  voicing: Float32Array
  /** Linear magnitude envelope, N/2 + 1 values per frame. */
  env: Float32Array
}

/** Extract the per-frame metadata for samples [from, to). */
export function extractFrames(x: Float32Array, f0: Float32Array, conf: Float32Array, fromFrame: number, toFrame: number): VoiceFrames {
  const count = Math.max(0, toFrame - fromFrame)
  const half = N / 2 + 1
  const env = new Float32Array(count * half)
  const win = hann(N)
  const re = new Float32Array(N)
  const im = new Float32Array(N)
  for (let f = 0; f < count; f++) {
    const s = (fromFrame + f) * HOP
    for (let j = 0; j < N; j++) {
      re[j] = (x[s + j] ?? 0) * win[j]
      im[j] = 0
    }
    fft(re, im)
    // Cepstral smoothing: log spectrum → keep the slow part → back.
    for (let k = 0; k < N; k++) {
      re[k] = Math.log(Math.hypot(re[k], im[k]) + 1e-6)
      im[k] = 0
    }
    fft(re, im, true)
    for (let k = KEEP; k < N - KEEP; k++) re[k] = im[k] = 0
    fft(re, im)
    for (let k = 0; k < half; k++) env[f * half + k] = Math.exp(re[k])
  }
  const voicing = new Float32Array(count)
  const pitch = new Float32Array(count)
  for (let f = 0; f < count; f++) {
    pitch[f] = f0[fromFrame + f] ?? 0
    voicing[f] = pitch[f] > 0 ? Math.min(1, Math.max(0, ((conf[fromFrame + f] ?? 0) - 0.5) * 2.5)) : 0
  }
  return { f0: pitch, voicing, env }
}

/** Make audio (16 kHz) from frame metadata alone. */
export function synthesize({ f0, voicing, env }: VoiceFrames, seed = 1): Float32Array {
  const frames = f0.length
  const half = N / 2 + 1
  const out = new Float32Array(frames * HOP + N)
  const binHz = SR / N
  const ampAt = (f: number, hz: number) => {
    const k = hz / binHz
    const i = Math.floor(k)
    if (i >= half - 1) return 0
    const t = k - i
    return env[f * half + i] * (1 - t) + env[f * half + i + 1] * t
  }

  // Harmonics, with pitch and amplitudes interpolated sample by sample.
  const MAX_H = 60
  const phase = new Float64Array(MAX_H)
  for (let f = 0; f < frames - 1; f++) {
    const v0 = voicing[f]
    const v1 = voicing[f + 1]
    if (v0 === 0 && v1 === 0) continue
    const p0 = f0[f] || f0[f + 1]
    const p1 = f0[f + 1] || f0[f]
    const harmonics = Math.min(MAX_H, Math.floor(3800 / Math.max(p0, p1)))
    const a0 = new Float32Array(harmonics)
    const a1 = new Float32Array(harmonics)
    for (let h = 0; h < harmonics; h++) {
      a0[h] = ampAt(f, p0 * (h + 1)) * v0
      a1[h] = ampAt(f + 1, p1 * (h + 1)) * v1
    }
    for (let j = 0; j < HOP; j++) {
      const t = j / HOP
      const hz = p0 + (p1 - p0) * t
      let s = 0
      for (let h = 0; h < harmonics; h++) {
        phase[h] += (2 * Math.PI * hz * (h + 1)) / SR
        s += (a0[h] + (a1[h] - a0[h]) * t) * Math.sin(phase[h])
      }
      out[f * HOP + j + N / 2] += s
    }
    for (let h = 0; h < MAX_H; h++) phase[h] %= 2 * Math.PI
  }

  // Noise for the unvoiced part, shaped by the envelope (overlap-add).
  let rand = seed >>> 0
  const noise = () => ((rand = (rand * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1
  const W = HOP * 2
  const win = hann(W)
  const re = new Float32Array(N)
  const im = new Float32Array(N)
  for (let f = 0; f < frames; f++) {
    const amount = 1 - voicing[f] * 0.85
    for (let k = 0; k < half; k++) {
      const mag = env[f * half + k] * amount
      const ph = noise() * Math.PI
      re[k] = mag * Math.cos(ph)
      im[k] = mag * Math.sin(ph)
      if (k > 0 && k < N / 2) {
        re[N - k] = re[k]
        im[N - k] = -im[k]
      }
    }
    fft(re, im, true)
    for (let j = 0; j < W; j++) out[f * HOP + j + N / 2 - HOP] += re[j] * win[j] * 0.9
  }
  return out
}

/** Scale `y` to the loudness of `x`. */
export function matchLoudness(y: Float32Array, x: Float32Array) {
  const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / Math.max(1, a.length))
  const gain = rms(x) / (rms(y) || 1)
  for (let i = 0; i < y.length; i++) y[i] = Math.max(-1, Math.min(1, y[i] * gain))
  return y
}
