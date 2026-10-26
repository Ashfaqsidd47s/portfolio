import * as React from "react"
import { motion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react"
import { ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { CATEGORIES } from "./catalogue"
import { useShell } from "./shell"
import { EASE, Eyebrow, useNow } from "./ui"

const SALEROOMS = [
  ["Geneva", "Europe/Zurich"],
  ["London", "Europe/London"],
  ["New York", "America/New_York"],
  ["Hong Kong", "Asia/Hong_Kong"],
  ["Dubai", "Asia/Dubai"],
] as const

const MARK = ["1", "1", "b", "i", "d", "s"]

/**
 * The house's sign-off: a full-screen footer that waits beneath the page.
 * The page lifts off it like a curtain (a clipped box holding a sticky
 * panel), the panel drifts up into place, and the wordmark rises a letter
 * at a time, lit by a slow champagne shimmer.
 */
export function Footer() {
  const shell = useShell()
  const wrap = React.useRef<HTMLDivElement>(null)
  const content = React.useRef<HTMLDivElement>(null)
  const [contentHeight, setContentHeight] = React.useState(0)
  // At least a screen tall; taller when a short screen can't fit it all.
  const view = shell.height
  const h = Math.max(view, contentHeight)

  React.useLayoutEffect(() => {
    const el = content.current!
    const measure = () => setContentHeight(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const { scrollYProgress } = useScroll({ container: shell.scroller, target: wrap, offset: ["start end", "end end"] })
  const smooth = useSpring(scrollYProgress, { stiffness: 140, damping: 32, mass: 0.4 })
  const progress = shell.reduced ? scrollYProgress : smooth
  const lift = useTransform(progress, [0, 1], shell.reduced ? ["0%", "0%"] : ["-22%", "0%"])
  const dim = useTransform(progress, [0, 0.9], [0.75, 0])
  const glow = useTransform(progress, [0.3, 1], [0, 1])

  const toTop = () => {
    if (shell.lenis.current) shell.lenis.current.scrollTo(0, { duration: 2.6, easing: (t) => 1 - Math.pow(1 - t, 4) })
    else shell.scroller.current?.scrollTo({ top: 0, behavior: shell.reduced ? "auto" : "smooth" })
  }

  return (
    <div ref={wrap} className="relative" style={{ height: h, clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" }}>
      {/* The panel sticks to the bottom of the view while its box scrolls over it. */}
      <div className="relative" style={{ height: view + h, top: -view }}>
        <footer data-eb-tone="dark" className="sticky overflow-hidden bg-eb-ink-2 text-eb-ivory" style={{ height: h, top: view - h }}>
          {/* Warm light pooling under the wordmark. */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-[radial-gradient(60%_70%_at_50%_100%,rgba(201,169,110,0.16),transparent_70%)]"
            style={{ opacity: glow }}
          />
          <div aria-hidden className="noise pointer-events-none absolute inset-0" />

          <motion.div ref={content} className="relative flex flex-col px-5 pt-20 @3xl:px-12 @3xl:pt-12" style={{ y: lift, minHeight: view }}>
            <div className="mx-auto grid w-full max-w-[1400px] gap-10 @4xl:grid-cols-[1.3fr_1fr] @4xl:gap-20">
              <div>
                <Eyebrow className="text-eb-gold">Private enquiries</Eyebrow>
                <p className="mt-4 max-w-xl font-eb-serif text-[clamp(1.7rem,3.6cqw,3.1rem)] font-medium leading-[1.05] tracking-[-0.01em] text-balance">
                  Every great collection begins <em className="font-normal text-eb-gold">with a single bid.</em>
                </p>
              </div>
              <Newsletter />
            </div>

            <div className="mx-auto mt-8 grid w-full max-w-[1400px] grid-cols-2 gap-8 border-t border-eb-ivory/10 pt-8 @3xl:grid-cols-[1fr_1fr_1.3fr]">
              <FooterList
                title="Departments"
                split
                items={CATEGORIES.map((c) => ({ label: c, onClick: () => shell.go({ name: "lots", category: c }) }))}
              />
              <FooterList
                title="The house"
                items={[
                  { label: "All lots", onClick: () => shell.go({ name: "lots" }) },
                  { label: "My bids", onClick: () => shell.go({ name: "account", tab: "bids" }) },
                  { label: "Watchlist", onClick: () => shell.go({ name: "account", tab: "watch" }) },
                  { label: "Back to the stage", onClick: () => (shell.view.name === "home" ? toTop() : shell.go({ name: "home" })) },
                ]}
              />
              <Salerooms />
            </div>

            <div className="mt-auto">
              {/* Sized to the screen as well as the width, so the whole footer fits in one view. */}
              <Wordmark progress={progress} size={Math.max(72, Math.min(shell.width * 0.26, view * 0.27))} />
              <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 border-t border-eb-ivory/10 py-5 font-eb-sans text-[0.64rem] tracking-wide text-eb-ivory/40">
                <p className="min-w-0">© 2026 11bids Fine Auctions · A portfolio demo: lots, bidders and prices are fictional · Photography via Unsplash</p>
                <button
                  type="button"
                  onClick={toTop}
                  className="group flex shrink-0 items-center gap-3 uppercase tracking-[0.28em] text-eb-ivory/70 transition-colors hover:text-eb-ivory"
                >
                  <span className="hidden @lg:inline">Back to top</span>
                  <span className="grid size-9 place-items-center rounded-full border border-eb-ivory/25 transition-[border-color,transform] duration-500 group-hover:-translate-y-1 group-hover:border-eb-gold">
                    <ArrowUp className="size-3.5" strokeWidth={1.4} />
                  </span>
                </button>
              </div>
            </div>
          </motion.div>

          {/* The page's shadow, lifting off as the footer is uncovered. */}
          <motion.div aria-hidden className="pointer-events-none absolute inset-0 bg-eb-ink" style={{ opacity: dim }} />
        </footer>
      </div>
    </div>
  )
}

/** "11bids" across the full width, each letter rising on its own beat. */
function Wordmark({ progress, size }: { progress: MotionValue<number>; size: number }) {
  return (
    <p
      aria-label="11bids"
      role="img"
      className="relative mx-auto mt-2 flex w-full justify-center overflow-hidden font-eb-serif leading-[0.95] tracking-[-0.03em]"
      style={{ fontSize: size }}
    >
      {MARK.map((ch, i) => (
        <Letter key={i} ch={ch} i={i} progress={progress} />
      ))}
    </p>
  )
}

function Letter({ ch, i, progress }: { ch: string; i: number; progress: MotionValue<number> }) {
  const start = 0.3 + i * 0.06
  const y = useTransform(progress, [start, start + 0.45], ["105%", "0%"])
  const rotate = useTransform(progress, [start, start + 0.45], [8, 0])
  const italic = i >= 2
  return (
    <span className="inline-block overflow-hidden pb-[0.05em]">
      <motion.span
        aria-hidden
        className={cn(
          "inline-block bg-[linear-gradient(100deg,#8d6f3a_0%,#f1e3c4_22%,#c9a96e_40%,#fbf3df_52%,#a8874b_70%,#e9d6ad_100%)] bg-[length:250%_100%] bg-clip-text text-transparent motion-safe:animate-[eb-shimmer_9s_ease-in-out_infinite]",
          italic && "italic"
        )}
        style={{ y, rotate, transformOrigin: "0% 100%", animationDelay: `${i * -0.35}s` }}
      >
        {ch}
      </motion.span>
    </span>
  )
}

function Newsletter() {
  const [email, setEmail] = React.useState("")
  const [joined, setJoined] = React.useState(false)
  const [tried, setTried] = React.useState(false)
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
  return (
    <div className="@4xl:pt-8">
      <p className="max-w-sm font-eb-sans text-sm leading-relaxed text-eb-ivory/55">
        Previews of every sale, results as they fall, and the occasional private offer. Once a week, never more.
      </p>
      <form
        className="mt-5 flex max-w-md items-center border-b border-eb-ivory/25 transition-colors focus-within:border-eb-gold"
        onSubmit={(e) => {
          e.preventDefault()
          setTried(true)
          if (valid) setJoined(true)
        }}
        noValidate
      >
        <label className="flex-1">
          <span className="sr-only">Email</span>
          <input
            type="email"
            value={email}
            disabled={joined}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email"
            className="h-12 w-full bg-transparent font-eb-serif text-xl text-eb-ivory placeholder:text-eb-ivory/30 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={joined}
          className="font-eb-sans text-[0.64rem] uppercase tracking-[0.28em] text-eb-gold transition-colors hover:text-eb-ivory disabled:opacity-100"
        >
          {joined ? "Subscribed" : "Subscribe"}
        </button>
      </form>
      <motion.p
        key={joined ? "ok" : tried && !valid ? "bad" : "none"}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className={cn("mt-2 h-4 font-eb-sans text-xs", joined ? "text-eb-gold" : "text-[#e08a7c]")}
        role="status"
      >
        {joined ? "Thank you. The next catalogue is on its way." : tried && !valid ? "Enter a valid email address." : ""}
      </motion.p>
    </div>
  )
}

/** The house's rooms, each on its own local clock. */
function Salerooms() {
  const now = useNow()
  return (
    <div className="col-span-2 @3xl:col-span-1">
      <Eyebrow className="text-eb-ivory/45">Salerooms</Eyebrow>
      <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 @3xl:grid-cols-1">
        {SALEROOMS.map(([city, zone]) => (
          <li key={city} className="flex items-baseline justify-between gap-4 border-b border-eb-ivory/[0.06] pb-1.5">
            <span className="font-eb-serif text-lg text-eb-ivory/85">{city}</span>
            <span className="font-eb-sans text-xs tracking-wider text-eb-ivory/45">
              {new Date(now).toLocaleTimeString("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit" })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FooterList({ title, items, split }: { title: string; items: { label: string; onClick: () => void }[]; split?: boolean }) {
  return (
    <div>
      <Eyebrow className="text-eb-ivory/45">{title}</Eyebrow>
      <ul className={cn("mt-4 grid gap-1.5", split && "@3xl:grid-cols-2 @3xl:gap-x-6")}>
        {items.map((it) => (
          <li key={it.label}>
            <button
              type="button"
              onClick={it.onClick}
              className="group relative font-eb-serif text-lg text-eb-ivory/85 transition-colors hover:text-eb-gold"
            >
              {it.label}
              <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-current transition-transform duration-500 group-hover:scale-x-100" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
