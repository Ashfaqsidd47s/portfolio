import * as React from "react"
import Lenis from "lenis"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowUpRight, Heart, Menu, UserRound, X } from "lucide-react"
import "@fontsource/cormorant-garamond/latin-400.css"
import "@fontsource/cormorant-garamond/latin-400-italic.css"
import "@fontsource/cormorant-garamond/latin-500.css"
import "@fontsource/jost/latin-400.css"
import "@fontsource/jost/latin-500.css"
import { cn } from "@/lib/utils"
import type { AppProps } from "@/os/registry/apps"
import { AccountPage } from "./account"
import { CATEGORIES } from "./catalogue"
import { AuthDialog, BidDialog, type BidDraft } from "./dialogs"
import { Home } from "./home"
import { LotPage } from "./lot"
import { Catalogue } from "./lots"
import { ShellContext, type Shell, type View } from "./shell"
import { Splash } from "./splash"
import { Footer } from "./footer"
import { useAuction } from "./store"
import { EASE, Eyebrow, pauseClock } from "./ui"

const viewKey = (v: View) => (v.name === "lot" ? `lot:${v.id}` : v.name === "lots" ? `lots:${v.category ?? ""}` : v.name)

/**
 * 11bids: a storefront for a luxury auction house. A liquid WebGL stage
 * melts from the house's wordmark through its featured lots; below it the
 * whole sale drifts past in parallax, then the catalogue, every lot's page
 * and a live room of bidders, with proxy bids and anti-sniping.
 */
export default function ElevenBids({ isVisible, isPhone }: AppProps) {
  const reduced = useReducedMotion() ?? false
  const rootRef = React.useRef<HTMLDivElement>(null)
  const scroller = React.useRef<HTMLDivElement>(null)
  const content = React.useRef<HTMLDivElement>(null)
  const lenis = React.useRef<Lenis | null>(null)
  const logo = React.useRef<HTMLButtonElement>(null)
  const [splash, setSplash] = React.useState<Shell["splash"]>("text")
  const [size, setSize] = React.useState({ width: 1024, height: 720 })
  const [stack, setStack] = React.useState<View[]>([{ name: "home" }])
  const view = stack[stack.length - 1]
  const [auth, setAuth] = React.useState<{ mode: "in" | "up"; then?: () => void } | null>(null)
  const [draft, setDraft] = React.useState<BidDraft | null>(null)
  const [menu, setMenu] = React.useState(false)

  // The app's own size: it may be a window, a phone screen or a page.
  React.useLayoutEffect(() => {
    const el = rootRef.current!
    const fit = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Buttery scrolling inside the app's own scroller.
  React.useEffect(() => {
    if (reduced || !scroller.current || !content.current) return
    const l = new Lenis({ wrapper: scroller.current, content: content.current, lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 })
    lenis.current = l
    return () => {
      l.destroy()
      lenis.current = null
    }
  }, [reduced])

  React.useEffect(() => {
    if (!isVisible || !lenis.current) return
    let raf = 0
    const loop = (t: number) => {
      lenis.current?.raf(t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [isVisible, reduced])

  React.useEffect(() => {
    if (auth || draft || menu) lenis.current?.stop()
    else lenis.current?.start()
  }, [auth, draft, menu])

  // The room: other bidders act while the sale is on screen.
  React.useEffect(() => {
    pauseClock(!isVisible)
    if (!isVisible) return
    const { relist, tick } = useAuction.getState()
    relist(Date.now())
    tick(Date.now())
    const id = window.setInterval(() => useAuction.getState().tick(Date.now()), 2400)
    return () => window.clearInterval(id)
  }, [isVisible])

  const toTop = React.useCallback(() => {
    if (lenis.current) lenis.current.scrollTo(0, { immediate: true, force: true })
    scroller.current?.scrollTo({ top: 0 })
  }, [])

  const go = React.useCallback((next: View) => {
    setMenu(false)
    setStack((s) => (viewKey(s[s.length - 1]) === viewKey(next) ? s : [...s.slice(-12), next]))
  }, [])

  const back = React.useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : [{ name: "home" }])), [])

  const requireAccount = React.useCallback((then?: () => void, mode: "in" | "up" = "up") => {
    if (useAuction.getState().account) return then?.()
    setAuth({ mode, then })
  }, [])

  const reviewBid = React.useCallback((lotId: string, amount: number, max?: number) => setDraft({ lotId, amount, max }), [])

  const shell: Shell = {
    view,
    go,
    back,
    requireAccount,
    reviewBid,
    scroller,
    lenis,
    splash,
    width: size.width,
    height: size.height,
    visible: isVisible,
    reduced,
  }

  return (
    <ShellContext.Provider value={shell}>
      <div ref={rootRef} data-eb-root className="@container relative h-full min-h-[420px] overflow-hidden bg-eb-ink font-eb-sans text-eb-ivory antialiased">
        <div ref={scroller} className="absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:thin]" data-eb-scroller>
          <div ref={content}>
            <AnimatePresence mode="wait" onExitComplete={toTop}>
              <motion.main
                key={viewKey(view)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.7, ease: EASE } }}
                exit={{ opacity: 0, transition: { duration: 0.35, ease: [0.7, 0, 0.84, 0] } }}
              >
                {view.name === "home" && <Home />}
                {view.name === "lot" && <LotPage id={view.id} />}
                {view.name === "lots" && <LotsPage category={view.category} />}
                {view.name === "account" && <AccountPage tab={view.tab} />}
              </motion.main>
            </AnimatePresence>
          </div>
        </div>

        <Header menu={menu} setMenu={setMenu} compact={isPhone || size.width < 900} logo={logo} />
        {splash !== "done" && <Splash logo={logo} phase={splash} setPhase={setSplash} />}
        <MobileMenu open={menu} onClose={() => setMenu(false)} />
        <Toasts />

        <AuthDialog
          open={!!auth}
          mode={auth?.mode ?? "up"}
          onClose={() => setAuth(null)}
          onDone={() => {
            const then = auth?.then
            setAuth(null)
            if (then) window.setTimeout(then, 380)
          }}
        />
        <BidDialog draft={draft} onClose={() => setDraft(null)} />
      </div>
    </ShellContext.Provider>
  )
}

