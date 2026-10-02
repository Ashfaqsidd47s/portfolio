import * as React from "react"
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

/**
 * A modern browser window that "boots" its app the first time it scrolls into
 * view: a terminal runs the dev command, prints ready, then slides away to
 * reveal the live demo underneath. The intro's Turbo C++ boot, ten years on.
 */
export function AppWindow({
  name,
  url,
  liveUrl,
  command = "pnpm dev",
  bootLines = [],
  accent = "#ff4d8d",
  children,
  className,
  bodyClassName,
}: {
  name: string
  /** What the address bar shows. */
  url: string
  /** The real product, linked from the title bar. */
  liveUrl?: string
  command?: string
  bootLines?: string[]
  accent?: string
  children: React.ReactNode
  className?: string
  bodyClassName?: string
}) {
  const reduced = useReducedMotion()
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.35 })
  const lines = React.useMemo(
    () => [`~/${name.toLowerCase()} $ ${command}`, ...bootLines, "✓ ready — opening browser…"],
    [name, command, bootLines]
  )
  const [shown, setShown] = React.useState(0)
  const booted = reduced || shown > lines.length

  React.useEffect(() => {
    if (!inView || reduced || shown > lines.length) return
    const id = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 120 : 260)
    return () => window.clearTimeout(id)
  }, [inView, reduced, shown, lines.length])

  return (
    <div
      ref={ref}
      className={cn("relative mx-auto w-full max-w-6xl", className)}
      style={{ "--app-accent": accent } as React.CSSProperties}
    >
      <div className="overflow-hidden border-4 border-night bg-[#f7f5f0] text-[#1b1430] shadow-[12px_14px_0_rgb(0_0_0/0.5)]">
        {/* Title / address bar */}
        <div className="flex items-center gap-2 border-b-4 border-night bg-ink-2 px-2.5 py-1.5">
          <span className="size-2.5 shrink-0 bg-px-red" />
          <span className="size-2.5 shrink-0 bg-px-yellow" />
          <span className="size-2.5 shrink-0 bg-px-green" />
          <span className="ml-2 min-w-0 flex-1 truncate bg-night px-2 font-terminal text-base text-lilac">
            <span className="text-px-green">🔒</span> {url}
          </span>
          {liveUrl && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className="retro shrink-0 px-2 py-1 text-[0.5rem] text-night hover:brightness-110"
              style={{ background: accent }}
            >
              LIVE ↗
            </a>
          )}
        </div>

        <div className={cn("relative min-h-[30rem] font-sans", bodyClassName)}>
          {children}

          <AnimatePresence>
            {!booted && (
              <motion.div
                aria-hidden
                className="crt absolute inset-0 z-30 bg-[#07070f] p-4 font-terminal text-xl leading-snug text-tc-gray sm:p-6"
                exit={{ clipPath: "inset(0 0 100% 0)" }}
                transition={{ duration: 0.5, ease: [0.7, 0, 0.3, 1] }}
              >
                {lines.slice(0, shown).map((l, i) => (
                  <p
                    key={i}
                    className={cn(
                      i === 0 && "text-cream",
                      i === lines.length - 1 && "text-px-green"
                    )}
                  >
                    {l}
                  </p>
                ))}
                <span className="animate-blink text-cream">█</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

/** A tiny "demo data" disclaimer chip for the previews. */
export function DemoNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("mx-auto mt-5 max-w-6xl px-1 text-center font-pixel-sans text-sm text-lilac/80", className)}>
      {children}
    </p>
  )
}
