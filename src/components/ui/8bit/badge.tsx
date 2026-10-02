// Vendored from 8bitcn (https://8bitcn.com, MIT) — renders its own span
// instead of the base Badge, whose variants differ in this repo.
import type * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import "@/components/ui/8bit/styles/retro.css"

const badgeVariants = cva("", {
  variants: {
    font: { normal: "", retro: "retro" },
    variant: {
      default: "border-primary bg-primary text-primary-foreground",
      outline: "border-background bg-background text-foreground",
      secondary: "border-muted bg-muted text-foreground",
    },
  },
  defaultVariants: { variant: "default" },
})

export interface BitBadgeProps
  extends React.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {}

const isVisual = (c: string) =>
  c.startsWith("bg-") ||
  c.startsWith("border-") ||
  c.startsWith("text-") ||
  c.startsWith("rounded-")

function Badge({ children, className = "", font, variant, ...props }: BitBadgeProps) {
  const color = badgeVariants({ variant })
  const classes = className.split(" ").filter(Boolean)
  // Colour classes go on the badge and its side bars; everything else
  // (sizing, spacing, layout) goes on the container.
  const visualClasses = classes.filter(isVisual)
  const containerClasses = classes.filter((c) => !isVisual(c))

  return (
    <span className={cn("relative inline-flex items-stretch", containerClasses)}>
      <span
        {...props}
        className={cn(
          "inline-flex h-full w-full items-center justify-center gap-1 whitespace-nowrap border-y-0 px-2 py-0.5 text-[0.625rem] leading-none",
          font !== "normal" && "retro",
          color,
          visualClasses
        )}
      >
        {children}
      </span>
      <span aria-hidden className={cn("absolute inset-y-[4px] -left-1.5 w-1.5", color, visualClasses)} />
      <span aria-hidden className={cn("absolute inset-y-[4px] -right-1.5 w-1.5", color, visualClasses)} />
    </span>
  )
}

export { Badge }
