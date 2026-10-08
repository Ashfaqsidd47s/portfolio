import * as React from "react"
import { AudioLines, Download, Lock, Mic, Pause, Play, Search, Trash2, Wand2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ctx, playSamples, stopAudio } from "./audio"
import { Stat, fmt } from "./analyse-view"
import { SR } from "./dsp/analyze"
import { encodeWav, indexVoicebank, plan, renderNatural, renderSmooth, type Piece, type Timing, type Voice } from "./dsp/speak"
import type { Unit, Voicebank } from "./dsp/voicebank"

export type VoiceState = { vb: Voicebank; voice: Voice }

const clipOf = (voice: Voice, u: Unit) => voice.mono.slice(Math.floor(u.start * SR), Math.floor(u.end * SR))

// ---- Voicebank ----------------------------------------------------------------

/**
 * The words and syllables cut from the recording. Click a word to hear it;
 * nudge or remove cuts that came out wrong (the cutting is automatic and
 * approximate). Every change is saved in this browser.
 */
export function VoicebankView({
  state,
  canBuild,
  buildHint,
  onBuild,
  onChange,
  onDelete,
}: {
  state: VoiceState | null
  canBuild: boolean
  buildHint: string
  onBuild: () => void
  onChange: (vb: Voicebank) => void
  onDelete: () => void
}) {
  const [query, setQuery] = React.useState("")
  const [selected, setSelected] = React.useState<string | null>(null)

  const counts = React.useMemo(() => {
    const m = new Map<string, Unit[]>()
    for (const u of state?.vb.words ?? []) m.set(u.text, [...(m.get(u.text) ?? []), u])
    for (const list of m.values()) list.sort((a, b) => b.score - a.score)
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [state])

  if (!state) {
    return (
      <div className="grid flex-1 place-items-center p-6 text-center">
        <div className="max-w-md">
          <Wand2 className="mx-auto size-9 text-accent" aria-hidden />
          <p className="mt-3 text-base font-semibold">Build a voicebank</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The recording is cut into every word and syllable the captions mention, ready for the Speak tab to reuse. It stays in this
            browser.
          </p>
          <button
            type="button"
            disabled={!canBuild}
            onClick={onBuild}
            data-tour="studio-build"
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            Build voicebank
          </button>
          <p className="mt-2 text-xs text-muted-foreground">{buildHint}</p>
        </div>
      </div>
    )
  }

  const { vb, voice } = state
  const play = (u: Unit) => playSamples(clipOf(voice, u))
  const update = (id: number, fn: (u: Unit) => Unit | null) =>
    onChange({
      ...vb,
      words: vb.words.flatMap((u) => (u.id === id ? (fn(u) ?? []) : [u])),
    })
  const nudge = (u: Unit, edge: "start" | "end", by: number) => {
    const next = { ...u, [edge]: Math.max(0, u[edge] + by) }
    if (next.end - next.start < 0.05) return
    update(u.id, () => next)
    playSamples(clipOf(voice, next))
  }

  const shown = counts.filter(([w]) => !query || w.includes(query))
  const cuts = selected ? (counts.find(([w]) => w === selected)?.[1] ?? []) : []

  return (
    <div className="@container min-h-0 flex-1 overflow-auto p-4">
      <div className="grid grid-cols-2 gap-2 @3xl:grid-cols-5">
        <Stat label="Word cuts" value={vb.words.length} />
        <Stat label="Different words" value={counts.length} />
        <Stat label="Syllables" value={`${new Set(vb.syllables.map((s) => s.text)).size} kinds`} />
        <Stat label="Voice pitch" value={`${Math.round(vb.pitch)} Hz`} />
        <div className="col-span-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 @3xl:col-span-1">
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3 shrink-0" aria-hidden /> <span className="truncate">Saved in this browser</span>
          </p>
          <button type="button" onClick={onDelete} aria-label="Delete voicebank" title="Delete voicebank" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <label className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm focus-within:border-ring">
            <Search className="size-3.5 text-muted-foreground" aria-hidden />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a word (Hindi script)" className="min-w-0 flex-1 bg-transparent outline-none" />
          </label>
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Words in the voicebank">
            {shown.map(([w, units]) => (
              <li key={w}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(w)
                    play(units[0])
                  }}
                  className={cn(
                    "rounded-md border px-2 py-1 text-sm hover:border-ring",
                    selected === w ? "border-ring bg-accent-soft" : "border-border bg-elevated"
                  )}
                >
                  {w}
                  {units.length > 1 && <span className="ml-1 text-[0.6875rem] text-muted-foreground">×{units.length}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <aside className="rounded-lg border border-border p-3 @3xl:sticky @3xl:top-0 @3xl:self-start">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Click a word to hear it and check its cuts. Fix any that start late or end early — Speak always uses the best one.</p>
          ) : (
            <>
              <p className="text-base font-semibold">{selected}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {cuts.map((u, i) => (
                  <li key={u.id} className="rounded-md border border-border p-2 text-xs">
                    <div className="flex items-center gap-2">
                      <button type="button" aria-label="Play this cut" onClick={() => play(u)} className="rounded-md bg-muted p-1.5 hover:bg-accent-soft">
                        <Play className="size-3" />
                      </button>
                      <span className="tabular-nums">{fmt(u.start)}</span>
                      <span className="text-muted-foreground">{Math.round((u.end - u.start) * 1000)} ms</span>
                      {i === 0 && <span className="rounded bg-accent-soft px-1 text-[0.625rem] font-medium text-accent">used</span>}
                      <span className="ml-auto h-1.5 w-12 overflow-hidden rounded bg-muted" title={`Confidence ${Math.round(u.score * 100)}%`}>
                        <span className="block h-full bg-accent" style={{ width: `${u.score * 100}%` }} />
                      </span>
                      <button type="button" aria-label="Remove this cut" title="Remove a bad cut" onClick={() => update(u.id, () => null)} className="rounded p-1 text-muted-foreground hover:bg-muted">
                        <X className="size-3" />
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[0.6875rem] text-muted-foreground">
                      start
                      <button type="button" className="rounded border border-border px-1 hover:bg-muted" onClick={() => nudge(u, "start", -0.03)}>
                        −30ms
                      </button>
                      <button type="button" className="rounded border border-border px-1 hover:bg-muted" onClick={() => nudge(u, "start", 0.03)}>
                        +30ms
                      </button>
                      <span className="ml-2">end</span>
                      <button type="button" className="rounded border border-border px-1 hover:bg-muted" onClick={() => nudge(u, "end", -0.03)}>
                        −30ms
                      </button>
                      <button type="button" className="rounded border border-border px-1 hover:bg-muted" onClick={() => nudge(u, "end", 0.03)}>
                        +30ms
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

// ---- Speak ---------------------------------------------------------------------

/** Lines made only of words she says in the recording, so every word is her own. */
const READY_LINES = [
  "हे गाइस वेलकम बैक टू माय चैनल",
  "मुझे मेकअप काफी अच्छे लगते हैं",
  "मैं आपको एक सिंपल सा लुक दिखाऊंगी",
  "प्लीज डू सब्सक्राइब माय चैनल",
  "ये लुक काफी सिंपल है, मिलते हैं नेक्स्ट वीडियो में",
]
const ROMAN_EXAMPLE = "hey guys, aaj main aapko ek naya look dikhaungi"

const PIECE_STYLE: Record<"word" | "syllables" | "missing", string> = {
  word: "border-[#34d399]/60 bg-[#34d399]/12",
  syllables: "border-[#fbbf24]/70 bg-[#fbbf24]/12",
  missing: "border-[#f87171]/70 bg-[#f87171]/12",
}

function pieceQuality(p: Piece): keyof typeof PIECE_STYLE {
  if (p.kind === "word") return "word"
  if (p.kind === "syllables" && p.units.some((u) => !u)) return "missing"
  return "syllables"
}

/**
 * Type a sentence — Hindi script or Roman Hinglish — and hear it in the
 * voicebank's voice. Green words are her own recordings of that word,
 * amber ones are built from her syllables, red ones are missing a piece.
 */
export function SpeakView({ state, onOpenVoicebank }: { state: VoiceState | null; onOpenVoicebank: () => void }) {
  const [text, setText] = React.useState(READY_LINES[0])
  const [mode, setMode] = React.useState<"natural" | "smooth">("natural")
  const [gapMs, setGapMs] = React.useState(40)
  const [result, setResult] = React.useState<{ pieces: Piece[]; audio: Float32Array; timings: Timing[] } | null>(null)
  const [playing, setPlaying] = React.useState<number | null>(null)
  const [active, setActive] = React.useState<number | null>(null)
  const index = React.useMemo(() => (state ? indexVoicebank(state.vb) : null), [state])

  // Highlight the word being spoken.
  React.useEffect(() => {
    if (playing === null || !result) return
    let raf = 0
    const tick = () => {
      const t = ctx().currentTime - playing
      setActive(result.timings.find((w) => w.start <= t && w.end > t)?.piece ?? null)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, result])

  React.useEffect(() => () => stopAudio(), [])

  if (!state || !index) {
    return (
      <div className="grid flex-1 place-items-center p-6 text-center">
        <div className="max-w-sm">
          <Mic className="mx-auto size-9 text-accent" aria-hidden />
          <p className="mt-3 text-base font-semibold">No voice yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Load a recording with its captions and build a voicebank first.</p>
          <button type="button" onClick={onOpenVoicebank} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Go to Voicebank
          </button>
        </div>
      </div>
    )
  }

  const speak = (line = text) => {
    const pieces = plan(line, index)
    const render = mode === "natural" ? renderNatural : renderSmooth
    const { audio, timings } = render(pieces, state.voice, { gapMs })
    setResult({ pieces, audio, timings })
    const { startedAt } = playSamples(audio, { onEnd: () => setPlaying(null) })
    setPlaying(startedAt)
  }

  const playPiece = (i: number) => {
    if (!result) return
    const t = result.timings.find((w) => w.piece === i)
    if (!t) return
    playSamples(result.audio.subarray(Math.floor(t.start * SR), Math.ceil(t.end * SR)))
  }

  const download = () => {
    if (!result) return
    const a = document.createElement("a")
    a.href = URL.createObjectURL(encodeWav(result.audio))
    a.download = `voice-studio-${Date.now()}.wav`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const counts = result
    ? result.pieces.reduce((c, p) => (p.kind === "pause" ? c : { ...c, [pieceQuality(p)]: (c[pieceQuality(p)] ?? 0) + 1 }), {} as Record<string, number>)
    : {}

  return (
    <div className="@container min-h-0 flex-1 overflow-auto p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ready-made lines</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {READY_LINES.map((line) => (
              <button
                key={line}
                type="button"
                onClick={() => {
                  setText(line)
                  speak(line)
                }}
                className="rounded-full border border-border bg-elevated px-3 py-1 text-sm hover:border-ring"
              >
                {line}
              </button>
            ))}
          </div>
        </section>

        <section>
          <label htmlFor="studio-text" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Or type anything
          </label>
          <textarea
            id="studio-text"
            data-tour="studio-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) speak()
            }}
            rows={3}
            placeholder={`Hindi script or Roman Hinglish, e.g. “${ROMAN_EXAMPLE}”`}
            className="mt-2 w-full resize-y rounded-lg border border-border bg-elevated p-3 text-base outline-none focus:border-ring"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-tour="studio-speak"
              onClick={() => speak()}
              disabled={!text.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              <AudioLines className="size-4" /> Speak
            </button>
            {playing !== null && (
              <button type="button" onClick={stopAudio} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                <Pause className="size-4" /> Stop
              </button>
            )}
            <div role="radiogroup" aria-label="Voice style" className="flex rounded-lg border border-border p-0.5 text-xs">
              {(["natural", "smooth"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => setMode(m)}
                  title={m === "natural" ? "Her real recordings spliced together" : "Rebuilt through the vocoder with one smooth pitch line"}
                  className={cn("rounded-md px-2.5 py-1.5 font-medium capitalize", mode === m ? "bg-muted" : "text-muted-foreground")}
                >
                  {m}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Gap between words
              <input type="range" min={0} max={150} step={10} value={gapMs} onChange={(e) => setGapMs(Number(e.target.value))} className="w-24 accent-[var(--accent)]" />
              <span className="w-10 tabular-nums">{gapMs} ms</span>
            </label>
            {result && (
              <button type="button" onClick={download} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
                <Download className="size-3.5" /> WAV
              </button>
            )}
          </div>
        </section>

        {result && (
          <section aria-live="polite">
            <div className="flex flex-wrap gap-1.5">
              {result.pieces.map((p, i) =>
                p.kind === "pause" ? (
                  <span key={i} className="self-center px-1 text-muted-foreground">
                    ·
                  </span>
                ) : (
                  <button
                    key={i}
                    type="button"
                    onClick={() => playPiece(i)}
                    title={
                      p.kind === "word"
                        ? `Her recording of “${p.text}”`
                        : `Built from syllables: ${p.units.map((u) => u?.text ?? "∅").join(" · ")}`
                    }
                    className={cn("rounded-md border px-2 py-1 text-sm transition-shadow", PIECE_STYLE[pieceQuality(p)], playing !== null && active === i && "ring-2 ring-ring")}
                  >
                    {p.typed}
                    {p.text !== p.typed && <span className="ml-1 text-xs text-muted-foreground">{p.text}</span>}
                  </button>
                )
              )}
            </div>
            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                <span className="mr-1 inline-block size-2 rounded-sm bg-[#34d399]" />
                her own word ({counts.word ?? 0})
              </span>
              <span>
                <span className="mr-1 inline-block size-2 rounded-sm bg-[#fbbf24]" />
                built from her syllables ({counts.syllables ?? 0})
              </span>
              <span>
                <span className="mr-1 inline-block size-2 rounded-sm bg-[#f87171]" />
                a piece is missing ({counts.missing ?? 0})
              </span>
            </p>
          </section>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Natural</strong> splices her real recordings together: most like her, a little bumpy.{" "}
          <strong className="text-foreground">Smooth</strong> rebuilds them from the numbers with one even pitch line: smoother, more robotic.
          Words she said in the video sound best; the voicebank tab lets you fix any cut that sounds wrong.
        </p>
      </div>
    </div>
  )
}
