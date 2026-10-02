import * as React from "react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/8bit/button"
import { cn } from "@/lib/utils"
import { Dialogue, Stage, StageTitle, Sfx } from "./primitives"
import { EASE } from "./hooks"

/* ---------------------------- the assignment ----------------------------- */

const TILES = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", "+"]
const OPS = new Set(["+", "−", "×", "÷"])

function evaluate(tokens: string[]): string {
  // Merge digits into numbers, then apply × ÷ before + −.
  const parts: Array<number | string> = []
  for (const t of tokens) {
    const last = parts[parts.length - 1]
    if (OPS.has(t)) {
      if (typeof last === "number") parts.push(t)
    } else if (typeof last === "number") {
      parts[parts.length - 1] = last * 10 + Number(t)
    } else {
      parts.push(Number(t))
    }
  }
  if (typeof parts[parts.length - 1] === "string") parts.pop()
  if (!parts.length) return "0"
  const stack: Array<number | string> = [parts[0]]
  for (let i = 1; i < parts.length; i += 2) {
    const op = parts[i] as string
    const n = parts[i + 1] as number
    if (op === "×" || op === "÷") {
      const prev = stack.pop() as number
      if (op === "÷" && n === 0) return "ERR"
      stack.push(op === "×" ? prev * n : prev / n)
    } else {
      stack.push(op, n)
    }
  }
  let total = stack[0] as number
  for (let i = 1; i < stack.length; i += 2) {
    total = stack[i] === "+" ? total + (stack[i + 1] as number) : total - (stack[i + 1] as number)
  }
  return String(Math.round(total * 1e6) / 1e6)
}

function DndCalculator() {
  const dropRef = React.useRef<HTMLDivElement>(null)
  const dragged = React.useRef(false)
  const [tokens, setTokens] = React.useState<string[]>([])
  const [result, setResult] = React.useState<string | null>(null)
  const [hover, setHover] = React.useState(false)

  const add = (t: string) => {
    setResult(null)
    setTokens((ts) => (ts.length >= 16 ? ts : [...ts, t]))
  }

  const overDrop = (x: number, y: number) => {
    const r = dropRef.current?.getBoundingClientRect()
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
  }

  return (
    <div className="px-frame-shadow bg-ink p-4 sm:p-5">
      <p className="retro mb-3 text-[0.5625rem] text-px-cyan">DND-CALC · NO LIBRARIES</p>
      <div
        ref={dropRef}
        className={cn(
          "flex min-h-16 flex-wrap items-center gap-1 border-4 border-dashed px-3 py-2 font-terminal text-3xl transition-colors",
          hover ? "border-px-yellow bg-px-yellow/10" : "border-lilac/40 bg-night"
        )}
        aria-live="polite"
      >
        {tokens.length === 0 && result === null && (
          <span className="text-xl text-lilac/60">drag tiles here (or tap them)</span>
        )}
        {tokens.map((t, i) => (
          <span key={i} className="text-cream">
            {t}
          </span>
        ))}
        {result !== null && <span className="ml-auto text-px-yellow">= {result}</span>}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {TILES.map((t) => (
          <motion.button
            key={t}
            type="button"
            drag
            dragSnapToOrigin
            dragElastic={0.9}
            whileDrag={{ scale: 1.2, zIndex: 20, rotate: -6 }}
            onDragStart={() => {
              dragged.current = true
            }}
            onDrag={(_, info) => setHover(overDrop(info.point.x - window.scrollX, info.point.y - window.scrollY))}
            onDragEnd={(_, info) => {
              setHover(false)
              if (overDrop(info.point.x - window.scrollX, info.point.y - window.scrollY)) add(t)
            }}
            onClick={() => {
              // A drag also ends in a click; only a plain tap should add.
              if (dragged.current) {
                dragged.current = false
                return
              }
              add(t)
            }}
            className={cn(
              "relative h-12 cursor-grab touch-none font-terminal text-3xl active:cursor-grabbing",
              OPS.has(t) ? "bg-px-pink text-night" : "bg-cream text-night",
              t === "+" && "col-span-2"
            )}
            aria-label={`Add ${t}`}
          >
            {t}
          </motion.button>
        ))}
      </div>
      <div className="mt-4 flex gap-4">
        <Button size="sm" className="flex-1 bg-px-yellow text-[0.5625rem] text-night" onClick={() => setResult(evaluate(tokens))}>
          =
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 bg-ink text-[0.5625rem] text-cream"
          onClick={() => {
            setTokens([])
            setResult(null)
          }}
        >
          CLEAR
        </Button>
      </div>
    </div>
  )
}

