import * as React from "react"
import { cn } from "@/lib/utils"
import { useSettings, type WallpaperId } from "@/os/store/settings"


function Hills() {
  return (
    <>
      <div className="os-stars absolute inset-0" />
      <div className="absolute right-[14%] top-[12%] size-24 rounded-full bg-[var(--wp-sun)] opacity-90 sm:size-32" />
      <svg className="absolute inset-x-0 bottom-0 h-[58%] w-full" viewBox="0 0 1440 520" preserveAspectRatio="none">
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
    </>
  )
}

/** A stepped ridge, as columns of pixels. Deterministic, so it never shifts between renders. */
function ridge(width: number, base: number, amp: number, freq: number, phase: number, step: number) {
  const cols: { x: number; h: number }[] = []
  for (let x = 0; x < width; x += step) {
    const h = base + amp * (Math.sin(x * freq + phase) * 0.6 + Math.sin(x * freq * 2.7 + phase * 1.9) * 0.4)
    cols.push({ x, h: Math.round(h / step) * step })
  }
  return cols
}

const FAR = ridge(160, 26, 9, 0.09, 1.2, 2)
const NEAR = ridge(160, 14, 6, 0.13, 4.1, 2)
const PIXEL_STARS = [
  [12, 6], [30, 14], [47, 4], [63, 18], [79, 9], [96, 3], [112, 15], [128, 7], [145, 12], [22, 24], [88, 22], [138, 26],
]

function Pixel() {
  return (
    <svg className="absolute inset-0 size-full" viewBox="0 0 160 90" preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x="0" y={i * 9} width="160" height={i === 5 ? 90 : 9} fill={`var(--wp-band-${i})`} />
      ))}
      <g style={{ opacity: "calc(var(--wp-stars) * 0.7)" }}>
        {PIXEL_STARS.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="0.5" height="0.5" fill="#fff" />
        ))}
      </g>
      {/* Sun / moon, drawn as a pixel disc */}
      <g fill="var(--wp-sun)">
        <rect x="116" y="22" width="10" height="14" />
        <rect x="114" y="24" width="14" height="10" />
        <rect x="113" y="26" width="16" height="6" />
      </g>
      {FAR.map(({ x, h }) => (
        <rect key={`f${x}`} x={x} y={90 - h - 10} width="2" height={h + 10} fill="var(--wp-hill-1)" />
      ))}
      {NEAR.map(({ x, h }) => (
        <rect key={`n${x}`} x={x} y={90 - h} width="2" height={h} fill="var(--wp-hill-2)" />
      ))}
      <rect x="0" y="84" width="160" height="6" fill="var(--wp-hill-3)" />
    </svg>
  )
}

function Blueprint() {
  return (
    <>
      <div className="wp-grid absolute inset-0" />
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        stroke="var(--wp-ink)"
        strokeWidth="1.5"
      >
        <rect x="860" y="150" width="380" height="250" rx="10" strokeDasharray="6 6" />
        <line x1="860" y1="186" x2="1240" y2="186" />
        <circle cx="882" cy="168" r="5" />
        <circle cx="900" cy="168" r="5" />
        <rect x="884" y="210" width="120" height="166" rx="4" />
        <rect x="1024" y="210" width="192" height="70" rx="4" />
        <rect x="1024" y="296" width="192" height="80" rx="4" />
        <path d="M860 430 H1240 M860 422 V438 M1240 422 V438" />
        <circle cx="300" cy="640" r="90" strokeDasharray="4 8" />
        <path d="M300 550 V730 M210 640 H390" strokeDasharray="2 6" />
        <path d="M180 220 L330 220 L330 330" strokeDasharray="8 6" />
        <rect x="160" y="200" width="40" height="40" rx="6" />
      </svg>
    </>
  )
}

const SCENES: Record<WallpaperId, () => React.ReactElement | null> = {
  hills: Hills,
  pixel: Pixel,
  blueprint: Blueprint,
  plain: () => null,
}

/**
 * The desktop (and phone) background. Every scene is SVG or CSS — no image
 * downloads — and paints itself from `--wp-*` tokens, so the theme switch
 * repaints it. Text never sits directly on a wallpaper.
 */
export function Wallpaper({ id, className }: { id?: WallpaperId; className?: string }) {
  const chosen = useSettings((s) => s.wallpaper)
  const wallpaper = id ?? chosen
  const Scene = SCENES[wallpaper] ?? Hills
  return (
    <div
      aria-hidden
      data-wallpaper={wallpaper}
      className={cn("os-wallpaper pointer-events-none absolute inset-0 overflow-hidden", `wp-${wallpaper}`, className)}
    >
      <Scene />
    </div>
  )
}

/** A wallpaper drawn at desktop size and scaled down to fit, for pickers. */
export function WallpaperThumb({ id, className }: { id: WallpaperId; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [scale, setScale] = React.useState(0.12)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setScale(el.clientWidth / 1440)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} className={cn("relative aspect-[16/10] overflow-hidden", className)}>
      <div className="absolute left-0 top-0 h-[900px] w-[1440px] origin-top-left" style={{ transform: `scale(${scale})` }}>
        <Wallpaper id={id} />
      </div>
    </div>
  )
}
