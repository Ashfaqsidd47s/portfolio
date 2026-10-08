import { analyze, type Analysis } from "./dsp/analyze"

export type WorkerReply = { type: "progress"; p: number } | { type: "done"; analysis: Analysis }

// The analysis is a few seconds of number crunching: keep it off the UI thread.
const ctx = self as unknown as Worker
ctx.onmessage = (e: MessageEvent<Float32Array>) => {
  const analysis = analyze(e.data, (p) => ctx.postMessage({ type: "progress", p } satisfies WorkerReply))
  ctx.postMessage({ type: "done", analysis } satisfies WorkerReply, [
    analysis.db.buffer,
    analysis.f0.buffer,
    analysis.conf.buffer,
    analysis.spec.buffer,
  ])
}
