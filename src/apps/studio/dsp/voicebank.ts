import type { Analysis, Region } from "./analyze"
import type { Cue } from "./captions"
import { isDevanagari, syllables, words } from "./hindi"

/**
 * Cut a recording into labelled words and syllables, with no speech model.
 * Captions say which words are in each line; the audio says where the
 * syllables are (loudness peaks in voiced sound). Words are laid onto the
 * peaks in order, by how many syllables each has, and cut at the quietest
 * point between them. It's approximate — the Studio lets you fix bad cuts.
 */

export type Unit = {
  id: number
  text: string
  /** Seconds into the 16 kHz recording. */
  start: number
  end: number
  /** 0–1: how much to trust this cut (clean audio, syllable counts agree). */
  score: number
}

export type Voicebank = {
  version: 1
  source: string
  words: Unit[]
  syllables: Unit[]
  /** Typical pitch of the voice, Hz. */
  pitch: number
}

const FPS = 100

/** Loudness smoothed over ±`r` frames. */
function smooth(db: Float32Array, from: number, to: number, r = 3) {
  const out = new Float32Array(to - from)
  for (let i = from; i < to; i++) {
    let s = 0
    let n = 0
    for (let j = Math.max(from, i - r); j <= Math.min(to - 1, i + r); j++) {
      s += db[j]
      n++
    }
    out[i - from] = s / n
  }
  return out
}

/** Syllable nuclei: loudness peaks at least 3 dB above the dips around them, 80 ms apart. */
export function findNuclei(env: Float32Array, threshold: number): number[] {
  const peaks: number[] = []
  for (let i = 1; i < env.length - 1; i++) {
    if (env[i] < threshold || env[i] < env[i - 1] || env[i] < env[i + 1]) continue
    let left = env[i]
    for (let j = i; j >= Math.max(0, i - 15); j--) left = Math.min(left, env[j])
    let right = env[i]
    for (let j = i; j <= Math.min(env.length - 1, i + 15); j++) right = Math.min(right, env[j])
    if (env[i] - Math.max(left, right) < 3) continue
    const prev = peaks[peaks.length - 1]
    if (prev !== undefined && i - prev < 8) {
      if (env[i] > env[prev]) peaks[peaks.length - 1] = i
      continue
    }
    peaks.push(i)
  }
  return peaks
}

/** Quietest frame strictly between frames a and b. */
function dip(env: Float32Array, a: number, b: number) {
  let best = Math.round((a + b) / 2)
  for (let i = a + 1; i < b; i++) if (env[i] < env[best]) best = i
  return best
}

export function buildVoicebank(a: Analysis, regions: Region[], cues: Cue[], source = "recording"): Voicebank {
  const wordUnits: Unit[] = []
  const syllableUnits: Unit[] = []
  let id = 0
  const cleanShare = (from: number, to: number) => {
    let clean = 0
    for (const r of regions) if (r.kind === "speech") clean += Math.max(0, Math.min(to, r.end) - Math.max(from, r.start))
    return clean / Math.max(0.01, to - from)
  }
  const pitches: number[] = []

  const spoken = cues.filter((c) => !c.sound)
  spoken.forEach((cue, ci) => {
    const tokens = words(cue.text).filter(isDevanagari)
    if (tokens.length === 0) return
    const sylls = tokens.map((t) => syllables(t))
    const total = sylls.reduce((n, s) => n + Math.max(1, s.length), 0)

    // A little slack either side, without running into the neighbouring lines.
    const prevEnd = spoken[ci - 1]?.end ?? 0
    const nextStart = spoken[ci + 1]?.start ?? a.duration
    const from = Math.max(0, Math.floor(Math.max(cue.start - 0.15, prevEnd) * FPS))
    const to = Math.min(a.frames, Math.ceil(Math.min(cue.end + 0.15, nextStart) * FPS))
    if (to - from < 20) return
    const env = smooth(a.db, from, to)
    const threshold = a.floor + 12
    let onset = env.findIndex((v) => v > threshold)
    let offset = env.length - 1
    while (offset > 0 && env[offset] <= threshold) offset--
    if (onset < 0 || offset <= onset) return
    onset = Math.max(0, onset - 3)
    offset = Math.min(env.length - 1, offset + 4)

    const nuclei = findNuclei(env, threshold)
    if (nuclei.length === 0) return
    const agreement = 1 - Math.abs(nuclei.length - total) / Math.max(nuclei.length, total)
    const quality = cleanShare(cue.start, cue.end)
    const score = Math.max(0, Math.min(1, agreement * 0.6 + quality * 0.4))

    // Syllable k sits on nucleus nucleusOf(k); words are cut between their outer syllables.
    const nucleusOf = (k: number) => nuclei[Math.min(nuclei.length - 1, Math.floor(((k + 0.5) * nuclei.length) / total))]
    const cut = (k: number) => {
      // Boundary before syllable k.
      if (k <= 0) return onset
      if (k >= total) return offset
      const left = nucleusOf(k - 1)
      const right = nucleusOf(k)
      if (right > left) return dip(env, left, right)
      // Two syllables landed on one peak (fewer peaks than syllables): split time evenly instead.
      return Math.round(onset + ((offset - onset) * k) / total)
    }
    const t = (frame: number) => (from + frame) / FPS

    let k = 0
    tokens.forEach((token, w) => {
      const parts = sylls[w].length ? sylls[w] : [token]
      const startFrame = cut(k)
      const endFrame = cut(k + parts.length)
      if (endFrame - startFrame >= 6) {
        wordUnits.push({ id: id++, text: token, start: t(startFrame), end: t(endFrame), score })
        parts.forEach((p, j) => {
          const s = cut(k + j)
          const e = cut(k + j + 1)
          if (e - s >= 5) syllableUnits.push({ id: id++, text: p, start: t(s), end: t(e), score: score * 0.9 })
        })
      }
      k += parts.length
    })

    for (let i = from; i < to; i++) if (a.f0[i] > 0 && a.conf[i] > 0.7) pitches.push(a.f0[i])
  })

  // Trust cuts of a believable length more: close to her typical syllable
  // length times the word's syllable count. Over-long cuts usually swallowed
  // a neighbouring word.
  const perSyllable = syllableUnits.map((u) => u.end - u.start).sort((p, q) => p - q)
  const typical = perSyllable[perSyllable.length >> 1] ?? 0.2
  const believable = (u: Unit, n: number) => Math.exp(-1.5 * Math.abs(Math.log((u.end - u.start) / (typical * n))))
  for (const u of wordUnits) u.score *= 0.5 + 0.5 * believable(u, Math.max(1, syllables(u.text).length))
  for (const u of syllableUnits) u.score *= 0.5 + 0.5 * believable(u, 1)

  pitches.sort((p, q) => p - q)
  return { version: 1, source, words: wordUnits, syllables: syllableUnits, pitch: pitches[pitches.length >> 1] ?? 200 }
}
