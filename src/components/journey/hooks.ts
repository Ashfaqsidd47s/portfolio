import * as React from "react"
import { useMotionValue, useReducedMotion, useScroll, type MotionValue } from "motion/react"

export const EASE = [0.16, 1, 0.3, 1] as const

/**
 * Scroll progress (0 → 1) through a tall pinned section. Under reduced motion
 * it is pinned at 1, so every scrubbed scene renders in its finished state.
 */
export function useSceneProgress(
  ref: React.RefObject<HTMLElement | null>,
  offset: NonNullable<Parameters<typeof useScroll>[0]>["offset"] = ["start start", "end end"]
): MotionValue<number> {
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset })
  const done = useMotionValue(1)
  return reduced ? done : scrollYProgress
}

/**
 * Linear map of `v` from [a, b] to [c, d], clamped. Use it as a function
 * transform (`useTransform(mv, (v) => ramp(v, …))`) for opacity: Motion would
 * otherwise hand a range-mapped scroll value to a native scroll timeline,
 * which measures pinned sections differently.
 */
export function ramp(v: number, [a, b]: [number, number], [c, d]: [number, number]) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return c + (d - c) * t
}

/** Mirrors a motion value into React state, rounded to `steps` buckets. */
export function useSteppedValue(value: MotionValue<number>, steps = 100) {
  const [v, setV] = React.useState(() => Math.round(value.get() * steps) / steps)
  React.useEffect(
    () => value.on("change", (latest) => setV(Math.round(latest * steps) / steps)),
    [value, steps]
  )
  return v
}

/** Reveals `text` a character at a time once `start` turns true. */
export function useTypewriter(text: string, start: boolean, cps = 45) {
  const reduced = useReducedMotion()
  const [count, setCount] = React.useState(0)

  React.useEffect(() => {
    if (!start || reduced) return
    const id = window.setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          window.clearInterval(id)
          return c
        }
        return c + 1
      })
    }, 1000 / cps)
    return () => window.clearInterval(id)
  }, [start, reduced, text, cps])

  if (reduced) return { shown: text, done: true }
  return { shown: text.slice(0, count), done: count >= text.length }
}
