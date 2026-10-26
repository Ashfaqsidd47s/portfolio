import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { currentBid, formatMoney, nextMinimum } from "./auction"
import { drawPlaceholder, drawWordmark, fontsReady } from "./cards"
import { FEATURED, photoUrl, type CatalogueLot } from "./catalogue"
import { LiquidStage, type Slide } from "./liquid"
import { useShell } from "./shell"
import { useAuction } from "./store"
import { Countdown, EASE, Eyebrow, MaskedLine, Odometer, btn } from "./ui"

type Rect = Slide["rect"]

/** Wide stages put the photo between two columns of text; narrow ones stack them. */
export function stageLayout(width: number, height: number) {
  const wide = width >= 860
  if (wide) {
    const h = Math.min(height * 0.74, width * 0.34 * 1.25)
    const w = h * 0.8
    return { wide, photo: { x: (width - w) / 2, y: (height - h) / 2 + height * 0.02, w, h } }
  }
  const h = Math.min(height * 0.46, width * 0.84 * 1.25)
  const w = h * 0.8
  return { wide, photo: { x: (width - w) / 2, y: height * 0.12, w, h } }
}

function wordmarkRect(width: number, height: number): Rect {
  const w = Math.min(width * (width < 600 ? 1.02 : 0.86), 1100)
  const h = w / 2.4
  return { x: (width - w) / 2, y: (height - h) / 2 - height * 0.03, w, h }
}

/** How long the wordmark holds the stage once it's up, before the first lot pours in. */
const SPLASH_MS = 4200

/**
 * The landing page's pinned stage: one screen of scroll per featured lot.
 * The wordmark rises out of the dark as a splash when the app opens, then
 * melts into the first lot on its own; scrolling melts each lot into the next.
 */
