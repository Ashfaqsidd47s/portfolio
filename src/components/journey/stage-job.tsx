import * as React from "react"
import { Link } from "react-router-dom"
import { motion, useReducedMotion, useTransform } from "motion/react"
import { Badge } from "@/components/ui/8bit/badge"
import { Button } from "@/components/ui/8bit/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/8bit/card"
import { Github, Linkedin } from "@/components/icons"
import { experience, profile, projects, sideProjects } from "@/data/profile"
import { ElevenMatrixApp } from "./app-11matrix"
import { cn } from "@/lib/utils"
import { Dialogue, PixelSprite, Stage, StageTitle } from "./primitives"
import { EASE, useSceneProgress, useSteppedValue } from "./hooks"
import { HERO_FRAMES, STAR } from "./sprites"

const job = experience[0]
const project = (name: string) => {
  const p = projects.find((x) => x.name === name)
  if (!p) throw new Error(`Unknown project: ${name}`)
  return p
}

/* ------------------------------ Class change ----------------------------- */

function ClassChange() {
  const reduced = useReducedMotion()
  return (
    <div className="relative mx-auto flex max-w-xl flex-col items-center px-4">
      <motion.div
        className="px-frame-shadow relative w-full bg-ink p-6 text-center"
        initial={reduced ? false : "hidden"}
        whileInView="shown"
        viewport={{ once: true, amount: 0.9 }}
      >
        <p className="retro text-[0.5625rem] text-lilac">{job.company.toUpperCase()} · JAN 2026</p>
        <p className="mt-2 font-pixel-sans text-lg text-cream">My first job. The offer said:</p>
        <div className="relative mt-4 inline-block">
          <p className="retro text-sm text-lilac sm:text-base">FRONTEND DEVELOPER</p>
          <motion.span
            aria-hidden
            className="absolute inset-x-[-6px] top-1/2 h-1 origin-left bg-px-red"
            variants={{ hidden: { scaleX: 0 }, shown: { scaleX: 1 } }}
            transition={{ delay: 0.5, duration: 0.35 }}
          />
        </div>
        <motion.div
          variants={{ hidden: { opacity: 0, scale: 2.4, y: 10 }, shown: { opacity: 1, scale: 1, y: 0 } }}
          transition={{ delay: 1, type: "spring", stiffness: 320, damping: 14 }}
        >
          <p className="retro mt-5 text-[0.625rem] text-px-yellow">✦ CLASS CHANGE ✦</p>
          <p className="retro pixel-text-shadow mt-3 text-base text-px-green sm:text-xl">FULL-STACK DEVELOPER</p>
        </motion.div>
        <p className="sr-only">Hired as a frontend developer, working as a full-stack developer.</p>
      </motion.div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          className="pointer-events-none absolute w-5"
          style={{ left: `${10 + i * 16}%`, top: i % 2 ? "-8%" : "100%" }}
          initial={reduced ? false : { opacity: 0, scale: 0 }}
          whileInView={{ opacity: [0, 1, 0], scale: [0, 1.4, 0.6], y: i % 2 ? -20 : 20 }}
          viewport={{ once: true, amount: 0.9 }}
          transition={{ delay: 1.1 + i * 0.06, duration: 1.1 }}
        >
          <PixelSprite sprite={STAR} />
        </motion.span>
      ))}
    </div>
  )
}

