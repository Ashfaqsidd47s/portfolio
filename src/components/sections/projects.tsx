import * as React from "react"
import { motion, useReducedMotion } from "motion/react"
import { ArrowUpRight } from "lucide-react"
import { Github } from "@/components/icons"
import { Section, SectionHeader } from "@/components/section"
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion-primitives"
import { Badge } from "@/components/ui/badge"
import { projects, sideProjects, type Project } from "@/data/profile"
import { cn } from "@/lib/utils"

/** Card lifts and reveals a soft spotlight that follows the pointer. */
function useSpotlight() {
  const ref = React.useRef<HTMLDivElement>(null)
  const onMove = React.useCallback((e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty("--mx", `${e.clientX - r.left}px`)
    el.style.setProperty("--my", `${e.clientY - r.top}px`)
  }, [])
  return { ref, onMove }
}

function FeaturedProject({ project, index }: { project: Project; index: number }) {
  const { ref, onMove } = useSpotlight()
  const reduced = useReducedMotion()

  return (
    <Reveal delay={index * 0.05}>
      <motion.article
        ref={ref}
        onMouseMove={onMove}
        whileHover={reduced ? undefined : { y: -3 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="group relative overflow-hidden rounded-xl border border-border bg-elevated p-6 transition-colors duration-300 hover:border-border-strong sm:p-8"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(420px circle at var(--mx) var(--my), color-mix(in oklch, var(--accent) 9%, transparent), transparent 65%)",
          }}
        />

        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-12">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="label-mono text-subtle-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {project.name}
              </h3>
              <Badge size="sm" variant={project.status === "Production" ? "accent" : "default"}>
                {project.status}
              </Badge>
            </div>

            <p className="mt-2 text-[0.9375rem] text-muted-foreground">
              {project.tagline}
              {project.context && (
                <span className="text-subtle-foreground"> · {project.context}</span>
              )}
            </p>

            <ul className="mt-6 flex flex-col gap-2.5">
              {project.highlights.map((h) => (
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
          </div>

          <div className="flex flex-col gap-5 lg:border-l lg:border-border lg:pl-8">
            <div>
              <p className="label-mono mb-3 text-subtle-foreground">Stack</p>
              <ul className="flex flex-wrap gap-1.5">
                {project.stack.map((t) => (
                  <li key={t}>
                    <Badge size="sm">{t}</Badge>
                  </li>
                ))}
              </ul>
            </div>

            {project.url && (
              <a
                href={project.url}
                target="_blank"
                rel="noreferrer"
                className="group/link inline-flex w-fit items-center gap-1.5 text-sm font-medium text-foreground"
              >
                <span className="link-underline">{project.urlLabel}</span>
                <ArrowUpRight className="size-4 transition-transform duration-300 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
              </a>
            )}
          </div>
        </div>
      </motion.article>
    </Reveal>
  )
}

function SideProject({ project }: { project: Project }) {
  const { ref, onMove } = useSpotlight()

  return (
    <StaggerItem className="h-full">
      <article
        ref={ref}
        onMouseMove={onMove}
        className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-elevated p-6 transition-all duration-300 hover:-translate-y-1 hover:border-border-strong"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(300px circle at var(--mx) var(--my), color-mix(in oklch, var(--accent) 8%, transparent), transparent 60%)",
          }}
        />
        <div className="relative flex flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold tracking-tight">
              {project.name}
            </h3>
            <Badge size="sm">{project.status}</Badge>
          </div>

          <p className="mt-1.5 text-[0.8125rem] text-subtle-foreground">
            {project.tagline}
          </p>

          <ul className="mt-4 flex flex-1 flex-col gap-2">
            {project.highlights.map((h) => (
              <li
                key={h}
                className="text-pretty text-[0.875rem] leading-relaxed text-muted-foreground"
              >
                {h}
              </li>
            ))}
          </ul>

          <ul className="mt-5 flex flex-wrap gap-1.5">
            {project.stack.map((t) => (
              <li key={t}>
                <Badge size="sm">{t}</Badge>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center gap-4 border-t border-border pt-4">
            {project.url && (
              <a
                href={project.url}
                target="_blank"
                rel="noreferrer"
                className="group/l inline-flex items-center gap-1 text-[0.8125rem] font-medium"
              >
                <span className="link-underline">Live</span>
                <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover/l:translate-x-0.5 group-hover/l:-translate-y-0.5" />
              </a>
            )}
            {project.repo && (
              <a
                href={project.repo}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Github className="size-3.5" />
                <span className="link-underline">Source</span>
              </a>
            )}
          </div>
        </div>
      </article>
    </StaggerItem>
  )
}

export function ProjectsSection() {
  return (
    <Section id="projects" className="border-t border-border">
      <SectionHeader
        index="02"
        eyebrow="Selected work"
        title="Products I've shipped"
        description="Platforms in production or active development, where I own significant parts of both the frontend architecture and the services behind them."
      />

      <div className="flex flex-col gap-5">
        {projects.map((p, i) => (
          <FeaturedProject key={p.name} project={p} index={i} />
        ))}
      </div>

      <Reveal className="mb-8 mt-20 flex items-center gap-3">
        <span className="label-mono text-accent">Open source & side projects</span>
        <span className="h-px flex-1 bg-border" />
        <a
          href="https://github.com/Ashfaqsidd47s"
          target="_blank"
          rel="noreferrer"
          className={cn(
            "group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          )}
        >
          <Github className="size-4" />
          <span className="link-underline">All repositories</span>
          <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>
      </Reveal>

      <StaggerGroup className="grid gap-4 sm:grid-cols-2">
        {sideProjects.map((p) => (
          <SideProject key={p.name} project={p} />
        ))}
      </StaggerGroup>
    </Section>
  )
}
