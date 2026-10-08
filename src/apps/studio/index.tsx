import * as React from "react"
import { AudioLines, FileAudio, FileText, Lock, Minus, Pause, Play, Plus, Sparkles, Square } from "lucide-react"
import type { AppProps } from "@/os/registry/apps"
import type { WorkerReply } from "./analysis.worker"
import { classifyRegions, noteName, SR, voiceStats, type Analysis, type RegionKind } from "./dsp/analyze"
import { parseCaptions, type Cue } from "./dsp/captions"
import { extractFrames, matchLoudness, synthesize } from "./dsp/resynth"
import { Overview, Timeline, REGION_COLOR, REGION_LABEL, type Range } from "./timeline"

/** The longest stretch "rebuild from metadata" works on at once. */
const MAX_REBUILD = 20

type Loaded = { name: string; original: AudioBuffer; mono: Float32Array }
type Playback = { mode: "original" | "rebuilt"; from: number; to: number; startedAt: number; node: AudioBufferSourceNode }

const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`
const fmtShort = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

let audioCtx: AudioContext | null = null
const ctx = () => (audioCtx ??= new AudioContext())

/** Decode any audio (or video) file, plus a 16 kHz mono copy for analysis. */
async function decode(file: File): Promise<Loaded> {
  const original = await ctx().decodeAudioData(await file.arrayBuffer())
  const length = Math.ceil(original.duration * SR)
  const offline = new OfflineAudioContext(1, length, SR)
  const src = offline.createBufferSource()
  src.buffer = original
  src.connect(offline.destination)
  src.start()
  const rendered = await offline.startRendering()
  return { name: file.name, original, mono: rendered.getChannelData(0) }
}

function analyseInWorker(mono: Float32Array, onProgress: (p: number) => void): Promise<Analysis> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./analysis.worker.ts", import.meta.url), { type: "module" })
    worker.onmessage = (e: MessageEvent<WorkerReply>) => {
      if (e.data.type === "progress") onProgress(e.data.p)
      else {
        resolve(e.data.analysis)
        worker.terminate()
      }
    }
    worker.onerror = (e) => {
      reject(new Error(e.message || "Analysis failed"))
      worker.terminate()
    }
    const copy = mono.slice()
    worker.postMessage(copy, [copy.buffer])
  })
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface px-3 py-2" title={hint}>
      <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function DropZone({ onFiles, busy }: { onFiles: (files: FileList) => void; busy: string | null }) {
  return (
    <div className="grid h-full place-items-center p-6">
      <label
        className="flex w-full max-w-lg cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border-strong bg-surface p-8 text-center hover:border-ring"
        data-tour="studio-drop"
      >
        <AudioLines className="size-10 text-accent" aria-hidden />
        <p className="text-base font-semibold">{busy ?? "Drop a recording and its captions"}</p>
        <p className="text-sm text-muted-foreground">
          Audio or video (mp3, m4a, wav, mp4) plus an optional <code>.srt</code> / <code>.vtt</code>. YouTube auto-captions
          work as they are.
        </p>
        <span className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Choose files</span>
        <input type="file" multiple accept="audio/*,video/*,.srt,.vtt" className="sr-only" onChange={(e) => e.target.files && onFiles(e.target.files)} />
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" aria-hidden /> Everything is analysed in this browser. Nothing is uploaded.
        </p>
      </label>
    </div>
  )
}

/**
 * Voice Studio, step one: the analyser. Load a recording (and its captions)
 * and see what a voice is made of — pitch, spectrum, where the clean speech
 * is — then hear it rebuilt from those numbers alone.
 */
export default function Studio({ isVisible }: AppProps) {
  const [audio, setAudio] = React.useState<Loaded | null>(null)
  const [cues, setCues] = React.useState<{ name: string; cues: Cue[] } | null>(null)
  const [analysis, setAnalysis] = React.useState<Analysis | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [view, setView] = React.useState<Range>({ start: 0, end: 20 })
  const [selection, setSelection] = React.useState<Range | null>(null)
  const [playing, setPlaying] = React.useState<Playback | null>(null)
  const [rebuilt, setRebuilt] = React.useState<{ range: Range; samples: Float32Array } | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const playhead = React.useRef<HTMLDivElement>(null)

  const regions = React.useMemo(() => (analysis ? classifyRegions(analysis, cues?.cues) : []), [analysis, cues])
  const stats = React.useMemo(() => (analysis ? voiceStats(analysis, regions) : null), [analysis, regions])
  const duration = analysis?.duration ?? 0

  const loadFiles = async (files: FileList | File[]) => {
    setError(null)
    const list = [...files]
    const captionFile = list.find((f) => /\.(srt|vtt)$/i.test(f.name))
    const audioFile = list.find((f) => !/\.(srt|vtt)$/i.test(f.name))
    if (captionFile) setCues({ name: captionFile.name, cues: parseCaptions(await captionFile.text()) })
    if (!audioFile) return
    try {
      stop()
      setBusy(`Decoding ${audioFile.name}…`)
      const loaded = await decode(audioFile)
      setAudio(loaded)
      setAnalysis(null)
      setRebuilt(null)
      setSelection(null)
      setBusy("Analysing… 0%")
      const a = await analyseInWorker(loaded.mono, (p) => setBusy(`Analysing… ${Math.round(p * 100)}%`))
      setAnalysis(a)
      setView({ start: 0, end: Math.min(20, a.duration) })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file")
    } finally {
      setBusy(null)
    }
  }

  // Once analysed, jump past an intro if there is one.
  const skippedIntro = React.useRef(false)
  React.useEffect(() => {
    if (!stats?.intro || skippedIntro.current) return
    skippedIntro.current = true
    setView((v) => ({ start: stats.intro!.end, end: stats.intro!.end + (v.end - v.start) }))
  }, [stats])

  // ---- Playback ------------------------------------------------------------

  const stop = React.useCallback(() => {
    setPlaying((p) => {
      p?.node.stop()
      return null
    })
  }, [])

  const play = (mode: Playback["mode"], range: Range) => {
    if (!audio) return
    stop()
    const ac = ctx()
    void ac.resume()
    const node = ac.createBufferSource()
    if (mode === "original") {
      node.buffer = audio.original
      node.start(0, range.start, range.end - range.start)
    } else {
      if (!rebuilt) return
      const buf = ac.createBuffer(1, rebuilt.samples.length, SR)
      buf.getChannelData(0).set(rebuilt.samples)
      node.buffer = buf
      node.start()
    }
    node.connect(ac.destination)
    const p: Playback = { mode, from: range.start, to: range.end, startedAt: ac.currentTime, node }
    node.onended = () => setPlaying((cur) => (cur === p ? null : cur))
    setPlaying(p)
  }

  // Pause when the window is hidden or covered.
  React.useEffect(() => {
    if (!isVisible) stop()
  }, [isVisible, stop])

  // Move the playhead without re-rendering React every frame.
  React.useEffect(() => {
    if (!playing) {
      if (playhead.current) playhead.current.style.opacity = "0"
      return
    }
    let raf = 0
    const tick = () => {
      const t = playing.from + (ctx().currentTime - playing.startedAt)
      const el = playhead.current
      if (el) {
        const x = (t - view.start) / (view.end - view.start)
        el.style.opacity = x >= 0 && x <= 1 ? "1" : "0"
        el.style.left = `${x * 100}%`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, view])

  React.useEffect(() => () => stop(), [stop])

  // ---- Rebuild from metadata ----------------------------------------------

  const target: Range = selection ?? view
  const rebuildRange: Range = { start: target.start, end: Math.min(target.end, target.start + MAX_REBUILD) }

  const rebuild = () => {
    if (!audio || !analysis) return
    setBusy("Rebuilding from metadata…")
    // Let the label paint before the (sub-second) crunch.
    window.setTimeout(() => {
      const from = Math.floor(rebuildRange.start * 100)
      const to = Math.floor(rebuildRange.end * 100)
      const frames = extractFrames(audio.mono, analysis.f0, analysis.conf, from, to)
      const samples = matchLoudness(synthesize(frames), audio.mono.subarray(from * 160, to * 160))
      setRebuilt({ range: rebuildRange, samples })
      setBusy(null)
    }, 30)
  }
  const rebuiltIsCurrent = rebuilt && rebuilt.range.start === rebuildRange.start && rebuilt.range.end === rebuildRange.end

  // ---- View ------------------------------------------------------------------

  const span = view.end - view.start
  const zoom = (factor: number) =>
    setView((v) => {
      const mid = (v.start + v.end) / 2
      const next = Math.min(duration, Math.max(2, (v.end - v.start) * factor))
      const start = Math.max(0, Math.min(duration - next, mid - next / 2))
      return { start, end: start + next }
    })

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) void loadFiles(e.dataTransfer.files)
  }

  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-background text-foreground"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <AudioLines className="size-4 text-accent" aria-hidden /> Voice Studio
          <span className="rounded bg-muted px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground">Analyser</span>
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-1.5 text-xs">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 hover:bg-muted">
            <FileAudio className="size-3.5" aria-hidden />
            <span className="max-w-40 truncate">{audio?.name ?? "Load audio"}</span>
            <input type="file" accept="audio/*,video/*" className="sr-only" onChange={(e) => e.target.files && void loadFiles(e.target.files)} />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 hover:bg-muted">
            <FileText className="size-3.5" aria-hidden />
            <span className="max-w-40 truncate">{cues ? `${cues.cues.length} captions` : "Load captions"}</span>
            <input type="file" accept=".srt,.vtt" className="sr-only" onChange={(e) => e.target.files && void loadFiles(e.target.files)} />
          </label>
        </div>
      </header>

      {error && <p className="border-b border-border bg-[#fde8e8] px-4 py-2 text-xs text-[#9b1c1c] dark:bg-[#3a1515] dark:text-[#fca5a5]">{error}</p>}

      {!analysis ? (
        <DropZone onFiles={(f) => void loadFiles(f)} busy={busy} />
      ) : (
        <div className="@container min-h-0 flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 gap-2 @lg:grid-cols-3 @3xl:grid-cols-6">
            <Stat label="Length" value={fmtShort(duration)} />
            <Stat label="Clean speech" value={`${fmtShort(stats!.cleanSpeech)}`} hint="Talking with nothing underneath: the part a voice clone can use." />
            <Stat label="Speech over music" value={fmtShort(stats!.speechTotal - stats!.cleanSpeech)} hint="Talking with background music: less useful." />
            <Stat label="Typical pitch" value={`${Math.round(stats!.medianHz)} Hz · ${noteName(stats!.medianHz)}`} />
            <Stat label="Pitch range" value={`${Math.round(stats!.lowHz)}–${Math.round(stats!.highHz)} Hz`} />
            <Stat
              label="Intro"
              value={
                stats!.intro ? (
                  <button type="button" className="underline underline-offset-2" onClick={() => setView({ start: stats!.intro!.end, end: stats!.intro!.end + span })}>
                    {fmtShort(stats!.intro.start)}–{fmtShort(stats!.intro.end)}
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
            <Timeline analysis={analysis} regions={regions} cues={cues?.cues ?? []} view={view} selection={selection} onSelect={setSelection} />
            <div ref={playhead} aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-[#ff4d8d] opacity-0" />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
              <button
                type="button"
                data-tour="studio-play"
                onClick={() => (playing?.mode === "original" ? stop() : play("original", target))}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
              >
                {playing?.mode === "original" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                Original
              </button>
              <button
                type="button"
                data-tour="studio-play-rebuilt"
                disabled={!rebuiltIsCurrent}
                onClick={() => (playing?.mode === "rebuilt" ? stop() : play("rebuilt", rebuildRange))}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-40"
              >
                {playing?.mode === "rebuilt" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                Rebuilt
              </button>
              {playing && (
                <button type="button" aria-label="Stop" onClick={stop} className="rounded-md p-1.5 hover:bg-muted">
                  <Square className="size-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              data-tour="studio-rebuild"
              onClick={rebuild}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Sparkles className="size-3.5" aria-hidden /> {busy ?? `Rebuild ${fmtShort(rebuildRange.start)}–${fmtShort(rebuildRange.end)} from metadata`}
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
            <strong className="text-foreground">Rebuilt</strong> throws the audio away and makes it again from two numbers per 10 ms: the
            pitch, and a 40-number outline of the voice's spectrum. If it still sounds like the same person, those numbers are the voice — and
            they're what the next step (the voicebank) is built from.
          </p>
        </div>
      )}

      {dragging && (
        <div className="pointer-events-none absolute inset-2 grid place-items-center rounded-xl border-2 border-dashed border-ring bg-background/80 text-sm font-medium">
          Drop audio and captions
        </div>
      )}
      {busy && analysis && <p className="sr-only" role="status">{busy}</p>}
    </div>
  )
}

