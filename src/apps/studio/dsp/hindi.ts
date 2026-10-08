/**
 * Just enough Hindi for a voicebank:
 * - split Devanagari into aksharas and spoken syllables (with the usual
 *   schwa deletion, so "मेकअप" is "मेक·अप", not "मे·क·अ·प"),
 * - a sound-alike key ("skeleton": the consonants, simplified) that matches
 *   Roman Hinglish to Devanagari: "makeup" ≈ "मेकअप", "kaafi" ≈ "काफी",
 * - a rough Roman → Devanagari transliteration for words never heard.
 */

const isConsonant = (c: string) => (c >= "क" && c <= "ह") || (c >= "क़" && c <= "य़")
const isIndependentVowel = (c: string) => c >= "ऄ" && c <= "औ"
const isMatra = (c: string) => (c >= "ा" && c <= "ौ") || c === "ॢ" || c === "ॣ"
const VIRAMA = "्"
const NUKTA = "़"
const isNasal = (c: string) => c === "ँ" || c === "ं" || c === "ः"

export type Akshara = { text: string; /** Carries a vowel: a matra, an independent vowel or the inherent "a". */ vowel: "explicit" | "inherent" }

/** Split one Devanagari word into aksharas (orthographic syllables). */
export function aksharas(word: string): Akshara[] {
  const out: Akshara[] = []
  const chars = [...word]
  let i = 0
  while (i < chars.length) {
    const start = i
    let vowel: Akshara["vowel"] = "inherent"
    if (isIndependentVowel(chars[i])) {
      i++
      vowel = "explicit"
    } else if (isConsonant(chars[i])) {
      i++
      if (chars[i] === NUKTA) i++
      // Conjuncts: consonant + virama + consonant…
      while (chars[i] === VIRAMA && chars[i + 1] && isConsonant(chars[i + 1])) {
        i += 2
        if (chars[i] === NUKTA) i++
      }
      if (chars[i] === VIRAMA) i++
      else if (isMatra(chars[i])) {
        i++
        vowel = "explicit"
      }
    } else {
      i++
      continue // not Devanagari: skip
    }
    while (isNasal(chars[i])) i++
    out.push({ text: chars.slice(start, i).join(""), vowel })
  }
  return out
}

/**
 * Spoken syllables of a word. An inherent "a" is dropped at the end of a
 * word and before an independent vowel; that consonant then closes the
 * syllable before it (the standard Hindi schwa deletion, simplified).
 */
export function syllables(word: string): string[] {
  const ak = aksharas(word)
  const out: string[] = []
  ak.forEach((a, i) => {
    const last = i === ak.length - 1
    const beforeVowel = !last && isIndependentVowel([...ak[i + 1].text][0])
    const silent = a.vowel === "inherent" && i > 0 && (last || beforeVowel) && !a.text.endsWith(VIRAMA)
    const closesPrevious = silent || a.text.endsWith(VIRAMA)
    if (closesPrevious && out.length) out[out.length - 1] += a.text
    else out.push(a.text)
  })
  return out
}

/** Words in a line of text: Devanagari or Latin runs, punctuation dropped. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter(Boolean)
}

export const isDevanagari = (w: string) => /[ऀ-ॿ]/.test(w)

// ---- Sound-alike keys ------------------------------------------------------

const DEVA_KEY: Record<string, string> = {
  क: "k", ख: "k", ग: "g", घ: "g", ङ: "n", च: "c", छ: "c", ज: "j", झ: "j", ञ: "n",
  ट: "t", ठ: "t", ड: "d", ढ: "d", ण: "n", त: "t", थ: "t", द: "d", ध: "d", न: "n",
  प: "p", फ: "f", ब: "b", भ: "b", म: "m", य: "", र: "r", ल: "l", व: "v", श: "s",
  ष: "s", स: "s", ह: "h", क़: "k", ख़: "k", ग़: "g", ज़: "j", ड़: "r", ढ़: "r", फ़: "f", य़: "",
}

/**
 * The consonant skeleton of a word, in either script: vowels and y are
 * dropped, look-alike sounds merged, doubles collapsed. "welcome" and
 * "वेलकम" both give "vlkm"; "guys" and "गाइस" both give "gs".
 */
