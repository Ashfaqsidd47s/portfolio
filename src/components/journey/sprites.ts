import type { Sprite } from "./primitives"

const HERO_PALETTE = {
  K: "#1b1430",
  S: "#c98b5e",
  W: "#ffffff",
  M: "#7a3b2e",
  H: "#ff4d8d",
  h: "#c2306a",
  J: "#3b4cc0",
  B: "#f6eedd",
}

/** The player: me, in a hoodie. Two walk frames. */
export const HERO_FRAMES: Sprite[] = [
  {
    palette: HERO_PALETTE,
    rows: [
      "...KKKKKK...",
      "..KKKKKKKK..",
      ".KKKKKKKKKK.",
      ".KKSSSSSSKK.",
      "..SWKSSWKS..",
      "..SSSSSSSS..",
      "...SSMMSS...",
      "....SSSS....",
      "..HHHHHHHH..",
      ".HHHhHHhHHH.",
      ".SHHhHHhHHS.",
      ".SHHHHHHHHS.",
      "..JJJJJJJJ..",
      "..JJJ..JJJ..",
      "..BBB..BBB..",
    ],
  },
  {
    palette: HERO_PALETTE,
    rows: [
      "...KKKKKK...",
      "..KKKKKKKK..",
      ".KKKKKKKKKK.",
      ".KKSSSSSSKK.",
      "..SWKSSWKS..",
      "..SSSSSSSS..",
      "...SSMMSS...",
      "....SSSS....",
      "..HHHHHHHH..",
      ".HHHhHHhHHH.",
      ".SHHhHHhHHS.",
      ".SHHHHHHHHS.",
      "..JJJJJJJJ..",
      "...JJJJJJ...",
      "...BB..BB...",
    ],
  },
]

export const HEART: Sprite = {
  palette: { X: "#ff4d8d", w: "#ffd0e0" },
  rows: [".XX.XX.", "XwXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."],
}

export const TROPHY: Sprite = {
  palette: { Y: "#ffd23f", y: "#c99a12", w: "#fff6c8" },
  rows: [
    "YYYYYYYYY",
    "YwYYYYYyY",
    "Y.YYYYY.Y",
    ".YYYYYYy.",
    "..YYYYy..",
    "...YYy...",
    "....Y....",
    "...yYy...",
    "..YYYYY..",
  ],
}

export const STAR: Sprite = {
  palette: { Y: "#ffd23f" },
  rows: ["..Y..", "..Y..", "YYYYY", ".YYY.", "Y...Y"],
}

const face = (eyes: string, mouth: string): Sprite => ({
  palette: HERO_PALETTE,
  rows: [
    "...KKKKKK...",
    "..KKKKKKKK..",
    ".KKKKKKKKKK.",
    ".KKSSSSSSKK.",
    eyes,
    "..SSSSSSSS..",
    mouth,
    "....SSSS....",
    "..HHHHHHHH..",
    ".HHHhHHhHHH.",
    ".SHHhHHhHHS.",
    ".SHHHHHHHHS.",
    "..JJJJJJJJ..",
    "..JJJ..JJJ..",
    "..BBB..BBB..",
  ],
})

/** The companion's faces: idle, talking (mouth open), and mid-blink. */
export const COMPANION = {
  idle: face("..SWKSSWKS..", "...SSMMSS..."),
  talk: face("..SWKSSWKS..", "...SMKKMS..."),
  blink: face("..SKKSSKKS..", "...SSMMSS..."),
  blinkTalk: face("..SKKSSKKS..", "...SMKKMS..."),
}
