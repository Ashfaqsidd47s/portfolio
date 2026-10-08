import { describe, expect, it } from "vitest"
import { analyze, classifyRegions, decimate2, noteName, SR, voiceStats, yin } from "./analyze"
import { extractFrames, matchLoudness, synthesize } from "./resynth"

/** A buzzy "voice": a few harmonics of f0, with on/off syllables if `gaps`. */
function voice(seconds: number, hz: number, { gaps = true, music = 0 } = {}) {
  const x = new Float32Array(Math.floor(seconds * SR))
  for (let i = 0; i < x.length; i++) {
    const t = i / SR
    const on = !gaps || Math.sin(2 * Math.PI * 3 * t) > -0.2
    let s = 0
    for (let h = 1; h <= 5; h++) s += Math.sin(2 * Math.PI * hz * h * t) / h
    x[i] = (on ? 0.2 * s : 0) + music * Math.sin(2 * Math.PI * 110 * t)
  }
  return x
}

describe("pitch (YIN)", () => {
  it("finds the pitch of a harmonic tone within 1%", () => {
    for (const hz of [110, 220, 330]) {
      const x8 = decimate2(voice(0.5, hz, { gaps: false }))
      const [found, conf] = yin(x8, 400, SR / 2)
      expect(Math.abs(found - hz) / hz).toBeLessThan(0.01)
      expect(conf).toBeGreaterThan(0.8)
    }
  })

  it("calls noise unvoiced", () => {
    const x = new Float32Array(4000).map(() => Math.random() * 2 - 1)
    expect(yin(x, 100, 8000)[0]).toBe(0)
  })

  it("names notes", () => {
    expect(noteName(440)).toBe("A4")
    expect(noteName(220)).toBe("A3")
  })
})

describe("regions", () => {
  it("tells speech with gaps from speech over a music bed and from silence", () => {
    const parts = [new Float32Array(SR * 4), voice(6, 210), voice(6, 210, { music: 0.15 })]
    const x = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
    let at = 0
    for (const p of parts) {
      x.set(p, at)
      at += p.length
    }
    for (let i = 0; i < SR * 4; i++) x[i] = (Math.random() - 0.5) * 0.002
    const a = analyze(x)
    const regions = classifyRegions(a)
    const kindAt = (t: number) => regions.find((r) => r.start <= t && r.end > t)?.kind
    expect(kindAt(2)).toBe("silence")
    expect(kindAt(7)).toBe("speech")
    expect(kindAt(13)).toBe("speech-music")
    const stats = voiceStats(a, regions)
    expect(Math.abs(stats.medianHz - 210)).toBeLessThan(5)
  })

  it("lets [Music] captions win", () => {
    const a = analyze(voice(6, 200))
    const regions = classifyRegions(a, [{ start: 0, end: 6, text: "[Music]", sound: true }])
    expect(regions.every((r) => r.kind === "music")).toBe(true)
  })
})

describe("rebuild from metadata", () => {
  it("makes sound of the same length and pitch from the numbers alone", () => {
    const x = voice(1, 200, { gaps: false })
    const a = analyze(x)
    const frames = extractFrames(x, a.f0, a.conf, 0, a.frames)
    const y = matchLoudness(synthesize(frames), x)
    expect(Math.abs(y.length - x.length)).toBeLessThan(1024)
    const back = analyze(y)
    const mid = Math.floor(back.frames / 2)
    expect(Math.abs(back.f0[mid] - 200)).toBeLessThan(6)
  })
})
