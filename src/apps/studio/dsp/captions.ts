/**
 * Captions from YouTube (.srt or .vtt). YouTube's auto-captions come as
 * "rolling" cues: lots of 10 ms empty fillers and some end times written
 * as NaN. Those are cleaned up here: empty cues are dropped and a broken
 * end time becomes the next cue's start.
 */

export type Cue = { start: number; end: number; text: string; /** [Music], [संगीत], [Applause]… */ sound: boolean }

const TIME = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/

function seconds(t: string): number {
  const m = TIME.exec(t)
  if (!m) return NaN
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0")) / 1000
}

export function parseCaptions(raw: string): Cue[] {
  const blocks = raw.replace(/\r/g, "").split(/\n\s*\n/)
  const out: { start: number; end: number; text: string }[] = []
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim())
    const at = lines.findIndex((l) => l.includes("-->"))
    if (at === -1) continue
    const [a, b] = lines[at].split("-->")
    const start = seconds(a)
    if (!Number.isFinite(start)) continue
    const text = lines
      .slice(at + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
    out.push({ start, end: seconds(b), text })
  }
  out.sort((x, y) => x.start - y.start)
  const cues: Cue[] = []
  for (let i = 0; i < out.length; i++) {
    const c = out[i]
    if (!c.text) continue
    const next = out.slice(i + 1).find((n) => n.start > c.start)
    const end = Number.isFinite(c.end) && c.end > c.start ? c.end : (next?.start ?? c.start + 2)
    cues.push({ start: c.start, end, text: c.text, sound: /^\[.*\]$/.test(c.text) })
  }
  return cues
}
