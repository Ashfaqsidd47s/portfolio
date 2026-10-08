import * as React from "react"
import { cn } from "@/lib/utils"
import { BINS, type Analysis, type Region, type RegionKind } from "./dsp/analyze"
import type { Cue } from "./dsp/captions"

export type Range = { start: number; end: number }

export const REGION_COLOR: Record<RegionKind, string> = {
  speech: "#34d399",
  "speech-music": "#fbbf24",
  music: "#a78bfa",
  silence: "#475569",
}

export const REGION_LABEL: Record<RegionKind, string> = {
  speech: "clean speech",
  "speech-music": "speech over music",
  music: "music",
  silence: "silence",
}

/** A dark-to-bright palette for the spectrogram (close to "magma"). */
const LUT = (() => {
  const stops = [
    [0, [8, 6, 22]],
    [0.25, [59, 15, 112]],
    [0.5, [140, 41, 129]],
    [0.75, [222, 73, 104]],
    [0.9, [254, 159, 109]],
    [1, [252, 253, 191]],
  ] as const
  const lut = new Uint8Array(256 * 3)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    let k = 0
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++
    const [t0, c0] = stops[k]
    const [t1, c1] = stops[k + 1]
    const u = (t - t0) / (t1 - t0)
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = Math.round(c0[c] + (c1[c] - c0[c]) * u)
  }
  return lut
})()

