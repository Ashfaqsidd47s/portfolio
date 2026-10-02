import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { useSay } from "./companion-context"
import { EraShift } from "./era-shift"
import { EASE, useSceneProgress, useSteppedValue } from "./hooks"
import { Dialogue, Stage, StageTitle } from "./primitives"

/* ------------------------------ tic-tac-toe ------------------------------- */

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

/** The app, in 2020's default Android template colours. */
function TicTacToeApp() {
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
    result === "X" ? "You win! 🎉" : result === "O" ? "Android wins." : result === "draw" ? "Draw." : "Your turn (X)"

  return (
    <div className="flex h-full flex-col bg-[#fafafa] font-sans">
      <div className="bg-[#3700b3] px-3 pb-0.5 pt-1 text-[9px] text-white/80">12:00</div>
      <div className="bg-[#6200ee] px-3 py-2.5 text-[15px] font-medium text-white shadow">TicTacToe</div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-3">
        <p className="text-[13px] font-medium text-[#424242]" aria-live="polite">
          {status}
        </p>
        <div className="grid w-full max-w-[13rem] grid-cols-3 gap-[3px] bg-[#e0e0e0]" role="grid" aria-label="Tic-tac-toe board">
          {board.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => play(i)}
              aria-label={c ? `Cell ${i + 1}: ${c}` : `Cell ${i + 1}: empty`}
              className="grid aspect-square place-items-center bg-white text-2xl font-bold hover:bg-[#f3e5f5]"
            >
              {c && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={c === "X" ? "text-[#6200ee]" : "text-[#03dac5]"}
                >
                  {c}
                </motion.span>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setBoard(Array(9).fill(null))}
          className="rounded bg-[#6200ee] px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-white shadow hover:bg-[#7c3aed]"
        >
          New game
        </button>
      </div>
      <div className="flex justify-around bg-black py-1.5 text-xs text-white/80">
        <span>◀</span>
        <span>●</span>
        <span>■</span>
      </div>
    </div>
  )
}

/* -------------------------------- the IDE --------------------------------- */

const CODE = `package com.ashfaq.tictactoe;

import android.os.Bundle;
import android.widget.Button;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private final String[] board = new String[9];
    private boolean xTurn = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        // TODO: make the AI unbeatable
    }

    public void onCellClick(Button cell) {
        int i = Integer.parseInt(cell.getTag().toString());
        if (board[i] != null) return;
        board[i] = xTurn ? "X" : "O";
        cell.setText(board[i]);
        xTurn = !xTurn;
    }
}`

const KEYWORDS =
  "package|import|public|private|protected|class|extends|final|boolean|int|void|new|return|if|true|false|null|super"
const TOKEN = new RegExp(
  `(\\/\\/.*$)|("(?:[^"\\\\]|\\\\.)*"?)|(@\\w+)|\\b(${KEYWORDS})\\b|\\b(\\d+)\\b|(\\w+)(?=\\()`,
  "g"
)

