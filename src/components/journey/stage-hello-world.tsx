import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Progress } from "@/components/ui/8bit/progress"
import { Button } from "@/components/ui/8bit/button"
import { cn } from "@/lib/utils"
import { Dialogue, PixelSprite, Stage, StageTitle } from "./primitives"
import { useSay } from "./companion-context"
import { useSceneProgress, useSteppedValue } from "./hooks"
import { HEART } from "./sprites"

/* Turbo C++ 3.0 editor colours: yellow text, white keywords, on blue. */
type Tok = [text: string, kind?: "kw" | "pp" | "str" | "cm"]
const tokColor = {
  kw: "text-tc-white",
  pp: "text-tc-green",
  str: "text-[#55ffff]",
  cm: "text-tc-gray",
} as const

const HELLO: Tok[][] = [
  [["#include <iostream.h>", "pp"]],
  [["#include <conio.h>", "pp"]],
  [],
  [["void", "kw"], [" main() {"]],
  [["    clrscr();"]],
  [["    cout << "], ['"Hello World"', "str"], [";"]],
  [["    getch();"]],
  [["}"]],
]

const lineLength = (line: Tok[]) => line.reduce((n, t) => n + t[0].length, 0)

/** Prints the first `chars` characters of `lines`, each line counting its newline. */
function CodeLines({ lines, chars }: { lines: Tok[][]; chars: number }) {
  const lineStarts = lines.map((_, i) => lines.slice(0, i).reduce((n, l) => n + lineLength(l) + 1, 0))
  return (
    <>
      {lines.map((line, i) => {
        const lineBudget = Math.max(0, Math.min(lineLength(line) + 1, chars - lineStarts[i]))
        const isCaretLine = lineBudget > 0 && chars - lineStarts[i] <= lineLength(line)
        const tokStarts = line.map((_, j) => lineLength(line.slice(0, j)))
        return (
          <div key={i} className="min-h-[1.2em] whitespace-pre">
            {line.map(([text, kind], j) => {
              const shown = text.slice(0, Math.max(0, lineBudget - tokStarts[j]))
              return (
                <span key={j} className={kind ? tokColor[kind] : undefined}>
                  {shown}
                </span>
              )
            })}
            {isCaretLine && <span className="animate-blink text-tc-yellow">_</span>}
          </div>
        )
      })}
    </>
  )
}

const MENU = ["File", "Edit", "Search", "Run", "Compile", "Debug", "Project", "Options", "Window", "Help"]

function TurboWindow({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("relative bg-tc-blue p-1.5 font-terminal text-tc-yellow", className)}>
      <div className="relative h-full border-[3px] border-double border-tc-white px-3 pb-2 pt-4 sm:px-5">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-tc-blue px-2 text-tc-white">
          {title}
        </span>
        <span className="absolute -top-3 left-2 bg-tc-blue px-1 text-tc-white">[■]</span>
        {children}
      </div>
    </div>
  )
}

const CAPTIONS = [
  "2018. Class 11. C++ on Turbo C++. No mouse, no internet, no problem.",
  "Alt+F9. Zero errors. Peak of my career, honestly.",
  "Ctrl+F9. Hello World. Hooked for life.",
]

