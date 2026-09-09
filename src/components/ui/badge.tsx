import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border transition-colors duration-200",
  {
    variants: {
      variant: {
        default:
          "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground",
        solid: "border-transparent bg-foreground text-background",
        accent: "border-transparent bg-accent-soft text-accent",
        outline: "border-border-strong bg-transparent text-foreground",
      },
      size: {
        default: "px-2.5 py-1 text-xs font-medium",
        sm: "px-2 py-0.5 text-[0.6875rem] font-medium",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Badge({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant, size, className }))} {...props} />
  )
}

export { Badge }
