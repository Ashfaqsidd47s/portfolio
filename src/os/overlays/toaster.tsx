import { AnimatePresence, motion } from "motion/react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUi } from "@/os/store/ui"

/** OS notifications: bottom-right on the desktop, top of the screen on the phone. */
export function Toaster({ placement = "bottom-right" }: { placement?: "bottom-right" | "top" }) {
  const toasts = useUi((s) => s.toasts)
  const dismiss = useUi((s) => s.dismissToast)

  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed z-[1250] flex flex-col gap-2",
        placement === "top" ? "inset-x-3 top-[calc(env(safe-area-inset-top)+3rem)] items-center" : "bottom-4 right-4 items-end"
      )}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            role="status"
            initial={{ opacity: 0, y: placement === "top" ? -12 : 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="pointer-events-auto flex w-full max-w-xs items-start gap-3 rounded-xl border border-border bg-elevated/95 p-3 text-foreground shadow-lg backdrop-blur-md"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick()
                    dismiss(t.id)
                  }}
                  className="mt-2 rounded-md bg-primary px-2.5 py-1 text-[0.6875rem] font-medium text-primary-foreground hover:opacity-90"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
