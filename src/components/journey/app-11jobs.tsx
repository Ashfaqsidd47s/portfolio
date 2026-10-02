import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { AppWindow, DemoNote } from "./app-window"

/* ------------------------------ prompt → plan ----------------------------- */

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, a: 1, an: 1, single: 1 }
const ROUND_NAMES = ["Screening", "Technical", "Practical", "Culture fit", "Final"]
const SECTION_NAMES = ["MCQ", "Coding", "Short answer", "System design"]
const BANK: Record<string, string[]> = {
  frontend: [
    "Build a debounced search input",
    "Why did this component re-render?",
    "Fix the useEffect memory leak",
    "Make this card grid responsive",
    "Implement infinite scroll",
    "Explain the event loop in 3 lines",
    "Virtualise a 10k-row list",
    "CSS: center a div (yes, really)",
  ],
  backend: [
    "Design a rate limiter",
    "Write a paginated SQL query",
    "Explain idempotency keys",
    "Find the N+1 in this ORM call",
    "Queue vs cron: pick one, defend it",
    "Cache this endpoint safely",
    "Model a many-to-many in Postgres",
    "Retry with exponential backoff",
  ],
  general: [
    "Tell us about a bug that humbled you",
    "Estimate: how many tabs do you have open?",
    "Explain a hard idea to a 5-year-old",
    "Prioritise these 5 tasks",
    "Spot the flaw in this plan",
    "Write a crisp status update",
    "Timed logic puzzle",
    "What would you automate first here?",
  ],
}

type Plan = { role: string; rounds: number; sections: number; questions: number }

function count(text: string, noun: string, fallback: number, max: number) {
  const m = text.match(new RegExp(`(\\d+|one|two|three|four|five|a|an|single)\\s+${noun}`, "i"))
  const n = m ? (Number(m[1]) || WORDS[m[1].toLowerCase()] || fallback) : fallback
  return Math.max(1, Math.min(max, n))
}

function parsePrompt(text: string): Plan {
  const role =
    text.match(/(?:job|role|opening|position)\s+for\s+(?:an?\s+)?(.+?)(?=\s+with\b|,|\.|$)/i)?.[1] ??
    text.match(/(?:hire|hiring)\s+(?:an?\s+)?(.+?)(?=\s+with\b|,|\.|$)/i)?.[1] ??
    "Frontend Developer"
  return {
    role: role.trim().replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 40),
    rounds: count(text, "rounds?", 3, 5),
    sections: count(text, "sections?", 2, 4),
    questions: count(text, "questions?", 2, 4),
  }
}

function bankFor(role: string) {
  if (/front|react|ui|web/i.test(role)) return BANK.frontend
  if (/back|api|node|go|server|data/i.test(role)) return BANK.backend
  return BANK.general
}

type Op =
  | { kind: "job"; role: string }
  | { kind: "round"; r: number }
  | { kind: "section"; r: number; s: number }
  | { kind: "question"; r: number; s: number; q: number; text: string }

function opsFor(plan: Plan): Op[] {
  const bank = bankFor(plan.role)
  const ops: Op[] = [{ kind: "job", role: plan.role }]
  let qi = 0
  for (let r = 0; r < plan.rounds; r++) {
    ops.push({ kind: "round", r })
    for (let s = 0; s < plan.sections; s++) {
      ops.push({ kind: "section", r, s })
      for (let q = 0; q < plan.questions; q++) ops.push({ kind: "question", r, s, q, text: bank[qi++ % bank.length] })
    }
  }
  return ops
}

function callLine(op: Op) {
  switch (op.kind) {
    case "job":
      return `create_job({ title: "${op.role}" })`
    case "round":
      return `add_round({ n: ${op.r + 1}, name: "${ROUND_NAMES[op.r]}" })`
    case "section":
      return `add_section({ round: ${op.r + 1}, type: "${SECTION_NAMES[op.s]}" })`
    case "question":
      return `add_question({ r${op.r + 1}.s${op.s + 1}, "${op.text.slice(0, 22)}${op.text.length > 22 ? "…" : ""}" })`
  }
}

