import { Link } from "react-router-dom"
import { Mail, ArrowUpRight } from "lucide-react"
import { Github, Linkedin } from "@/components/icons"
import { profile } from "@/data/profile"
import { Reveal } from "@/components/motion-primitives"

const links = [
  { href: profile.socials.github, label: "GitHub", icon: Github },
  { href: profile.socials.linkedin, label: "LinkedIn", icon: Linkedin },
  { href: profile.socials.email, label: "Email", icon: Mail },
]

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <Reveal className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="label-mono text-subtle-foreground">
              {profile.location}
            </p>
            <p className="mt-3 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
              Designed and built from scratch — React, TypeScript, Tailwind CSS
              and Motion.
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:items-end">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {links.map(({ href, label, icon: Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target={href.startsWith("mailto") ? undefined : "_blank"}
                    rel="noreferrer"
                    className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Icon className="size-4" />
                    <span className="link-underline">{label}</span>
                    <ArrowUpRight className="size-3 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-60" />
                  </a>
                </li>
              ))}
              <li>
                <Link
                  to="/resume"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="link-underline">Résumé</span>
                </Link>
              </li>
            </ul>
            <p className="text-xs text-subtle-foreground">
              © {new Date().getFullYear()} {profile.name}
            </p>
          </div>
        </Reveal>
      </div>
    </footer>
  )
}
