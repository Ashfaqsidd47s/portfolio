import { Section, SectionHeader } from "@/components/section"
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion-primitives"
import { Badge } from "@/components/ui/badge"
import { profile, skills, focusAreas, education } from "@/data/profile"

export function AboutSection() {
  return (
    <Section id="about" className="border-t border-border">
      <SectionHeader
        index="03"
        eyebrow="About"
        title="A bit about how I work"
      />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          <Reveal>
            <div className="flex flex-col gap-5">
              {profile.about.map((p) => (
                <p
                  key={p}
                  className="text-pretty text-[0.9375rem] leading-[1.75] text-muted-foreground sm:text-base"
                >
                  {p}
                </p>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.08} className="mt-12">
            <p className="label-mono mb-5 text-subtle-foreground">
              What I focus on
            </p>
            <StaggerGroup className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
              {focusAreas.map((f) => (
                <StaggerItem key={f.title} className="bg-background">
                  <div className="h-full p-5">
                    <h3 className="text-[0.9375rem] font-semibold tracking-tight">
                      {f.title}
                    </h3>
                    <p className="mt-2 text-pretty text-[0.8125rem] leading-relaxed text-muted-foreground">
                      {f.body}
                    </p>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </Reveal>
        </div>

        <div className="flex flex-col gap-12">
          <Reveal delay={0.06}>
            <p className="label-mono mb-5 text-subtle-foreground">Toolkit</p>
            <dl className="flex flex-col gap-6">
              {skills.map((group) => (
                <div key={group.label}>
                  <dt className="mb-2.5 text-[0.8125rem] font-medium text-foreground">
                    {group.label}
                  </dt>
                  <dd>
                    <ul className="flex flex-wrap gap-1.5">
                      {group.items.map((s) => (
                        <li key={s}>
                          <Badge size="sm">{s}</Badge>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="label-mono mb-5 text-subtle-foreground">Education</p>
            <ul className="flex flex-col divide-y divide-border border-y border-border">
              {education.map((e) => (
                <li key={e.degree} className="py-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-[0.9375rem] font-medium tracking-tight">
                      {e.degree}
                    </h3>
                    <span className="label-mono shrink-0 text-subtle-foreground">
                      {e.period}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                    {e.institution}
                    {e.detail && (
                      <span className="text-subtle-foreground"> · {e.detail}</span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </Section>
  )
}
