import { describe, expect, it } from "vitest"
import { analyze, classifyRegions, SR } from "./analyze"
import type { Cue } from "./captions"
import { indexVoicebank, matchWord, plan, renderNatural, renderSmooth } from "./speak"
import { buildVoicebank, findNuclei } from "./voicebank"

/**
 * A fake recording: one 180 ms "syllable" (a buzzy tone) per syllable, with
 * 90 ms gaps, so we know exactly where every word is.
 */
function recording(syllableCounts: number[], hz = 220) {
  const SYL = 0.18
  const GAP = 0.09
  const lead = 0.5
  const total = syllableCounts.reduce((a, b) => a + b, 0)
  const x = new Float32Array(Math.ceil((lead * 2 + total * (SYL + GAP)) * SR))
  for (let i = 0; i < x.length; i++) x[i] = (Math.random() - 0.5) * 0.002
  const truth: { start: number; end: number }[] = []
  let t = lead
  for (const n of syllableCounts) {
    const start = t
    for (let s = 0; s < n; s++) {
      for (let i = 0; i < SYL * SR; i++) {
        const tt = i / SR
        let v = 0
        for (let h = 1; h <= 4; h++) v += Math.sin(2 * Math.PI * hz * h * tt) / h
        x[Math.floor(t * SR) + i] = 0.25 * v * Math.sin((Math.PI * i) / (SYL * SR))
      }
      t += SYL + GAP
    }
    truth.push({ start, end: t - GAP })
  }
  return { x, truth, duration: x.length / SR }
}

describe("voicebank", () => {
  // काफी (2) है (1) मेकअप (2)
  const { x, truth, duration } = recording([2, 1, 2])
  const cues: Cue[] = [{ start: 0.3, end: duration - 0.3, text: "काफी है मेकअप", sound: false }]
  const a = analyze(x)
  const vb = buildVoicebank(a, classifyRegions(a, cues), cues)

  it("finds one loudness peak per syllable", () => {
    const env = a.db.slice()
    expect(findNuclei(env, a.floor + 12)).toHaveLength(5)
  })

  it("cuts each word close to where it really is", () => {
    expect(vb.words.map((w) => w.text)).toEqual(["काफी", "है", "मेकअप"])
    vb.words.forEach((w, i) => {
      expect(Math.abs(w.start - truth[i].start)).toBeLessThan(0.08)
      expect(Math.abs(w.end - truth[i].end)).toBeLessThan(0.08)
    })
    expect(vb.syllables.map((s) => s.text)).toEqual(["का", "फी", "है", "मेक", "अप"])
    expect(Math.abs(vb.pitch - 220)).toBeLessThan(10)
  })

  it("speaks typed words from the recording, in either script", () => {
    const index = indexVoicebank(vb)
    expect(matchWord("kaafi", index)).toBe("काफी")
    expect(matchWord("makeup", index)).toBe("मेकअप")
    const pieces = plan("kaafi makeup, hai", index)
    expect(pieces.map((p) => p.kind)).toEqual(["word", "word", "pause", "word"])
  })

  it("assembles unknown words from syllables and marks what's missing", () => {
    const index = indexVoicebank(vb)
    const [p] = plan("काका", index)
    expect(p.kind).toBe("syllables")
    if (p.kind === "syllables") expect(p.units.every((u) => u?.text === "का")).toBe(true)
    const [q] = plan("ज़ू", index)
    if (q.kind === "syllables") expect(q.units[0]).toBeNull()
  })

  it("renders audio both ways, with timings for each word", () => {
    const index = indexVoicebank(vb)
    const pieces = plan("है काफी", index)
    const voice = { mono: x, f0: a.f0, conf: a.conf, pitch: vb.pitch }
    const natural = renderNatural(pieces, voice, { gapMs: 40 })
    const expected = vb.words[1].end - vb.words[1].start + vb.words[0].end - vb.words[0].start
    expect(natural.audio.length / SR).toBeGreaterThan(expected)
    expect(natural.timings).toHaveLength(2)
    const smooth = renderSmooth(pieces, voice, { gapMs: 40 })
    expect(smooth.audio.length / SR).toBeGreaterThan(expected)
    expect(Math.max(...smooth.audio.map(Math.abs))).toBeGreaterThan(0.05)
  })
})