const CANDIDATES = ["Tabs", "Spaces", "Whatever Prettier says"]

function ElectionApp() {
  const [votes, setVotes] = React.useState([3, 2, 5])
  const total = votes.reduce((a, b) => a + b, 0)
  return (
    <div className="px-frame-shadow bg-ink p-4 sm:p-5">
      <p className="retro mb-4 text-[0.5625rem] text-px-cyan">ELECTION.APP</p>
      <ul className="flex flex-col gap-3">
        {CANDIDATES.map((c, i) => (
          <li key={c}>
            <button
              type="button"
              onClick={() => setVotes((v) => v.map((n, j) => (j === i ? n + 1 : n)))}
              className="group w-full text-left"
            >
              <span className="flex justify-between font-pixel-sans text-lg text-cream">
                <span>
                  <span className="text-px-yellow opacity-0 group-hover:opacity-100">▶ </span>
                  {c}
                </span>
                <span className="text-lilac">{votes[i]} votes</span>
              </span>
              <span className="mt-1 block h-3 bg-night">
                <motion.span
                  className="block h-full bg-px-cyan"
                  animate={{ width: `${(votes[i] / total) * 100}%` }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 font-pixel-sans text-base text-lilac">Click a candidate to vote. Democracy!</p>
    </div>
  )
}

function SelectedStamp() {
  const reduced = useReducedMotion()
  return (
    <motion.div
      className="mx-auto mt-16 flex w-fit -rotate-6 flex-col items-center border-[6px] border-px-red px-8 py-4 text-px-red"
      initial={reduced ? false : { scale: 3, opacity: 0 }}
      whileInView={{ scale: 1, opacity: 1 }}
      viewport={{ once: true, amount: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 18 }}
    >
      <span aria-hidden className="text-5xl font-black leading-none sm:text-6xl">合格</span>
      <span className="retro mt-2 text-sm">SELECTED</span>
    </motion.div>
  )
}

/* ---------------------------- trading platform --------------------------- */

type LogLine = { id: number; text: string; tone: "dim" | "good" | "bad" | "info" }
type Status = "open" | "target" | "stop"

const HISTORY = 70

function TradingSim() {
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const inView = useInView(wrapRef, { amount: 0.3 })
  const reduced = useReducedMotion()
  const [prices, setPrices] = React.useState<number[]>(() => Array(HISTORY).fill(100))
  const [levels, setLevels] = React.useState({ entry: 100, target: 106, stop: 95.5 })
  const [status, setStatus] = React.useState<Status>("open")
  const [tabOpen, setTabOpen] = React.useState(true)
  const [serverSide, setServerSide] = React.useState(false)
  const [log, setLog] = React.useState<LogLine[]>([])
  const [ledger, setLedger] = React.useState({ saved: 0, missed: 0 })
  const lineId = React.useRef(0)
  // Which way the market leans this round: +1 drifts to the target, -1 to the stop.
  const bias = React.useRef(1)
  const roundTimer = React.useRef(0)
  const state = React.useRef({ tabOpen, serverSide, status, levels })
  React.useEffect(() => {
    state.current = { tabOpen, serverSide, status, levels }
  })

  const push = React.useCallback((text: string, tone: LogLine["tone"]) => {
    setLog((l) => [...l.slice(-6), { id: ++lineId.current, text, tone }])
  }, [])

  const pricesRef = React.useRef(prices)

  React.useEffect(() => {
    if (!inView || reduced) return
    const id = window.setInterval(() => {
      const { tabOpen, serverSide, status, levels } = state.current
      if (status !== "open") return
      const ps = pricesRef.current
      const prev = ps[ps.length - 1]
      const next = Math.round((prev + (Math.random() - 0.5) * 1.3 + bias.current * 0.12) * 100) / 100
      pricesRef.current = [...ps.slice(1), next]
      setPrices(pricesRef.current)

      const hit: Status | null = next >= levels.target ? "target" : next <= levels.stop ? "stop" : null
      const listener = serverSide ? "server" : tabOpen ? "browser" : null
      if (listener && Math.random() < 0.35) push(`${listener}: ws ← tick ${next.toFixed(2)}`, "dim")
      if (!hit) return

      state.current.status = hit
      setStatus(hit)
      const what = hit === "target" ? "TARGET HIT" : "STOP-LOSS HIT"
      if (listener) {
        push(`${listener}: ${what} @ ${next.toFixed(2)} → saved to DB ✓`, "good")
        setLedger((l) => ({ ...l, saved: l.saved + 1 }))
      } else {
        push(`market: ${what.toLowerCase()} @ ${next.toFixed(2)}`, "info")
        push("db: …nothing. Nobody was listening ✗", "bad")
        setLedger((l) => ({ ...l, missed: l.missed + 1 }))
      }
      // Next round: open a fresh position from here.
      roundTimer.current = window.setTimeout(() => {
        bias.current = Math.random() < 0.6 ? 1 : -1
        setLevels({ entry: next, target: next + 6, stop: next - 4.5 })
        setStatus("open")
      }, 1600)
    }, 320)
    return () => window.clearInterval(id)
  }, [inView, reduced, push])

  React.useEffect(() => () => window.clearTimeout(roundTimer.current), [])

  // Chart geometry
  const W = 600
  const H = 240
  const all = [...prices, levels.target, levels.stop]
  const min = Math.min(...all) - 1
  const max = Math.max(...all) + 1
  const y = (v: number) => H - ((v - min) / (max - min)) * H
  const points = prices.map((v, i) => `${(i / (HISTORY - 1)) * W},${y(v)}`).join(" ")
  const last = prices[prices.length - 1]
  const pnl = last - levels.entry

  const levelLine = (v: number, color: string, label: string, dashed = false) => (
    <g>
      <line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke={color} strokeWidth={2} strokeDasharray={dashed ? "6 6" : undefined} />
      <text x={W - 4} y={y(v) - 5} textAnchor="end" fill={color} className="font-terminal" fontSize={18}>
        {label} {v.toFixed(2)}
      </text>
    </g>
  )

  return (
    <div ref={wrapRef} className="mx-auto max-w-6xl px-4">
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        {/* Market */}
        <div className="px-frame-shadow bg-[#07140d] p-4 [--px-frame:#2f6b45]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="retro text-[0.5625rem] text-px-green">MARKET · LIVE FEED</p>
            <p className="font-terminal text-2xl text-cream">
              OPTION CE <span className={pnl >= 0 ? "text-px-green" : "text-px-red"}>{last.toFixed(2)}</span>
            </p>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Simulated live option price with target and stop-loss levels">
            {levelLine(levels.target, "#4dff88", "TARGET")}
            {levelLine(levels.stop, "#ff5a4f", "SL")}
            {levelLine(levels.entry, "#b9b3d6", "ENTRY", true)}
            <polyline points={points} fill="none" stroke="#ffd23f" strokeWidth={3} strokeLinejoin="bevel" />
            <circle cx={W} cy={y(last)} r={5} fill="#ffd23f" />
          </svg>
          <p className="mt-2 font-pixel-sans text-base text-lilac">
            Simulated paper trade. The market keeps moving whether or not anyone is watching.
          </p>
        </div>

        {/* The app, in a browser tab */}
        <div className="flex flex-col border-4 border-night bg-ink shadow-[10px_12px_0_rgb(0_0_0/0.45)]">
          <div className="flex items-center gap-2 border-b-4 border-night bg-ink-2 px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate bg-night px-2 font-terminal text-base text-lilac">
              papertrade.app/positions
            </span>
            {tabOpen && (
              <button
                type="button"
                onClick={() => setTabOpen(false)}
                className="retro bg-px-red px-2 py-1 text-[0.5rem] text-night hover:brightness-110"
              >
                CLOSE TAB ×
              </button>
            )}
          </div>
          <div className="relative flex min-h-[17rem] flex-1 flex-col p-3">
            <div className="flex items-center justify-between font-pixel-sans text-lg">
              <span className="text-cream">Position · CE</span>
              <span
                className={cn(
                  "retro px-2 py-1 text-[0.5rem]",
                  status === "open" && "bg-lilac text-night",
                  status === "target" && "bg-px-green text-night",
                  status === "stop" && "bg-px-red text-night"
                )}
              >
                {status === "open" ? "OPEN" : status === "target" ? "TARGET HIT" : "STOPPED OUT"}
              </span>
            </div>
            <ul className="mt-3 flex flex-1 flex-col justify-end gap-0.5 font-terminal text-lg leading-tight" aria-live="polite">
              {log.map((l) => (
                <li
                  key={l.id}
                  className={cn(
                    l.tone === "dim" && "text-lilac/60",
                    l.tone === "good" && "text-px-green",
                    l.tone === "bad" && "text-px-red",
                    l.tone === "info" && "text-px-yellow"
                  )}
                >
                  {l.text}
                </li>
              ))}
            </ul>
            <p className="mt-2 font-terminal text-lg text-cream">
              DB: <span className="text-px-green">{ledger.saved} saved</span> ·{" "}
              <span className="text-px-red">{ledger.missed} missed</span>
            </p>

            <AnimatePresence>
              {!tabOpen && (
                <motion.div
                  className="absolute inset-0 grid place-items-center bg-[#0b0a1f]/95 p-4 text-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="flex flex-col items-center gap-3">
                    <p className="retro text-[0.625rem] text-lilac">TAB CLOSED</p>
                    <p className="max-w-xs font-pixel-sans text-lg text-cream">
                      {serverSide
                        ? "Doesn't matter now. The server is watching."
                        : "The target check lived in this tab. Watch the log underneath…"}
                    </p>
                    <Button size="sm" className="bg-px-yellow text-[0.5rem] text-night" onClick={() => setTabOpen(true)}>
                      REOPEN TAB
                    </Button>
                  </div>
                  <ul className="absolute inset-x-3 bottom-3 font-terminal text-lg leading-tight">
                    {log.slice(-2).map((l) => (
                      <li key={l.id} className={l.tone === "bad" ? "text-px-red" : l.tone === "good" ? "text-px-green" : "text-px-yellow"}>
                        {l.text}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        <p className="font-pixel-sans text-lg text-lilac">Where does the target / stop-loss check run?</p>
        <div className="flex flex-wrap justify-center gap-5" role="group" aria-label="Architecture">
          <Button
            size="sm"
            aria-pressed={!serverSide}
            onClick={() => setServerSide(false)}
            className={cn("text-[0.5rem]", !serverSide ? "bg-px-pink text-night" : "bg-ink text-cream")}
          >
            V1 · IN THE BROWSER
          </Button>
          <Button
            size="sm"
            aria-pressed={serverSide}
            onClick={() => setServerSide(true)}
            className={cn("text-[0.5rem]", serverSide ? "bg-px-green text-night" : "bg-ink text-cream")}
          >
            V2 · ON THE SERVER (THE FIX)
          </Button>
        </div>
      </div>
    </div>
  )
}

const REVIEW_NOTES = [
  { text: "State management: one useContext. For everything.", color: "bg-px-yellow", rot: "-rotate-2" },
  { text: "Trade logic in the frontend. Close tab = trade lives forever.", color: "bg-px-pink", rot: "rotate-1" },
  { text: "Architecture: it works on my machine.", color: "bg-px-cyan", rot: "-rotate-1" },
  { text: "Code reviewers: 0. Confidence: 100.", color: "bg-px-green", rot: "rotate-2" },
]

function FutureMeReview() {
  const reduced = useReducedMotion()
  return (
    <div className="mx-auto mt-24 max-w-5xl px-4">
      <p className="retro text-center text-[0.625rem] text-px-red">CODE REVIEW · FROM FUTURE ME</p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {REVIEW_NOTES.map((n, i) => (
          <motion.div
            key={n.text}
            className={cn("p-5 font-pixel-sans text-xl leading-snug text-night shadow-[6px_8px_0_rgb(0_0_0/0.4)]", n.color, n.rot)}
            initial={reduced ? false : { opacity: 0, y: 40, rotate: 0 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.5, ease: EASE, delay: (i % 2) * 0.1 }}
          >
            {n.text}
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export function StageInternship() {
  return (
    <Stage id="internship" className="overflow-clip bg-[#10162e] pb-28">
      <StageTitle id="internship" kicker="First remote internship. First, the selection test." />
      <Dialogue speaker="ASHFAQ · 2023" tone="cyan" className="mb-12 px-4">
        The test: an election app and a drag-and-drop calculator. No DnD library. No ChatGPT (I didn't know it existed). Just DOM events and confidence.
      </Dialogue>
      <div className="mx-auto grid max-w-5xl gap-10 px-4 md:grid-cols-2">
        <ElectionApp />
        <DndCalculator />
      </div>
      <div className="relative">
        <SelectedStamp />
        <Sfx className="left-[12%] top-6 hidden text-6xl text-px-yellow sm:block" delay={0.2}>
          ドン!
        </Sfx>
      </div>

      <div className="mt-28">
        <Dialogue speaker="ASHFAQ · 2023" tone="pink" className="mb-12 px-4">
          First real project: options paper trading. Live feed in, target or stop-loss hits, write to DB. What could possibly go wrong?
        </Dialogue>
        <TradingSim />
        <Dialogue speaker="ASHFAQ · NOW" tone="yellow" className="mt-16 px-4">
          Close the tab in V1. The target check lived in the browser, so no tab meant no trade closing: Schrödinger's stop-loss. Moved it server-side later. The client never noticed.
        </Dialogue>
        <FutureMeReview />
      </div>
    </Stage>
  )
}