/** Roughly what the same job costs by hand: clicks plus form fields. */
const clicksFor = (p: Plan) => 4 + p.rounds * 3 + p.rounds * p.sections * 4 + p.rounds * p.sections * p.questions * 6

type Tree = { role: string; rounds: { sections: { questions: string[] }[] }[] } | null

function treeFrom(ops: Op[]): Tree {
  let tree: Tree = null
  for (const op of ops) {
    if (op.kind === "job") tree = { role: op.role, rounds: [] }
    else if (tree && op.kind === "round") tree.rounds.push({ sections: [] })
    else if (tree && op.kind === "section") tree.rounds[op.r].sections.push({ questions: [] })
    else if (tree && op.kind === "question") tree.rounds[op.r].sections[op.s].questions.push(op.text)
  }
  return tree
}

const SUGGESTIONS = [
  "Create a job for Frontend Developer with 3 rounds, 2 sections each and 2 questions each",
  "Create a job for Backend Engineer with 2 rounds, 3 sections and 1 question each",
  "Hiring a Product Designer with 4 rounds",
]

/* --------------------------------- builder -------------------------------- */

function Builder({ tree, busy }: { tree: Tree; busy: boolean }) {
  if (!tree) {
    return (
      <div className="grid h-full min-h-[18rem] place-items-center p-6 text-center text-sm text-[#6b6580]">
        <div>
          <p className="text-3xl">🗂️</p>
          <p className="mt-2 font-semibold text-[#2a2150]">No workflow yet</p>
          <p>Click around for 15 minutes… or ask the agent.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-lg font-bold text-[#2a2150]">{tree.role}</p>
        <span className={cn("px-2 py-0.5 text-[0.6875rem] font-bold", busy ? "bg-[#fff1c2] text-[#8a6a00]" : "bg-[#dcf5e5] text-[#1f7a43]")}>
          {busy ? "● building…" : "✓ published"}
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-stretch md:overflow-x-auto md:pb-2">
        {tree.rounds.map((round, r) => (
          <React.Fragment key={r}>
            {r > 0 && <span aria-hidden className="hidden self-center text-xl text-[#9b93c0] md:block">→</span>}
            <motion.div
              className="min-w-[12.5rem] flex-1 border-2 border-[#d8d2ef] bg-white p-2.5"
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-[#7c5cff]">
                Round {r + 1} · {ROUND_NAMES[r]}
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {round.sections.map((sec, s) => (
                  <motion.div key={s} className="bg-[#f4f1ff] p-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-[0.6875rem] font-bold text-[#2a2150]">{SECTION_NAMES[s]}</p>
                    <ul className="mt-1 flex flex-col gap-1">
                      {sec.questions.map((q, i) => (
                        <motion.li
                          key={i}
                          className="truncate bg-white px-1.5 py-0.5 text-xs text-[#3d3566]"
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                        >
                          Q{i + 1}. {q}
                        </motion.li>
                      ))}
                    </ul>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

/* ----------------------------- candidate view ----------------------------- */

function CandidateView({ tree }: { tree: NonNullable<Tree> }) {
  const flat = tree.rounds[0].sections.flatMap((s, si) => s.questions.map((q) => ({ q, section: SECTION_NAMES[si] })))
  const [i, setI] = React.useState(0)
  const [answer, setAnswer] = React.useState("")
  const [secs, setSecs] = React.useState(15 * 60)
  const [switches, setSwitches] = React.useState(0)
  const done = i >= flat.length

  React.useEffect(() => {
    if (done) return
    const id = window.setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(id)
  }, [done])

  // Real proctoring, tiny edition: leave this window or tab and it counts.
  React.useEffect(() => {
    const onBlur = () => setSwitches((n) => n + 1)
    window.addEventListener("blur", onBlur)
    return () => window.removeEventListener("blur", onBlur)
  }, [])

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
        <span className="text-[#2a2150]">{tree.role} · Round 1 · {ROUND_NAMES[0]}</span>
        <span className="flex gap-2">
          <span className="bg-[#dcf5e5] px-2 py-1 text-[#1f7a43]">● Camera on (pretend)</span>
          <span className={cn("px-2 py-1", switches ? "bg-[#ffe0dc] text-[#b3261e]" : "bg-[#f4f1ff] text-[#3d3566]")}>
            Tab switches: {switches}
          </span>
          <span className="bg-[#2a2150] px-2 py-1 tabular-nums text-white">
            {String(Math.floor(secs / 60)).padStart(2, "0")}:{String(secs % 60).padStart(2, "0")}
          </span>
        </span>
      </div>
      {done ? (
        <div className="grid min-h-[16rem] place-items-center text-center">
          <div>
            <p className="text-4xl">✅</p>
            <p className="mt-2 text-lg font-bold text-[#2a2150]">Round 1 submitted</p>
            <p className="text-sm text-[#6b6580]">
              {switches ? `Proctor noticed ${switches} tab switch${switches > 1 ? "es" : ""}. Bold.` : "Zero tab switches. Suspiciously honest."}
            </p>
            <button type="button" onClick={() => {
                setI(0)
                setSwitches(0)
                setSecs(15 * 60)
              }} className="mt-3 text-sm font-bold text-[#7c5cff] hover:underline">
              Retake
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 h-1.5 bg-[#ece8fb]">
            <div className="h-full bg-[#7c5cff] transition-all" style={{ width: `${(i / flat.length) * 100}%` }} />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[#7c5cff]">
            {flat[i].section} · Question {i + 1} of {flat.length}
          </p>
          <p className="mt-1 text-xl font-bold text-[#2a2150]">{flat[i].q}</p>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
            placeholder="Your answer… (try switching tabs, the proctor is watching)"
            className="mt-3 w-full resize-none border-2 border-[#d8d2ef] bg-white p-2 text-sm text-[#2a2150] outline-none focus:border-[#7c5cff]"
          />
          <button
            type="button"
            onClick={() => {
              setI((n) => n + 1)
              setAnswer("")
            }}
            className="mt-2 bg-[#7c5cff] px-4 py-2 text-sm font-bold text-white hover:bg-[#6a48f5]"
          >
            {i === flat.length - 1 ? "Submit round" : "Next →"}
          </button>
        </>
      )}
    </div>
  )
}

/* ---------------------------------- app ----------------------------------- */

type Msg = { from: "me" | "agent"; text: string }

export function ElevenJobsApp() {
  const reduced = useReducedMotion()
  const [input, setInput] = React.useState(SUGGESTIONS[0])
  const [plan, setPlan] = React.useState<Plan | null>(null)
  const [applied, setApplied] = React.useState(0)
  const [msgs, setMsgs] = React.useState<Msg[]>([])
  const [tab, setTab] = React.useState<"builder" | "candidate">("builder")
  const logRef = React.useRef<HTMLDivElement>(null)

  const ops = React.useMemo(() => (plan ? opsFor(plan) : []), [plan])
  const busy = !!plan && applied < ops.length
  const tree = React.useMemo(() => treeFrom(ops.slice(0, applied)), [ops, applied])

  // Stream the tool calls, one MCP call at a time.
  React.useEffect(() => {
    if (!plan || applied >= ops.length) return
    const id = window.setTimeout(() => setApplied((n) => n + 1), reduced ? 0 : applied === 0 ? 500 : 110)
    return () => window.clearTimeout(id)
  }, [plan, applied, ops.length, reduced])

  const doneText =
    plan && !busy
      ? `Done. "${plan.role}" is live: ${plan.rounds} rounds, ${plan.rounds * plan.sections} sections, ${
          plan.rounds * plan.sections * plan.questions
        } questions. Want me to invite candidates?`
      : null

  React.useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [applied, msgs, doneText])

  const send = (e?: React.FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    const p = parsePrompt(text)
    setMsgs([{ from: "me", text }, { from: "agent", text: "On it. Calling the 11jobs MCP server…" }])
    setApplied(0)
    setPlan(p)
    setTab("builder")
  }

  return (
    <>
      <AppWindow
        name="11jobs"
        url="app.11jobs.in/jobs/new"
        liveUrl="https://11jobs.in"
        accent="#7c5cff"
        bootLines={["mcp: registered 14 tools (create_job, add_round, …)", "proctoring worker … online"]}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#e6e1f7] bg-white px-4 py-3">
          <p className="text-lg font-black tracking-tight text-[#2a2150]">
            11<span className="text-[#7c5cff]">jobs</span>
          </p>
          <div className="flex border-2 border-[#2a2150] text-xs font-bold" role="group" aria-label="View">
            {(["builder", "candidate"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tab === t}
                disabled={t === "candidate" && (!tree || busy)}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3 py-1.5 disabled:opacity-40",
                  tab === t ? "bg-[#2a2150] text-white" : "text-[#2a2150]"
                )}
              >
                {t === "builder" ? "Recruiter · builder" : "Candidate · preview"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] bg-[#faf9ff] lg:grid-cols-[22rem_1fr]">
          {/* Agent chat */}
          <div className="flex min-h-[26rem] flex-col border-b-2 border-[#e6e1f7] bg-[#16122e] lg:border-b-0 lg:border-r-2">
            <p className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs font-bold text-[#cfc7ff]">
              <span className="size-2 bg-px-green" /> AI agent · connected via 11jobs MCP
            </p>
            <div ref={logRef} className="flex max-h-[22rem] flex-1 flex-col gap-2 overflow-y-auto p-3" aria-live="polite">
              {msgs.length === 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-[#a59dd6]">Try one:</p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setInput(s)}
                      className="border border-white/15 px-2 py-1.5 text-left text-xs text-[#e7e3ff] hover:border-[#7c5cff]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {msgs.map((m, i) => (
                <p
                  key={i}
                  className={cn(
                    "max-w-[90%] px-3 py-2 text-sm",
                    m.from === "me" ? "self-end bg-[#7c5cff] text-white" : "self-start bg-white/10 text-[#e7e3ff]"
                  )}
                >
                  {m.text}
                </p>
              ))}
              {plan && (
                <div className="border border-white/10 bg-black/30 p-2 font-mono text-[0.6875rem] leading-relaxed">
                  {ops.slice(0, applied).map((op, i) => (
                    <p key={i} className="truncate text-[#9be7b4]">
                      <span className="text-[#7c7799]">→ </span>
                      {callLine(op)}
                    </p>
                  ))}
                  {busy && <p className="animate-blink text-[#cfc7ff]">▍</p>}
                </div>
              )}
              {doneText && (
                <motion.p
                  className="max-w-[90%] self-start bg-white/10 px-3 py-2 text-sm text-[#e7e3ff]"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {doneText}
                </motion.p>
              )}
            </div>
            <form onSubmit={send} className="flex gap-2 border-t border-white/10 p-3">
              <label className="sr-only" htmlFor="mcp-prompt">Ask the agent</label>
              <textarea
                id="mcp-prompt"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) send(e)
                }}
                rows={2}
                className="min-w-0 flex-1 resize-none bg-white/10 p-2 text-sm text-white outline-none placeholder:text-white/40 focus:bg-white/15"
                placeholder="Create a job for…"
              />
              <button
                type="submit"
                disabled={busy}
                className="self-end bg-[#7c5cff] px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Send
              </button>
            </form>
          </div>

          {/* Builder / candidate */}
          <div className="relative min-w-0">
            {plan && !busy && tab === "builder" && (
              <p className="mx-4 mt-3 inline-block bg-[#2a2150] px-2 py-1 text-[0.6875rem] font-bold text-white sm:absolute sm:right-3 sm:top-3 sm:z-10 sm:m-0">
                ≈ {clicksFor(plan)} clicks you didn't make
              </p>
            )}
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {tab === "candidate" && tree ? <CandidateView tree={tree} /> : <Builder tree={tree} busy={busy} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </AppWindow>
      <DemoNote>A replay of the real flow, running in your browser. Edit the prompt: rounds, sections and questions all parse.</DemoNote>
    </>
  )
}
