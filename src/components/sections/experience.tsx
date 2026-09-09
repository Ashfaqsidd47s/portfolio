import { motion, useScroll, useTransform, useReducedMotion } from "motion/react"
import { useRef } from "react"
import { ArrowUpRight } from "lucide-react"
import { Section, SectionHeader } from "@/components/section"
import { Reveal } from "@/components/motion-primitives"
import { Badge } from "@/components/ui/badge"
import { experience } from "@/data/profile"

export function ExperienceSection() {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 75%", "end 60%"],
  })
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <Section id="work">
      <SectionHeader
        index="01"
        eyebrow="Experience"
        title="Where I've been building"
        description="Three roles across product engineering — from an options trading platform, to a travel-booking marketplace, to owning production apps end-to-end."
      />

      <div ref={ref} className="relative">
        {/* Progress rail — draws itself as the section scrolls past. */}
        <div className="absolute left-0 top-2 hidden h-full w-px bg-border sm:block">
          <motion.div
            className="h-full w-px origin-top bg-foreground"
            style={reduced ? { scaleY: 1 } : { scaleY: lineScale }}
          />
        </div>

        <ol className="flex flex-col gap-12 sm:gap-16 sm:pl-10">
          {experience.map((job, i) => (
            <Reveal as="li" key={job.company} delay={i * 0.06} className="relative">
              <span
                aria-hidden
                className="absolute -left-10 top-2 hidden size-[9px] -translate-x-[4px] rounded-full border-2 border-background bg-foreground sm:block"
              />

              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h3 className="text-xl font-semibold tracking-tight sm:text-[1.375rem]">
                    {job.role}
                  </h3>
                  {job.current && (
                    <Badge variant="accent" size="sm">
                      Current
                    </Badge>
                  )}
                </div>
                <p className="label-mono shrink-0 text-subtle-foreground">
                  {job.period}
                </p>
              </div>

              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[0.9375rem] font-medium text-accent">
                <span>{job.company}</span>
                <span className="font-normal text-subtle-foreground">
                  · {job.location}
                </span>
                {job.url && (
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group/job inline-flex items-center gap-1 font-normal text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span className="text-subtle-foreground">·</span>
                    <span className="link-underline">{job.urlLabel}</span>
                    <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover/job:translate-x-0.5 group-hover/job:-translate-y-0.5" />
                  </a>
                )}
              </p>

              <p className="mt-4 max-w-2xl text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground">
                {job.summary}
              </p>

              <ul className="mt-5 flex max-w-2xl flex-col gap-2.5">
                {job.highlights.map((h) => (
                  <li
                    key={h}
                    className="relative pl-5 text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground"
                  >
                    <span
                      aria-hidden
                      className="absolute left-0 top-[0.6875em] size-1 rounded-full bg-border-strong"
                    />
                    {h}
                  </li>
                ))}
              </ul>

              <ul className="mt-6 flex flex-wrap gap-1.5">
                {job.stack.map((t) => (
                  <li key={t}>
                    <Badge size="sm">{t}</Badge>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </ol>
      </div>
    </Section>
  )
}
