import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { CircleCheck, CircleDashed, CircleX, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { BookingStatus } from "./data"

const STATUS: Record<BookingStatus, { label: string; className: string; Icon: typeof CircleCheck }> = {
  confirmed: { label: "Confirmed", className: "bg-[#dcfce7] text-[#166534]", Icon: CircleCheck },
  pending: { label: "Pending", className: "bg-[#fef3c7] text-[#92400e]", Icon: CircleDashed },
  cancelled: { label: "Cancelled", className: "bg-[#fee2e2] text-[#991b1b]", Icon: CircleX },
}

/** Status always ships with an icon and a word, never colour alone. */
export function StatusPill({ status }: { status: BookingStatus }) {
  const { label, className, Icon } = STATUS[status]
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold", className)}>
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-bold tracking-tight text-tn-ink">{title}</h2>
        {subtitle && <p className="text-xs text-tn-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40",
        variant === "primary" && "bg-tn-teal text-white hover:bg-[#0d6961]",
        variant === "secondary" && "border border-tn-line-2 bg-white text-tn-ink hover:bg-tn-soft",
        variant === "ghost" && "text-tn-muted hover:bg-tn-soft hover:text-tn-ink",
        variant === "danger" && "border border-[#fecaca] bg-white text-[#b91c1c] hover:bg-[#fef2f2]",
        className
      )}
    />
  )
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("rounded-lg border border-tn-line bg-white", className)} />
}

/** A panel that slides in over the app from the right, inside the window. */
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0 z-30 flex justify-end">
          <motion.button
            type="button"
            aria-label="Close panel"
            className="absolute inset-0 bg-tn-ink/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-label={title}
            className="relative flex h-full w-full max-w-sm flex-col border-l border-tn-line bg-white shadow-xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
          >
            <div className="flex items-center justify-between border-b border-tn-line px-4 py-3">
              <p className="text-sm font-bold text-tn-ink">{title}</p>
              <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-tn-muted hover:bg-tn-soft">
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}

/** A centred dialog inside the app (not the whole page). */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="absolute inset-0 z-30 grid place-items-center p-4">
          <motion.button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-tn-ink/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative w-full max-w-sm rounded-xl border border-tn-line bg-white p-4 shadow-xl"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-tn-ink">{title}</p>
              <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-tn-muted hover:bg-tn-soft">
                <X className="size-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export type ToastFn = (message: string) => void

/** One toast at a time, pinned to the bottom of the app. */
export function useToast() {
  const [toast, setToast] = React.useState<{ id: number; message: string } | null>(null)
  React.useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(id)
  }, [toast])

  const show = React.useCallback<ToastFn>((message) => setToast({ id: Date.now(), message }), [])

  const node = (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-40 flex justify-center px-3" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.p
            key={toast.id}
            role="status"
            className="w-full max-w-md rounded-lg bg-tn-ink px-3 py-2 text-center text-xs font-semibold text-white shadow-lg"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {toast.message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )

  return [show, node] as const
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-tn-muted">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  )
}

export const inputClass =
  "w-full rounded-md border border-tn-line-2 bg-white px-2.5 py-1.5 text-sm text-tn-ink outline-none placeholder:text-tn-faint focus:border-tn-teal focus:ring-2 focus:ring-tn-teal/20"
