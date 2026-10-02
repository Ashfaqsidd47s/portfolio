// Vendored from 8bitcn (https://8bitcn.com, MIT).
import type * as React from "react"
import { cn } from "@/lib/utils"
import HealthBar from "@/components/ui/8bit/health-bar"
import "@/components/ui/8bit/styles/retro.css"

export interface EnemyHealthDisplayProps extends React.ComponentProps<"div"> {
  enemyName: string
  level?: number
  currentHealth: number
  maxHealth: number
  showLevel?: boolean
  showHealthText?: boolean
  healthBarVariant?: "retro" | "default"
  healthBarColor?: string
  enemyNameColor?: string
}

export default function EnemyHealthDisplay({
  className,
  enemyName,
  level,
  currentHealth,
  maxHealth,
  showLevel = true,
  showHealthText = true,
  healthBarVariant = "retro",
  healthBarColor = "bg-red-500",
  enemyNameColor = "text-foreground",
  ...props
}: EnemyHealthDisplayProps) {
  const healthPercentage = Math.max(0, Math.min(100, (currentHealth / maxHealth) * 100))

  return (
    <div className={cn("retro relative w-full space-y-2 text-xs", className)} {...props}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("truncate font-bold", enemyNameColor)}>{enemyName}</span>
          {showLevel && level && <span className="text-muted-foreground">Lv.{level}</span>}
        </div>
        {showHealthText && (
          <span className="shrink-0 text-[9px] text-muted-foreground">
            {currentHealth}/{maxHealth}
          </span>
        )}
      </div>
      <div className="relative">
        <HealthBar
          value={healthPercentage}
          variant={healthBarVariant}
          className="w-full"
          progressBg={healthBarColor}
        />
      </div>
    </div>
  )
}
