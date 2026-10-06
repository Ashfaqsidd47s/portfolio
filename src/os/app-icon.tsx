import { cn } from "@/lib/utils"
import type { AppDef } from "@/os/registry/apps"

/** The rounded, tinted tile an app is drawn as — on the desktop, the phone and in title bars. */
export function AppIcon({ app, className }: { app: AppDef; className?: string }) {
  const Icon = app.icon
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid shrink-0 place-items-center rounded-[22%] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_1px_2px_rgb(0_0_0/0.25)]",
        className
      )}
      style={{ backgroundImage: `linear-gradient(145deg, ${app.tint[0]}, ${app.tint[1]})` }}
    >
      <Icon className="size-[52%] drop-shadow-[0_1px_1px_rgb(0_0_0/0.25)]" strokeWidth={2} />
    </span>
  )
}