/** A small Darcula-flavoured Java highlighter. */
function highlight(line: string) {
  const out: React.ReactNode[] = []
  let last = 0
  for (const m of line.matchAll(TOKEN)) {
    const i = m.index ?? 0
    if (i > last) out.push(line.slice(last, i))
    const [text, comment, str, annotation, kw, num, call] = m
    const color = comment
      ? "text-[#808080] italic"
      : str
        ? "text-[#6a8759]"
        : annotation
          ? "text-[#bbb529]"
          : kw
            ? "text-[#cc7832]"
            : num
              ? "text-[#6897bb]"
              : call
                ? "text-[#ffc66d]"
                : ""
    out.push(
      <span key={i} className={color}>
        {text}
      </span>
    )
    last = i + text.length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

type Phase = "splash" | "sync" | "build" | "boot" | "run" | "crash"

const LOGS: Record<Exclude<Phase, "splash">, { tab: string; lines: Array<[string, string?]> }> = {
  sync: {
    tab: "Build",
    lines: [
      ["Gradle sync started"],
      ["Download https://dl.google.com/…/gradle-6.5-bin.zip"],
      ["Resolving dependencies of :app…", "text-[#808080]"],
    ],
  },
  build: {
    tab: "Build",
    lines: [
      ["> Task :app:preBuild UP-TO-DATE", "text-[#808080]"],
      ["> Task :app:compileDebugJavaWithJavac"],
      ["> Task :app:mergeDebugResources"],
      ["> Task :app:packageDebug"],
      ["BUILD SUCCESSFUL in 1m 12s", "text-[#59a869]"],
    ],
  },
  boot: {
    tab: "Run",
    lines: [
      ["Launching 'app' on Pixel 3a API 30."],
      ["Waiting for the emulator to boot…", "text-[#808080]"],
      ["Installing APK: app-debug.apk"],
    ],
  },
  run: {
    tab: "Run",
    lines: [
      ["Installing APK: app-debug.apk"],
      ["$ adb shell am start -n com.ashfaq.tictactoe/.MainActivity", "text-[#808080]"],
      ["Connected to process 4242 on device 'Pixel_3a_API_30'.", "text-[#59a869]"],
    ],
  },
  crash: {
    tab: "Event Log",
    lines: [
      ["Connected to process 4242 on device 'Pixel_3a_API_30'.", "text-[#808080]"],
      ["Emulator: emulator: ERROR: x86 emulation currently requires hardware acceleration!", "text-[#ff6b68]"],
      ["Emulator: Process finished with exit code 1", "text-[#ff6b68]"],
    ],
  },
}

const SAY: Partial<Record<Phase, string>> = {
  sync: "2020. Android Studio. Gradle sync started. I'll just wait. I've got time.",
  build: "BUILD SUCCESSFUL. My laptop fan would like a word.",
  run: "It runs! My tic-tac-toe, on a phone. A pretend phone, but still. Go on, play.",
  crash: "Then the emulator met my laptop. The laptop won. Route blocked.",
}

function Phone({ phase, onColdBoot }: { phase: Phase; onColdBoot: () => void }) {
  return (
    <div className="relative aspect-[9/19] h-full max-h-[34rem] rounded-[2rem] bg-[#121212] p-2 shadow-[0_20px_50px_rgb(0_0_0/0.5),inset_0_0_0_2px_#3a3a3a]">
      <div className="relative h-full overflow-hidden rounded-[1.5rem] bg-black">
        <AnimatePresence mode="wait">
          {(phase === "splash" || phase === "sync" || phase === "build") && (
            <motion.div key="off" className="grid h-full place-items-center text-[10px] text-white/30" exit={{ opacity: 0 }}>
              Pixel 3a API 30 · offline
            </motion.div>
          )}
          {phase === "boot" && (
            <motion.div
              key="boot"
              className="grid h-full place-items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className="animate-pulse bg-gradient-to-r from-white/30 via-white to-white/30 bg-clip-text font-sans text-xl font-light tracking-[0.2em] text-transparent">
                android
              </span>
            </motion.div>
          )}
          {phase === "run" && (
            <motion.div key="run" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TicTacToeApp />
            </motion.div>
          )}
          {phase === "crash" && (
            <motion.div
              key="crash"
              className="grid h-full place-items-center bg-black p-4 text-center"
              initial={{ opacity: 0, filter: "hue-rotate(90deg) contrast(3)" }}
              animate={{ opacity: 1, filter: "none" }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex flex-col items-center gap-3">
                <span className="text-3xl">😵</span>
                <p className="font-sans text-xs text-white/70">Emulator process terminated</p>
                <button
                  type="button"
                  onClick={onColdBoot}
                  className="rounded border border-white/30 px-3 py-1.5 font-sans text-[11px] text-white hover:bg-white/10"
                >
                  Cold boot (good luck)
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <span className="absolute left-1/2 top-3.5 size-2 -translate-x-1/2 rounded-full bg-[#2a2a2a]" />
    </div>
  )
}

const TREE: Array<[string, number, boolean?]> = [
  ["TicTacToe", 0],
  ["app", 1],
  ["manifests", 2],
  ["java", 2],
  ["com.ashfaq.tictactoe", 3],
  ["MainActivity", 4, true],
  ["res", 2],
  ["layout", 3],
  ["activity_main.xml", 4],
  ["Gradle Scripts", 1],
]

function AndroidStudioScene() {
  const reduced = useReducedMotion()
  const ref = React.useRef<HTMLDivElement>(null)
  const progress = useSceneProgress(ref)
  const p = useSteppedValue(progress, 300)
  const [coldBooted, setColdBooted] = React.useState(false)
  const say = useSay()

  const base: Phase =
    p < 0.08 ? "splash" : p < 0.4 ? "sync" : p < 0.55 ? "build" : p < 0.62 ? "boot" : p < 0.82 ? "run" : "crash"
  const phase: Phase = base === "crash" && coldBooted ? "run" : base

  // Speak on phase changes only, not on every scroll tick.
  const onScreen = p > 0 && p < 1
  React.useEffect(() => {
    const line = SAY[base]
    if (line && onScreen) say({ speaker: "ASHFAQ · 2020", text: line, tone: "green" })
  }, [base, onScreen, say])

  const chars = Math.floor(Math.min(1, Math.max(0, (p - 0.08) / 0.3)) * CODE.length)
  const typed = CODE.slice(0, chars).split("\n")
  const syncCount = Math.min(47, Math.floor(Math.max(0, (p - 0.08) / 0.32) * 47))
  const log = base === "splash" ? null : LOGS[phase === "run" && base === "crash" ? "run" : base]
  const memory = Math.min(1, 0.35 + p * 0.7)

  return (
    <div ref={ref} className={reduced ? "relative" : "relative h-[340vh]"}>
      <div className="sticky top-0 flex h-svh flex-col bg-[#2b2b2b] pt-[4.5rem] font-sans text-[13px] text-[#a9b7c6]">
        {/* Title / toolbar */}
        <div className="flex h-9 shrink-0 items-center gap-3 border-b border-[#323232] bg-[#3c3f41] px-3">
          <span className="text-[#bbbbbb]">☰</span>
          <span className="truncate font-semibold text-[#bbbbbb]">TicTacToe</span>
          <span className="hidden truncate text-[#808080] md:inline">app › src › main › java › MainActivity.java</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="hidden rounded border border-[#555] px-2 py-0.5 text-xs sm:inline">📱 Pixel 3a API 30 ▾</span>
            <span className={cn("text-base", phase === "boot" || phase === "run" ? "text-[#59a869]" : "text-[#bbbbbb]")} title="Run 'app'">
              ▶
            </span>
            <span className={cn("text-sm", phase === "run" ? "text-[#c75450]" : "text-[#555]")}>■</span>
          </span>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Project tree */}
          <aside className="hidden w-56 shrink-0 border-r border-[#323232] bg-[#3c3f41] py-2 lg:block">
            <p className="px-3 pb-2 text-xs font-semibold text-[#bbbbbb]">Project ▾</p>
            {TREE.map(([name, depth, active]) => (
              <p
                key={name}
                className={cn("truncate py-0.5 pr-2", active && "bg-[#0d293e] text-white")}
                style={{ paddingLeft: 12 + depth * 14 }}
              >
                <span className="mr-1.5 text-[#808080]">{/\.|Activity/.test(name) ? "▫" : "▸"}</span>
                {name}
              </p>
            ))}
          </aside>

          {/* Editor */}
          <div className="hidden min-w-0 flex-1 flex-col md:flex">
            <div className="flex h-8 shrink-0 items-end gap-px border-b border-[#323232] bg-[#3c3f41] px-2 text-xs">
              <span className="border-b-2 border-[#4a88c7] bg-[#4e5254] px-3 py-1.5 text-[#e8e8e8]">MainActivity.java</span>
              <span className="px-3 py-1.5">activity_main.xml</span>
            </div>
            <pre className="min-h-0 flex-1 overflow-hidden py-2 font-mono text-[12.5px] leading-[1.55]">
              {typed.map((line, i) => (
                <div key={i} className="flex whitespace-pre">
                  <span className="w-10 shrink-0 select-none pr-3 text-right text-[#606366]">{i + 1}</span>
                  <span>
                    {highlight(line)}
                    {i === typed.length - 1 && chars < CODE.length && (
                      <span className="animate-blink text-white">▏</span>
                    )}
                  </span>
                </div>
              ))}
            </pre>
          </div>

          {/* Emulator */}
          <div className="flex min-w-0 flex-1 flex-col border-l border-[#323232] bg-[#313335] md:w-[20rem] md:flex-none">
            <p className="flex h-8 shrink-0 items-center border-b border-[#323232] px-3 text-xs text-[#bbbbbb]">
              Running Devices: Pixel_3a_API_30
            </p>
            <div className="flex min-h-0 flex-1 items-center justify-center p-3">
              <Phone phase={phase} onColdBoot={() => setColdBooted(true)} />
            </div>
          </div>
        </div>

        {/* Bottom tool window */}
        <div className="h-28 shrink-0 border-t border-[#323232] bg-[#2b2b2b] sm:h-32">
          <div className="flex h-7 items-center gap-1 border-b border-[#323232] bg-[#3c3f41] px-2 text-xs">
            {["Build", "Run", "Logcat", "Event Log"].map((t) => (
              <span
                key={t}
                className={cn("px-2 py-1", log?.tab === t ? "bg-[#4e5254] text-[#e8e8e8]" : "text-[#808080]")}
              >
                {t}
              </span>
            ))}
          </div>
          <div className="overflow-hidden px-3 py-1.5 font-mono text-[11.5px] leading-[1.6]" aria-live="polite">
            {log?.lines.map(([text, color], i) => (
              <motion.p
                key={`${phase}-${i}`}
                className={cn("truncate", color)}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.12 }}
              >
                {text}
              </motion.p>
            ))}
          </div>
        </div>

        {/* Status bar */}
        <div className="flex h-6 shrink-0 items-center gap-3 border-t border-[#323232] bg-[#3c3f41] px-3 text-[11px] text-[#999]">
          <span className="truncate">
            {base === "sync"
              ? `Gradle sync: resolving dependencies (${syncCount}/47)…`
              : base === "splash"
                ? "Indexing…"
                : "Gradle sync finished in 2 m 41 s"}
          </span>
          {base === "sync" && (
            <span className="hidden h-1.5 w-32 overflow-hidden rounded bg-[#555] sm:block">
              <span className="block h-full bg-[#4a88c7]" style={{ width: `${(syncCount / 47) * 100}%` }} />
            </span>
          )}
          <span className="ml-auto hidden sm:inline">LF · UTF-8 · 4 spaces</span>
          <span className="flex items-center gap-1.5" title="Memory">
            <span className="h-2 w-16 overflow-hidden rounded-sm bg-[#555]">
              <span
                className={cn("block h-full", memory > 0.9 ? "bg-[#c75450]" : "bg-[#6a8759]")}
                style={{ width: `${memory * 100}%` }}
              />
            </span>
          </span>
        </div>

        {/* Splash */}
        <AnimatePresence>
          {base === "splash" && !reduced && (
            <motion.div
              className="absolute inset-0 top-[4.5rem] grid place-items-center bg-[#2b2b2b]"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <p className="font-sans text-sm text-[#808080]">Opening project TicTacToe…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* IDE balloon on crash */}
        <AnimatePresence>
          {base === "crash" && !coldBooted && (
            <motion.div
              role="alert"
              className="absolute bottom-10 right-3 z-10 w-[min(22rem,calc(100%-1.5rem))] rounded-md border border-[#5e3a3a] bg-[#4b2d2d] p-3 text-xs text-[#e8e8e8] shadow-xl sm:bottom-40"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <p className="font-semibold">⚠ Emulator</p>
              <p className="mt-1 text-[#d0d0d0]">The emulator process for AVD Pixel_3a_API_30 has terminated.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="sr-only">
        {Object.values(SAY).map((s) => (
          <p key={s}>{s}</p>
        ))}
      </div>
    </div>
  )
}

export function StageAndroid() {
  const reduced = useReducedMotion()
  return (
    <Stage id="android" className="overflow-clip bg-[#2b2b2b] pb-28 text-[#a9b7c6]">
      <EraShift />
      <StageTitle id="android" variant="ide" kicker="Year one of B.Sc. CS. Mission: apps for the phone in my pocket." />
      <AndroidStudioScene />

      <motion.div
        className="mx-auto mt-24 w-[min(30rem,calc(100%-2rem))] rounded-lg border border-[#555] bg-[#3c3f41] p-4 font-sans text-sm text-[#d0d0d0] shadow-2xl"
        initial={reduced ? false : { opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <p className="font-semibold text-[#e8e8e8]">⚠ Android development is not supported on this machine</p>
        <p className="mt-1 text-[#a9b7c6]">Hardware acceleration unavailable. Consider a platform that runs anywhere.</p>
        <div className="mt-3 flex gap-4 text-[#589df6]">
          <a href="#web" className="font-semibold hover:underline">
            Switch to the web →
          </a>
          <span className="text-[#808080]">Ignore</span>
        </div>
      </motion.div>
      <Dialogue speaker="ASHFAQ · 2020" tone="green">
        The web runs on any machine. Even mine. Switching.
      </Dialogue>
    </Stage>
  )
}
