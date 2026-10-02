// Vendored from 8bitcn (https://8bitcn.com, MIT).
import { Progress } from "@/components/ui/8bit/progress"
import { cn } from "@/lib/utils"

interface XpBarProps {
  className?: string
  variant?: "retro" | "default"
  value?: number
  levelUpMessage?: string
  progressBg?: string
}

export default function XpBar({
  className,
  variant,
  value,
  levelUpMessage = "LEVEL UP!",
  progressBg = "bg-yellow-500",
}: XpBarProps) {
  const isLevelUp = value === 100

  return (
    <div className={cn("relative", className)}>
      <Progress
        value={value}
        variant={variant}
        className={cn(isLevelUp && "animate-pulse")}
        progressBg={progressBg}
      />
      {isLevelUp && (
        <div className="retro pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 animate-[px-blink_0.5s_step-end_infinite] whitespace-nowrap text-[0.5rem] text-black [text-shadow:1px_1px_0_#fff,-1px_-1px_0_#fff,1px_-1px_0_#fff,-1px_1px_0_#fff]">
          {levelUpMessage}
        </div>
      )}
    </div>
  )
}
