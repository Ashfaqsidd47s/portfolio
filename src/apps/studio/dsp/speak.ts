import { HOP, SR } from "./analyze"
import { COMMON, isDevanagari, romanSyllables, romanToDevanagari, skeleton, syllables, vowelKey } from "./hindi"
import { extractFrames, synthesize, type VoiceFrames } from "./resynth"
import type { Unit, Voicebank } from "./voicebank"

/**
 * Text → speech in the voicebank's voice. Each typed word becomes, best first:
 * 1. a recording of that exact word (typed in Devanagari, or Roman Hinglish
 *    that sounds the same: "kaafi" finds "काफी"),
 * 2. the word assembled from recorded syllables,
 * 3. a short gap where no piece of it was ever recorded.
 */

export type Piece =
  | { kind: "word"; typed: string; text: string; units: Unit[] }
  | { kind: "syllables"; typed: string; text: string; units: (Unit | null)[] }
  | { kind: "pause"; ms: number }

export type Index = {
  words: Map<string, Unit[]>
  bySkeleton: Map<string, string[]>
  syllables: Map<string, Unit[]>
  /** Open syllables (consonant + vowel, nothing after), keyed by text. */
  syllableCores: Map<string, Unit[]>
  /** Open syllables keyed by how they sound (skeleton + vowel), so त can stand in for ट. */
  syllableSounds: Map<string, Unit[]>
  /** Any syllable keyed by its opening consonant + vowel, coda and all: the last resort. */
  closedCores: Map<string, Unit[]>
}

const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => {
  const list = m.get(k)
  if (list) list.push(v)
  else m.set(k, [v])
}

/** The consonant + vowel that opens a syllable: "मेक" → "मे", "नल" → "न". */
function core(syllable: string) {
  const chars = [...syllable]
  let i = 0
  while (i < chars.length && (chars[i + 1] === "्" || chars[i] === "्")) i++
  let end = i + 1
  while (end < chars.length && /[़ा-ौँ-ः]/.test(chars[end])) end++
  return chars.slice(0, end).join("")
}

const soundKey = (syllable: string) => `${skeleton(syllable)}:${vowelKey(syllable) || "a"}`

/** The last consonant of a conjunct with its vowel: "प्र" → "र", "क्शा" → "शा". */
function simplify(core: string) {
  const at = core.lastIndexOf("\u094D")
  return at === -1 ? core : core.slice(at + 1)
}

export function indexVoicebank(vb: Voicebank): Index {
  const byScore = (a: Unit, b: Unit) => b.score - a.score
  const words = new Map<string, Unit[]>()
  const bySkeleton = new Map<string, string[]>()
  const syllableMap = new Map<string, Unit[]>()
  const cores = new Map<string, Unit[]>()
  const sounds = new Map<string, Unit[]>()
  const closed = new Map<string, Unit[]>()
  for (const u of vb.words) {
    push(words, u.text, u)
    if (syllables(u.text).length === 1) push(syllableMap, syllables(u.text)[0], u)
  }
  for (const u of vb.syllables) push(syllableMap, u.text, u)
  for (const [text, units] of syllableMap)
    for (const u of units) {
      if (core(text) === text) {
        push(cores, text, u)
        push(sounds, soundKey(text), u)
      }
      push(closed, core(text), u)
    }
  for (const list of [...words.values(), ...syllableMap.values(), ...cores.values(), ...sounds.values(), ...closed.values()]) list.sort(byScore)
  for (const w of words.keys()) {
    const key = skeleton(w)
    if (key) push(bySkeleton, key, w)
  }
  return { words, bySkeleton, syllables: syllableMap, syllableCores: cores, syllableSounds: sounds, closedCores: closed }
}

/** Edit distance, for picking the closest-sounding vowels. */
function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

/**
 * The recorded word that best matches what was typed, if any: the exact
 * word, a common word's caption spelling, or a word that sounds the same
 * (same consonants; vowels, first letter and syllable count close enough).
 */
export function matchWord(typed: string, index: Index): string | undefined {
  if (index.words.has(typed)) return typed
  const spelled = COMMON[typed]
  if (spelled && index.words.has(spelled)) return spelled
  const key = skeleton(typed)
  const candidates = key ? index.bySkeleton.get(key) : undefined
  if (!candidates?.length) return undefined
  const vowels = vowelKey(typed)
  const startsWithVowel = (w: string) => /^[aeiouअआइईउऊएऐओऔ]/.test(w)
  const sylCount = (w: string) => (isDevanagari(w) ? syllables(w).length : romanSyllables(w))
  const cost = (w: string) =>
    distance(vowelKey(w), vowels) + (startsWithVowel(w) !== startsWithVowel(typed) ? 1 : 0) + Math.abs(sylCount(w) - sylCount(typed))
  const best = [...candidates].sort((a, b) => cost(a) - cost(b) || index.words.get(b)!.length - index.words.get(a)!.length)[0]
  // Hindi script is spelled exactly, so only a perfect sound-alike will do
  // (लगता must not become लगते). Roman spelling varies: longer words may be
  // off by one vowel.
  const allowed = isDevanagari(typed) || key.length <= 2 ? 0 : 1
  return cost(best) <= allowed ? best : undefined
}