export function skeleton(word: string): string {
  let key = ""
  if (isDevanagari(word)) {
    for (const ch of word.normalize("NFC")) {
      const base = ch.normalize("NFD")
      key += DEVA_KEY[ch] ?? DEVA_KEY[base] ?? (ch === "ं" ? "" : "")
    }
  } else {
    const w = word
      .toLowerCase()
      .replace(/cch|chh|ch/g, "C")
      .replace(/sh|ss/g, "s")
      .replace(/ph/g, "f")
      .replace(/([kgjtdb])h/g, "$1")
      .replace(/c(?=[ei])/g, "s")
      .replace(/ck/g, "k")
      .replace(/x/g, "ks")
      .replace(/q/g, "k")
      .replace(/w/g, "v")
      .replace(/z/g, "j")
    for (const ch of w) {
      if (ch === "C") key += "c"
      else if (ch === "c") key += "k"
      else if (/[a-z]/.test(ch) && !"aeiouy".includes(ch)) key += ch
    }
  }
  return key.replace(/(.)\1+/g, "$1")
}

/**
 * The vowels of a word in one shared alphabet (a i u e ai o au), for
 * breaking ties between words with the same skeleton.
 */
export function vowelKey(word: string): string {
  if (isDevanagari(word)) {
    const map: Record<string, string> = {
      "\u093E": "a", "\u093F": "i", "\u0940": "i", "\u0941": "u", "\u0942": "u", "\u0947": "e", "\u0948": "ai",
      "\u094B": "o", "\u094C": "au", अ: "a", आ: "a", इ: "i", ई: "i", उ: "u", ऊ: "u", ए: "e", ऐ: "ai", ओ: "o", औ: "au",
    }
    return [...word].map((c) => map[c] ?? "").join("")
  }
  return word
    .toLowerCase()
    .replace(/ee|ea|ie/g, "i")
    .replace(/oo/g, "u")
    .replace(/aa/g, "a")
    .replace(/ey$/, "e")
    .replace(/(?<=[^aeiou])y$/, "ai")
    .replace(/ay|ai/g, "ai")
    .replace(/[^aeiou]/g, "")
    .replace(/(.)\1+/g, "$1")
}

/** Rough syllable count of a Roman word: its vowel groups (a final -y counts). */
export function romanSyllables(word: string): number {
  const w = word.toLowerCase().replace(/(?<=[^aeiou])y$/, "i")
  return Math.max(1, (w.match(/[aeiou]+/g) ?? []).length)
}

/**
 * Everyday words, spelled the way YouTube's Hindi captions spell them, so
 * typing them in Roman letters lands on the right recording.
 */
