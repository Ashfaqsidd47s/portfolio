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
})
