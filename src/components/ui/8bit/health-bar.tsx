// Vendored from 8bitcn (https://8bitcn.com, MIT).
import { Progress, type BitProgressProps } from "@/components/ui/8bit/progress"

interface HealthBarProps extends Omit<BitProgressProps, "value"> {
  value?: number
}

export default function HealthBar({ progressBg = "bg-red-500", ...props }: HealthBarProps) {
  return <Progress {...props} progressBg={progressBg} />
}
