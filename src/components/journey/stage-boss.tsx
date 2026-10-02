import * as React from "react"
import { AnimatePresence, motion, useReducedMotion, useTransform } from "motion/react"
import EnemyHealthDisplay from "@/components/ui/8bit/enemy-health-display"
import { cn } from "@/lib/utils"
import { Achievement, Dialogue, Stage, StageTitle, Sfx } from "./primitives"
import { EASE, useSceneProgress, useSteppedValue, useTypewriter } from "./hooks"

/* ------------------------------- AI era ---------------------------------- */

const OLD_TABS = [
  "Stack Overflow · 'undefined is not a function'",
  "Stack Overflow · closed as duplicate",
  "MDN · Array.prototype.reduce()",
  "GitHub issue #4211 · 'any update?'",
  "Some blog post from 2014",
  "Stack Overflow · answer with 3 upvotes",
  "The actual docs (finally)",
]

function ChatBubble({ from, text, start }: { from: "me" | "ai"; text: string; start: boolean }) {
  const { shown } = useTypewriter(text, start, 60)
  return (
    <div className={cn("flex", from === "me" ? "justify-end" : "justify-start")}>
      <p
        className={cn(
          "max-w-[85%] px-3 py-2 font-pixel-sans text-lg leading-snug",
          from === "me" ? "bg-px-cyan text-night" : "bg-ink-2 text-cream"
        )}
      >
        <span className="sr-only">{text}</span>
        <span aria-hidden>{shown || " "}</span>
      </p>
    </div>
  )
}

function BeforeAfter() {
  const reduced = useReducedMotion()
  const [chatStarted, setChatStarted] = React.useState(false)
  const [reply, setReply] = React.useState(false)

  React.useEffect(() => {
    if (!chatStarted) return
    const id = window.setTimeout(() => setReply(true), reduced ? 0 : 1400)
    return () => window.clearTimeout(id)
  }, [chatStarted, reduced])

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 md:grid-cols-2">
      {/* Before: sepia, film grain, grandpa energy */}
      <div className="noise relative overflow-hidden border-4 border-[#3b2a1a] bg-[#e8d6b0] p-5 text-[#3b2a1a] [filter:sepia(0.35)]">
        <p className="retro text-[0.5625rem]">BACK IN MY DAY · ~2022</p>
        <p className="mt-2 font-pixel-sans text-lg">One bug →</p>
        <div className="relative mt-3 h-64">
          {OLD_TABS.map((t, i) => (
            <motion.div
              key={t}
              className="absolute inset-x-0 truncate border-2 border-[#3b2a1a] bg-[#f5ead2] px-2 py-1 font-terminal text-lg shadow-[3px_3px_0_#3b2a1a]"
              style={{ top: i * 32, left: i * 6, right: (OLD_TABS.length - 1 - i) * 6 }}
              initial={reduced ? false : { opacity: 0, x: -30, rotate: -3 }}
              whileInView={{ opacity: 1, x: 0, rotate: 0 }}
              viewport={{ once: true, amount: 0.9 }}
              transition={{ delay: 0.12 * i, duration: 0.35 }}
            >
              {t}
            </motion.div>
          ))}
        </div>
        <p className="font-pixel-sans text-lg">
          → Fixed, eventually. Learned five other things on the way.
        </p>
      </div>

      {/* After */}
      <motion.div
        className="px-frame-shadow flex flex-col bg-night p-5"
        onViewportEnter={() => setChatStarted(true)}
        viewport={{ once: true, amount: 0.7 }}
      >
        <p className="retro text-[0.5625rem] text-px-green">AFTER · 2023</p>
        <p className="mt-2 font-pixel-sans text-lg text-cream">One bug →</p>
        <div className="mt-3 flex flex-1 flex-col gap-3">
          <ChatBubble from="me" text="why is this undefined? [pastes 80 lines]" start={chatStarted} />
          {reply && (
            <ChatBubble
              from="ai"
              text="You're reading .data before the promise resolves. Await it, or move the read into .then()."
              start={reply}
            />
          )}
        </div>
        <p className="mt-4 font-pixel-sans text-lg text-px-green">→ Fixed in 30 seconds.</p>
      </motion.div>
    </div>
  )
}

export function StageAiEra() {
  return (
    <Stage id="ai-era" className="overflow-clip bg-[#1c1530] pb-28">
      <StageTitle id="ai-era" kicker="Then I started my MCA, and the way everyone writes code changed." />
      <Dialogue speaker="ASHFAQ · 2023" tone="green" className="mb-14 px-4">
        I kept building full-stack projects and getting better every day. And around the end of my first internship, ChatGPT actually started working. No more Stack Overflow for simple bugs. Saying "back in my day we read ten tabs to fix one bug" already sounds like a grandpa story.
      </Dialogue>
      <BeforeAfter />
    </Stage>
  )
}

