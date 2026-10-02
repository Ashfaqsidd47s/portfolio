// Vendored from 8bitcn (https://8bitcn.com, MIT).
import type * as React from "react"
import { cn } from "@/lib/utils"
import "@/components/ui/8bit/styles/retro.css"

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "retro pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-sm bg-muted px-1 text-[0.5rem] font-medium text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
