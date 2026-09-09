import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react"
import { Github, Linkedin } from "@/components/icons"
import { Link } from "react-router-dom"
import { Section } from "@/components/section"
import { Reveal, MaskedWords } from "@/components/motion-primitives"
import { Button } from "@/components/ui/button"
import { profile } from "@/data/profile"

const channels = [
  {
    label: "Email",
    value: profile.email,
    href: profile.socials.email,
    icon: Mail,
  },
  {
    label: "Phone",
    value: profile.phone,
    href: `tel:${profile.phone.replace(/\s/g, "")}`,
    icon: Phone,
  },
  {
    label: "GitHub",
    value: "Ashfaqsidd47s",
    href: profile.socials.github,
    icon: Github,
  },
  {
    label: "LinkedIn",
    value: "in/ashfaqsidd47",
    href: profile.socials.linkedin,
    icon: Linkedin,
  },
]

export function ContactSection() {
  return (
    <Section id="contact" className="border-t border-border">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          <Reveal>
            <div className="flex items-center gap-3">
              <span className="label-mono text-subtle-foreground">04</span>
              <span className="label-mono text-accent">Contact</span>
            </div>
          </Reveal>

          <h2 className="display mt-5 text-[clamp(2rem,6vw,3.5rem)]">
            <MaskedWords text="Let's build" delay={0} />
            <br />
            <MaskedWords text="something good." delay={0.08} />
          </h2>

          <Reveal delay={0.15}>
            <p className="mt-6 max-w-md text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground">
              I'm open to full-stack and AI-product roles, and interesting
              freelance work. The fastest way to reach me is email — I reply to
              everything.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href={profile.socials.email}>
                  <Mail /> {profile.email}
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/resume">View résumé</Link>
              </Button>
            </div>

            <p className="mt-8 inline-flex items-center gap-2 text-sm text-subtle-foreground">
              <MapPin className="size-4" /> {profile.location}
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="lg:pt-16">
          <ul className="flex flex-col divide-y divide-border border-y border-border">
            {channels.map(({ label, value, href, icon: Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target={
                    href.startsWith("http") ? "_blank" : undefined
                  }
                  rel="noreferrer"
                  className="group flex items-center justify-between gap-4 py-5 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="size-4 text-subtle-foreground transition-colors group-hover:text-accent" />
                    <span className="label-mono text-subtle-foreground">
                      {label}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-[0.9375rem] text-muted-foreground transition-colors group-hover:text-foreground">
                    <span className="link-underline">{value}</span>
                    <ArrowUpRight className="size-4 shrink-0 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-70" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  )
}
