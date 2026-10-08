import * as React from "react"
import { AudioLines, FileAudio, FileText, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AppProps } from "@/os/registry/apps"
import { AnalyseView } from "./analyse-view"
import { analyseInWorker, decode, stopAudio, type Loaded } from "./audio"
import { classifyRegions, voiceStats, type Analysis } from "./dsp/analyze"
import { parseCaptions, type Cue } from "./dsp/captions"
import { buildVoicebank, type Voicebank } from "./dsp/voicebank"
import { deleteVoice, fromPcm, loadVoice, saveVoice, toPcm } from "./storage"
import { SpeakView, VoicebankView, type VoiceState } from "./voice-view"

type Tab = "analyse" | "voicebank" | "speak"

function DropZone({ onFiles, busy }: { onFiles: (files: FileList) => void; busy: string | null }) {
  return (
    <div className="grid flex-1 place-items-center p-6">
      <label
        className="flex w-full max-w-lg cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border-strong bg-surface p-8 text-center hover:border-ring"
        data-tour="studio-drop"
      >
        <AudioLines className="size-10 text-accent" aria-hidden />
        <p className="text-base font-semibold">{busy ?? "Drop a recording and its captions"}</p>
        <p className="text-sm text-muted-foreground">
          Audio or video (mp3, m4a, wav, mp4) plus an optional <code>.srt</code> / <code>.vtt</code>. YouTube auto-captions work as they
          are.
        </p>
        <span className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Choose files</span>
        <input type="file" multiple accept="audio/*,video/*,.srt,.vtt" className="sr-only" onChange={(e) => e.target.files && onFiles(e.target.files)} />
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" aria-hidden /> Everything stays in this browser. Nothing is uploaded.
        </p>
      </label>
    </div>
  )
}

/**
 * Voice Studio: analyse a recording, cut it into a voicebank, then type
 * anything and hear it in that voice. No backend and no AI sound model —
 * just signal processing in the browser.
 */
export default function Studio({ isVisible }: AppProps) {
  const [tab, setTab] = React.useState<Tab>("analyse")
  const [audio, setAudio] = React.useState<Loaded | null>(null)
  const [cues, setCues] = React.useState<{ name: string; cues: Cue[] } | null>(null)
  const [analysis, setAnalysis] = React.useState<Analysis | null>(null)
  const [voice, setVoice] = React.useState<VoiceState | null>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [dragging, setDragging] = React.useState(false)

  const regions = React.useMemo(() => (analysis ? classifyRegions(analysis, cues?.cues) : []), [analysis, cues])
  const stats = React.useMemo(() => (analysis ? voiceStats(analysis, regions) : null), [analysis, regions])

  // A voicebank saved earlier in this browser: Speak works straight away.
  React.useEffect(() => {
    let live = true
    void loadVoice().then((saved) => {
      if (!live || !saved) return
      setVoice({ vb: saved.vb, voice: { mono: fromPcm(saved.pcm), f0: saved.f0, conf: saved.conf, pitch: saved.vb.pitch } })
      setTab((t) => (t === "analyse" ? "speak" : t))
    })
    return () => {
      live = false
    }
  }, [])

  React.useEffect(() => {
    if (!isVisible) stopAudio()
  }, [isVisible])

  const loadFiles = async (files: FileList | File[]) => {
    setError(null)
    const list = [...files]
    const captionFile = list.find((f) => /\.(srt|vtt)$/i.test(f.name))
    const audioFile = list.find((f) => !/\.(srt|vtt)$/i.test(f.name))
    if (captionFile) setCues({ name: captionFile.name, cues: parseCaptions(await captionFile.text()) })
    if (!audioFile) return
    try {
      stopAudio()
      setBusy(`Decoding ${audioFile.name}…`)
      const loaded = await decode(audioFile)
      setAnalysis(null)
      setAudio(loaded)
      setBusy("Analysing… 0%")
      const a = await analyseInWorker(loaded.mono, (p) => setBusy(`Analysing… ${Math.round(p * 100)}%`))
      setAnalysis(a)
      setTab("analyse")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file")
    } finally {
      setBusy(null)
    }
  }

  const persist = (state: VoiceState) => {
    setVoice(state)
    void saveVoice({ vb: state.vb, pcm: toPcm(state.voice.mono), f0: state.voice.f0, conf: state.voice.conf, savedAt: Date.now() })
  }

  const build = () => {
    if (!audio || !analysis || !cues) return
    const vb = buildVoicebank(analysis, regions, cues.cues, audio.name)
    persist({ vb, voice: { mono: audio.mono, f0: analysis.f0, conf: analysis.conf, pitch: vb.pitch } })
  }

  const onChange = (vb: Voicebank) => voice && persist({ ...voice, vb })

  const buildHint = !audio
    ? "Load the recording first (Analyse tab)."
    : !cues
      ? "Load its captions too: they say which words are where."
      : !analysis
        ? "Analysing…"
        : `${audio.name} · ${cues.cues.length} captions`

  const TABS: { id: Tab; label: string }[] = [
    { id: "analyse", label: "Analyse" },
    { id: "voicebank", label: "Voicebank" },
    { id: "speak", label: "Speak" },
  ]

  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-background text-foreground"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        if (e.dataTransfer.files.length) void loadFiles(e.dataTransfer.files)
      }}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <AudioLines className="size-4 text-accent" aria-hidden /> Voice Studio
        </p>
        <div role="tablist" aria-label="Studio" className="ml-2 flex rounded-lg bg-muted p-0.5 text-xs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              data-tour={`studio-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn("rounded-md px-3 py-1 font-medium", tab === t.id ? "bg-elevated shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {t.label}
            </button>
          ))}
        </div>
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

      {tab === "analyse" &&
        (audio && analysis && stats ? (
          <AnalyseView key={audio.name} audio={audio} analysis={analysis} regions={regions} stats={stats} cues={cues?.cues ?? []} isVisible={isVisible} />
        ) : (
          <DropZone onFiles={(f) => void loadFiles(f)} busy={busy} />
        ))}
      {tab === "voicebank" && (
        <VoicebankView
          state={voice}
          canBuild={!!(audio && analysis && cues)}
          buildHint={buildHint}
          onBuild={build}
          onChange={onChange}
          onDelete={() => {
            stopAudio()
            setVoice(null)
            void deleteVoice()
          }}
        />
      )}
      {tab === "speak" && <SpeakView state={voice} onOpenVoicebank={() => setTab("voicebank")} />}

      {dragging && (
        <div className="pointer-events-none absolute inset-2 grid place-items-center rounded-xl border-2 border-dashed border-ring bg-background/80 text-sm font-medium">
          Drop audio and captions
        </div>
      )}
    </div>
  )
}
