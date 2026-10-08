import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type MenuEntry =
  | {
      type?: "item"
      label: string
      onSelect: () => void
      icon?: React.ReactNode
      shortcut?: string
      /** Shows a tick and makes the item a checkbox/radio for screen readers. */
      checked?: boolean
      radio?: boolean
    }
  | { type: "link"; label: string; href: string; icon?: React.ReactNode; download?: string }
  | { type: "label"; label: string }
  | { type: "separator" }

const ITEM =
  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs outline-none hover:bg-muted focus-visible:bg-muted"

/**
 * A dropdown panel shared by the menubar and the desktop context menu.
 * Arrow keys, Home/End move between items; Escape closes; ←/→ are handed to
 * `onStep` so the menubar can move to the neighbouring menu.
 */
export function MenuPanel({
  entries,
  onClose,
  onStep,
  autoFocus,
  className,
  style,
  label,
}: {
  entries: MenuEntry[]
  onClose: () => void
  onStep?: (dir: -1 | 1) => void
  autoFocus?: boolean
  className?: string
  style?: React.CSSProperties
  label?: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (autoFocus) ref.current?.querySelector<HTMLElement>("[role^='menuitem']")?.focus()
  }, [autoFocus])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>("[role^='menuitem']") ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    const go = (n: number) => {
      e.preventDefault()
      items[(n + items.length) % items.length]?.focus()
    }
    if (e.key === "ArrowDown") go(i + 1)
    else if (e.key === "ArrowUp") go(i < 0 ? items.length - 1 : i - 1)
    else if (e.key === "Home") go(0)
    else if (e.key === "End") go(items.length - 1)
    else if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    } else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && onStep) {
      e.preventDefault()
      onStep(e.key === "ArrowLeft" ? -1 : 1)
    }
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={style}
      className={cn("z-[1000] min-w-52 rounded-lg border border-border bg-elevated p-1 text-foreground shadow-lg", className)}
    >
      {entries.map((entry, i) => {
        if (entry.type === "separator") return <div key={i} role="separator" className="my-1 h-px bg-border" />
        if (entry.type === "label")
          return (
            <p key={i} className="px-2 pb-0.5 pt-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {entry.label}
            </p>
          )
        if (entry.type === "link")
          return (
            <a
              key={i}
              role="menuitem"
              href={entry.href}
              download={entry.download}
              target={entry.download || entry.href.startsWith("mailto:") ? undefined : "_blank"}
              rel="noreferrer"
              onClick={onClose}
              className={ITEM}
            >
              <span className="grid size-4 shrink-0 place-items-center text-muted-foreground">{entry.icon}</span>
              <span className="flex-1">{entry.label}</span>
            </a>
          )
        const checkable = entry.checked !== undefined
        return (
          <button
            key={i}
            type="button"
            role={checkable ? (entry.radio ? "menuitemradio" : "menuitemcheckbox") : "menuitem"}
            aria-checked={checkable ? entry.checked : undefined}
            onClick={() => {
              entry.onSelect()
              onClose()
            }}
            className={ITEM}
          >
            <span className="grid size-4 shrink-0 place-items-center text-muted-foreground">
              {checkable ? entry.checked && <Check className="size-3.5" /> : entry.icon}
            </span>
            <span className="flex-1">{entry.label}</span>
            {entry.shortcut && <kbd className="font-sans text-[0.6875rem] text-muted-foreground">{entry.shortcut}</kbd>}
          </button>
        )
      })}
    </div>
  )
}

/** Close on a pointer-down outside `ref` or on Escape, while `open`. */
export function useDismiss(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  React.useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close()
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close()
    const onBlur = () => close()
    document.addEventListener("pointerdown", onDown)
    document.addEventListener("keydown", onKey)
    window.addEventListener("blur", onBlur)
    return () => {
      document.removeEventListener("pointerdown", onDown)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("blur", onBlur)
    }
  }, [open, ref, close])
}
