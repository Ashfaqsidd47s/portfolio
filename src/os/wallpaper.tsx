import * as React from "react"
import { cn } from "@/lib/utils"
import { useSettings, type WallpaperId } from "@/os/store/settings"

/**
 * The desktop backgrounds. Every colour is a --wp-* token set per wallpaper
 * and theme in index.css (`[data-wallpaper=…]`), so the theme switch repaints
 * the scene and the shells can reuse the tokens (icon glow, screensaver).
 */

/** "Doon hills": layered ridgelines like the view from Dehradun towards Mussoorie, sun by day, moon and stars by night. */
function Hills() {
  return (
    <>
      <div className="os-stars absolute inset-0" />
      <div className="absolute right-[14%] top-[12%] size-24 rounded-full bg-[var(--wp-sun)] opacity-90 blur-[0.5px] sm:size-32" />
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

/** "Night desk": the desk this was built at — a monitor full of code, a lamp, a window that shows the time of day. */
function Desk() {
  return (
    <svg className="absolute inset-0 size-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="wp-desk-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--wp-sky-top)" />
          <stop offset="1" stopColor="var(--wp-sky-bottom)" />
        </linearGradient>
        <radialGradient id="wp-desk-glow">
          <stop offset="0" stopColor="var(--wp-screen-glow)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--wp-screen-glow)" stopOpacity="0" />
        </radialGradient>
        <clipPath id="wp-desk-window">
          <rect x="940" y="120" width="340" height="300" />
        </clipPath>
      </defs>
      <rect width="1440" height="900" fill="var(--wp-wall)" />

      {/* Window */}
      <rect x="926" y="106" width="368" height="328" rx="6" fill="var(--wp-frame)" />
      <g clipPath="url(#wp-desk-window)">
        <rect x="940" y="120" width="340" height="300" fill="url(#wp-desk-sky)" />
        <g fill="#fff" style={{ opacity: "var(--wp-stars)" }}>
          {[[980, 160], [1030, 210], [1090, 150], [1150, 240], [1230, 170], [1000, 300], [1200, 320], [1120, 190]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />
          ))}
        </g>
        <circle cx="1200" cy="200" r="38" fill="var(--wp-sun)" />
        <path d="M940 420 L940 360 L1010 330 L1080 352 L1160 318 L1240 344 L1280 330 L1280 420 Z" fill="var(--wp-hill-1)" />
      </g>
      <rect x="1104" y="120" width="12" height="300" fill="var(--wp-frame)" />
      <rect x="940" y="264" width="340" height="12" fill="var(--wp-frame)" />

      {/* Lamp light */}
      <path d="M300 300 L130 660 L520 660 Z" fill="var(--wp-lamp)" style={{ opacity: "var(--wp-lamp-on)" }} />
      <ellipse cx="580" cy="440" rx="380" ry="260" fill="url(#wp-desk-glow)" />

      {/* Desk */}
      <rect x="0" y="652" width="1440" height="248" fill="var(--wp-desk)" />
      <rect x="0" y="640" width="1440" height="16" fill="var(--wp-desk-top)" />

      {/* Monitor */}
      <rect x="560" y="560" width="40" height="84" fill="var(--wp-bezel)" />
      <rect x="500" y="630" width="160" height="14" rx="7" fill="var(--wp-bezel)" />
      <rect x="400" y="320" width="360" height="248" rx="14" fill="var(--wp-bezel)" />
      <rect x="414" y="334" width="332" height="220" rx="6" fill="var(--wp-screen)" />
      <g>
        {[
          [430, 352, 90, 1], [530, 352, 60, 2], [446, 374, 140, 3], [446, 396, 70, 2], [526, 396, 110, 1],
          [462, 418, 160, 3], [462, 440, 90, 1], [446, 462, 40, 2], [430, 484, 60, 1], [430, 506, 120, 3],
        ].map(([x, y, w, c]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={w} height="9" rx="3" fill={`var(--wp-code-${c})`} />
        ))}
        <rect x="560" y="506" width="8" height="12" fill="var(--wp-code-1)" className="os-caret" />
      </g>

      {/* Lamp */}
      <rect x="200" y="630" width="110" height="14" rx="7" fill="var(--wp-bezel)" />
      <path d="M255 632 L230 420 L300 300" stroke="var(--wp-bezel)" strokeWidth="10" fill="none" strokeLinecap="round" />
      <path d="M262 276 L340 316 L312 346 L238 300 Z" fill="var(--wp-bezel)" />

      {/* Mug */}
      <rect x="820" y="580" width="54" height="62" rx="8" fill="var(--wp-mug)" />
      <path d="M874 596 q22 4 0 32" stroke="var(--wp-mug)" strokeWidth="8" fill="none" />

      {/* Plant */}
      <path d="M1130 642 L1140 580 L1210 580 L1220 642 Z" fill="var(--wp-pot)" />
      {["M1175 580 C1150 530 1120 520 1100 500", "M1175 580 C1180 520 1200 490 1215 470", "M1175 580 C1205 550 1240 548 1262 540", "M1175 580 C1160 545 1170 510 1160 480"].map(
        (d) => (
          <path key={d} d={d} stroke="var(--wp-leaf)" strokeWidth="14" strokeLinecap="round" fill="none" />
        )
      )}
    </svg>
  )
}

