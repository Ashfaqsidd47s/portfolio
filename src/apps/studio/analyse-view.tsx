import * as React from "react"
import { Pause, Play, Plus, Minus, Sparkles } from "lucide-react"
import { ctx, playBuffer, playSamples, stopAudio, type Loaded } from "./audio"
import { noteName, type Analysis, type Region, type RegionKind, type VoiceStats } from "./dsp/analyze"
import type { Cue } from "./dsp/captions"
import { extractFrames, matchLoudness, synthesize } from "./dsp/resynth"
import { Overview, Timeline, REGION_COLOR, REGION_LABEL, type Range } from "./timeline"

/** The longest stretch "rebuild from metadata" works on at once. */
const MAX_REBUILD = 20

export const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`
export const fmtShort = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2" title={hint}>
      <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}

type Playing = { mode: "original" | "rebuilt"; from: number; startedAt: number }

/**
 * See what a voice is made of — pitch, spectrum, where the clean speech is —
 * and hear a stretch rebuilt from those numbers alone.
 */
export function AnalyseView({
  audio,
  analysis,
  regions,
  stats,
  cues,
  isVisible,
}: {
  audio: Loaded
  analysis: Analysis
  regions: Region[]
  stats: VoiceStats
  cues: Cue[]
  isVisible: boolean
}) {
  const duration = analysis.duration
  const [view, setView] = React.useState<Range>(() => {
    const start = stats.intro?.end ?? 0
    return { start, end: Math.min(duration, start + 20) }
  })
  const [selection, setSelection] = React.useState<Range | null>(null)
  const [playing, setPlaying] = React.useState<Playing | null>(null)
  const [rebuilt, setRebuilt] = React.useState<{ range: Range; samples: Float32Array } | null>(null)
  const [busy, setBusy] = React.useState(false)
  const playhead = React.useRef<HTMLDivElement>(null)

  const target: Range = selection ?? view
  const rebuildRange: Range = { start: target.start, end: Math.min(target.end, target.start + MAX_REBUILD) }
  const rebuiltIsCurrent = rebuilt && rebuilt.range.start === rebuildRange.start && rebuilt.range.end === rebuildRange.end

  const stop = React.useCallback(() => {
    stopAudio()
    setPlaying(null)
  }, [])

  const play = (mode: Playing["mode"]) => {
    const onEnd = () => setPlaying((p) => (p?.mode === mode ? null : p))
    if (mode === "original") {
      const { startedAt } = playBuffer(audio.original, { offset: target.start, duration: target.end - target.start, onEnd })
      setPlaying({ mode, from: target.start, startedAt })
    } else if (rebuilt) {
      const { startedAt } = playSamples(rebuilt.samples, { onEnd })
      setPlaying({ mode, from: rebuilt.range.start, startedAt })
    }
  }

  // Hidden or covered: stop (stopAudio fires onEnd, which clears `playing`).
  React.useEffect(() => {
    if (!isVisible) stopAudio()
  }, [isVisible])
  React.useEffect(() => stop, [stop])

  // Move the playhead without re-rendering React every frame.
  React.useEffect(() => {
    const el = playhead.current
    if (!el) return
    if (!playing) {
      el.style.opacity = "0"
      return
    }
    let raf = 0
    const tick = () => {
      const t = playing.from + (ctx().currentTime - playing.startedAt)
      const x = (t - view.start) / (view.end - view.start)
      el.style.opacity = x >= 0 && x <= 1 ? "1" : "0"
      el.style.left = `${x * 100}%`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, view])

  const rebuild = () => {
    setBusy(true)
    // Let the label paint before the (sub-second) crunch.
    window.setTimeout(() => {
      const from = Math.floor(rebuildRange.start * 100)
      const to = Math.floor(rebuildRange.end * 100)
      const frames = extractFrames(audio.mono, analysis.f0, analysis.conf, from, to)
      setRebuilt({ range: rebuildRange, samples: matchLoudness(synthesize(frames), audio.mono.subarray(from * 160, to * 160)) })
      setBusy(false)
    }, 30)
  }

  const span = view.end - view.start
  const zoom = (factor: number) =>
    setView((v) => {
      const mid = (v.start + v.end) / 2
      const next = Math.min(duration, Math.max(2, (v.end - v.start) * factor))
      const start = Math.max(0, Math.min(duration - next, mid - next / 2))
      return { start, end: start + next }
    })

  return (
    <div className="@container min-h-0 flex-1 overflow-auto p-4">
      <div className="grid grid-cols-2 gap-2 @lg:grid-cols-3 @3xl:grid-cols-6">
        <Stat label="Length" value={fmtShort(duration)} />
        <Stat label="Clean speech" value={fmtShort(stats.cleanSpeech)} hint="Talking with nothing underneath: the part a voice clone can use." />
        <Stat label="Speech over music" value={fmtShort(stats.speechTotal - stats.cleanSpeech)} hint="Talking with background music: less useful." />
        <Stat label="Typical pitch" value={`${Math.round(stats.medianHz)} Hz · ${noteName(stats.medianHz)}`} />
        <Stat label="Pitch range" value={`${Math.round(stats.lowHz)}–${Math.round(stats.highHz)} Hz`} />
        <Stat
          label="Intro"
          value={
            stats.intro ? (
              <button type="button" className="underline underline-offset-2" onClick={() => setView({ start: stats.intro!.end, end: stats.intro!.end + span })}>
                {fmtShort(stats.intro.start)}–{fmtShort(stats.intro.end)}
              </button>
            ) : (
              "none found"
            )
          }
          hint="Music at the start with no talking. Skipped for you."
        />
      </div>

      <Overview analysis={analysis} regions={regions} view={view} onView={setView} className="mt-4" />

      <div className="relative mt-3">
        <Timeline analysis={analysis} regions={regions} cues={cues} view={view} selection={selection} onSelect={setSelection} />
        <div ref={playhead} aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-[#ff4d8d] opacity-0" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <button
            type="button"
            data-tour="studio-play"
            onClick={() => (playing?.mode === "original" ? stop() : play("original"))}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
          >
            {playing?.mode === "original" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            Original
          </button>
          <button
            type="button"
            data-tour="studio-play-rebuilt"
            disabled={!rebuiltIsCurrent}
            onClick={() => (playing?.mode === "rebuilt" ? stop() : play("rebuilt"))}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
          >
            {playing?.mode === "rebuilt" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
            Rebuilt
          </button>
        </div>
        <button
          type="button"
          data-tour="studio-rebuild"
          onClick={rebuild}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Sparkles className="size-3.5" aria-hidden />
          {busy ? "Rebuilding…" : `Rebuild ${fmtShort(rebuildRange.start)}–${fmtShort(rebuildRange.end)} from metadata`}
        </button>
        <p className="text-xs text-muted-foreground">
          {selection ? `Selection ${fmt(selection.start)} – ${fmt(selection.end)}` : "Drag on the timeline to select; click a caption to pick its line."}
        </p>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" aria-label="Zoom out" onClick={() => zoom(1.6)} className="rounded-md border border-border p-1.5 hover:bg-muted">
            <Minus className="size-3.5" />
          </button>
          <span className="w-14 text-center text-xs tabular-nums text-muted-foreground">{span.toFixed(0)} s</span>
          <button type="button" aria-label="Zoom in" onClick={() => zoom(1 / 1.6)} className="rounded-md border border-border p-1.5 hover:bg-muted">
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(Object.keys(REGION_LABEL) as RegionKind[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: REGION_COLOR[k] }} aria-hidden /> {REGION_LABEL[k]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-[#3ee6ff]" aria-hidden /> pitch
        </span>
      </div>
      <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Rebuilt</strong> throws the audio away and makes it again from two numbers per 10 ms: the pitch,
        and a 40-number outline of the voice's spectrum. If it still sounds like the same person, those numbers are the voice.
      </p>
    </div>
  )
}