function ShopifyAdminMock() {
  return (
    <div className="overflow-hidden border-4 border-night bg-[#f1f1f1] text-night shadow-[8px_10px_0_rgb(0_0_0/0.45)]">
      <div className="flex items-center gap-2 bg-[#1a1a1a] px-3 py-1.5 font-terminal text-base text-[#cfcfcf]">
        <span className="size-2.5 bg-px-green" />
        store admin
      </div>
      <div className="grid grid-cols-[5.5rem_1fr]">
        <ul className="flex flex-col gap-1.5 border-r-2 border-night/10 p-2 font-pixel-sans text-sm text-night/70">
          {["Home", "Orders", "Products", "Customers", "Apps"].map((x) => (
            <li key={x} className={cn("px-1.5 py-0.5", x === "Apps" && "bg-night/10 font-semibold text-night")}>
              {x}
            </li>
          ))}
        </ul>
        <div className="p-3">
          <div className="relative border-4 border-dashed border-px-pink bg-white p-3">
            <span className="retro absolute -top-3 left-2 bg-px-pink px-1.5 py-0.5 text-[0.4375rem] text-night">
              EMBEDDED APP
            </span>
            <p className="font-pixel-sans text-base font-semibold">React, living inside the admin</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <span className="h-8 bg-night/10" />
              <span className="h-8 bg-night/10" />
              <span className="h-8 bg-night/10" />
            </div>
            <p className="mt-2 font-terminal text-base text-night/70">GET /admin/api/…/products.json</p>
            <p className="font-terminal text-base text-night/70">GET /admin/api/…/orders.json</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuestCard({
  tag,
  title,
  tagline,
  url,
  urlLabel,
  stack,
  children,
  delay = 0,
}: {
  tag: string
  title: string
  tagline: string
  url?: string
  urlLabel?: string
  stack: string[]
  children: React.ReactNode
  delay?: number
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      className="h-full"
    >
      <Card className="h-full">
        <CardHeader>
          <p className="text-[0.5rem] text-px-pink">{tag}</p>
          <CardTitle className="mt-1 text-sm leading-relaxed text-cream">{title}</CardTitle>
          <CardDescription font="normal" className="font-pixel-sans text-base text-lilac">
            {tagline}
          </CardDescription>
        </CardHeader>
        <CardContent font="normal" className="font-pixel-sans text-lg leading-snug text-cream">
          {children}
        </CardContent>
        <CardFooter className="mt-auto flex-wrap gap-x-4 gap-y-3">
          {stack.slice(0, 5).map((s) => (
            <Badge key={s} variant="secondary" className="text-[0.4375rem] text-cream">
              {s}
            </Badge>
          ))}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="retro ml-auto text-[0.5rem] text-px-yellow underline-offset-4 hover:underline"
            >
              {urlLabel} ↗
            </a>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  )
}

export function StageFirstJob() {
  return (
    <Stage id="first-job" className="overflow-clip bg-[#121a3a] pb-28">
      <StageTitle id="first-job" kicker="Hired for frontend. Got the whole stack. No complaints." />
      <ClassChange />

      <div className="mx-auto mt-20 max-w-xl px-4">
        <Dialogue speaker="QUEST 1 · SHOPIFY APPS" tone="green" className="mt-0">
          Shopify apps. Not stores, apps: React that lives inside someone else's admin and talks to their product and order APIs. Weird that this exists. Works great.
        </Dialogue>
        <ShopifyAdminMock />
      </div>

    </Stage>
  )
}

/* -------------------------------- 11Matrix ------------------------------- */

const NODES = [
  { label: "Shopify store A", short: "Store A", x: 16, y: 14, color: "#4dff88" },
  { label: "Shopify store B", short: "Store B", x: 84, y: 14, color: "#4dff88" },
  { label: "Shopify store C", short: "Store C", x: 12, y: 54, color: "#4dff88" },
  { label: "Google Analytics", short: "Analytics", x: 88, y: 54, color: "#ffd23f" },
  { label: "Pinterest", short: "Pinterest", x: 22, y: 90, color: "#ff4d8d" },
  { label: "Inventory", short: "Inventory", x: 78, y: 90, color: "#3ee6ff" },
]

function MatrixHub() {
  const reduced = useReducedMotion()
  const ref = React.useRef<HTMLDivElement>(null)
  const progress = useSceneProgress(ref)
  const p = useSteppedValue(progress, 100)
  const hubScale = useTransform(progress, [0.7, 0.85], [1, 1.12])
  const connected = NODES.filter((_, i) => p > 0.12 + i * 0.1).length
  const all = connected === NODES.length

  return (
    <div ref={ref} className={reduced ? "relative" : "relative h-[280vh]"}>
      <div className="sticky top-0 flex h-svh flex-col items-center justify-center overflow-hidden px-4 pt-16">
        <div className="relative aspect-square w-[min(36rem,92vw,72svh)]">
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            {NODES.map((n, i) => {
              const local = Math.max(0, Math.min(1, (p - 0.04 - i * 0.1) / 0.1))
              const d = `M ${n.x} ${n.y} L 50 50`
              return (
                <g key={n.label}>
                  <path d={d} stroke="#3a3570" strokeWidth={0.8} strokeDasharray="1.5 1.5" fill="none" />
                  <motion.path
                    d={d}
                    stroke={n.color}
                    strokeWidth={1}
                    fill="none"
                    initial={false}
                    animate={{ pathLength: local }}
                    transition={{ duration: 0.15 }}
                  />
                  {local >= 1 && (
                    <rect width={1.8} height={1.8} fill={n.color} x={-0.9} y={-0.9}>
                      <animateMotion dur={`${1.4 + i * 0.2}s`} repeatCount="indefinite" path={d} />
                    </rect>
                  )}
                </g>
              )
            })}
          </svg>

          {NODES.map((n, i) => {
            const on = i < connected
            return (
              <div
                key={n.label}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap border-4 px-1.5 py-1 font-pixel-sans text-sm transition-all duration-300 sm:px-2 sm:py-1.5 sm:text-base",
                  on ? "border-night bg-cream text-night" : "border-ink-2 bg-ink text-lilac/60"
                )}
                style={{ left: `${n.x}%`, top: `${n.y}%`, boxShadow: on ? `0 0 0 3px ${n.color}` : undefined }}
              >
                <span className="sm:hidden">{n.short}</span>
                <span className="hidden sm:inline">{n.label}</span>
              </div>
            )
          })}

          <motion.div
            className={cn(
              "absolute left-1/2 top-1/2 grid size-[34%] -translate-x-1/2 -translate-y-1/2 place-items-center border-4 border-night text-center transition-colors duration-500",
              all ? "bg-px-yellow" : "bg-ink-2"
            )}
            style={{ scale: hubScale }}
          >
            <div>
              <p className={cn("retro text-[clamp(0.6rem,2.4vw,1rem)]", all ? "text-night" : "text-cream")}>11MATRIX</p>
              <p className={cn("mt-1 font-pixel-sans text-[clamp(0.7rem,2.2vw,1rem)]", all ? "text-night" : "text-lilac")}>
                {connected}/{NODES.length} connected
              </p>
            </div>
          </motion.div>
        </div>
        <p className="mt-6 max-w-xl text-center font-pixel-sans text-lg text-cream sm:text-xl" aria-live="polite">
          {all
            ? "One place for every store: analytics, marketing, operations, support, and inventory across all of them."
            : "Connect every store and channel…"}
        </p>
      </div>
    </div>
  )
}