function HelloWorldScene() {
  const reduced = useReducedMotion()
  const ref = React.useRef<HTMLDivElement>(null)
  const progress = useSceneProgress(ref)
  const p = useSteppedValue(progress, 200)
  const total = HELLO.reduce((n, l) => n + l.map((t) => t[0]).join("").length + 1, 0)
  const chars = Math.floor(Math.min(1, p / 0.5) * total)
  const phase = p < 0.52 ? 0 : p < 0.72 ? 1 : 2
  const say = useSay()
  const started = p > 0.02

  React.useEffect(() => {
    if (started) say({ speaker: "ASHFAQ · 2018", text: CAPTIONS[phase], tone: "pink" })
  }, [phase, started, say])

  return (
    <div ref={ref} className={reduced ? "relative" : "relative h-[300vh]"}>
      <div className="sticky top-0 flex h-svh flex-col bg-tc-blue pt-[4.5rem] font-terminal text-xl sm:text-2xl">
        {/* Menu bar */}
        <div className="flex gap-4 overflow-hidden whitespace-nowrap bg-tc-gray px-3 text-black">
          <span>≡</span>
          {MENU.map((m) => (
            <span key={m}>
              <span className="text-tc-red">{m[0]}</span>
              {m.slice(1)}
            </span>
          ))}
        </div>

        <TurboWindow title="HELLO.CPP" className="relative min-h-0 flex-1">
          <div className="text-lg leading-[1.2] sm:text-2xl">
            <CodeLines lines={HELLO} chars={chars} />
          </div>

          {/* Compile dialog */}
          <AnimatePresence>
            {phase === 1 && (
              <motion.div
                className="absolute left-1/2 top-[38%] w-[min(26rem,85%)] -translate-x-1/2 bg-tc-gray p-1.5 text-black shadow-[10px_10px_0_rgb(0_0_0/0.6)]"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
              >
                <div className="border-[3px] border-double border-tc-white px-4 py-3">
                  <p className="text-center text-tc-white">Compiling</p>
                  <p>Main file: HELLO.CPP</p>
                  <p>Compiling: EDITOR → HELLO.CPP</p>
                  <div className="mt-2 flex justify-between">
                    <span>Warnings: 0</span>
                    <span>Errors: 0</span>
                  </div>
                  <p className="mt-2 text-center">
                    <span className="bg-tc-green px-2">Success</span> : Press any key
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </TurboWindow>

        {/* Status bar */}
        <div className="flex gap-4 overflow-hidden whitespace-nowrap bg-tc-gray px-3 text-black">
          {["F1 Help", "F2 Save", "F3 Open", "Alt-F9 Compile", "F9 Make", "F10 Menu"].map((k) => (
            <span key={k}>
              <span className="text-tc-red">{k.split(" ")[0]}</span> {k.split(" ")[1]}
            </span>
          ))}
        </div>

        {/* User screen (Alt+F5) */}
        <AnimatePresence>
          {phase === 2 && (
            <motion.div
              className="crt absolute inset-0 top-[4.5rem] bg-black p-4 text-2xl text-tc-gray sm:text-3xl"
              initial={{ clipPath: "inset(50% 0 50% 0)" }}
              animate={{ clipPath: "inset(0% 0 0% 0)" }}
              exit={{ clipPath: "inset(50% 0 50% 0)" }}
              transition={{ duration: 0.35 }}
            >
              <p className="text-tc-white">Hello World<span className="animate-blink">_</span></p>
              <motion.p
                aria-hidden
                className="retro pixel-text-shadow absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-6 whitespace-nowrap text-[clamp(1.5rem,7vw,4.5rem)] text-px-yellow"
                initial={{ scale: 3, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.25 }}
              >
                IT WORKS!
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Every caption, readable without scrolling through the scene. */}
      <div className="sr-only">
        {CAPTIONS.map((c) => (
          <p key={c}>{c}</p>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------- */

const LOVE_CPP: Tok[][] = [
  [["// LOVE.CPP  (rebuilt from memory)", "cm"]],
  [["#include <iostream.h>", "pp"]],
  [["#include <stdio.h>", "pp"]],
  [["#include <conio.h>", "pp"]],
  [],
  [["void", "kw"], [" main() {"]],
  [["    "], ["char", "kw"], [" a[30], b[30];"]],
  [["    clrscr();"]],
  [["    cout << "], ['"Your name: "', "str"], ["; gets(a);"]],
  [["    cout << "], ['"Crush name: "', "str"], ["; gets(b);"]],
  [["    // cancel every letter both names share", "cm"]],
  [["    "], ["for", "kw"], [" (int i = 0; a[i]; i++)"]],
  [["      "], ["for", "kw"], [" (int j = 0; b[j]; j++)"]],
  [["        "], ["if", "kw"], [" (a[i] == b[j] && a[i] != '*') {"]],
  [["          a[i] = b[j] = '*';"]],
  [["          "], ["break", "kw"], [";"]],
  [["        }"]],
  [["    // ...count what's left, do some maths ♥", "cm"]],
  [["    cout << "], ['"Love: "', "str"], [" << percent << "], ['"%"', "str"], [";"]],
  [["    getch();"]],
  [["}"]],
]

function lettersOf(name: string) {
  return [...name.toUpperCase().replace(/[^A-Z]/g, "")]
}

function loveCalc(a: string, b: string) {
  const A = lettersOf(a)
  const B = lettersOf(b)
  const ca = A.map(() => false)
  const cb = B.map(() => false)
  A.forEach((ch, i) => {
    const j = B.findIndex((c, k) => c === ch && !cb[k])
    if (j !== -1) {
      ca[i] = true
      cb[j] = true
    }
  })
  const common = ca.filter(Boolean).length
  const remaining = A.length + B.length - common * 2
  let seed = 7
  for (const ch of [...A, ...B]) seed = (seed * 31 + ch.charCodeAt(0)) % 9973
  let pct = 38 + common * 9 + (seed % 23) - Math.min(remaining, 12)
  if (/^(CODE|CODING|PROGRAMMING|CPP|C)$/.test(B.join("")) || /^(CODE|CODING|PROGRAMMING)$/.test(A.join(""))) {
    pct = 100
  }
  return { A, B, ca, cb, pct: Math.max(11, Math.min(100, pct)) }
}

function verdict(p: number) {
  if (p === 100) return "Soulmates. Clearly."
  if (p >= 80) return "Book the wedding hall."
  if (p >= 60) return "There's definitely something there."
  if (p >= 40) return "Friendship. Strong friendship."
  return "The compiler says: syntax error ♥"
}

function CancelledName({ letters, cancelled, show }: { letters: string[]; cancelled: boolean[]; show: boolean }) {
  const reduced = useReducedMotion()
  return (
    <span className="flex flex-wrap gap-x-1 text-2xl tracking-widest">
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          className="relative"
          animate={
            show && cancelled[i]
              ? { color: "#ff5555", opacity: 0.55 }
              : { color: "#ffffff", opacity: 1 }
          }
          transition={{ delay: reduced ? 0 : 0.08 * i }}
        >
          {ch}
          {cancelled[i] && (
            <motion.span
              aria-hidden
              className="absolute left-[-2px] right-[-2px] top-1/2 h-[3px] bg-tc-red"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: show ? 1 : 0 }}
              transition={{ delay: reduced ? 0 : 0.08 * i, duration: 0.2 }}
            />
          )}
        </motion.span>
      ))}
    </span>
  )
}

function LoveCalculator() {
  const reduced = useReducedMotion()
  const [a, setA] = React.useState("")
  const [b, setB] = React.useState("")
  const [stage, setStage] = React.useState<"idle" | "cancel" | "calc" | "done">("idle")
  const [result, setResult] = React.useState<ReturnType<typeof loveCalc> | null>(null)
  const [count, setCount] = React.useState(0)
  const timers = React.useRef<number[]>([])

  React.useEffect(() => () => timers.current.forEach(clearTimeout), [])

  React.useEffect(() => {
    if (stage !== "done" || !result || reduced) return
    const id = window.setInterval(() => {
      setCount((c) => {
        if (c >= result.pct) {
          window.clearInterval(id)
          return c
        }
        return c + 1
      })
    }, 14)
    return () => window.clearInterval(id)
  }, [stage, result, reduced])

  const run = (e: React.FormEvent) => {
    e.preventDefault()
    if (!lettersOf(a).length || !lettersOf(b).length) return
    timers.current.forEach(clearTimeout)
    const r = loveCalc(a, b)
    setResult(r)
    setCount(0)
    setStage("cancel")
    const longest = Math.max(r.A.length, r.B.length)
    timers.current = [
      window.setTimeout(() => setStage("calc"), reduced ? 0 : 600 + longest * 80),
      window.setTimeout(() => setStage("done"), reduced ? 0 : 1800 + longest * 80),
    ]
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-2">
      <TurboWindow title="LOVE.CPP" className="shadow-[10px_10px_0_rgb(0_0_0/0.45)]">
        <div className="overflow-x-auto text-base leading-[1.25] sm:text-lg">
          <CodeLines lines={LOVE_CPP} chars={Infinity} />
        </div>
      </TurboWindow>

      <div className="crt relative flex min-h-[26rem] flex-col bg-black p-5 font-terminal text-xl text-tc-gray shadow-[10px_10px_0_rgb(0_0_0/0.45)]">
        <p className="text-tc-white">C:\TC&gt;LOVE.EXE</p>
        <form onSubmit={run} className="mt-3 flex flex-col gap-2">
          <label className="flex flex-wrap items-baseline gap-x-2">
            <span>Your name:</span>
            <input
              value={a}
              onChange={(e) => {
                setA(e.target.value)
                setStage("idle")
              }}
              maxLength={20}
              placeholder="type here_"
              className="min-w-0 flex-1 bg-transparent text-tc-yellow caret-tc-yellow outline-none placeholder:text-tc-gray/50 focus-visible:bg-white/5"
            />
          </label>
          <label className="flex flex-wrap items-baseline gap-x-2">
            <span>Crush name:</span>
            <input
              value={b}
              onChange={(e) => {
                setB(e.target.value)
                setStage("idle")
              }}
              maxLength={20}
              placeholder="type here_"
              className="min-w-0 flex-1 bg-transparent text-tc-yellow caret-tc-yellow outline-none placeholder:text-tc-gray/50 focus-visible:bg-white/5"
            />
          </label>
          <div className="mt-3">
            <Button
              type="submit"
              size="sm"
              className="bg-px-pink text-[0.5625rem] text-night hover:bg-px-pink/90"
              disabled={!lettersOf(a).length || !lettersOf(b).length}
            >
              RUN · CTRL+F9
            </Button>
          </div>
        </form>

        <div className="mt-5 flex-1" aria-live="polite">
          {stage !== "idle" && result && (
            <div className="flex flex-col gap-2">
              <p className="text-tc-gray">Cancelling common letters...</p>
              <CancelledName letters={result.A} cancelled={result.ca} show />
              <CancelledName letters={result.B} cancelled={result.cb} show />
            </div>
          )}
          {(stage === "calc" || stage === "done") && (
            <div className="mt-4">
              <p>Calculating love...</p>
              <Progress
                value={stage === "done" ? 100 : 55}
                variant="retro"
                progressBg="bg-px-pink"
                className="mt-2 h-4 [--foreground:#aaaaaa] [--ring:#aaaaaa]"
              />
            </div>
          )}
          {stage === "done" && result && (
            <motion.div
              className="mt-5 flex items-center gap-4"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <PixelSprite sprite={HEART} className="w-12 animate-bob" />
              <div>
                <p className="text-4xl text-tc-white">Love: {reduced ? result.pct : count}%</p>
                <p className="text-tc-yellow">{verdict(result.pct)}</p>
              </div>
            </motion.div>
          )}
        </div>
        <p className="mt-4 text-base text-tc-gray/70">
          Results are 100% scientific. (They are not.) Nothing you type leaves this page.
        </p>
      </div>
    </div>
  )
}

export function StageHelloWorld() {
  return (
    <Stage id="hello-world" className="overflow-clip bg-tc-blue">
      <StageTitle id="hello-world" kicker="Class 11. A blue screen. A blinking cursor. Destiny." />
      <HelloWorldScene />
      <div className="pb-24 pt-10">
        <Dialogue speaker="ASHFAQ · 2018" tone="yellow" className="mb-12 px-4">
          First real program: a love calculator. Cancel shared letters, do "maths", print a %. Peer-reviewed by the entire class. Your turn.
        </Dialogue>
        <LoveCalculator />
      </div>
    </Stage>
  )
}
