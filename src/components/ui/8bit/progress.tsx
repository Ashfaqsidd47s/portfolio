// Vendored from 8bitcn (https://8bitcn.com, MIT).
import type * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import "@/components/ui/8bit/styles/retro.css"

const progressVariants = cva("", {
  variants: {
    variant: { default: "", retro: "retro" },
    font: { normal: "", retro: "retro" },
  },
  defaultVariants: { font: "retro" },
})

export interface BitProgressProps
  extends React.ComponentProps<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants> {
  progressBg?: string
}

function Progress({ className, font, variant, value, progressBg, ...props }: BitProgressProps) {
  // Lift a height utility off className so it sizes the track itself.
  const heightClass = className?.match(/h-(\d+|\[.*?\])/)?.[0] ?? "h-2"
  const filledSquares = Math.round(((value || 0) / 100) * 20)

  return (
    <div className={cn("relative w-full", className)}>
      <ProgressPrimitive.Root
        data-slot="progress"
        className={cn(
          "relative w-full overflow-hidden bg-primary/20",
          heightClass,
          font !== "normal" && "retro"
        )}
        value={value}
        {...props}
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className={cn(
            "h-full transition-all",
            variant === "retro" ? "flex w-full" : "w-full flex-1",
            variant !== "retro" && (progressBg || "bg-primary")
          )}
          style={
            variant === "retro" ? undefined : { transform: `translateX(-${100 - (value || 0)}%)` }
          }
        >
          {variant === "retro" && (
            <div className="flex w-full">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "mx-[1px] h-full flex-1",
                    i < filledSquares ? progressBg || "bg-primary" : "bg-transparent"
                  )}
                />
              ))}
            </div>
          )}
        </ProgressPrimitive.Indicator>
      </ProgressPrimitive.Root>
      <div
        className="pointer-events-none absolute inset-0 -my-1 border-y-4 border-foreground dark:border-ring"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 -mx-1 border-x-4 border-foreground dark:border-ring"
        aria-hidden="true"
      />
    </div>
  )
}

export { Progress }
