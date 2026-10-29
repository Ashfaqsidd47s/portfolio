import type { EnvState } from "./env"

/**
 * The little story: you've just got off the bus at the ISBT; your friend is
 * waiting by Clement Town Lake. She'd like Cake House's patties. Then the
 * two of you walk to the Great Stupa as the lights come on.
 *
 * Pure: the game asks for lines and the next objective; lines change with
 * the hour and the weather.
 */

/** Your friend's name. Change it here. */
export const FRIEND_NAME = "Riya"
export const PLAYER_NAME = "Ashfaq"

export type Stage = "arrive" | "errand" | "return" | "walk" | "free"

export type Line = { who: "me" | "friend" | "narrator"; text: string }
export type Choice = { id: string; label: string }
export type Scene = { lines: Line[]; choices?: Choice[] }

export type StoryState = {
  stage: Stage
  patties: boolean
  mithai: boolean
  mithaiGiven: boolean
  chai: number
  following: boolean
  sawStupa: boolean
}

export const newStory = (): StoryState => ({
  stage: "arrive",
  patties: false,
  mithai: false,
  mithaiGiven: false,
  chai: 0,
  following: false,
  sawStupa: false,
})

type Mood = "sunset" | "day" | "night" | "rain" | "mist" | "morning"

export function mood(env: EnvState): Mood {
  if (env.rain > 0.4) return "rain"
  if (env.mist > 0.55) return "mist"
  const e = env.sun.elevation
  if (e < -6) return "night"
  if (e < 9 && env.minutes > 12 * 60) return "sunset"
  if (e < 12) return "morning"
  return "day"
}

const f = (text: string): Line => ({ who: "friend", text })
const m = (text: string): Line => ({ who: "me", text })
const n = (text: string): Line => ({ who: "narrator", text })

const GREETING: Record<Mood, string> = {
  sunset: "You made it! Look — the sun's going red right over the water. I've been saving you the best seat.",
  day: "Finally! I've counted every duck on this lake. Twice.",
  night: "There you are! The fountain's lit up now, I didn't want you to miss it.",
  rain: "Look at you, totally drenched! Come, sit — the rain's nice from here.",
  mist: "I could barely see you coming through the fog! Doon winters, yaar.",
  morning: "Good morning! The lake's so quiet this early, na?",
}

export function objective(s: StoryState): { text: string; target: string } | null {
  switch (s.stage) {
    case "arrive":
      return { text: `Meet ${FRIEND_NAME} at Clement Town Lake`, target: "friend" }
    case "errand":
      return s.patties
        ? { text: `Take the patties back to ${FRIEND_NAME}`, target: "friend" }
        : { text: "Get patties and a pastry from Cake House", target: "cakehouse" }
    case "return":
      return { text: `Take the patties back to ${FRIEND_NAME}`, target: "friend" }
    case "walk":
      return { text: `Walk ${FRIEND_NAME} to the Great Stupa`, target: "stupa" }
    case "free":
      return null
  }
}

/** Talking to her. Returns what's said and what happens. */
export function talk(s: StoryState, env: EnvState): Scene {
  const md = mood(env)
  switch (s.stage) {
    case "arrive":
      return {
        lines: [
          f(GREETING[md]),
          m("Sorry, the bus crawled from Saharanpur. And then the whole of Turner Road was one long traffic jam."),
          f("Hmm. Fine, you're forgiven… on one condition."),
          f("Cake House's veg patties. And a pineapple pastry. It's just outside the cantt gate, opposite Velmed."),
        ],
        choices: [
          { id: "accept", label: "On it. Two patties and a pastry." },
          { id: "tease", label: "That's your condition? That's it?" },
        ],
      }
    case "errand":
      if (s.patties) return talkReturn(s, md)
      return {
        lines: [f(md === "rain" ? "Take my umbrella! …I don't have one. Run then!" : "Cake House! Out the gate, it's on your right. Go go go."), n("Cake House is just outside the cantonment gate on Turner Road.")],
      }
    case "return":
      return talkReturn(s, md)
    case "walk":
      return {
        lines: s.following
          ? [f(md === "night" ? "The stupa's lit with a thousand little bulbs at night. You'll see." : "Buddha Temple Road, then straight to the gate. Lead the way.")]
          : [f("Shall we go now?")],
        choices: s.following ? [{ id: "wait", label: "Wait here a minute." }] : [{ id: "follow", label: "Come on, let's go." }],
      }
    case "free":
      return {
        lines: [f(freeLine(md, s))],
        choices: s.following ? [{ id: "wait", label: "Wait here for me." }] : [{ id: "follow", label: "Walk with me?" }],
      }
  }
}

