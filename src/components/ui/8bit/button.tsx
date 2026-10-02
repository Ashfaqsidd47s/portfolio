// Vendored from 8bitcn (https://8bitcn.com, MIT) — adapted to this repo's
// base Button variants and @radix-ui/react-slot.
import type { ButtonHTMLAttributes, Ref } from "react"
import { Slottable } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Button as ShadcnButton } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import "@/components/ui/8bit/styles/retro.css"

const buttonVariants = cva("", {
  variants: {
    font: { normal: "", retro: "retro" },
    variant: {
      default: "bg-foreground",
      outline: "bg-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
    },
    size: { default: "", sm: "", lg: "", icon: "" },
  },
  defaultVariants: { variant: "default", size: "default" },
})

export interface BitButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  ref?: Ref<HTMLButtonElement>
}

function ButtonDecorations({
  size,
  variant,
}: Pick<BitButtonProps, "size" | "variant">) {
  return (
    <span aria-hidden="true" className="pointer-events-none contents">
      {variant !== "ghost" && variant !== "link" && size !== "icon" && (
        <>
          {/* Pixelated border */}
          <span className="absolute -top-1.5 left-1.5 h-1.5 w-1/2 bg-foreground dark:bg-ring" />
          <span className="absolute -top-1.5 right-1.5 h-1.5 w-1/2 bg-foreground dark:bg-ring" />
          <span className="absolute -bottom-1.5 left-1.5 h-1.5 w-1/2 bg-foreground dark:bg-ring" />
          <span className="absolute -bottom-1.5 right-1.5 h-1.5 w-1/2 bg-foreground dark:bg-ring" />
          <span className="absolute left-0 top-0 size-1.5 bg-foreground dark:bg-ring" />
          <span className="absolute right-0 top-0 size-1.5 bg-foreground dark:bg-ring" />
          <span className="absolute bottom-0 left-0 size-1.5 bg-foreground dark:bg-ring" />
          <span className="absolute bottom-0 right-0 size-1.5 bg-foreground dark:bg-ring" />
          <span className="absolute -left-1.5 top-1.5 h-[calc(100%-12px)] w-1.5 bg-foreground dark:bg-ring" />
          <span className="absolute -right-1.5 top-1.5 h-[calc(100%-12px)] w-1.5 bg-foreground dark:bg-ring" />
          {variant !== "outline" && (
            <>
              {/* Top shadow */}
              <span className="absolute left-0 top-0 h-1.5 w-full bg-foreground/20" />
              <span className="absolute left-0 top-1.5 h-1.5 w-3 bg-foreground/20" />
              {/* Bottom shadow */}
              <span className="absolute bottom-0 left-0 h-1.5 w-full bg-foreground/20" />
              <span className="absolute bottom-1.5 right-0 h-1.5 w-3 bg-foreground/20" />
            </>
          )}
        </>
      )}

      {size === "icon" && (
        <>
          <span className="absolute left-0 top-0 h-[5px] w-full bg-foreground md:h-1.5 dark:bg-ring" />
          <span className="absolute bottom-0 h-[5px] w-full bg-foreground md:h-1.5 dark:bg-ring" />
          <span className="absolute -left-1 top-1 h-1/2 w-[5px] bg-foreground md:w-1.5 dark:bg-ring" />
          <span className="absolute -left-1 bottom-1 h-1/2 w-[5px] bg-foreground md:w-1.5 dark:bg-ring" />
          <span className="absolute -right-1 top-1 h-1/2 w-[5px] bg-foreground md:w-1.5 dark:bg-ring" />
          <span className="absolute -right-1 bottom-1 h-1/2 w-[5px] bg-foreground md:w-1.5 dark:bg-ring" />
        </>
      )}
    </span>
  )
}

function Button({
  asChild = false,
  children,
  className,
  font,
  size,
  variant,
  ...props
}: BitButtonProps) {
  return (
    <ShadcnButton
      {...props}
      className={cn(
        "relative inline-flex items-center justify-center gap-1.5 rounded-none border-none transition-transform active:translate-y-1",
        size === "icon" && "mx-1 my-0",
        font !== "normal" && "retro",
        className
      )}
      size={size}
      variant={variant}
      asChild={asChild}
    >
      {asChild ? <Slottable>{children}</Slottable> : children}
      <ButtonDecorations size={size} variant={variant} />
    </ShadcnButton>
  )
}

export { Button }
