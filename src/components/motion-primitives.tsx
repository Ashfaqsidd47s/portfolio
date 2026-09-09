import * as React from "react"
import { motion, useReducedMotion, type Variants } from "motion/react"
import { cn } from "@/lib/utils"

const EASE = [0.16, 1, 0.3, 1] as const

/** Fades and lifts children into view once, as they enter the viewport. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
  as = "div",
  amount = 0.35,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
  as?: "div" | "section" | "li" | "span" | "article"
  amount?: number
}) {
  const reduced = useReducedMotion()
  const Comp = motion[as]

  return (
    <Comp
      className={className}
      initial={reduced ? undefined : { opacity: 0, y }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount, margin: "0px 0px -60px 0px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </Comp>
  )
}

/** Parent that staggers its Reveal-like children. */
const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
}

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
}

export function StaggerGroup({
  children,
  className,
  amount = 0.2,
}: {
  children: React.ReactNode
  className?: string
  amount?: number
}) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div className={className} variants={staggerChild}>
      {children}
    </motion.div>
  )
}

/**
 * Splits a line into words and animates each one up from behind a mask.
 * Used for the hero headline only — expensive, and loses its impact if repeated.
 */
export function MaskedWords({
  text,
  className,
  delay = 0,
  wordClassName,
}: {
  text: string
  className?: string
  delay?: number
  wordClassName?: string
}) {
  const reduced = useReducedMotion()
  const words = text.split(" ")

  if (reduced) return <span className={className}>{text}</span>

  return (
    <span className={cn("inline", className)}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em]"
        >
          <motion.span
            className={cn("inline-block", wordClassName)}
            initial={{ y: "110%" }}
            animate={{ y: 0 }}
            transition={{
              duration: 0.95,
              delay: delay + i * 0.055,
              ease: EASE,
            }}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  )
}

export { EASE }