/** An open syllable that sounds like `c` (consonant + vowel), if one was recorded. */
function findOpen(c: string, index: Index): Unit | undefined {
  return (
    index.syllableCores.get(c)?.[0] ??
    index.syllableSounds.get(soundKey(c))?.[0] ??
    index.syllableSounds.get(soundKey(simplify(c)))?.[0]
  )
}

/**
 * Recorded audio for syllable `s`: the exact syllable if she said it;
 * otherwise its opening sound plus, for a closed syllable like "नाम", the
 * start of a syllable beginning with the final consonant (the "m"), trimmed
 * so only the consonant and a breath of vowel remain.
 */
function findSyllable(s: string, index: Index): (Unit | null)[] {
  const exact = index.syllables.get(s)?.[0]
  if (exact) return [exact]
  const c = core(s)
  const open = findOpen(c, index) ?? index.closedCores.get(c)?.[0]
  if (!open) return [null]
  const coda = s.slice(c.length).replace(/[\u094D\u0901-\u0903]/g, "")
  if (!coda) return [open]
  const tail = findOpen([...coda].pop()!, index)
  return tail ? [open, { ...tail, end: tail.start + (tail.end - tail.start) * 0.45 }] : [open]
}

export function plan(text: string, index: Index): Piece[] {
  const pieces: Piece[] = []
  const tokens = text.toLowerCase().match(/[\p{L}\p{M}\p{N}]+|[,.!?।;:\n]/gu) ?? []
  for (const token of tokens) {
    if (/^[,;:]$/.test(token)) {
      pieces.push({ kind: "pause", ms: 220 })
      continue
    }
    if (/^[.!?।\n]$/.test(token)) {
      pieces.push({ kind: "pause", ms: 420 })
      continue
    }
    const found = matchWord(token, index)
    if (found) {
      pieces.push({ kind: "word", typed: token, text: found, units: [index.words.get(found)![0]] })
      continue
    }
    const deva = isDevanagari(token) ? token : (COMMON[token] ?? romanToDevanagari(token))
    pieces.push({ kind: "syllables", typed: token, text: deva, units: syllables(deva).flatMap((s) => findSyllable(s, index)) })
  }
  return pieces
}

// ---- Rendering ----------------------------------------------------------------

export type Voice = { mono: Float32Array; f0: Float32Array; conf: Float32Array; pitch: number }
export type RenderOptions = { gapMs: number }

const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / Math.max(1, x.length))

/** Where each piece landed in the output, for highlighting while it plays. */
export type Timing = { piece: number; start: number; end: number }

/**
 * Natural: splice the real recordings together. Each clip is levelled to
 * the same loudness and joined with short crossfades.
 */
export function renderNatural(pieces: Piece[], voice: Voice, { gapMs }: RenderOptions): { audio: Float32Array; timings: Timing[] } {
  const all: Unit[] = pieces.flatMap((p) => (p.kind === "pause" ? [] : (p.units as (Unit | null)[]).filter((u): u is Unit => !!u)))
  const levels = all.map((u) => rms(voice.mono.subarray(Math.floor(u.start * SR), Math.floor(u.end * SR)))).filter((v) => v > 0)
  levels.sort((a, b) => a - b)
  const target = levels[levels.length >> 1] || 0.05
  const fade = Math.floor(0.008 * SR)
  const xfade = Math.floor(0.012 * SR)

  const timings: Timing[] = []
  const out: number[] = []
  const append = (clip: Float32Array, overlap: number) => {
    const o = Math.min(overlap, out.length, clip.length)
    for (let i = 0; i < clip.length; i++) {
      const at = out.length - o + i
      if (i < o) out[at] += clip[i]
      else out.push(clip[i])
    }
  }
  const silence = (ms: number) => {
    for (let i = 0; i < (ms / 1000) * SR; i++) out.push(0)
  }

  pieces.forEach((p, pi) => {
    if (p.kind === "pause") return silence(p.ms)
    const start = out.length
    p.units.forEach((u, j) => {
      if (!u) return silence(90)
      const raw = voice.mono.slice(Math.floor(u.start * SR), Math.floor(u.end * SR))
      const gain = Math.min(4, target / (rms(raw) || target))
      for (let i = 0; i < raw.length; i++) {
        const edge = Math.min(1, i / fade, (raw.length - 1 - i) / fade)
        raw[i] *= gain * edge
      }
      append(raw, j > 0 ? xfade : 0)
    })
    timings.push({ piece: pi, start: start / SR, end: out.length / SR })
    silence(gapMs)
  })
  return { audio: Float32Array.from(out, (v) => Math.max(-1, Math.min(1, v))), timings }
}

