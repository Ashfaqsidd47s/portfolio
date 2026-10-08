import type { WorkerReply } from "./analysis.worker"
import { SR, type Analysis } from "./dsp/analyze"

let audioCtx: AudioContext | null = null
export const ctx = () => (audioCtx ??= new AudioContext())

export type Loaded = { name: string; original: AudioBuffer; mono: Float32Array }

/** Decode any audio (or video) file, plus a 16 kHz mono copy for analysis. */
export async function decode(file: File): Promise<Loaded> {
  const original = await ctx().decodeAudioData(await file.arrayBuffer())
  const offline = new OfflineAudioContext(1, Math.ceil(original.duration * SR), SR)
  const src = offline.createBufferSource()
  src.buffer = original
  src.connect(offline.destination)
  src.start()
  const rendered = await offline.startRendering()
  return { name: file.name, original, mono: rendered.getChannelData(0) }
}

export function analyseInWorker(mono: Float32Array, onProgress: (p: number) => void): Promise<Analysis> {
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

/**
 * One sound at a time for the whole Studio: starting a new one stops the
 * last. Returns a stop function; `onEnd` fires when it finishes or is stopped.
 */
let current: { node: AudioBufferSourceNode; onEnd?: () => void } | null = null

export function stopAudio() {
  if (!current) return
  const { node, onEnd } = current
  current = null
  node.onended = null
  try {
    node.stop()
  } catch {
    /* already stopped */
  }
  onEnd?.()
}

export function playSamples(samples: Float32Array, { sampleRate = SR, offset = 0, duration, onEnd }: { sampleRate?: number; offset?: number; duration?: number; onEnd?: () => void } = {}) {
  const buf = ctx().createBuffer(1, Math.max(1, samples.length), sampleRate)
  buf.getChannelData(0).set(samples)
  return playBuffer(buf, { offset, duration, onEnd })
}

export function playBuffer(buffer: AudioBuffer, { offset = 0, duration, onEnd }: { offset?: number; duration?: number; onEnd?: () => void } = {}) {
  stopAudio()
  const ac = ctx()
  void ac.resume()
  const node = ac.createBufferSource()
  node.buffer = buffer
  node.connect(ac.destination)
  node.start(0, offset, duration)
  const entry = { node, onEnd }
  current = entry
  node.onended = () => {
    if (current === entry) current = null
    onEnd?.()
  }
  return { startedAt: ac.currentTime }
}
