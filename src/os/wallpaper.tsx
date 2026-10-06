import { cn } from "@/lib/utils"

/**
 * "Doon hills": layered ridgelines like the view from Dehradun towards
 * Mussoorie, with a sun by day and a moon and stars by night. Colours come
 * from the --wp-* tokens in index.css, so the theme switch repaints it.
 */
export function Wallpaper({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("os-wallpaper pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="os-stars absolute inset-0" />
      <div className="absolute right-[14%] top-[12%] size-24 rounded-full bg-[var(--wp-sun)] opacity-90 blur-[0.5px] sm:size-32" />
      <svg
        className="absolute inset-x-0 bottom-0 h-[58%] w-full"
        viewBox="0 0 1440 520"
        preserveAspectRatio="none"
      >
        <path
          fill="var(--wp-hill-1)"
          d="M0 250 C120 205 220 170 340 190 C450 208 520 150 640 120 C760 92 860 160 980 170 C1100 180 1180 110 1300 118 C1370 122 1410 140 1440 150 L1440 520 L0 520 Z"
        />
        <path
          fill="var(--wp-hill-2)"
          d="M0 330 C140 290 250 250 380 280 C500 308 600 250 720 236 C850 222 930 290 1060 300 C1190 310 1280 250 1440 262 L1440 520 L0 520 Z"
        />
        <path
          fill="var(--wp-hill-3)"
          d="M0 420 C160 380 300 360 440 390 C580 420 700 370 840 360 C980 350 1100 410 1240 404 C1330 400 1400 380 1440 372 L1440 520 L0 520 Z"
        />
      </svg>
    </div>
  )
}