export function Stage() {
  const shell = useShell()
  const { width, height, scroller, reduced, visible } = shell
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const sectionRef = React.useRef<HTMLElement>(null)
  const stageRef = React.useRef<LiquidStage | null>(null)
  const wordmark = React.useRef<HTMLCanvasElement | null>(null)
  const [index, setIndex] = React.useState(0)
  const [ready, setReady] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const [splash, setSplash] = React.useState(!shell.splashed.current)
  const count = FEATURED.length
  const layout = stageLayout(width, height)

  const endSplash = React.useCallback(() => {
    shell.splashed.current = true
    setSplash(false)
  }, [shell.splashed])

  const slideFor = React.useCallback(
    (i: number | "splash"): Slide | null => {
      if (i === "splash") {
        if (!wordmark.current) return null
        return { source: wordmark.current, rect: wordmarkRect(width, height), fit: "contain", fallback: () => wordmark.current! }
      }
      const lot = FEATURED[i]
      return {
        source: photoUrl(lot.photos[0]?.src ?? "", 1400, 1750),
        rect: stageLayout(width, height).photo,
        fit: "cover",
        fallback: () => drawPlaceholder(lot.maker, lot.title),
      }
    },
    [width, height]
  )

  // One GL stage for the life of the page.
  React.useEffect(() => {
    let stage: LiquidStage
    try {
      stage = new LiquidStage(canvasRef.current!, reduced)
    } catch (error) {
      console.warn("11bids: the liquid stage is off, showing photos instead.", error)
      setFailed(true)
      return
    }
    stageRef.current = stage
    let live = true
    void fontsReady()
      .then(drawWordmark)
      .then((mark) => {
        if (!live) return
        wordmark.current = mark
        setReady(true)
      })
    return () => {
      live = false
      stage.dispose()
      stageRef.current = null
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    stageRef.current?.resize(width, height, Math.min(window.devicePixelRatio || 1, 1.75))
    stageRef.current?.relayout((slide) => (slide.fit === "contain" ? wordmarkRect(width, height) : layout.photo))
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height])

  // Warm every featured photo so each melt starts the moment it's asked for.
  React.useEffect(() => {
    if (!ready) return
    for (let i = 0; i < count; i++) {
      const slide = slideFor(i)
      if (slide) void stageRef.current?.load(slide)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  React.useEffect(() => {
    if (!ready) return
    const slide = slideFor(splash ? "splash" : index)
    if (slide) void stageRef.current?.show(slide)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [index, ready, splash])

  // The splash holds the stage a moment, then gives way to the lots.
  React.useEffect(() => {
    if (!splash || !(ready || failed)) return
    const timer = setTimeout(endSplash, reduced ? 1800 : SPLASH_MS)
    return () => clearTimeout(timer)
  }, [splash, ready, failed, reduced, endSplash])

  // Scroll picks the slide.
  React.useEffect(() => {
    const el = scroller.current
    const section = sectionRef.current
    if (!el || !section) return
    const onScroll = () => {
      const travel = section.offsetHeight - el.clientHeight
      const p = travel > 0 ? (el.scrollTop - section.offsetTop) / travel : 0
      const i = Math.max(0, Math.min(count - 1, Math.floor(p * count * 0.999 + 0.0001)))
      setIndex(i)
      // Scrolling on means the visitor is past the splash.
      if (el.scrollTop - section.offsetTop > 24) endSplash()
    }
    onScroll()
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [scroller, count, height, endSplash])

  // Draw while the window can be seen and the stage is on screen.
  const [onScreen, setOnScreen] = React.useState(true)
  React.useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { root: scroller.current })
    io.observe(section)
    return () => io.disconnect()
  }, [scroller])

  React.useEffect(() => {
    if (!visible || !onScreen || failed) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      stageRef.current?.frame((now - last) / 1000)
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible, onScreen, failed])

  const jump = (i: number) => {
    const el = scroller.current
    const section = sectionRef.current
    if (!el || !section) return
    const travel = section.offsetHeight - el.clientHeight
    endSplash()
    const top = section.offsetTop + ((i + 0.5) / count) * travel
    if (shell.lenis.current) shell.lenis.current.scrollTo(top, { duration: 1.4 })
    else el.scrollTo({ top, behavior: reduced ? "auto" : "smooth" })
  }

  const lot = splash ? null : FEATURED[index]

  return (
    <section ref={sectionRef} aria-label="Featured lots" className="relative bg-eb-ink" style={{ height: height * (count + 0.6) }}>
      <div className="sticky top-0 overflow-hidden" style={{ height }}>
        <canvas
          ref={canvasRef}
          className={cn("absolute inset-0 size-full", lot && "cursor-pointer")}
          aria-hidden
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            stageRef.current?.pointer(e.clientX - r.left, e.clientY - r.top)
          }}
          onPointerLeave={() => stageRef.current?.leave()}
          onClick={(e) => {
            if (!lot) return
            const r = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - r.left
            const y = e.clientY - r.top
            const p = layout.photo
            if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) shell.go({ name: "lot", id: lot.id })
          }}
        />
        {failed && <StaticStage lot={lot} />}

        <h1 className="sr-only">11bids — fine auctions</h1>

        <AnimatePresence>
          {splash && (
            <motion.p
              key="intro"
              className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto max-w-[34ch] px-6 pb-14 text-center font-eb-serif text-lg italic text-eb-ivory/70 @3xl:text-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: ready ? 1.6 : 0, duration: 1.2 } }}
              exit={{ opacity: 0, transition: { duration: 0.4 } }}
            >
              Rare watches, handbags, jewels and motor cars, sold to the room one bid at a time.
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence>{lot && <LotCopy key={lot.id} lot={lot} wide={layout.wide} photo={layout.photo} />}</AnimatePresence>

        <nav
          aria-label="Featured lots"
          className={cn(
            "absolute flex gap-3",
            layout.wide ? "right-6 top-1/2 -translate-y-1/2 flex-col" : "inset-x-0 bottom-4 justify-center"
          )}
        >
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => jump(i)}
              aria-label={`Lot ${FEATURED[i].number}: ${FEATURED[i].title}`}
              aria-current={!splash && i === index}
              className="group grid place-items-center p-1"
            >
              <span
                className={cn(
                  "block bg-eb-ivory transition-all duration-700",
                  layout.wide ? "w-px" : "h-px",
                  !splash && i === index ? (layout.wide ? "h-8 opacity-100" : "w-8 opacity-100") : layout.wide ? "h-3 opacity-30 group-hover:opacity-70" : "w-3 opacity-30 group-hover:opacity-70"
                )}
              />
            </button>
          ))}
        </nav>
      </div>
    </section>
  )
}

