import * as React from "react"
import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { Achievement, Dialogue, PixelSprite, Stage, StageTitle } from "./primitives"
import { EASE, useSceneProgress, useSteppedValue } from "./hooks"
import { HEART } from "./sprites"

const POWERUPS = [
  { key: "HTML", color: "bg-px-orange", note: "the bones" },
  { key: "CSS", color: "bg-px-cyan", note: "the looks" },
  { key: "JS", color: "bg-px-yellow", note: "the brains" },
]

function BrowserChrome({
  url,
  children,
  className,
}: {
  url: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("overflow-hidden border-4 border-night bg-cream shadow-[10px_12px_0_rgb(0_0_0/0.45)]", className)}>
      <div className="flex items-center gap-2 border-b-4 border-night bg-ink-2 px-2 py-1.5">
        <span className="size-2.5 bg-px-red" />
        <span className="size-2.5 bg-px-yellow" />
        <span className="size-2.5 bg-px-green" />
        <span className="ml-2 min-w-0 flex-1 truncate bg-night px-2 font-terminal text-base text-lilac">
          {url}
        </span>
      </div>
      {children}
    </div>
  )
}

/** One page, three eras: unstyled HTML, then CSS, then JavaScript. */
function EvolvingPage({ phase }: { phase: number }) {
  const styled = phase >= 1
  const live = phase >= 2
  const [clicks, setClicks] = React.useState(0)
  const [dark, setDark] = React.useState(false)
  const t = "transition-all duration-500"

  return (
    <div
      className={cn(
        t,
        "min-h-[22rem] p-4 text-left",
        styled ? "font-sans" : "font-serif",
        styled && dark ? "bg-[#14122e] text-cream" : styled ? "bg-white text-night" : "bg-white text-black"
      )}
    >
      <header
        className={cn(
          t,
          styled ? "-mx-4 -mt-4 mb-4 bg-gradient-to-r from-px-pink to-px-purple px-4 py-5 text-white" : ""
        )}
      >
        <h3 className={cn(t, styled ? "text-2xl font-bold tracking-tight" : "text-3xl font-bold")}>My Website</h3>
        <nav className={cn(t, "mt-1 flex gap-3", !styled && "text-[#0000ee] underline")}>
          <a href="#web" onClick={(e) => e.preventDefault()} className={styled ? "text-white/90" : undefined}>
            Home
          </a>
          <a href="#web" onClick={(e) => e.preventDefault()} className={styled ? "text-white/90" : undefined}>
            About
          </a>
          <a href="#web" onClick={(e) => e.preventDefault()} className={styled ? "text-white/90" : undefined}>
            Contact
          </a>
        </nav>
      </header>
      <div className={cn(t, styled ? "grid grid-cols-2 gap-3" : "")}>
        {["Fast", "Responsive"].map((f) => (
          <div
            key={f}
            className={cn(
              t,
              styled ? "rounded-lg border p-3 shadow-sm" : "mb-2",
              styled && (dark ? "border-white/15 bg-white/5" : "border-black/10 bg-[#faf7ff]")
            )}
          >
            <p className={styled ? "font-semibold" : "font-bold"}>{f}</p>
            <p className={cn("text-sm", styled && "opacity-70")}>Lorem ipsum dolor sit amet.</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!live}
          onClick={() => setClicks((c) => c + 1)}
          className={cn(
            t,
            styled
              ? "rounded-full bg-px-pink px-4 py-2 text-sm font-semibold text-white shadow hover:scale-105 active:scale-95"
              : "border border-black bg-[#efefef] px-1 text-black"
          )}
        >
          Click me
        </button>
        {live && (
          <>
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm">
              clicked {clicks} {clicks === 1 ? "time" : "times"}
            </motion.span>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setDark((d) => !d)}
              className="rounded-full border border-current px-3 py-1 text-xs"
            >
              {dark ? "☀ light" : "☾ dark"}
            </motion.button>
          </>
        )}
      </div>
    </div>
  )
}

function WebScene() {
  const reduced = useReducedMotion()
  const ref = React.useRef<HTMLDivElement>(null)
  const progress = useSceneProgress(ref)
  const p = useSteppedValue(progress, 100)
  const phase = p < 0.33 ? 0 : p < 0.66 ? 1 : 2

  return (
    <div ref={ref} className={reduced ? "relative" : "relative h-[260vh]"}>
      <div className="sticky top-0 flex h-svh items-center pt-16">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-8 px-4 md:grid-cols-[1fr_1.4fr]">
          <div className="flex flex-col gap-4">
            <p className="font-pixel-sans text-xl text-lilac">
              Square one again: how does the web actually work?
            </p>
            <ul className="flex flex-row gap-4 md:flex-col">
              {POWERUPS.map((pu, i) => {
                const on = phase >= i
                return (
                  <li key={pu.key} className="flex items-center gap-3">
                    <motion.span
                      className={cn(
                        "retro grid h-12 w-14 place-items-center text-[0.625rem] text-night sm:w-16",
                        on ? pu.color : "bg-ink-2 text-lilac/50"
                      )}
                      animate={on ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                      transition={{ duration: 0.4 }}
                    >
                      {pu.key}
                    </motion.span>
                    <span
                      className={cn(
                        "hidden font-pixel-sans text-lg sm:inline",
                        on ? "text-cream" : "text-lilac/40"
                      )}
                    >
                      {pu.note}
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="retro text-[0.5625rem] text-px-yellow" aria-live="polite">
              {["+ HTML LEARNED", "+ CSS LEARNED", "+ JS LEARNED · TRY THE BUTTON"][phase]}
            </p>
          </div>
          <BrowserChrome url={["index.html", "index.html + style.css", "index.html + style.css + app.js"][phase]}>
            <EvolvingPage phase={phase} />
          </BrowserChrome>
        </div>
      </div>
    </div>
  )
}

const STATIC_SITES = [
  "landing-page.html",
  "landing-page-v2.html",
  "landing-v2-final.html",
  "landing-v2-FINAL-final.html",
  "portfolio.html",
  "restaurant.html",
  "gym.html",
  "calculator.html",
  "todo.html",
  "weather.html",
  "clone.html",
  "one-more.html",
]

const SITE_COLORS = ["bg-px-pink", "bg-px-cyan", "bg-px-yellow", "bg-px-green", "bg-px-purple", "bg-px-orange"]

function SiteBurst() {
  const reduced = useReducedMotion()
  return (
    <div className="mx-auto grid max-w-5xl grid-cols-2 gap-5 px-4 sm:grid-cols-3 lg:grid-cols-4">
      {STATIC_SITES.map((name, i) => (
        <motion.div
          key={name}
          className="border-4 border-night bg-cream shadow-[6px_8px_0_rgb(0_0_0/0.4)]"
          initial={reduced ? false : { opacity: 0, y: 80, rotate: (i % 2 ? 1 : -1) * (8 + (i % 4) * 4), scale: 0.6 }}
          whileInView={{ opacity: 1, y: 0, rotate: (i % 3) - 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ type: "spring", stiffness: 200, damping: 16, delay: (i % 4) * 0.08 }}
        >
          <div className="truncate border-b-4 border-night bg-ink-2 px-2 py-1 font-terminal text-sm text-lilac">
            {name}
          </div>
          <div className="flex flex-col gap-1.5 p-2">
            <span className={cn("h-5", SITE_COLORS[i % SITE_COLORS.length])} />
            <span className="h-1.5 w-3/4 bg-night/20" />
            <span className="h-1.5 w-1/2 bg-night/20" />
            <div className="mt-1 grid grid-cols-3 gap-1">
              <span className="h-6 bg-night/10" />
              <span className="h-6 bg-night/10" />
              <span className="h-6 bg-night/10" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export function StageWeb() {
  return (
    <Stage id="web" className="overflow-clip bg-[#1a1240] pb-28">
      <StageTitle id="web" kicker="New route. Back to basics: what even is a div?" />
      <WebScene />
      <Dialogue speaker="ASHFAQ · 2020" tone="cyan" className="mb-14 px-4">
        Once it clicked I shipped a LOT of static sites in a month. Naming them was the hardest part.
      </Dialogue>
      <SiteBurst />
    </Stage>
  )
}

/* ------------------------------------------------------------------------- */

const MERN = [
  { key: "M", name: "MongoDB", color: "bg-px-green" },
  { key: "E", name: "Express", color: "bg-lilac" },
  { key: "R", name: "React", color: "bg-px-cyan" },
  { key: "N", name: "Node.js", color: "bg-px-green" },
]

function Cartridges() {
  const reduced = useReducedMotion()
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-end gap-3 sm:gap-5">
        {MERN.map((c, i) => (
          <motion.div
            key={c.name}
            className="flex flex-col items-center"
            initial={reduced ? false : { y: -140, opacity: 0, rotate: i % 2 ? 12 : -12 }}
            whileInView={{ y: 0, opacity: 1, rotate: 0 }}
            viewport={{ once: true, amount: 0.8 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 * i }}
          >
            <div className="relative w-16 border-4 border-night bg-[#5c5878] px-1.5 pb-2 pt-3 sm:w-20">
              <div className={cn("retro grid h-14 place-items-center text-xl text-night sm:h-16", c.color)}>
                {c.key}
              </div>
              <div className="mt-2 flex justify-between px-1">
                {[0, 1, 2, 3].map((n) => (
                  <span key={n} className="h-1.5 w-1 bg-night/50" />
                ))}
              </div>
            </div>
            <span className="mt-2 font-pixel-sans text-base text-lilac">{c.name}</span>
          </motion.div>
        ))}
      </div>
      {/* The console they plug into */}
      <div className="-mt-1 h-6 w-[min(26rem,90vw)] border-4 border-night bg-ink-2" />
    </div>
  )
}

function FeedPost({ who, text, likes }: { who: string; text: string; likes: number }) {
  const [liked, setLiked] = React.useState(false)
  return (
    <div className="border-4 border-night bg-cream p-3 text-night">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center bg-px-purple font-pixel-sans text-white">{who[0]}</span>
        <span className="font-pixel-sans text-lg font-semibold">{who}</span>
      </div>
      <p className="mt-2 font-pixel-sans text-lg leading-snug">{text}</p>
      <button
        type="button"
        onClick={() => setLiked((l) => !l)}
        aria-pressed={liked}
        className="mt-2 flex items-center gap-2 font-pixel-sans text-base"
      >
        <motion.span animate={liked ? { scale: [1, 1.5, 1] } : { scale: 1 }}>
          <PixelSprite sprite={HEART} className={cn("w-5", !liked && "grayscale")} />
        </motion.span>
        {likes + (liked ? 1 : 0)} likes
      </button>
    </div>
  )
}

export function StageFullStack() {
  const reduced = useReducedMotion()
  return (
    <Stage id="full-stack" className="overflow-clip bg-night pb-28">
      <StageTitle id="full-stack" kicker="Static sites are cute. But where does the data live?" />
      <Cartridges />
      <Dialogue speaker="ASHFAQ · 2021" tone="pink" className="mt-14 px-4">
        Grabbed a MERN social-media tutorial and actually finished it, which statistically nobody does. Users, posts, a real database. First full-stack app ✓
      </Dialogue>

      <motion.div
        className="mx-auto mt-14 w-full max-w-md px-4"
        initial={reduced ? false : { opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <BrowserChrome url="localhost:3000/feed">
          <div className="flex flex-col gap-3 bg-[#e9e3d4] p-3">
            <FeedPost who="ashfaq" text="it works. IT WORKS. full stack, baby. 🚀" likes={12} />
            <FeedPost who="mongo" text="I stored that, by the way." likes={3} />
          </div>
        </BrowserChrome>
      </motion.div>

      <Achievement
        className="mt-14"
        title="First full-stack app"
        detail="MongoDB · Express · React · Node — then a few more after it"
      />
    </Stage>
  )
}
