import * as React from "react"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/8bit/button"
import { cn } from "@/lib/utils"
import { Dialogue, Stage, StageTitle, Sfx, PixelSprite, type Sprite } from "./primitives"
import { EASE } from "./hooks"

const CRYSTAL: Sprite = {
  palette: { C: "#3ee6ff", c: "#1a9bb8", w: "#e8fdff" },
  rows: [
    "....C....",
    "...CwC...",
    "..CwCCC..",
    ".CwCCCCc.",
    "CCCCCCCcc",
    ".CCCCCcc.",
    "..CCCcc..",
    "...Ccc...",
    "....c....",
  ],
}

const QUESTS: Array<{ label: string; done: boolean; isNew?: boolean }> = [
  { label: "Print Hello World", done: true },
  { label: "Build a love calculator", done: true },
  { label: "Build a snake game, offline", done: true },
  { label: "Take a drop year, aim for engineering", done: true },
  { label: "NEW ROUTE: B.Sc. Computer Science · Doon University · 2020", done: false, isNew: true },
]

export function StageSavePoint() {
  const reduced = useReducedMotion()
  return (
    <Stage id="save-point" className="overflow-clip bg-night pb-28">
      <StageTitle id="save-point" kicker="Every RPG has a quiet room with a glowing crystal. 2019 was mine." />
      <div className="mx-auto grid max-w-5xl items-center gap-12 px-4 md:grid-cols-[auto_1fr]">
        <div className="relative mx-auto flex flex-col items-center">
          <div className="absolute inset-0 -z-0 rounded-full bg-px-cyan/20 blur-3xl" />
          <PixelSprite sprite={CRYSTAL} className="relative w-28 animate-bob drop-shadow-[0_0_24px_#3ee6ff]" />
          <p className="retro mt-6 text-[0.625rem] text-px-cyan">SAVE POINT</p>
        </div>

        <div className="px-frame-shadow bg-ink p-5 sm:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-4 border-night pb-3">
            <p className="retro text-[0.625rem] text-px-yellow">SLOT 1 · ASHFAQ</p>
            <p className="retro text-[0.5625rem] text-lilac">2019 · DROP YEAR</p>
          </div>
          <ul className="mt-4 flex flex-col gap-3">
            {QUESTS.map((q, i) => (
              <motion.li
                key={q.label}
                className={cn(
                  "flex items-start gap-3 font-pixel-sans text-lg leading-snug",
                  q.isNew ? "text-px-yellow" : "text-cream"
                )}
                initial={reduced ? false : { opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.8 }}
                transition={{ delay: i * 0.12, duration: 0.45, ease: EASE }}
              >
                <span
                  aria-hidden
                  className={cn(
                    "retro mt-1 grid size-5 shrink-0 place-items-center text-[0.5rem]",
                    q.done ? "bg-px-green text-night" : "animate-blink bg-px-yellow text-night"
                  )}
                >
                  {q.done ? "✓" : "!"}
                </span>
                <span>
                  <span className="sr-only">{q.done ? "Done: " : "Next: "}</span>
                  {q.label}
                </span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
      <Dialogue speaker="ASHFAQ · 2019" tone="cyan" className="mt-16 px-4">
        Took a drop year. Goal: become an engineer. 2020: B.Sc. Computer Science unlocked. Grind mode: on.
      </Dialogue>
    </Stage>
  )
}

/* ------------------------------------------------------------------------- */

type Cell = "X" | "O" | null
const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

function winner(b: Cell[]) {
  for (const [x, y, z] of LINES) if (b[x] && b[x] === b[y] && b[x] === b[z]) return b[x]
  return b.every(Boolean) ? "draw" : null
}

function minimax(b: Cell[], turn: "X" | "O"): number {
  const w = winner(b)
  if (w === "O") return 1
  if (w === "X") return -1
  if (w === "draw") return 0
  const scores = b.flatMap((c, i) => {
    if (c) return []
    const next = [...b]
    next[i] = turn
    return [minimax(next, turn === "O" ? "X" : "O")]
  })
  return turn === "O" ? Math.max(...scores) : Math.min(...scores)
}

/** Unbeatable most of the time — it plays a random move 1 in 4 turns. */
function aiMove(b: Cell[]) {
  const free = b.flatMap((c, i) => (c ? [] : [i]))
  if (Math.random() < 0.25) return free[Math.floor(Math.random() * free.length)]
  let best = free[0]
  let bestScore = -Infinity
  for (const i of free) {
    const next = [...b]
    next[i] = "O"
    const s = minimax(next, "X")
    if (s > bestScore) {
      bestScore = s
      best = i
    }
  }
  return best
}

function TicTacToe() {
  const [board, setBoard] = React.useState<Cell[]>(Array(9).fill(null))
  const result = winner(board)

  const play = (i: number) => {
    if (board[i] || result) return
    const next = [...board]
    next[i] = "X"
    if (!winner(next)) next[aiMove(next)] = "O"
    setBoard(next)
  }

  const status =
    result === "X" ? "YOU WIN!" : result === "O" ? "ANDROID WINS" : result === "draw" ? "DRAW" : "YOUR TURN (X)"

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="retro text-[0.5rem] text-[#0c2a14]" aria-live="polite">
        {status}
      </p>
      <div className="grid grid-cols-3 gap-1.5 bg-[#0c2a14] p-1.5" role="grid" aria-label="Tic-tac-toe board">
        {board.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => play(i)}
            aria-label={c ? `Cell ${i + 1}: ${c}` : `Cell ${i + 1}: empty`}
            className="retro grid size-14 place-items-center bg-[#a4c639] text-lg text-[#0c2a14] transition-colors hover:bg-[#b8da4a] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#0c2a14] sm:size-16"
          >
            {c && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className={c === "O" ? "text-white" : undefined}>
                {c}
              </motion.span>
            )}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setBoard(Array(9).fill(null))}
        className="retro mt-1 bg-[#0c2a14] px-3 py-2 text-[0.5rem] text-[#a4c639] hover:bg-[#164422]"
      >
        NEW GAME
      </button>
    </div>
  )
}