export const COMMON: Record<string, string> = {
  // English as said in Hinglish
  hi: "हाय", hey: "हे", hello: "हेलो", guys: "गाइस", welcome: "वेलकम", back: "बैक", my: "माय", channel: "चैनल",
  please: "प्लीज", subscribe: "सब्सक्राइब", video: "वीडियो", videos: "वीडियोस", today: "टुडे", look: "लुक",
  makeup: "मेकअप", so: "सो", and: "एंड", but: "बट", i: "आई", you: "यू", the: "द", this: "दिस", is: "इज", it: "इट",
  ok: "ओके", okay: "ओके", thanks: "थैंक्स", thank: "थैंक", love: "लव", we: "वी", are: "आर", lets: "लेट्स",
  start: "स्टार्ट", time: "टाइम", skin: "स्किन", face: "फेस", simple: "सिंपल", actually: "एक्चुअली", use: "यूज",
  // Hinglish
  main: "मैं", mai: "मैं", hai: "है", hain: "हैं", aap: "आप", aapko: "आपको", apko: "आपको", aapka: "आपका",
  kya: "क्या", nahi: "नहीं", nahin: "नहीं", bahut: "बहुत", bohot: "बहुत", accha: "अच्छा", acha: "अच्छा",
  achha: "अच्छा", kaafi: "काफी", kafi: "काफी", mera: "मेरा", meri: "मेरी", mere: "मेरे", mujhe: "मुझे",
  hum: "हम", ham: "हम", ek: "एक", aaj: "आज", naam: "नाम", kaise: "कैसे", ho: "हो", karo: "करो", karna: "करना",
  thoda: "थोड़ा", thodi: "थोड़ी", sab: "सब", bhi: "भी", toh: "तो", to: "तो", ke: "के", ki: "की", ka: "का",
  ko: "को", se: "से", me: "में", mein: "में", par: "पर", pe: "पे", jo: "जो", ye: "ये", yeh: "यह", wo: "वो",
  woh: "वो", aur: "और", ya: "या", ab: "अब", phir: "फिर", fir: "फिर", kar: "कर", raha: "रहा", rahi: "रही",
  dekho: "देखो", dekh: "देख", lagta: "लगता", lagti: "लगती", pasand: "पसंद", sabse: "सबसे", pehle: "पहले",
  pahle: "पहले", tha: "था", thi: "थी", hoga: "होगा", hogi: "होगी", kuch: "कुछ", kuchh: "कुछ", itna: "इतना",
  zyada: "ज्यादा", jyada: "ज्यादा", ji: "जी", haan: "हां", han: "हां", na: "ना", chalo: "चलो", milte: "मिलते",
}

// ---- Roman → Devanagari (rough) -------------------------------------------

const R_CONS: [string, string][] = [
  ["chh", "छ"], ["kh", "ख"], ["gh", "घ"], ["ch", "च"], ["jh", "झ"], ["th", "थ"], ["dh", "ध"], ["ph", "फ"],
  ["bh", "भ"], ["sh", "श"], ["k", "क"], ["g", "ग"], ["c", "क"], ["j", "ज"], ["t", "त"], ["d", "द"], ["n", "न"],
  ["p", "प"], ["f", "फ"], ["b", "ब"], ["m", "म"], ["y", "य"], ["r", "र"], ["l", "ल"], ["v", "व"], ["w", "व"],
  ["s", "स"], ["h", "ह"], ["q", "क"], ["x", "क्स"], ["z", "ज़"],
]
const R_VOW: [string, string, string][] = [
  // roman, independent, matra
  ["aa", "आ", "ा"], ["ai", "ऐ", "ै"], ["au", "औ", "ौ"], ["ee", "ई", "ी"], ["ii", "ई", "ी"],
  ["oo", "ऊ", "ू"], ["uu", "ऊ", "ू"], ["a", "अ", ""], ["i", "इ", "ि"], ["u", "उ", "ु"],
  ["e", "ए", "े"], ["o", "ओ", "ो"],
]

/** Hinglish spelled in Roman letters → a plausible Devanagari spelling. */
export function romanToDevanagari(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z]/g, "")
  let out = ""
  let i = 0
  let afterConsonant = false
  while (i < w.length) {
    const vow = R_VOW.find(([r]) => w.startsWith(r, i))
    if (vow) {
      // A final "a" after a consonant is long in Hinglish spelling: naya → नया.
      const finalA = vow[0] === "a" && afterConsonant && i === w.length - 1
      out += finalA ? "\u093E" : afterConsonant ? vow[2] : vow[1]
      i += vow[0].length
      afterConsonant = false
      continue
    }
    const con = R_CONS.find(([r]) => w.startsWith(r, i))
    if (!con) {
      i++
      continue
    }
    // Two consonants in a row join into a conjunct.
    if (afterConsonant) out += VIRAMA
    out += con[1]
    i += con[0].length
    afterConsonant = true
  }
  return out
}
