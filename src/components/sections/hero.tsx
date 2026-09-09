import { motion, useReducedMotion } from "motion/react"
import { ArrowDown, Mail, FileText } from "lucide-react"
import { Github, Linkedin } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { MaskedWords, EASE } from "@/components/motion-primitives"
import { profile } from "@/data/profile"
import { Link } from "react-router-dom"

const socials = [
  { href: profile.socials.github, label: "GitHub", icon: Github },
  { href: profile.socials.linkedin, label: "LinkedIn", icon: Linkedin },
  { href: profile.socials.email, label: "Email", icon: Mail },
]

export function Hero() {
  const reduced = useReducedMotion()

  const fade = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.8, delay, ease: EASE },
        }

  return (
    <section className="noise relative isolate overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] grid-backdrop opacity-[0.55]"
      />

      <div className="mx-auto flex min-h-[92svh] max-w-6xl flex-col justify-center px-5 pb-20 pt-32 sm:px-8 sm:pb-28 sm:pt-36">
        <motion.div {...fade(0.15)} className="flex items-center gap-2.5">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-accent" />
          </span>
          <span className="label-mono text-muted-foreground">
            {profile.availableLabel}
          </span>
        </motion.div>

        <h1 className="display mt-7 max-w-4xl text-[clamp(2.5rem,8.5vw,5.25rem)]">
          <MaskedWords text="I build AI-native," delay={0.2} />
          <br />
          <MaskedWords text="real-time web products." delay={0.34} />
        </h1>

        <motion.p
          {...fade(0.72)}
          className="mt-8 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-[1.0625rem]"
        >
          Full-stack developer in {profile.location}, working across{" "}
          <strong className="font-medium text-foreground">Next.js / React</strong>{" "}
          frontends and{" "}
          <strong className="font-medium text-foreground">Go / Node</strong>{" "}
          backends. Currently shipping an AI hiring platform with an MCP-based
          chatbot and a multi-store commerce analytics OS — owning frontend
          architecture, backend services, and AI feature integration end-to-end.
        </motion.p>

        <motion.div
          {...fade(0.82)}
          className="mt-10 flex flex-wrap items-center gap-3"
        >
          <Button asChild size="lg">
            <a href="#work">
              View my work <ArrowDown className="transition-transform duration-300 group-hover:translate-y-0.5" />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/resume">
              <FileText /> Résumé
            </Link>
          </Button>

          <div className="ml-1 flex items-center gap-1">
            {socials.map(({ href, label, icon: Icon }) => (
              <Button
                key={label}
                asChild
                variant="ghost"
                size="icon"
                aria-label={label}
              >
                <a
                  href={href}
                  target={href.startsWith("mailto") ? undefined : "_blank"}
                  rel="noreferrer"
                >
                  <Icon />
                </a>
              </Button>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