export function StageMatrix() {
  const matrix = project("11Matrix")
  return (
    <Stage id="matrix" className="overflow-clip bg-night pb-28">
      <StageTitle id="matrix" kicker="Currently playing. Save file: very large." />
      <div className="flex justify-center">
        <Badge className="animate-pulse bg-px-green text-[0.5625rem] text-night">● CURRENTLY PLAYING</Badge>
      </div>
      <MatrixHub />
      <Dialogue speaker="ASHFAQ · NOW" tone="yellow" className="px-4">
        I own it end to end: React Router up front, Go + Gin + Postgres behind, MCP so AI can run the shop too. Every store, one dashboard, one leaderboard.
      </Dialogue>
      <div className="mt-10 flex flex-wrap justify-center gap-x-5 gap-y-4 px-4">
        {matrix.stack.map((s) => (
          <Badge key={s} variant="secondary" className="text-[0.5rem] text-cream">
            {s}
          </Badge>
        ))}
      </div>
      <div className="mt-16 px-4">
        <ElevenMatrixApp />
      </div>
    </Stage>
  )
}

/* --------------------------------- Finale -------------------------------- */

const ONE_LINERS: Record<string, string> = {
  Fujin: "shadcn, but whole features. npx fujin add, ship, go home.",
  "Bingo Master": "Bingo meets chess over raw WebSockets. No Socket.IO training wheels.",
  "Gaming Era": "Chat + WebRTC video for gamers. OAuth hand-rolled, because why not.",
  "File Scanner": "Upload → queue → scan → live dashboard. Three services, zero panic.",
}

