// Vendored from 8bitcn (https://8bitcn.com, MIT).
import type * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import {
  Card as ShadcnCard,
  CardContent as ShadcnCardContent,
  CardDescription as ShadcnCardDescription,
  CardFooter as ShadcnCardFooter,
  CardHeader as ShadcnCardHeader,
  CardTitle as ShadcnCardTitle,
} from "@/components/ui/card"
import "@/components/ui/8bit/styles/retro.css"

const cardVariants = cva("", {
  variants: { font: { normal: "", retro: "retro" } },
  defaultVariants: { font: "retro" },
})

export interface BitCardProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof cardVariants> {}

function Card({ className, font, ...props }: BitCardProps) {
  return (
    <div
      className={cn(
        "relative border-y-6 border-foreground bg-card p-0! text-card-foreground dark:border-ring",
        className
      )}
    >
      <ShadcnCard
        {...props}
        className={cn(
          "h-full w-full! flex flex-col rounded-none border-0 bg-card text-card-foreground shadow-none",
          font !== "normal" && "retro",
          className
        )}
      />
      <div
        className="pointer-events-none absolute inset-0 -mx-1.5 border-x-6 border-inherit"
        aria-hidden="true"
      />
    </div>
  )
}

function CardHeader({ className, font, ...props }: BitCardProps) {
  return <ShadcnCardHeader className={cn(font !== "normal" && "retro", className)} {...props} />
}

function CardTitle({ className, font, ...props }: BitCardProps) {
  return <ShadcnCardTitle className={cn(font !== "normal" && "retro", className)} {...props} />
}

function CardDescription({ className, font, ...props }: BitCardProps) {
  return (
    <ShadcnCardDescription className={cn(font !== "normal" && "retro", className)} {...props} />
  )
}

function CardContent({ className, font, ...props }: BitCardProps) {
  return (
    <ShadcnCardContent
      className={cn("flex-1", font !== "normal" && "retro", className)}
      {...props}
    />
  )
}

function CardFooter({ className, font, ...props }: BitCardProps) {
  return <ShadcnCardFooter className={cn(font !== "normal" && "retro", className)} {...props} />
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
