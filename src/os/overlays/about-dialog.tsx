import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { profile } from "@/data/profile"
import { useSystemActions } from "@/os/system"
import { useUi } from "@/os/store/ui"

/** "About this Mac", for the portfolio. */
export function AboutDialog() {
  const open = useUi((s) => s.aboutOpen)
  const setOpen = useUi((s) => s.setAboutOpen)
  const system = useSystemActions()
  const closeRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, setOpen])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1100] grid place-items-center p-4">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-os-title"
            className="relative w-full max-w-sm rounded-2xl border border-border bg-elevated p-6 text-center shadow-2xl"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15 }}
          >
            <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-foreground text-xl font-bold text-background shadow-md">
              MA
            </span>
            <h2 id="about-os-title" className="mt-4 text-lg font-semibold tracking-tight">
              Ashfaq OS
            </h2>
            <p className="text-xs text-muted-foreground">Version 1.2 · {profile.location}</p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {profile.name}'s portfolio, built as an operating system. Every app on the desktop is a project, and every
              project runs as a working demo.
            </p>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-left text-xs">
              <dt className="text-muted-foreground">Built with</dt>
              <dd>React 19, TypeScript, Vite, Tailwind CSS v4</dd>
              <dt className="text-muted-foreground">Motion</dt>
              <dd>Motion, Zustand, Radix UI</dd>
              <dt className="text-muted-foreground">Idea</dt>
              <dd>The desktop layout of posthog.com</dd>
            </dl>
            <div className="mt-6 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  system.openApp("about")
                }}
                className="rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                About me
              </button>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                OK
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