export function StageContinue() {
  const reduced = useReducedMotion()
  const [count, setCount] = React.useState(9)
  const [started, setStarted] = React.useState(false)

  React.useEffect(() => {
    if (!started || reduced) return
    const id = window.setInterval(() => setCount((c) => (c > 0 ? c - 1 : 9)), 1000)
    return () => window.clearInterval(id)
  }, [started, reduced])

  return (
    <Stage id="continue" className="overflow-clip bg-night pb-16">
      {/* Anime ending card */}
      <motion.div
        className="relative mx-auto flex max-w-5xl flex-col items-center px-4 pt-24 text-center"
        initial={reduced ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.8 }}
      >
        <p aria-hidden className="text-[clamp(3rem,14vw,8rem)] font-black leading-none text-cream [-webkit-text-stroke:3px_var(--color-px-pink)]">
          つづく
        </p>
        <p className="retro mt-4 text-[0.625rem] tracking-[0.3em] text-px-pink sm:text-xs">TO BE CONTINUED</p>
      </motion.div>

      <div className="mx-auto mt-24 max-w-5xl px-4">
        <p className="retro text-center text-[0.625rem] text-px-yellow">SIDE QUESTS</p>
        <p className="mt-3 text-center font-pixel-sans text-lg text-lilac">Things I built because I wanted to.</p>
        <div className="mt-10 grid gap-10 sm:grid-cols-2">
          {sideProjects.map((sp, i) => (
            <QuestCard
              key={sp.name}
              tag={sp.status.toUpperCase()}
              title={sp.name.toUpperCase()}
              tagline={sp.tagline}
              url={sp.url ?? sp.repo}
              urlLabel={sp.url ? "LIVE" : "REPO"}
              stack={sp.stack}
              delay={(i % 2) * 0.1}
            >
              {ONE_LINERS[sp.name] ?? sp.highlights[0].replaceAll("`", "")}
            </QuestCard>
          ))}
        </div>
      </div>

      {/* Player two */}
      <motion.div
        onViewportEnter={() => setStarted(true)}
        viewport={{ once: true, amount: 0.5 }}
        className="mx-auto mt-32 flex max-w-3xl flex-col items-center px-4 text-center"
      >
        <div className="flex items-end gap-6">
          <PixelSprite sprite={HERO_FRAMES[0]} className="w-14 animate-bob" title="Pixel-art me" />
          <div className="grid size-14 place-items-center border-4 border-dashed border-lilac/50">
            <span className="retro text-[0.5rem] text-lilac">P2?</span>
          </div>
        </div>
        <h2 className="retro pixel-text-shadow mt-8 text-[clamp(1.1rem,4vw,2rem)] leading-snug text-cream">
          CONTINUE? <span className="text-px-pink">{count}</span>
        </h2>
        <p className="mt-5 max-w-lg text-pretty font-pixel-sans text-xl text-lilac">
          {profile.availableLabel}. If you're building something real, I'd like to be player two.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-x-7 gap-y-6">
          <Button asChild className="bg-px-yellow text-[0.625rem] text-night">
            <a href={profile.socials.email}>EMAIL ME</a>
          </Button>
          <Button asChild variant="outline" className="bg-ink text-[0.625rem] text-cream">
            <a href={profile.socials.github} target="_blank" rel="noreferrer">
              <Github /> GITHUB
            </a>
          </Button>
          <Button asChild variant="outline" className="bg-ink text-[0.625rem] text-cream">
            <a href={profile.socials.linkedin} target="_blank" rel="noreferrer">
              <Linkedin /> LINKEDIN
            </a>
          </Button>
          <Button asChild variant="outline" className="bg-ink text-[0.625rem] text-cream">
            <Link to="/resume">RÉSUMÉ</Link>
          </Button>
        </div>
        <p className="mt-8 font-terminal text-xl text-lilac">{profile.email} · {profile.location}</p>
      </motion.div>

      <footer className="mx-auto mt-28 flex max-w-5xl flex-col items-center gap-2 border-t-4 border-ink px-4 pt-8 text-center">
        <p className="retro text-[0.5rem] leading-loose text-lilac">
          © {new Date().getFullYear()} {profile.name.toUpperCase()} · THANKS FOR PLAYING
        </p>
        <p className="font-pixel-sans text-sm text-lilac/80">
          Built with React, Motion, Tailwind CSS and{" "}
          <a href="https://8bitcn.com" target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-cream">
            8bitcn
          </a>
          .
        </p>
      </footer>
    </Stage>
  )
}