/** Stepped skyline for the pixel scene: deterministic, so it never shifts between visits. */
function steppedPath(base: number, amp: number, freq: number, phase: number, step: number, width: number, bottom: number) {
  let d = `M0 ${bottom}`
  for (let x = 0; x < width; x += step) {
    const h = base - amp * (0.6 * Math.sin(x * freq + phase) + 0.4 * Math.sin(x * freq * 2.7 + phase * 1.9))
    d += ` V${Math.round(h)} H${x + step}`
  }
  return `${d} V${bottom} Z`
}

/** "Pixel era": a nod to the journey — chunky pixel mountains in its night (or daytime) palette. */
function Pixel() {
  const ridges = React.useMemo(
    () => [
      { d: steppedPath(96, 26, 0.035, 0.4, 8, 320, 180), fill: "var(--wp-hill-1)" },
      { d: steppedPath(122, 18, 0.05, 2.1, 6, 320, 180), fill: "var(--wp-hill-2)" },
      { d: steppedPath(146, 8, 0.08, 1.2, 4, 320, 180), fill: "var(--wp-hill-3)" },
    ],
    []
  )
  return (
    <svg className="absolute inset-0 size-full" viewBox="0 0 320 180" preserveAspectRatio="xMidYMax slice" shapeRendering="crispEdges">
      {/* Banded sky, like a limited palette */}
      <rect width="320" height="180" fill="var(--wp-sky-top)" />
      <rect y="40" width="320" height="140" fill="var(--wp-sky-mid)" />
      <rect y="78" width="320" height="102" fill="var(--wp-sky-bottom)" />
      <g fill="#fff" style={{ opacity: "var(--wp-stars)" }}>
        {[[20, 12], [48, 30], [90, 8], [130, 24], [170, 6], [210, 34], [250, 14], [300, 28], [8, 50], [150, 46], [280, 54]].map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />
        ))}
      </g>
      {/* Pixel sun / moon */}
      <g fill="var(--wp-sun)">
        <rect x="240" y="22" width="12" height="20" />
        <rect x="236" y="26" width="20" height="12" />
        <rect x="238" y="24" width="16" height="16" />
      </g>
      {/* Clouds */}
      <g fill="var(--wp-cloud)">
        <rect x="40" y="40" width="28" height="4" />
        <rect x="46" y="36" width="14" height="4" />
        <rect x="190" y="56" width="34" height="4" />
        <rect x="198" y="52" width="16" height="4" />
      </g>
      {ridges.map((r) => (
        <path key={r.fill} d={r.d} fill={r.fill} />
      ))}
      <rect y="168" width="320" height="12" fill="var(--wp-ground)" />
    </svg>
  )
}

const scenes: Record<WallpaperId, React.FC> = {
  hills: Hills,
  desk: Desk,
  pixel: Pixel,
  // "Plain" is only the background colour and dot grid from index.css.
  plain: () => null,
}

export function useWallpaper() {
  return useSettings((s) => s.wallpaper)
}

export function Wallpaper({ className }: { className?: string }) {
  const id = useWallpaper()
  const Scene = scenes[id]
  return (
    <div aria-hidden className={cn("os-wallpaper pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <Scene />
    </div>
  )
}
