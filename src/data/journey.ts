/**
 * The stages of the scroll journey on the home page, in order. The HUD reads
 * this for its stage indicator and the stage-select menu, and each stage
 * component uses its own entry for its title card — so a year or title edited
 * here updates everywhere.
 */
export type Stage = {
  id: string
  /** Shown as "STAGE 01" on title cards. */
  n: number
  year: string
  title: string
  /** One line for the stage-select menu. */
  blurb: string
}

export const stages: Stage[] = [
  { id: "hello-world", n: 1, year: "2018", title: "Hello, World", blurb: "Class 11, Turbo C++ and a love calculator" },
  { id: "snake", n: 2, year: "2019", title: "graphics.h", blurb: "A snake game, built without the internet" },
  { id: "save-point", n: 3, year: "2019", title: "Save Point", blurb: "A drop year and a new quest" },
  { id: "android", n: 4, year: "2020", title: "Android Dreams", blurb: "B.Sc. CS, tiny games, a laptop that said no" },
  { id: "web", n: 5, year: "2020", title: "Enter the Web", blurb: "HTML, CSS, JS and a month of static sites" },
  { id: "full-stack", n: 6, year: "2021", title: "Full Stack", blurb: "A MERN social media app, start to finish" },
  { id: "internship", n: 7, year: "2023", title: "First Internship", blurb: "A no-library drag & drop test, then a trading platform" },
  { id: "ai-era", n: 8, year: "2023", title: "The AI Era", blurb: "MCA, more projects, and goodbye Stack Overflow" },
  { id: "boss", n: 9, year: "2025", title: "Boss Fight", blurb: "Five state-management patterns, one codebase, two days" },
  { id: "freelance", n: 10, year: "2025", title: "Freelance", blurb: "Laravel backends with AI as a co-pilot" },
  { id: "first-job", n: 11, year: "2026", title: "Class Change", blurb: "Hired as frontend, levelled up to full-stack" },
  { id: "matrix", n: 12, year: "Now", title: "11Matrix", blurb: "Every store, every channel, one place" },
  { id: "continue", n: 13, year: "Next", title: "Continue?", blurb: "Side quests, and player two" },
]

export const stageById = (id: string): Stage => {
  const stage = stages.find((s) => s.id === id)
  if (!stage) throw new Error(`Unknown stage: ${id}`)
  return stage
}