function LotsPage({ category }: { category?: (typeof CATEGORIES)[number] }) {
  return (
    <div className="bg-eb-paper text-eb-ink">
      <div data-eb-tone="light" className="mx-auto max-w-[1400px] px-5 pb-24 pt-28 @3xl:px-12">
        <Eyebrow className="text-eb-gold-deep">The sale</Eyebrow>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE }}
          className="mb-12 mt-4 font-eb-serif text-[clamp(2.6rem,7cqw,5.4rem)] font-medium leading-[0.92] tracking-[-0.015em]"
        >
          {category ?? (
            <>
              All <em className="font-normal">lots</em>
            </>
          )}
        </motion.h1>
        <Catalogue category={category} />
      </div>
      <Footer />
    </div>
  )
}

/** Light text over the dark stage, dark text over paper; tucks away while you read downwards. */
function Header({
  menu,
  setMenu,
  compact,
  logo,
}: {
  menu: boolean
  setMenu: (v: boolean) => void
  compact: boolean
  logo: React.RefObject<HTMLButtonElement | null>
}) {
  const shell = React.useContext(ShellContext)!
  const account = useAuction((s) => s.account)
  const watching = useAuction((s) => s.watch.length)
  const [tone, setTone] = React.useState<"dark" | "light">("dark")
  const [solid, setSolid] = React.useState(false)
  const [hidden, setHidden] = React.useState(false)
  const [openMenu, setOpenMenu] = React.useState(false)
  const ref = React.useRef<HTMLElement>(null)

  React.useEffect(() => {
    const el = shell.scroller.current
    if (!el) return
    let last = el.scrollTop
    let raf = 0
    const read = () => {
      raf = 0
      const top = el.scrollTop
      setSolid(top > 24)
      if (Math.abs(top - last) > 6) {
        setHidden(top > last && top > 240)
        last = top
      }
      // What's under the header decides its colours.
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      const stack = document.elementsFromPoint(r.left + r.width / 2, r.bottom + 2)
      const under = stack.find((n) => el.contains(n) && n !== el)
      setTone(under?.closest<HTMLElement>("[data-eb-tone]")?.dataset.ebTone === "light" ? "light" : "dark")
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }
    read()
    el.addEventListener("scroll", onScroll, { passive: true })
    const id = window.setTimeout(read, 900)
    return () => {
      el.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(raf)
      window.clearTimeout(id)
    }
  }, [shell.scroller, shell.view])

  const light = tone === "light"
  const nav = [
    { label: "Auctions", view: { name: "lots" } as View },
    ...CATEGORIES.slice(0, 4).map((c) => ({ label: c, view: { name: "lots", category: c } as View })),
  ]

  return (
    <motion.header
      ref={ref}
      // During the splash the header waits, then unfolds sideways out of the
      // mark sitting at its centre; its logo appears as the mark lands on it.
      initial={{ opacity: 0, clipPath: `inset(0px ${shell.width / 2 - 48}px -2000px ${shell.width / 2 - 48}px)` }}
      animate={{
        y: hidden && !menu && !openMenu ? "-110%" : "0%",
        opacity: shell.splash === "text" ? 0 : 1,
        // Open, it reaches far below the header, so menus hanging off it never clip.
        clipPath:
          shell.splash === "text"
            ? `inset(0px ${shell.width / 2 - 48}px -2000px ${shell.width / 2 - 48}px)`
            : "inset(0px 0px -2000px 0px)",
      }}
      transition={{ duration: 0.55, ease: EASE }}
      className={cn(
        "absolute inset-x-0 top-0 z-40 transition-[background-color,color,border-color,backdrop-filter] duration-500",
        light ? "text-eb-ink" : "text-eb-ivory",
        solid ? (light ? "border-b border-eb-ink/10 bg-eb-paper/80 backdrop-blur-xl" : "border-b border-eb-ivory/10 bg-eb-ink/55 backdrop-blur-xl") : "border-b border-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-6 px-5 @3xl:px-12">
        <button
          ref={logo}
          type="button"
          onClick={() => shell.go({ name: "home" })}
          className="font-eb-serif text-[1.7rem] leading-none tracking-tight"
          style={{ opacity: shell.splash === "done" ? 1 : 0 }}
          aria-label="11bids home"
        >
          11<em>bids</em>
        </button>
        {!compact && (
          <nav aria-label="Departments" className="flex items-center gap-7">
            {nav.map((n) => {
              const active =
                shell.view.name === "lots" && n.view.name === "lots" && (shell.view.category ?? null) === ((n.view as { category?: string }).category ?? null)
              return (
                <button
                  key={n.label}
                  type="button"
                  onClick={() => shell.go(n.view)}
                  className={cn("group relative font-eb-sans text-[0.66rem] uppercase tracking-[0.26em] transition-opacity", active ? "opacity-100" : "opacity-70 hover:opacity-100")}
                >
                  {n.label}
                  <span className={cn("absolute inset-x-0 -bottom-1.5 h-px origin-left bg-current transition-transform duration-500", active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100")} />
                </button>
              )
            })}
          </nav>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shell.go({ name: "account", tab: "watch" })}
            aria-label={`Watchlist, ${watching} lots`}
            className="relative grid size-10 place-items-center opacity-80 transition-opacity hover:opacity-100"
          >
            <Heart className="size-[1.1rem]" strokeWidth={1.4} />
            <AnimatePresence>
              {watching > 0 && (
                <motion.span
                  key={watching}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-eb-gold px-1 text-[0.55rem] font-medium leading-4 text-eb-ink"
                >
                  {watching}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
          {account ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu((o) => !o)}
                aria-expanded={openMenu}
                aria-label="Your account"
                className={cn("ml-1 grid size-9 place-items-center rounded-full font-eb-serif text-base", light ? "bg-eb-ink text-eb-ivory" : "bg-eb-ivory text-eb-ink")}
              >
                {account.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </button>
              <AnimatePresence>
                {openMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="absolute right-0 top-12 w-56 bg-eb-paper py-2 text-eb-ink shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45)]"
                    onMouseLeave={() => setOpenMenu(false)}
                  >
                    <p className="border-b border-eb-ink/10 px-4 pb-3 pt-1">
                      <span className="block font-eb-serif text-lg">{account.name}</span>
                      <span className="block truncate font-eb-sans text-xs text-eb-taupe">{account.email}</span>
                    </p>
                    {[
                      ["My bids", () => shell.go({ name: "account", tab: "bids" })],
                      ["Watchlist", () => shell.go({ name: "account", tab: "watch" })],
                      ["Sign out", () => useAuction.getState().signOut()],
                    ].map(([label, fn]) => (
                      <button
                        key={label as string}
                        type="button"
                        onClick={() => {
                          setOpenMenu(false)
                          ;(fn as () => void)()
                        }}
                        className="block w-full px-4 py-2.5 text-left font-eb-sans text-xs uppercase tracking-[0.2em] transition-colors hover:bg-eb-ink/5"
                      >
                        {label as string}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => shell.requireAccount(undefined, "in")}
              className={cn(
                "ml-1 hidden h-9 items-center gap-2 border px-4 font-eb-sans text-[0.62rem] uppercase tracking-[0.24em] transition-colors @lg:inline-flex",
                light ? "border-eb-ink/25 hover:border-eb-ink" : "border-eb-ivory/30 hover:border-eb-ivory"
              )}
            >
              Sign in
            </button>
          )}
          {!account && (
            <button type="button" aria-label="Sign in" onClick={() => shell.requireAccount(undefined, "in")} className="grid size-10 place-items-center @lg:hidden">
              <UserRound className="size-[1.1rem]" strokeWidth={1.4} />
            </button>
          )}
          {compact && (
            <button type="button" onClick={() => setMenu(!menu)} aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu} className="grid size-10 place-items-center">
              {menu ? <X className="size-5" strokeWidth={1.3} /> : <Menu className="size-5" strokeWidth={1.3} />}
            </button>
          )}
        </div>
      </div>
    </motion.header>
  )
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const shell = React.useContext(ShellContext)!
  const items: { label: string; view: View }[] = [
    { label: "All lots", view: { name: "lots" } },
    ...CATEGORIES.map((c) => ({ label: c, view: { name: "lots", category: c } as View })),
    { label: "My bids", view: { name: "account", tab: "bids" } },
  ]
  return (
    <AnimatePresence>
      {open && (
        <motion.nav
          aria-label="Menu"
          className="absolute inset-0 z-30 flex flex-col justify-center bg-eb-ink px-8 text-eb-ivory"
          initial={{ clipPath: "inset(0 0 100% 0)" }}
          animate={{ clipPath: "inset(0 0 0% 0)" }}
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: 0.7, ease: EASE }}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        >
          <ul className="grid gap-1">
            {items.map((it, i) => (
              <li key={it.label} className="overflow-hidden">
                <motion.button
                  type="button"
                  onClick={() => shell.go(it.view)}
                  initial={{ y: "100%" }}
                  animate={{ y: "0%" }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.15 + i * 0.05 }}
                  className="group flex items-baseline gap-4 py-1 font-eb-serif text-[clamp(2rem,9cqw,3.2rem)] leading-tight"
                >
                  <span className="font-eb-sans text-[0.6rem] tracking-[0.2em] text-eb-gold">{String(i + 1).padStart(2, "0")}</span>
                  <span className="transition-[font-style] group-hover:italic">{it.label}</span>
                  <ArrowUpRight className="size-5 self-center opacity-0 transition-opacity group-hover:opacity-60" strokeWidth={1.2} />
                </motion.button>
              </li>
            ))}
          </ul>
        </motion.nav>
      )}
    </AnimatePresence>
  )
}

function Toasts() {
  const toasts = useAuction((s) => s.toasts)
  const dismiss = useAuction((s) => s.dismiss)
  const shell = React.useContext(ShellContext)!
  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-[60] flex w-[min(360px,calc(100%-2rem))] flex-col gap-2" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, transition: { duration: 0.3 } }}
            transition={{ duration: 0.6, ease: EASE }}
            className="pointer-events-auto relative overflow-hidden bg-eb-paper text-eb-ink shadow-[0_24px_60px_-16px_rgba(0,0,0,0.55)]"
          >
            <span className={cn("absolute inset-y-0 left-0 w-0.5", t.tone === "good" ? "bg-eb-green" : t.tone === "bad" ? "bg-eb-red" : "bg-eb-gold")} />
            <button
              type="button"
              className="block w-full py-3.5 pl-5 pr-10 text-left"
              onClick={() => {
                dismiss(t.id)
                if (t.lotId) shell.go({ name: "lot", id: t.lotId })
              }}
            >
              <span className="block font-eb-serif text-lg leading-tight">{t.title}</span>
              {t.body && <span className="mt-0.5 block font-eb-sans text-xs leading-relaxed text-eb-taupe">{t.body}</span>}
            </button>
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="absolute right-2 top-2 grid size-7 place-items-center text-eb-stone hover:text-eb-ink">
              <X className="size-3.5" strokeWidth={1.5} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
