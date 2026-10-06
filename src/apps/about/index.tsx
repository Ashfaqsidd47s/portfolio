import { Download, Mail, MapPin } from "lucide-react"
import { Github, Linkedin } from "@/components/icons"
import { profile, skills } from "@/data/profile"

export default function About() {
  const links = [
    { href: profile.socials.email, label: profile.email, Icon: Mail },
    { href: profile.socials.github, label: "GitHub", Icon: Github },
    { href: profile.socials.linkedin, label: "LinkedIn", Icon: Linkedin },
  ]

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <header className="flex items-center gap-4">
        <span
          aria-hidden
          className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#fcd34d] to-[#d97706] text-xl font-bold text-white shadow-sm"
        >
          MA
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">{profile.name}</h2>
          <p className="text-sm text-muted-foreground">{profile.role}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" aria-hidden /> {profile.location}
            </span>
            {profile.available && (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-accent" aria-hidden /> {profile.availableLabel}
              </span>
            )}
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-3 text-sm leading-relaxed">
        {profile.about.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </section>

      <section>
        <h3 className="label-mono text-muted-foreground">Toolbox</h3>
        <dl className="mt-2 flex flex-col gap-2">
          {skills.map((g) => (
            <div key={g.label} className="grid gap-1 text-sm @md:grid-cols-[7rem_1fr]">
              <dt className="text-muted-foreground">{g.label}</dt>
              <dd>{g.items.join(", ")}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-wrap gap-2">
        {links.map(({ href, label, Icon }) => (
          <a
            key={label}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Icon className="size-3.5" aria-hidden /> {label}
          </a>
        ))}
        <a
          href={profile.resumeFile}
          download={profile.resumeFileName}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
        >
          <Download className="size-3.5" aria-hidden /> Résumé (PDF)
        </a>
      </section>
    </div>
  )
}
