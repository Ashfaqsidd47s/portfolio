import { Link } from "react-router-dom"
import { ExternalLink, Hammer } from "lucide-react"
import { Github } from "@/components/icons"
import { AppIcon } from "@/os/app-icon"
import { findProject, getApp, type AppProps } from "@/os/registry/apps"

/** Projects whose playable demo already runs inside Journey.exe. */
const IN_JOURNEY = new Set(["suregem", "11jobs", "11matrix"])

/**
 * Stand-in for a project whose working demo hasn't been built yet: what it
 * is, what I did on it, the stack, and where to see the real thing.
 */
export default function ProjectInfo({ appId }: AppProps) {
  const app = getApp(appId)!
  const project = findProject(app.project)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header className="flex items-start gap-4">
        <AppIcon app={app} className="size-14" />
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">{app.name}</h2>
          <p className="text-sm text-muted-foreground">{project?.tagline ?? app.description}</p>
          {project && (
            <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
              <span>{project.status}</span>
              {project.context && <span>· {project.context}</span>}
            </p>
          )}
        </div>
      </header>

      <div className="flex items-start gap-3 rounded-lg border border-dashed border-border-strong bg-surface p-3 text-sm">
        <Hammer className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <p className="text-muted-foreground">
          A working demo of {app.name} is on its way to this window.
          {IN_JOURNEY.has(appId) && (
            <>
              {" "}
              Until then you can play with it in{" "}
              <Link to="/journey" className="font-medium text-foreground underline underline-offset-2">
                Journey.exe
              </Link>
              .
            </>
          )}
        </p>
      </div>

      {project && (
        <>
          <section>
            <h3 className="label-mono text-muted-foreground">What I built</h3>
            <ul className="mt-2 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed">
              {project.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="label-mono text-muted-foreground">Stack</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {project.stack.map((s) => (
                <li key={s} className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs">
                  {s}
                </li>
              ))}
            </ul>
          </section>
          <div className="flex flex-wrap gap-2">
            {project.url && (
              <a
                href={project.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <ExternalLink className="size-3.5" aria-hidden /> {project.urlLabel ?? "Live site"}
              </a>
            )}
            {project.repo && (
              <a
                href={project.repo}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                <Github className="size-3.5" aria-hidden /> Source
              </a>
            )}
          </div>
        </>
      )}
    </div>
  )
}