/** The words around a featured lot: who made it, what it is, where the bidding stands. */
function LotCopy({ lot, wide, photo }: { lot: CatalogueLot; wide: boolean; photo: Rect }) {
  const shell = useShell()
  const state = useAuction((s) => s.lots[lot.id])
  const account = useAuction((s) => s.account)
  if (!state) return null
  const current = currentBid(state)
  const fade = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10, transition: { duration: 0.35 } },
  }
  const bidNow = () => {
    const open = () => shell.reviewBid(lot.id, nextMinimum(useAuction.getState().lots[lot.id]))
    if (account) open()
    else shell.requireAccount(open)
  }

  const title = (
    <h2 className="font-eb-serif text-[clamp(2.1rem,5.2cqw,4.4rem)] font-medium leading-[0.98] tracking-[-0.01em] text-balance">
      <MaskedLine text={lot.title} delay={0.35} />
    </h2>
  )

  const figures = (
    <motion.dl {...fade} transition={{ duration: 0.9, ease: EASE, delay: 0.55 }} className="grid gap-5">
      <div>
        <dt className="font-eb-sans text-[0.62rem] uppercase tracking-[0.3em] text-eb-ivory/50">Current bid</dt>
        <dd className="mt-1.5 font-eb-serif text-4xl text-eb-ivory">
          <Odometer value={current} />
        </dd>
      </div>
      <div className="flex gap-8">
        <div>
          <dt className="font-eb-sans text-[0.62rem] uppercase tracking-[0.3em] text-eb-ivory/50">Closes in</dt>
          <dd className="mt-1 font-eb-sans text-sm tracking-wider text-eb-ivory/90">
            <Countdown endsAt={state.endsAt} />
          </dd>
        </div>
        <div>
          <dt className="font-eb-sans text-[0.62rem] uppercase tracking-[0.3em] text-eb-ivory/50">Bids</dt>
          <dd className="mt-1 font-eb-sans text-sm tracking-wider text-eb-ivory/90">{state.bids.length}</dd>
        </div>
      </div>
    </motion.dl>
  )

  const actions = (
    <motion.div {...fade} transition={{ duration: 0.9, ease: EASE, delay: 0.7 }} className="pointer-events-auto flex flex-wrap gap-3">
      <button type="button" className={cn(btn.base, btn.solidLight)} onClick={bidNow}>
        Bid {formatMoney(nextMinimum(state))}
      </button>
      <button type="button" className={cn(btn.base, btn.ghostLight)} onClick={() => shell.go({ name: "lot", id: lot.id })}>
        View lot <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
      </button>
    </motion.div>
  )

  if (wide) {
    const gutter = photo.x
    return (
      <div className="pointer-events-none absolute inset-0 text-eb-ivory">
        <div className="absolute flex flex-col justify-center gap-5" style={{ left: "5%", width: gutter - 64 - 0.05 * shell.width, top: 0, bottom: 0 }}>
          <motion.div {...fade} transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}>
            <Eyebrow className="text-eb-gold">
              Lot {String(lot.number).padStart(3, "0")} · {lot.maker}
            </Eyebrow>
          </motion.div>
          {title}
          <motion.p {...fade} transition={{ duration: 0.9, ease: EASE, delay: 0.5 }} className="font-eb-sans text-[0.8rem] tracking-wide text-eb-ivory/55">
            {lot.subtitle}
          </motion.p>
        </div>
        <div className="absolute flex flex-col justify-center gap-8" style={{ left: photo.x + photo.w + 56, right: "7%", top: 0, bottom: 0 }}>
          {figures}
          <motion.p {...fade} transition={{ duration: 0.9, ease: EASE, delay: 0.6 }} className="font-eb-sans text-xs tracking-wide text-eb-ivory/45">
            Estimate {formatMoney(lot.estimate[0])} – {formatMoney(lot.estimate[1])}
          </motion.p>
          {actions}
        </div>
      </div>
    )
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 px-5 pb-12 text-center text-eb-ivory"
      style={{ top: photo.y + photo.h + 20 }}
    >
      <motion.div {...fade} transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}>
        <Eyebrow className="text-eb-gold">
          Lot {String(lot.number).padStart(3, "0")} · {lot.maker}
        </Eyebrow>
      </motion.div>
      <div className="[&_h2]:text-[clamp(1.7rem,8cqw,2.6rem)]">{title}</div>
      <motion.div {...fade} transition={{ duration: 0.9, ease: EASE, delay: 0.55 }} className="flex items-baseline gap-4 font-eb-sans text-xs tracking-wide text-eb-ivory/60">
        <span className="font-eb-serif text-2xl text-eb-ivory">
          <Odometer value={current} />
        </span>
        <Countdown endsAt={state.endsAt} />
      </motion.div>
      {actions}
    </div>
  )
}

/** Without WebGL: the same story as a plain crossfade. */
function StaticStage({ lot }: { lot: CatalogueLot | null }) {
  const { width, height } = useShell()
  const { photo } = stageLayout(width, height)
  return (
    <AnimatePresence>
      {lot ? (
        <motion.img
          key={lot.id}
          src={photoUrl(lot.photos[0]?.src ?? "", 1000, 1250)}
          alt=""
          className="absolute object-cover"
          style={{ left: photo.x, top: photo.y, width: photo.w, height: photo.h }}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: EASE }}
        />
      ) : (
        <motion.p
          key="mark"
          className="absolute inset-0 grid place-items-center font-eb-serif text-[18cqw] text-eb-ivory"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <span>
            11<em>bids</em>
          </span>
        </motion.p>
      )}
    </AnimatePresence>
  )
}
