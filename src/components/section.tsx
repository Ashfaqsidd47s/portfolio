import { Reveal } from "@/components/motion-primitives"
import { cn } from "@/lib/utils"

export function Section({
  id,
  children,
  className,
}: {
  id?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      className={cn(
        "mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28",
        className
      )}
    >
      {children}
    </section>
  )
}

export function SectionHeader({
  index,
  eyebrow,
  title,
  description,
  className,
}: {
  index?: string
  eyebrow: string
  title: string
  description?: string
  className?: string
}) {
  return (
    <Reveal className={cn("mb-12 sm:mb-16", className)}>
      <div className="flex items-center gap-3">
        {index && (
          <span className="label-mono text-subtle-foreground">{index}</span>
        )}
        <span className="label-mono text-accent">{eyebrow}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <h2 className="display mt-5 max-w-2xl text-3xl sm:text-4xl">{title}</h2>
      {description && (
        <p className="mt-4 max-w-xl text-pretty text-[0.9375rem] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </Reveal>
  )
}