function talkReturn(s: StoryState, md: Mood): Scene {
  const lines: Line[] = [
    n("You hand over two hot veg patties and a pineapple pastry."),
    f("Still hot! Okay, you are officially forgiven."),
  ]
  if (s.mithai && !s.mithaiGiven) {
    lines.push(m("Also… bal mithai. From Raj Kumar, by the chowk."), f("You remembered! Okay, now you're my favourite person."))
  }
  lines.push(
    f(md === "sunset" || md === "night" ? "Let's walk to the Buddha Temple. The Great Stupa looks unreal when the lights come on." : "Let's walk to the Buddha Temple? The monastery garden's so peaceful.")
  )
  return { lines, choices: [{ id: "walk", label: "Let's go." }] }
}

function freeLine(md: Mood, s: StoryState) {
  const pool: Record<Mood, string[]> = {
    sunset: ["Same time tomorrow? Sunsets here are a habit now.", "Look at the sky. Pink, then orange, then gone."],
    day: ["We should come back for momos at Ama's.", "I like how slow everything is here."],
    night: ["It's getting cold. Chai at the ISBT stall?", "Listen — crickets. All of them."],
    rain: ["Rain on the lake sounds like a tabla, na?", "Let's not go anywhere till it stops."],
    mist: ["The fog makes everything look like a dream.", "I can't see the end of the road!"],
    morning: ["Monks were chanting since six. I could hear them from the lake.", "Morning walks here are the best."],
  }
  const list = pool[md]
  return list[(s.chai + (s.sawStupa ? 1 : 0)) % list.length]
}

/** A choice was picked. Mutates the state; may return a short reply. */
export function choose(s: StoryState, id: string): Scene | null {
  switch (id) {
    case "accept":
      s.stage = "errand"
      return { lines: [f("Hero. I'll guard the bench.")] }
    case "tease":
      s.stage = "errand"
      return { lines: [f("And a pastry. Pineapple. Don't come back with chocolate."), m("Okay, okay.")] }
    case "walk":
      s.stage = "walk"
      s.following = true
      if (s.mithai) s.mithaiGiven = true
      return null
    case "follow":
      s.following = true
      return { lines: [f("Lead the way.")] }
    case "wait":
      s.following = false
      return { lines: [f("I'll be right here.")] }
  }
  return null
}

export function bought(s: StoryState, what: "patties" | "mithai" | "chai"): Scene {
  if (what === "patties") {
    if (s.patties || s.stage === "walk" || s.stage === "free") return { lines: [n("The counter's warm with fresh rusks and fruit cake. You're good for now.")] }
    if (s.stage === "arrive") return { lines: [n("Cake House: patties, pastries, cream rolls. You don't know what she'd want yet.")] }
    s.patties = true
    s.stage = "return"
    return { lines: [n("Two veg patties, hot from the oven, and a pineapple pastry in a little white box."), m("She'd better still be there.")] }
  }
  if (what === "mithai") {
    if (s.mithai) return { lines: [n("You already have a box of bal mithai. Patience.")] }
    s.mithai = true
    return { lines: [n("A small box of bal mithai: brown, fudgy, rolled in little white sugar balls. Almora's pride, sold by the chowk.")] }
  }
  s.chai++
  return { lines: [n(s.chai === 1 ? "Kadak chai in a paper cup. Your hands warm up at once." : "Another chai. The stall owner nods: regular now.")] }
}

/** Arriving at the stupa together. */
export function finale(env: EnvState): Scene {
  const md = mood(env)
  return {
    lines: [
      n("The Great Stupa of Mindrolling rises fifty-odd metres over the garden, gold at the top."),
      f(md === "night" ? "See? Every edge is lit. Like it's made of fireflies." : md === "rain" ? "Even in the rain it looks peaceful." : "Every time I come here it feels like the world slows down."),
      m("Worth the patties?"),
      f("Worth the patties."),
      n("You walk the kora round the stupa together, clockwise, prayer flags fluttering overhead."),
    ],
  }
}
