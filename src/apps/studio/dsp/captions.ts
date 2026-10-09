/**
 * Captions from YouTube (.srt, .vtt or .json3). YouTube's auto-captions come
 * as "rolling" cues: lots of 10 ms empty fillers and some end times written
 * as NaN. Those are cleaned up here: empty cues are dropped and a broken
 * end time becomes the next cue's start.
 *
 * The .vtt and .json3 versions of auto-captions also carry a timestamp for
 * every word (the .srt download drops them). When present they're kept in
 * `words`, and the voicebank cuts straight from them.
 */

export type TimedWord = { text: string; start: number; end: number }

export type Cue = {
  start: number
  end: number
  text: string
  /** [Music], [संगीत], [Applause]… */
  sound: boolean
  /** Per-word timing, when the caption file has it. */
  words?: TimedWord[]
}

/** Longest a word is assumed to last when the next word is far away (a pause follows). */
const MAX_WORD = 1.2

/** Give every word an end (the next word's start, capped) and group them back into lines. */
function linesFromWords(lines: { start: number; end: number; words: { text: string; start: number }[] }[]): Cue[] {
  const all = lines.flatMap((l) => l.words).sort((a, b) => a.start - b.start)
  const ends = new Map<object, number>()
  const ms = (t: number) => Math.round(t * 1000) / 1000
  all.forEach((w, i) => ends.set(w, ms(Math.min(all[i + 1]?.start ?? w.start + MAX_WORD, w.start + MAX_WORD))))
  return lines
    .filter((l) => l.words.length)
    .map((l) => {
      const words = l.words.map((w) => ({ text: w.text, start: ms(w.start), end: ends.get(w)! }))
      const text = words.map((w) => w.text).join(" ")
      return { start: l.start, end: Math.max(l.end, words[words.length - 1].end), text, sound: /^\[.*\]$/.test(text), words }
    })
    .sort((a, b) => a.start - b.start)
}

/** YouTube json3: events with word segments and per-word offsets. */
function parseJson3(raw: string): Cue[] | null {
  let data: { events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string; tOffsetMs?: number }[] }[] }
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!Array.isArray(data.events)) return null
  const lines = data.events
    .filter((e) => e.segs && e.tStartMs !== undefined)
    .map((e) => ({
      start: e.tStartMs! / 1000,
      end: (e.tStartMs! + (e.dDurationMs ?? 0)) / 1000,
      words: e
        .segs!.map((s) => ({ text: (s.utf8 ?? "").trim(), start: (e.tStartMs! + (s.tOffsetMs ?? 0)) / 1000 }))
        .filter((w) => w.text && w.text !== "\n"),
    }))
  return linesFromWords(lines)
}

const INLINE = /<(\d{2}:\d{2}:\d{2}\.\d{3})><c>([^<]*)<\/c>/g

/** YouTube auto-caption WebVTT: "first<00:00:01.760><c> second</c><00:00:02.080><c> third</c>". */
function parseTimedVtt(raw: string): Cue[] | null {
  if (!/<\d{2}:\d{2}:\d{2}\.\d{3}><c>/.test(raw)) return null
  const lines: { start: number; end: number; words: { text: string; start: number }[] }[] = []
  // Cue by cue from each "-->" header: YouTube puts lines holding a single
  // space inside cues, so blank-line splitting would cut them in half.
  const rows = raw.replace(/\r/g, "").split("\n")
  const headers = rows.flatMap((r, i) => (r.includes("-->") ? [i] : []))
  for (const [n, at] of headers.entries()) {
    const body = rows.slice(at + 1, headers[n + 1] ?? rows.length)
    const [a, b] = rows[at].split("-->")
    const start = seconds(a)
    const end = seconds(b)
    // Only the row with inline timestamps is new; the other row repeats the previous line.
    const timed = body.find((r) => r.includes("<c>"))
    if (!timed || !Number.isFinite(start)) continue
    const words: { text: string; start: number }[] = []
    const first = timed.split("<")[0].trim()
    if (first) words.push({ text: first, start })
    for (const m of timed.matchAll(INLINE)) {
      const text = m[2].trim()
      if (text) words.push({ text, start: seconds(m[1]) })
    }
    lines.push({ start, end: Number.isFinite(end) ? end : start, words })
  }
  return linesFromWords(lines)
}

const TIME = /(?:(\d+):)?(\d{1,2}):(\d{2})[.,](\d{1,3})/

function seconds(t: string): number {
  const m = TIME.exec(t)
  if (!m) return NaN
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, "0")) / 1000
}

export function parseCaptions(raw: string): Cue[] {
  const timed = raw.trimStart().startsWith("{") ? parseJson3(raw) : parseTimedVtt(raw)
  if (timed) return timed
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