/* ------------------------------ Boss fight ------------------------------- */

const ENEMIES = [
  { name: "REDUX TOOLKIT", note: "One part of the app. Honestly? Great.", color: "bg-px-purple", hp: 120 },
  { name: "ZUSTAND", note: "Another part, another store.", color: "bg-px-orange", hp: 100 },
  { name: "CONTEXT API", note: "Another part, all in Context.", color: "bg-px-cyan", hp: 110 },
  { name: "NUQS · URL STATE", note: "Every bit of state in the search params. Smart, actually.", color: "bg-px-yellow", hp: 140 },
  { name: "COPY-PASTE FIXES", note: "Snippets pasted from GPT. Bugs 'fixed' by hardcoding.", color: "bg-px-red", hp: 160 },
]

const FIGHT_START = 0.12
const FIGHT_END = 0.86
const SEG = (FIGHT_END - FIGHT_START) / ENEMIES.length

function formatClock(hours: number) {
  const total = Math.max(0, Math.round(hours * 3600))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":")
}

function BossScene() {
  const reduced = useReducedMotion()
  const ref = React.useRef<HTMLDivElement>(null)
  const progress = useSceneProgress(ref)
  const p = useSteppedValue(progress, 400)
  const shake = useTransform(progress, (v) => {
    const local = ((v - FIGHT_START) % SEG) / SEG
    return v > FIGHT_START && v < FIGHT_END && local > 0.1 && local < 0.4 ? Math.sin(v * 900) * 4 : 0
  })

  const current = Math.min(ENEMIES.length - 1, Math.max(0, Math.floor((p - FIGHT_START) / SEG)))
  const won = p >= FIGHT_END
  const hours = 48 * (1 - Math.min(1, p / FIGHT_END) * 0.995)

  return (
    <div ref={ref} className={reduced ? "relative" : "relative h-[420vh]"}>
      <div className="sticky top-0 flex h-svh flex-col justify-center overflow-hidden pt-16">
        <div aria-hidden className="speedlines animate-spin-slow absolute left-1/2 top-1/2 size-[140vmax] -translate-x-1/2 -translate-y-1/2 opacity-60" />

        <div className="relative mx-auto w-full max-w-5xl px-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="retro text-[0.5625rem] text-px-red">BOSS BATTLE</p>
              <h3 className="retro pixel-text-shadow mt-2 text-[clamp(0.9rem,3vw,1.5rem)] leading-snug text-cream">
                THE FIVE-PATTERN CODEBASE
              </h3>
            </div>
            <div className="text-right">
              <p className="retro text-[0.5rem] text-lilac">CLIENT LEAVES IN</p>
              <p className={cn("font-terminal text-3xl sm:text-4xl", hours < 6 ? "animate-blink text-px-red" : "text-px-yellow")}>
                {formatClock(hours)}
              </p>
            </div>
          </div>

          <motion.ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:mt-6 sm:grid-cols-2 sm:gap-y-5" style={{ x: shake }}>
            {ENEMIES.map((e, i) => {
              const local = Math.max(0, Math.min(1, (p - FIGHT_START - i * SEG) / (SEG * 0.85)))
              const hp = Math.round(e.hp * (1 - local))
              const active = i === current && !won && p > FIGHT_START
              return (
                <li
                  key={e.name}
                  className={cn(
                    "relative bg-ink/90 p-2.5 transition-[opacity,transform] duration-300 sm:p-3",
                    active && "scale-[1.03] outline outline-4 outline-px-yellow",
                    hp === 0 && "opacity-45"
                  )}
                >
                  <EnemyHealthDisplay
                    enemyName={e.name}
                    level={(i + 1) * 9}
                    currentHealth={hp}
                    maxHealth={e.hp}
                    healthBarColor={e.color}
                    className="text-[0.5625rem]"
                  />
                  <p className="mt-2 hidden font-pixel-sans text-base leading-snug text-lilac sm:block">{e.note}</p>
                  {hp === 0 && (
                    <span className="retro absolute right-3 top-3 rotate-12 bg-px-green px-1.5 py-0.5 text-[0.5rem] text-night">
                      TAMED
                    </span>
                  )}
                  {active && hp > 0 && (
                    <span aria-hidden className="retro absolute -right-2 -top-3 animate-bob text-xs text-px-yellow">
                      HIT!
                    </span>
                  )}
                </li>
              )
            })}
            <li className="flex flex-col justify-center bg-px-pink/15 p-2.5 outline outline-4 outline-px-pink sm:p-3">
              <p className="retro text-[0.5625rem] text-px-pink">ASHFAQ · Lv.?? · HP 100%</p>
              <p className="mt-2 font-pixel-sans text-lg text-cream">
                ▶ {won ? "VICTORY" : `ANALYSE PATTERN ${current + 1}/5`}
              </p>
              <p className="font-pixel-sans text-base text-lilac">AI assist: OFF · Teammates: 0</p>
            </li>
          </motion.ul>
        </div>

        <AnimatePresence>
          {won && (
            <motion.div
              className="absolute inset-0 grid place-items-center bg-night/70 px-4 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div>
                <motion.p
                  className="retro pixel-text-shadow text-[clamp(2.5rem,12vw,7rem)] leading-none text-px-yellow"
                  initial={{ scale: 4, rotate: -12 }}
                  animate={{ scale: 1, rotate: -6 }}
                  transition={{ type: "spring", stiffness: 300, damping: 14 }}
                >
                  K.O.!
                </motion.p>
                <p className="retro mt-6 text-[0.625rem] leading-loose text-cream sm:text-xs">
                  FIXED IN 2 DAYS · SINGLE-HANDED · NO AI
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export function StageBoss() {
  return (
    <Stage id="boss" className="overflow-clip bg-[#1a0b1f] pb-28">
      <StageTitle id="boss" kicker="Second year of MCA, second internship. A real team this time." />
      <div className="relative">
        <Sfx className="right-[6%] top-0 hidden text-7xl text-px-red md:block">ゴゴゴ</Sfx>
        <Dialogue speaker="ASHFAQ · 2025" tone="pink" className="px-4">
          A service-based company, with teams, a manager and a lead. Finally, I thought, here I'll learn on good code. Honestly, it was worse than my first internship. One project had been through ten interns, plus a few serious developers in a few corners. State management alone came in five flavours.
        </Dialogue>
      </div>
      <BossScene />
      <Dialogue speaker="ASHFAQ · 2025" tone="yellow" className="px-4">
        My first task: fix the whole application in two days, or the client walks. I'd already mapped all five patterns, so I fixed it single-handed, without AI. It made me a better developer.
      </Dialogue>
      <Achievement className="mt-12" title="Survived a five-pattern codebase" detail="and shipped the fix before the deadline" />
    </Stage>
  )
}

/* ------------------------------- Freelance ------------------------------- */

const PHP: Array<[string, string?]> = [
  ["<?php", "text-px-purple"],
  [""],
  ["Route::middleware('auth:sanctum')", "text-cream"],
  ["    ->group(function () {", "text-cream"],
  ["        Route::apiResource('orders', OrderController::class);", "text-px-green"],
  ["        Route::post('orders/{order}/refund', RefundController::class);", "text-px-green"],
  ["    });", "text-cream"],
]

export function StageFreelance() {
  const reduced = useReducedMotion()
  return (
    <Stage id="freelance" className="overflow-clip bg-night pb-28">
      <StageTitle id="freelance" kicker="After the chaos, anything looks clean." />
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 md:grid-cols-[1.2fr_1fr]">
        <motion.div
          className="border-4 border-night bg-[#1e1b3a] shadow-[10px_12px_0_rgb(0_0_0/0.45)]"
          initial={reduced ? false : { opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <div className="border-b-4 border-night bg-ink-2 px-3 py-1 font-terminal text-lg text-lilac">routes/api.php</div>
          <pre className="overflow-x-auto p-4 font-terminal text-lg leading-snug">
            {PHP.map(([line, color], i) => (
              <div key={i} className={color}>
                {line || " "}
              </div>
            ))}
          </pre>
          <p className="border-t-4 border-night px-4 py-2 font-pixel-sans text-sm text-lilac">
            Illustrative snippet, not client code.
          </p>
        </motion.div>
        <div className="flex flex-col gap-6">
          <Dialogue speaker="ASHFAQ · 2025" tone="cyan" className="mt-0">
            Next, a few freelance jobs, mostly backend work in Laravel. It was nice code, and simple for me — I'd seen enough chaos by then.
          </Dialogue>
          <Dialogue speaker="ASHFAQ · 2025" tone="green" className="mt-0">
            By now AI was everywhere. If you know the concepts, it fixes things for you, even if you're just pasting code into a chatbot. Agents were only starting to catch on, but it got the job done.
          </Dialogue>
        </div>
      </div>
    </Stage>
  )
}
