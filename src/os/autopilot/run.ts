/**
 * The playlist runner, kept free of the DOM so it can be unit-tested. Each
 * tour is an async function that must stop when its AbortSignal fires.
 */

export type Tour<C> = { id: string; name: string; run: (ctx: C) => Promise<void> }

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError"

/** Rejects with an AbortError as soon as `signal` fires. */
export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason)
    signal.addEventListener("abort", onAbort, { once: true })
    promise.then(
      (v) => {
        signal.removeEventListener("abort", onAbort)
        resolve(v)
      },
      (e) => {
        signal.removeEventListener("abort", onAbort)
        reject(e)
      }
    )
  })
}

export function sleep(ms: number, signal: AbortSignal) {
  return abortable(new Promise<void>((r) => setTimeout(r, ms)), signal)
}

/**
 * Play `tours` from `start`, looping forever until `signal` aborts. A tour
 * that fails (a target that never appeared, say) is skipped rather than
 * stopping the show. `onTour` hears about each tour as it starts, so the
 * caller can remember where to resume; `between` runs after each full loop.
 */
export async function runPlaylist<C>(
  tours: Tour<C>[],
  ctx: C,
  {
    signal,
    start = 0,
    onTour,
    onError,
    between,
  }: {
    signal: AbortSignal
    start?: number
    onTour?: (index: number, tour: Tour<C>) => void
    onError?: (tour: Tour<C>, error: unknown) => void
    between?: () => Promise<void>
  }
): Promise<void> {
  if (tours.length === 0) return
  let i = ((start % tours.length) + tours.length) % tours.length
  for (;;) {
    signal.throwIfAborted()
    const tour = tours[i]
    onTour?.(i, tour)
    try {
      await tour.run(ctx)
    } catch (e) {
      if (signal.aborted || isAbort(e)) throw signal.reason ?? e
      onError?.(tour, e)
    }
    signal.throwIfAborted()
    i = (i + 1) % tours.length
    if (i === 0 && between) await between()
  }
}

/** A point on the quadratic Bézier from `a` to `b` bent through `c`, at `t` ∈ [0, 1]. */
export function bezier(a: { x: number; y: number }, c: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  const u = 1 - t
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }
}

/**
 * How long a human takes to point at a target: Fitts's law (longer for far,
 * small targets), clamped to something that reads well on screen.
 */
export function moveDuration(distance: number, targetWidth: number) {
  const id = Math.log2(1 + distance / Math.max(targetWidth, 8))
  return Math.min(1200, Math.max(280, 220 + 170 * id))
}
