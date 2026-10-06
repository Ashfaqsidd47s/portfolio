import * as React from "react"
import { Link } from "react-router-dom"
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "motion/react"
import { Button } from "@/components/ui/8bit/button"
import XpBar from "@/components/ui/8bit/xp-bar"
import { stages } from "@/data/journey"
import { profile } from "@/data/profile"
import { PixelSprite } from "./primitives"
import { useSteppedValue } from "./hooks"
import { HERO_FRAMES } from "./sprites"

function useActiveStage() {
  const [active, setActive] = React.useState<string | null>(null)
  React.useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-stage]")
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.getAttribute("data-stage"))
        }
      },
      // A thin band across the middle of the viewport decides the stage.
      { rootMargin: "-48% 0px -48% 0px" }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])
  return active
}

export function Hud() {
  const { scrollY, scrollYProgress } = useScroll()
  const progress = useSteppedValue(scrollYProgress, 100)
  const active = useActiveStage()
  const stage = stages.find((s) => s.id === active)
  const [frame, setFrame] = React.useState(0)
  const [facingLeft, setFacingLeft] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)

  useMotionValueEvent(scrollY, "change", (y) => {
    setFrame(Math.floor(y / 48) % 2)
    setFacingLeft(y < (scrollY.getPrevious() ?? y))
  })

  React.useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [menuOpen])

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b-4 border-night bg-night/85 backdrop-blur-md">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <a href="#top" className="group flex min-w-0 items-center gap-2.5" aria-label="Back to start">
            <span className="retro grid size-8 shrink-0 place-items-center bg-px-pink text-[0.625rem] text-night transition-transform group-hover:-translate-y-0.5">
              MA
            </span>
            <span className="retro hidden truncate text-[0.5625rem] text-cream sm:inline">
              ASHFAQ.EXE
            </span>
          </a>

          <p
            className="retro min-w-0 truncate text-center text-[0.5rem] text-px-yellow sm:text-[0.5625rem]"
            aria-live="polite"
          >
            {stage ? (
              <>
                <span className="text-lilac">{stage.year} · </span>
                {stage.title.toUpperCase()}
              </>
            ) : (
              <span className="animate-blink">PRESS START</span>
            )}
          </p>

          <div className="flex shrink-0 items-center gap-3">
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 bg-night px-2.5 text-[0.5rem] text-cream hover:bg-ink-2 sm:text-[0.5625rem]"
            >
              <Link to="/" aria-label="Back to the desktop">
                ◀ <span className="hidden sm:inline">DESKTOP</span>
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 bg-night px-2.5 text-[0.5rem] text-cream hover:bg-ink-2 sm:text-[0.5625rem]"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="stage-select"
            >
              STAGES
            </Button>
            <Button
              asChild
              size="sm"
              className="hidden h-8 bg-px-yellow px-2.5 text-[0.5625rem] text-night hover:bg-px-yellow/90 sm:inline-flex"
            >
              <Link to="/resume">RÉSUMÉ</Link>
            </Button>
          </div>
        </nav>

        {/* XP bar = how far through the journey you are, with me walking it. */}
        <div className="relative mx-auto max-w-6xl px-4 pb-2 sm:px-6">
          <XpBar
            value={progress >= 0.995 ? 100 : Math.round(progress * 100)}
            levelUpMessage="LEVEL UP!"
            progressBg="bg-px-yellow"
            className="[&_[data-slot=progress]]:h-1.5"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-6 w-5 transition-[left] duration-150 ease-out"
            style={{ left: `calc(1rem + (100% - 2rem - 1.25rem) * ${progress})` }}
          >
            <div style={{ transform: facingLeft ? "scaleX(-1)" : undefined }}>
              <PixelSprite sprite={HERO_FRAMES[frame]} className="w-5" />
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-night/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
              id="stage-select"
              role="dialog"
              aria-label="Stage select"
              className="px-frame-shadow absolute right-4 top-24 max-h-[calc(100svh-8rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto bg-ink p-4 sm:right-6"
              initial={{ y: -16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -16, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="retro mb-3 text-[0.625rem] text-px-yellow">STAGE SELECT</p>
              <ol className="flex flex-col">
                {stages.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      onClick={() => setMenuOpen(false)}
                      className="group flex items-baseline gap-3 px-2 py-2 hover:bg-ink-2 focus-visible:bg-ink-2"
                    >
                      <span
                        aria-hidden
                        className={
                          s.id === active
                            ? "retro text-[0.5rem] text-px-pink"
                            : "retro text-[0.5rem] text-transparent group-hover:text-px-pink"
                        }
                      >
                        ▶
                      </span>
                      <span className="retro w-9 shrink-0 text-[0.5rem] text-lilac">{s.year}</span>
                      <span className="min-w-0">
                        <span className="block font-pixel-sans text-lg leading-tight text-cream">
                          {s.title}
                        </span>
                        <span className="block font-pixel-sans text-sm leading-snug text-lilac">
                          {s.blurb}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
              <div className="mt-4 flex flex-wrap gap-3 border-t-4 border-night pt-4">
                <Button asChild size="sm" className="bg-px-yellow text-[0.5625rem] text-night">
                  <Link to="/resume">RÉSUMÉ</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="bg-ink text-[0.5625rem] text-cream">
                  <a href={profile.socials.email}>EMAIL ME</a>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
