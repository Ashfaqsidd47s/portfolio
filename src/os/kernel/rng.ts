/**
 * Seeded randomness for demo data, so every visitor sees the same believable
 * bookings, names and prices — and a screenshot today matches one tomorrow.
 */
export function createRng(seed: number) {
  let a = seed >>> 0
  // mulberry32
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)],
    chance: (p: number) => next() < p,
  }
}

export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