/**
 * Smooth: rebuild every clip from its metadata through the vocoder, with
 * one continuous pitch line for the whole sentence (gently falling, like
 * natural speech) so the joins between clips don't jump. More robotic,
 * but more even.
 */
export function renderSmooth(pieces: Piece[], voice: Voice, { gapMs }: RenderOptions): { audio: Float32Array; timings: Timing[] } {
  const frames: VoiceFrames[] = []
  const half = 257
  const silenceFrames = (n: number): VoiceFrames => ({ f0: new Float32Array(n), voicing: new Float32Array(n), env: new Float32Array(n * half).fill(1e-4) })
  const timings: Timing[] = []
  let count = 0
  pieces.forEach((p, pi) => {
    if (p.kind === "pause") {
      const f = silenceFrames(Math.round(p.ms / 10))
      frames.push(f)
      count += f.f0.length
      return
    }
    const start = count
    for (const u of p.units) {
      const f = u ? extractFrames(voice.mono, voice.f0, voice.conf, Math.floor(u.start * 100), Math.floor(u.end * 100)) : silenceFrames(9)
      frames.push(f)
      count += f.f0.length
    }
    timings.push({ piece: pi, start: (start * HOP) / SR, end: (count * HOP) / SR })
    const g = silenceFrames(Math.round(gapMs / 10))
    frames.push(g)
    count += g.f0.length
  })

  const all: VoiceFrames = { f0: new Float32Array(count), voicing: new Float32Array(count), env: new Float32Array(count * half) }
  let at = 0
  for (const f of frames) {
    all.f0.set(f.f0, at)
    all.voicing.set(f.voicing, at)
    all.env.set(f.env, at * half)
    at += f.f0.length
  }

  // Reshape pitch: keep each clip's own movement, but centre it on a line that
  // falls two semitones across the sentence. Ratios are smoothed over 80 ms.
  const ratio = new Float32Array(count).fill(1)
  at = 0
  for (const f of frames) {
    const voiced = Array.from(f.f0).filter((v) => v > 0).sort((a, b) => a - b)
    const med = voiced[voiced.length >> 1]
    for (let i = 0; i < f.f0.length; i++) {
      const target = voice.pitch * 2 ** ((1 - (2 * (at + i)) / Math.max(1, count)) / 6)
      ratio[at + i] = med ? Math.pow(target / med, 0.8) : 1
    }
    at += f.f0.length
  }
  const smoothRatio = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    let s = 0
    let n = 0
    for (let j = Math.max(0, i - 4); j <= Math.min(count - 1, i + 4); j++) {
      s += ratio[j]
      n++
    }
    smoothRatio[i] = s / n
  }
  for (let i = 0; i < count; i++) if (all.f0[i] > 0) all.f0[i] *= smoothRatio[i]

  const audio = synthesize(all)
  const level = rms(audio) || 1
  for (let i = 0; i < audio.length; i++) audio[i] = Math.max(-1, Math.min(1, (audio[i] / level) * 0.08))
  return { audio, timings }
}

/** 16-bit PCM WAV, for downloading a result. */
export function encodeWav(samples: Float32Array, sampleRate = SR): Blob {
  const data = new DataView(new ArrayBuffer(44 + samples.length * 2))
  const str = (o: number, s: string) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)))
  str(0, "RIFF")
  data.setUint32(4, 36 + samples.length * 2, true)
  str(8, "WAVE")
  str(12, "fmt ")
  data.setUint32(16, 16, true)
  data.setUint16(20, 1, true)
  data.setUint16(22, 1, true)
  data.setUint32(24, sampleRate, true)
  data.setUint32(28, sampleRate * 2, true)
  data.setUint16(32, 2, true)
  data.setUint16(34, 16, true)
  str(36, "data")
  data.setUint32(40, samples.length * 2, true)
  samples.forEach((v, i) => data.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true))
  return new Blob([data.buffer], { type: "audio/wav" })
}