function Phone() {
  return (
    <div className="relative mx-auto w-[18rem] bg-[#1b1430] p-3 shadow-[12px_14px_0_rgb(0_0_0/0.5)] [clip-path:polygon(8px_0,calc(100%-8px)_0,100%_8px,100%_calc(100%-8px),calc(100%-8px)_100%,8px_100%,0_calc(100%-8px),0_8px)]">
      <div className="mx-auto mb-2 h-1.5 w-16 bg-[#3a3570]" />
      <div className="bg-[#a4c639] px-3 py-5">
        <p className="retro mb-4 text-center text-[0.5625rem] text-[#0c2a14]">TIC TAC TOE.APK</p>
        <TicTacToe />
      </div>
      <div className="mt-2 flex justify-center gap-8 py-1 text-[#3a3570]">
        <span>◁</span>
        <span>○</span>
        <span>□</span>
      </div>
    </div>
  )
}

export function StageAndroid() {
  const reduced = useReducedMotion()
  return (
    <Stage id="android" className="overflow-clip bg-[#0f2416] pb-28">
      <StageTitle id="android" kicker="Year one of B.Sc. CS. Mission: apps for the phone in my pocket." />
      <div className="mx-auto grid max-w-5xl items-center gap-14 px-4 md:grid-cols-2">
        <div className="relative">
          <Phone />
          <Sfx className="-right-2 -top-6 text-5xl text-[#a4c639] sm:text-6xl">ピコッ</Sfx>
        </div>

        <div className="flex flex-col gap-10">
          <Dialogue speaker="ASHFAQ · 2020" tone="green" className="mt-0">
            Built tiny Android games like tic-tac-toe (go on, play it). Then I met the real final boss: the emulator vs. my laptop.
          </Dialogue>

          <motion.div
            role="alert"
            className="mx-auto w-full max-w-md bg-[#c0c0c0] p-1 font-terminal text-lg text-black shadow-[10px_10px_0_rgb(0_0_0/0.55)]"
            initial={reduced ? false : { scale: 0.4, opacity: 0, rotate: -6 }}
            whileInView={{ scale: 1, opacity: 1, rotate: 0 }}
            viewport={{ once: true, amount: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            <div className="flex items-center justify-between bg-[#000080] px-2 text-white">
              <span>Android Emulator</span>
              <span aria-hidden className="bg-[#c0c0c0] px-1.5 text-black">×</span>
            </div>
            <div className="flex gap-3 px-3 py-4">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-tc-red font-bold text-white">
                ×
              </span>
              <p className="leading-tight">
                This device does not meet the requirements to run the emulator. Android
                development is not supported on this machine.
              </p>
            </div>
            <div className="flex justify-center pb-2">
              <span className="border-2 border-black px-6">OK</span>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div
        className="mx-auto mt-20 flex max-w-3xl flex-col items-center gap-4 px-4 text-center"
        initial={reduced ? false : { opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <p className="retro text-[0.625rem] text-lilac">ROUTE BLOCKED</p>
        <p className="retro pixel-text-shadow text-[clamp(1rem,3.6vw,1.75rem)] leading-relaxed text-px-yellow">
          ↻ NEW ROUTE: THE WEB
        </p>
        <p className="max-w-lg font-pixel-sans text-xl text-cream">
          Runs on any machine. Even mine. Sold.
        </p>
        <Button asChild size="sm" className="mt-3 bg-px-yellow text-[0.5625rem] text-night">
          <a href="#web">CONTINUE ▶</a>
        </Button>
      </motion.div>
    </Stage>
  )
}
