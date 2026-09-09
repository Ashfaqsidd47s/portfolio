import { Download, Printer, ArrowLeft, Mail, Phone, MapPin, ArrowUpRight } from "lucide-react"
import { Github, Linkedin } from "@/components/icons"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Reveal } from "@/components/motion-primitives"
import { useDocumentMeta } from "@/hooks/use-document-meta"
import {
  profile,
  experience,
  projects,
  skills,
  education,
} from "@/data/profile"

function ResumeSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="print-section">
      <div className="mb-5 flex items-center gap-3">
        <h2 className="label-mono text-accent print:text-black">{title}</h2>
        <span className="h-px flex-1 bg-border print:bg-neutral-300" />
      </div>
      {children}
    </section>
  )
}

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="mt-3 flex flex-col gap-1.5">
      {items.map((h) => (
        <li
          key={h}
          className="relative pl-4 text-pretty text-[0.875rem] leading-relaxed text-muted-foreground print:text-neutral-800"
        >
          <span
            aria-hidden
            className="absolute left-0 top-[0.65em] size-[3px] rounded-full bg-border-strong print:bg-neutral-500"
          />
          {h}
        </li>
      ))}
    </ul>
  )
}

export default function Resume() {
  useDocumentMeta({
    title: "Résumé — Mohammad Ashfaq",
    description:
      "Résumé of Mohammad Ashfaq: full-stack developer with experience across React, Next.js, Go, Node.js, PostgreSQL and MCP server development.",
    path: "/resume",
  })

  return (
    <div className="mx-auto max-w-4xl px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
      {/* Toolbar — hidden when printing */}
      <Reveal className="print:hidden">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            to="/"
            className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
            <span className="link-underline">Back to portfolio</span>
          </Link>

          <div className="flex flex-wrap gap-2.5">
            <Button asChild>
              <a
                href={profile.resumeFile}
                download={profile.resumeFileName}
              >
                <Download /> Download PDF
              </a>
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> Print
            </Button>
          </div>
        </div>
      </Reveal>

      <article className="flex flex-col gap-12">
        {/* Header */}
        <Reveal>
          <header className="border-b border-border pb-8 print:border-neutral-300">
            <h1 className="display text-4xl sm:text-5xl">{profile.name}</h1>
            <p className="mt-3 text-[0.9375rem] font-medium text-accent print:text-black">
              {profile.role}
            </p>

            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[0.8125rem] text-muted-foreground print:text-neutral-700">
              <li className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {profile.location}
              </li>
              <li>
                <a
                  href={`tel:${profile.phone.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <Phone className="size-3.5" /> {profile.phone}
                </a>
              </li>
              <li>
                <a
                  href={profile.socials.email}
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <Mail className="size-3.5" />
                  <span className="link-underline">{profile.email}</span>
                </a>
              </li>
              <li>
                <a
                  href={profile.socials.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <Linkedin className="size-3.5" />
                  <span className="link-underline">in/ashfaqsidd47</span>
                </a>
              </li>
              <li>
                <a
                  href={profile.socials.github}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                >
                  <Github className="size-3.5" />
                  <span className="link-underline">Ashfaqsidd47s</span>
                </a>
              </li>
            </ul>

            <p className="mt-6 max-w-3xl text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground print:text-neutral-800">
              {profile.summary}
            </p>
          </header>
        </Reveal>

        {/* Skills */}
        <Reveal delay={0.04}>
          <ResumeSection title="Skills">
            <dl className="flex flex-col gap-3.5">
              {skills.map((group) => (
                <div
                  key={group.label}
                  className="grid gap-1.5 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-4"
                >
                  <dt className="text-[0.8125rem] font-semibold">
                    {group.label}
                  </dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {group.items.map((s) => (
                      <Badge key={s} size="sm">
                        {s}
                      </Badge>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </ResumeSection>
        </Reveal>

        {/* Experience */}
        <Reveal delay={0.04}>
          <ResumeSection title="Experience">
            <ol className="flex flex-col gap-8">
              {experience.map((job) => (
                <li key={job.company}>
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                    <h3 className="text-[1.0625rem] font-semibold tracking-tight">
                      {job.role}
                    </h3>
                    <span className="label-mono shrink-0 text-subtle-foreground print:text-neutral-600">
                      {job.period}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                    <p className="flex flex-wrap items-center gap-x-2 text-[0.875rem] font-medium text-accent print:text-black">
                      <span>{job.company}</span>
                      {job.url && (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[0.75rem] font-normal text-subtle-foreground transition-colors hover:text-foreground print:text-neutral-600"
                        >
                          <span className="link-underline">{job.urlLabel}</span>
                        </a>
                      )}
                    </p>
                    <span className="text-[0.8125rem] text-subtle-foreground print:text-neutral-600">
                      {job.location}
                    </span>
                  </div>
                  <Bullets items={job.highlights} />
                  <p className="mt-3 font-mono text-[0.75rem] italic text-subtle-foreground print:text-neutral-600">
                    {job.stack.join(" · ")}
                  </p>
                </li>
              ))}
            </ol>
          </ResumeSection>
        </Reveal>

        {/* Projects */}
        <Reveal delay={0.04}>
          <ResumeSection title="Projects">
            <ol className="flex flex-col gap-8">
              {projects.map((p) => (
                <li key={p.name}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h3 className="text-[1.0625rem] font-semibold tracking-tight">
                      {p.name}
                    </h3>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group inline-flex items-center gap-1 font-mono text-[0.75rem] text-accent print:text-neutral-700"
                      >
                        <span className="link-underline">{p.urlLabel}</span>
                        <ArrowUpRight className="size-3 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 print:hidden" />
                      </a>
                    )}
                    <span className="text-[0.875rem] text-muted-foreground print:text-neutral-700">
                      — {p.tagline}
                      {p.context && (
                        <span className="text-subtle-foreground print:text-neutral-600">
                          {" "}· {p.context}
                        </span>
                      )}
                    </span>
                  </div>
                  <Bullets items={p.highlights} />
                  <p className="mt-3 font-mono text-[0.75rem] italic text-subtle-foreground print:text-neutral-600">
                    {p.stack.join(" · ")}
                  </p>
                </li>
              ))}
            </ol>
          </ResumeSection>
        </Reveal>

        {/* Education */}
        <Reveal delay={0.04}>
          <ResumeSection title="Education">
            <ul className="flex flex-col gap-4">
              {education.map((e) => (
                <li
                  key={e.degree}
                  className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                >
                  <div>
                    <h3 className="text-[0.9375rem] font-semibold tracking-tight">
                      {e.degree}
                    </h3>
                    <p className="mt-0.5 text-[0.875rem] text-muted-foreground print:text-neutral-700">
                      {e.institution}
                      {e.detail && (
                        <span className="text-subtle-foreground print:text-neutral-600">
                          {" "}· {e.detail}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="label-mono shrink-0 text-subtle-foreground print:text-neutral-600">
                    {e.period}
                  </span>
                </li>
              ))}
            </ul>
          </ResumeSection>
        </Reveal>

        {/* Footer CTA — screen only */}
        <Reveal delay={0.04} className="print:hidden">
          <div className="flex flex-col items-start gap-4 rounded-xl border border-border bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[0.9375rem] font-medium">
                Want a copy for your records?
              </p>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">
                Download the original one-page PDF, ready to attach.
              </p>
            </div>
            <Button asChild>
              <a href={profile.resumeFile} download={profile.resumeFileName}>
                <Download /> Download PDF
              </a>
            </Button>
          </div>
        </Reveal>
      </article>
    </div>
  )
}