/** Canvas sized to its box in device pixels; redraws on resize. */
function useCanvas(draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, deps: React.DependencyList) {
  const ref = React.useRef<HTMLCanvasElement>(null)
  const [size, setSize] = React.useState({ w: 0, h: 0 })
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      setSize({ w: Math.round(el.clientWidth * dpr), h: Math.round(el.clientHeight * dpr) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  React.useEffect(() => {
    const el = ref.current
    if (!el || !size.w || !size.h) return
    el.width = size.w
    el.height = size.h
    const g = el.getContext("2d")
    if (g) draw(g, size.w, size.h)
    // `draw` closes over `deps`.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [size, ...deps])
  return ref
}

/** The whole recording at a glance: regions, loudness, and the window being viewed (drag or click to move it). */
export function Overview({
  analysis,
  regions,
  view,
  onView,
  className,
}: {
  analysis: Analysis
  regions: Region[]
  view: Range
  onView: (r: Range) => void
  className?: string
}) {
  const { duration } = analysis
  const ref = useCanvas(
    (g, w, h) => {
      for (const r of regions) {
        g.fillStyle = REGION_COLOR[r.kind]
        g.globalAlpha = 0.35
        g.fillRect((r.start / duration) * w, 0, ((r.end - r.start) / duration) * w + 1, h)
      }
      g.globalAlpha = 1
      g.fillStyle = "rgba(255,255,255,0.85)"
      const per = analysis.frames / w
      for (let x = 0; x < w; x++) {
        let max = -120
        for (let i = Math.floor(x * per); i < Math.floor((x + 1) * per); i++) max = Math.max(max, analysis.db[i])
        const v = Math.max(0, Math.min(1, (max - analysis.floor) / 50))
        g.fillRect(x, h - v * h, 1, v * h)
      }
    },
    [analysis, regions]
  )

  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const span = view.end - view.start
    const centre = ((e.clientX - r.left) / r.width) * duration
    const start = Math.max(0, Math.min(duration - span, centre - span / 2))
    onView({ start, end: start + span })
  }

  return (
    <div
      className={cn("relative h-12 cursor-pointer touch-none overflow-hidden rounded-lg bg-[#0b0a1f]", className)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId)
        seek(e)
      }}
      onPointerMove={(e) => e.buttons === 1 && seek(e)}
      aria-label="Whole recording"
      data-tour="studio-overview"
    >
      <canvas ref={ref} className="absolute inset-0 size-full" />
      <div
        className="pointer-events-none absolute inset-y-0 rounded border-2 border-white/90 bg-white/10"
        style={{ left: `${(view.start / duration) * 100}%`, width: `${((view.end - view.start) / duration) * 100}%` }}
      />
    </div>
  )
}

const PITCH_LO = 70
const PITCH_HI = 600
const pitchY = (hz: number, h: number) => h - (Math.log2(hz / PITCH_LO) / Math.log2(PITCH_HI / PITCH_LO)) * h

/**
 * The detail view: region strip, pitch lane (log scale with note lines),
 * spectrogram (0–4 kHz) and the captions, for the time window `view`.
 * Drag across it to select a stretch; click a caption to select its line.
 */
export function Timeline({
  analysis,
  regions,
  cues,
  view,
  selection,
  onSelect,
}: {
  analysis: Analysis
  regions: Region[]
  cues: Cue[]
  view: Range
  selection: Range | null
  onSelect: (r: Range | null) => void
}) {
  const span = view.end - view.start
  const frameAt = (x: number, w: number) => Math.floor((view.start + (x / w) * span) * 100)

  const pitchRef = useCanvas(
    (g, w, h) => {
      g.fillStyle = "#0f0d26"
      g.fillRect(0, 0, w, h)
      g.strokeStyle = "rgba(255,255,255,0.08)"
      g.fillStyle = "rgba(255,255,255,0.35)"
      g.font = `${Math.round(h / 9)}px ui-monospace, monospace`
      for (const [hz, label] of [
        [110, "A2"],
        [220, "A3"],
        [440, "A4"],
      ] as const) {
        const y = pitchY(hz, h)
        g.fillRect(0, y, w, 1)
        g.fillText(label, 4, y - 3)
      }
      g.strokeStyle = "#3ee6ff"
      g.lineWidth = Math.max(1.5, h / 50)
      g.beginPath()
      let last = 0
      for (let x = 0; x < w; x++) {
        const i = frameAt(x, w)
        const hz = analysis.f0[i]
        if (hz > 0 && analysis.conf[i] > 0.6) {
          const y = pitchY(hz, h)
          // Lift the pen across gaps and big jumps, so they don't draw as cliffs.
          if (last && Math.abs(Math.log2(hz / last)) < 0.3) g.lineTo(x, y)
          else g.moveTo(x, y)
          last = hz
        } else last = 0
      }
      g.stroke()
    },
    [analysis, view]
  )

  const specRef = useCanvas(
    (g, w, h) => {
      const img = g.createImageData(w, h)
      for (let x = 0; x < w; x++) {
        const i = Math.min(analysis.frames - 1, frameAt(x, w))
        for (let y = 0; y < h; y++) {
          const bin = Math.min(BINS - 1, Math.floor((1 - y / h) * BINS))
          const v = i >= 0 ? analysis.spec[i * BINS + bin] : 0
          const o = (y * w + x) * 4
          img.data[o] = LUT[v * 3]
          img.data[o + 1] = LUT[v * 3 + 1]
          img.data[o + 2] = LUT[v * 3 + 2]
          img.data[o + 3] = 255
        }
      }
      g.putImageData(img, 0, 0)
    },
    [analysis, view]
  )

  // Drag to select a stretch of time.
  const drag = React.useRef<number | null>(null)
  const timeAt = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return Math.max(0, Math.min(analysis.duration, view.start + ((e.clientX - r.left) / r.width) * span))
  }

  const visibleRegions = regions.filter((r) => r.end > view.start && r.start < view.end)
  const visibleCues = cues.filter((c) => c.end > view.start && c.start < view.end)
  const pct = (t: number) => `${((t - view.start) / span) * 100}%`

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div
        className="relative cursor-crosshair touch-none select-none"
        data-tour="studio-timeline"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId)
          drag.current = timeAt(e)
        }}
        onPointerMove={(e) => {
          if (drag.current === null) return
          const t = timeAt(e)
          if (Math.abs(t - drag.current) > 0.05) onSelect({ start: Math.min(t, drag.current), end: Math.max(t, drag.current) })
        }}
        onPointerUp={(e) => {
          if (drag.current !== null && Math.abs(timeAt(e) - drag.current) <= 0.05) onSelect(null)
          drag.current = null
        }}
      >
        <div className="relative h-2">
          {visibleRegions.map((r) => (
            <div
              key={r.start}
              className="absolute inset-y-0"
              title={REGION_LABEL[r.kind]}
              style={{ left: pct(Math.max(r.start, view.start)), width: `${((Math.min(r.end, view.end) - Math.max(r.start, view.start)) / span) * 100}%`, background: REGION_COLOR[r.kind] }}
            />
          ))}
        </div>
        <canvas ref={pitchRef} className="block h-24 w-full" aria-label="Pitch" />
        <canvas ref={specRef} className="block h-40 w-full" aria-label="Spectrogram, 0 to 4 kHz" />
        {selection && (
          <div
            className="pointer-events-none absolute inset-y-0 border-x-2 border-white/80 bg-white/15"
            style={{ left: pct(selection.start), width: `${((selection.end - selection.start) / span) * 100}%` }}
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-1.5 pb-0.5 font-mono text-[0.625rem] text-white/60">
          <span>{view.start.toFixed(1)} s</span>
          <span>{view.end.toFixed(1)} s</span>
        </div>
      </div>
      <div className="relative h-14 overflow-hidden border-t border-border bg-surface" aria-label="Captions">
        {visibleCues.length === 0 && <p className="p-2 text-xs text-muted-foreground">No captions here.</p>}
        {visibleCues.map((c, i) => (
          <button
            key={`${c.start}-${i}`}
            type="button"
            title={c.text}
            onClick={() => onSelect({ start: c.start, end: c.end })}
            className={cn(
              "absolute top-1.5 h-11 overflow-hidden rounded-md border px-1.5 py-1 text-left text-[0.6875rem] leading-tight",
              c.sound ? "border-[#a78bfa]/50 bg-[#a78bfa]/10 italic text-muted-foreground" : "border-border bg-elevated hover:border-ring"
            )}
            style={{ left: pct(c.start), width: `calc(${((c.end - c.start) / span) * 100}% - 2px)` }}
          >
            {c.text}
          </button>
        ))}
      </div>
    </div>
  )
}
