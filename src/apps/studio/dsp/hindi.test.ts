import { describe, expect, it } from "vitest"
import { aksharas, romanToDevanagari, skeleton, syllables, vowelKey, words } from "./hindi"

describe("aksharas and syllables", () => {
  it("splits into aksharas, keeping conjuncts and nasals together", () => {
    expect(aksharas("काफी").map((a) => a.text)).toEqual(["का", "फी"])
    expect(aksharas("अच्छा").map((a) => a.text)).toEqual(["अ", "च्छा"])
    expect(aksharas("मैंने").map((a) => a.text)).toEqual(["मैं", "ने"])
  })

  it("drops the final and pre-vowel schwa like a speaker does", () => {
    expect(syllables("मेकअप")).toEqual(["मेक", "अप"])
    expect(syllables("काफी")).toEqual(["का", "फी"])
    expect(syllables("चैनल")).toEqual(["चै", "नल"])
    expect(syllables("है")).toEqual(["है"])
    expect(syllables("क")).toEqual(["क"])
  })

  it("splits text into words in either script", () => {
    expect(words("हे गाइस, welcome back!")).toEqual(["हे", "गाइस", "welcome", "back"])
  })
})

describe("sound-alike keys", () => {
  it("matches Roman Hinglish to the Devanagari the captions use", () => {
    const pairs: [string, string][] = [
      ["welcome", "वेलकम"],
      ["guys", "गाइस"],
      ["makeup", "मेकअप"],
      ["kaafi", "काफी"],
      ["kafi", "काफी"],
      ["channel", "चैनल"],
      ["subscribe", "सब्सक्राइब"],
      ["mujhe", "मुझे"],
      ["accha", "अच्छा"],
      ["my", "माय"],
      ["hai", "है"],
    ]
    for (const [roman, deva] of pairs) expect(skeleton(roman), `${roman} vs ${deva}`).toBe(skeleton(deva))
  })

  it("keeps different words apart", () => {
    expect(skeleton("makeup")).not.toBe(skeleton("काफी"))
    expect(vowelKey("है")).not.toBe(vowelKey("हो"))
  })
})

describe("romanToDevanagari", () => {
  it("spells common Hinglish plausibly", () => {
    expect(romanToDevanagari("kaam")).toBe("काम")
    expect(romanToDevanagari("dost")).toBe("दोस्त")
    expect(romanToDevanagari("naya")).toBe("नया")
    expect(romanToDevanagari("pyaar")).toBe("प्यार")
  })
})
