import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "motion/react"
import { Menu, X, Moon, Sun, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/hooks/use-theme"
import { cn } from "@/lib/utils"
import { profile } from "@/data/profile"

const sections = [
  { id: "work", label: "Work" },
  { id: "projects", label: "Projects" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
]

function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className={cn("relative overflow-hidden", className)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: 14, opacity: 0, rotate: -30 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -14, opacity: 0, rotate: 30 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-center"
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </motion.span>
      </AnimatePresence>
    </Button>
  )
}

export function Nav() {
  const { pathname } = useLocation()
  const isHome = pathname === "/"
  const [scrolled, setScrolled] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState<string>("")
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24))

  // Track which section is currently in the upper half of the viewport.
  React.useEffect(() => {
    if (!isHome) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    )
    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [isHome])

  // Lock body scroll while the mobile sheet is open. Cleanup also covers the
  // case where the route changes out from under an open sheet.
  React.useEffect(() => {
    if (!open) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  // Any navigation — a sheet link, the desktop nav, or the browser's back
  // button — should leave the sheet closed.
  // oxlint-disable-next-line react/set-state-in-effect
  React.useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <>
      <motion.header
        initial={{ y: -70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-500",
          scrolled
            ? "border-b border-border bg-background/80 backdrop-blur-xl"
            : "border-b border-transparent"
        )}
      >
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link
            to="/"
            className="group flex items-center gap-2.5"
            aria-label="Home"
          >
            <span className="flex size-8 items-center justify-center rounded-md border border-border-strong bg-surface font-mono text-[0.8125rem] font-semibold transition-colors duration-300 group-hover:border-foreground/40">
              MA
            </span>
            <span className="hidden text-sm font-medium tracking-tight sm:inline">
              {profile.name}
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {sections.map((s) => (
              <a
                key={s.id}
                href={isHome ? `#${s.id}` : `/#${s.id}`}
                className={cn(
                  "relative rounded-md px-3 py-2 text-sm transition-colors duration-200",
                  isHome && active === s.id
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isHome && active === s.id && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-md bg-surface-2"
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}
                <span className="relative">{s.label}</span>
              </a>
            ))}
            <Link
              to="/resume"
              className={cn(
                "relative rounded-md px-3 py-2 text-sm transition-colors duration-200",
                pathname === "/resume"
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {pathname === "/resume" && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-md bg-surface-2"
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              <span className="relative">Résumé</span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button
              asChild
              size="sm"
              className="hidden sm:inline-flex"
            >
              <a href={profile.socials.email}>Get in touch</a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle menu"
              aria-expanded={open}
            >
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-background md:hidden"
          >
            <div className="flex h-full flex-col justify-between px-5 pb-10 pt-24">
              <ul className="flex flex-col">
                {sections.map((s, i) => (
                  <motion.li
                    key={s.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 * i + 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="border-b border-border"
                  >
                    <a
                      href={isHome ? `#${s.id}` : `/#${s.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-baseline gap-4 py-5 text-2xl font-medium tracking-tight"
                    >
                      <span className="label-mono text-subtle-foreground">
                        0{i + 1}
                      </span>
                      {s.label}
                    </a>
                  </motion.li>
                ))}
                <motion.li
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.32, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="border-b border-border"
                >
                  <Link
                    to="/resume"
                    onClick={() => setOpen(false)}
                    className="flex items-baseline gap-4 py-5 text-2xl font-medium tracking-tight"
                  >
                    <span className="label-mono text-subtle-foreground">05</span>
                    Résumé
                  </Link>
                </motion.li>
              </ul>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col gap-3"
              >
                <Button asChild size="lg">
                  <a href={profile.socials.email}>Get in touch</a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href={profile.resumeFile} download={profile.resumeFileName}>
                    <FileText /> Download résumé
                  </a>
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
