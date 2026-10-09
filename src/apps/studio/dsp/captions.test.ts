import { describe, expect, it } from "vitest"
import { parseCaptions } from "./captions"

const SRT = `1
00:00:01,439 --> 00:00:05,800
हे गाइस वेलकम

2
00:00:30,109 --> NaN:NaN:NaN,NaN



3
00:00:30,119 --> 00:00:33,790
कि मैं ऐसा

4
00:00:33,790 --> 00:00:33,800


5
00:01:10,120 --> 00:01:13,279
[प्रशंसा]

6
00:01:17,040 --> NaN:NaN:NaN,NaN
स्टार्ट तो
`

describe("parseCaptions", () => {
  it("drops YouTube's empty filler cues and keeps the text ones", () => {
    const cues = parseCaptions(SRT)
    expect(cues.map((c) => c.text)).toEqual(["हे गाइस वेलकम", "कि मैं ऐसा", "[प्रशंसा]", "स्टार्ट तो"])
    expect(cues[0]).toMatchObject({ start: 1.439, end: 5.8, sound: false })
  })

  it("marks bracketed sound cues and repairs NaN end times", () => {
    const cues = parseCaptions(SRT)
    expect(cues[2].sound).toBe(true)
    expect(cues[3].end).toBeCloseTo(79.04)
  })

  it("reads WebVTT too", () => {
    const vtt = "WEBVTT\n\n00:01.000 --> 00:02.500\n<c>hello</c> there\n"
    expect(parseCaptions(vtt)).toEqual([{ start: 1, end: 2.5, text: "hello there", sound: false }])
  })

  it("keeps per-word timing from YouTube's auto-caption WebVTT", () => {
    const vtt = `WEBVTT
Kind: captions
Language: hi

00:00:01.439 --> 00:00:03.590 align:start position:0%
 
हे<00:00:01.760><c> गाइस</c><00:00:02.080><c> वेलकम</c>

00:00:03.590 --> 00:00:03.600 align:start position:0%
हे गाइस वेलकम
 

00:00:03.600 --> 00:00:05.800 align:start position:0%
हे गाइस वेलकम
और<00:00:04.100><c> बैक</c>
`
    const cues = parseCaptions(vtt)
    expect(cues.map((c) => c.text)).toEqual(["हे गाइस वेलकम", "और बैक"])
    expect(cues[0].words).toEqual([
      { text: "हे", start: 1.439, end: 1.76 },
      { text: "गाइस", start: 1.76, end: 2.08 },
      { text: "वेलकम", start: 2.08, end: 3.28 },
    ])
    expect(cues[1].words![1]).toEqual({ text: "बैक", start: 4.1, end: 4.1 + 1.2 })
  })

  it("reads YouTube json3 with word offsets", () => {
    const json = JSON.stringify({
      events: [
        { tStartMs: 1000, dDurationMs: 2000, segs: [{ utf8: "काफी" }, { utf8: " अच्छा", tOffsetMs: 400 }] },
        { tStartMs: 3000, segs: [{ utf8: "\n" }] },
        { tStartMs: 3100, dDurationMs: 900, segs: [{ utf8: "है" }] },
      ],
    })
    const cues = parseCaptions(json)
    expect(cues.flatMap((c) => c.words!.map((w) => [w.text, w.start, w.end]))).toEqual([
      ["काफी", 1, 1.4],
      ["अच्छा", 1.4, 2.6],
      ["है", 3.1, 4.3],
    ])
  })
})
