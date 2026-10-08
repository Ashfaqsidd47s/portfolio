import { describe, expect, it } from "vitest"
import { bezier, moveDuration, runPlaylist, sleep, type Tour } from "./run"

const tour = (id: string, log: string[], body?: (signal: AbortSignal) => Promise<void>): Tour<AbortSignal> => ({
  id,
  name: id,
  run: async (signal) => {
    log.push(id)
    await body?.(signal)
  },
})

describe("runPlaylist", () => {
  it("plays in order from the start index, loops, and stops on abort", async () => {
    const log: string[] = []
    const ctl = new AbortController()
    const tours = [tour("a", log), tour("b", log), tour("c", log, async () => void (log.length >= 5 && ctl.abort()))]
    let loops = 0
    await expect(
      runPlaylist(tours, ctl.signal, { signal: ctl.signal, start: 1, between: async () => void loops++ })
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(log).toEqual(["b", "c", "a", "b", "c"])
    expect(loops).toBe(1)
  })

  it("aborting mid-step rejects straight away (hand-over)", async () => {
    const log: string[] = []
    const ctl = new AbortController()
    const started = Date.now()
    const run = runPlaylist([tour("slow", log, (s) => sleep(10_000, s))], ctl.signal, { signal: ctl.signal })
    setTimeout(() => ctl.abort(), 20)
    await expect(run).rejects.toMatchObject({ name: "AbortError" })
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it("skips a tour that fails and reports it", async () => {
    const log: string[] = []
    const errors: string[] = []
    const ctl = new AbortController()
    const tours = [
      tour("broken", log, async () => {
        throw new Error("no target")
      }),
      tour("fine", log, async () => ctl.abort()),
    ]
    await expect(
      runPlaylist(tours, ctl.signal, { signal: ctl.signal, onError: (t) => errors.push(t.id) })
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(log).toEqual(["broken", "fine"])
    expect(errors).toEqual(["broken"])
  })

  it("resumes where it was told to", async () => {
    const seen: number[] = []
    const ctl = new AbortController()
    const tours = [tour("a", []), tour("b", []), tour("c", [])]
    await expect(
      runPlaylist(tours, ctl.signal, {
        signal: ctl.signal,
        start: 2,
        onTour: (i) => {
          seen.push(i)
          if (seen.length === 2) ctl.abort()
        },
      })
    ).rejects.toBeDefined()
    expect(seen).toEqual([2, 0])
  })
})

describe("cursor path", () => {
  it("starts and ends on the endpoints", () => {
    const a = { x: 0, y: 0 }
    const b = { x: 100, y: 50 }
    expect(bezier(a, { x: 80, y: -40 }, b, 0)).toEqual(a)
    expect(bezier(a, { x: 80, y: -40 }, b, 1)).toEqual(b)
  })

  it("takes longer for far, small targets", () => {
    expect(moveDuration(1000, 16)).toBeGreaterThan(moveDuration(100, 16))
    expect(moveDuration(500, 16)).toBeGreaterThan(moveDuration(500, 200))
    expect(moveDuration(0, 50)).toBeGreaterThanOrEqual(280)
  })
})
