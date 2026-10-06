import * as React from "react"
import { motion, useReducedMotion } from "motion/react"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTrypNow, type Listing } from "./data"

const DEFAULT_PROMPT =
  "Desert safari in Dubai. 6 hours, dune bashing, camel ride, BBQ dinner. Hotel pickup at 3pm. AED 180 per adult, AED 140 per child. Free cancellation up to 24h before."

/** Rough rates into the inventory's USD, so a saved listing prices sensibly. */
const TO_USD: Record<string, number> = { AED: 1 / 3.67, USD: 1, $: 1, INR: 1 / 83, "₹": 1 / 83, EUR: 1.08 }

/**
 * The "one prompt → whole listing" generator. The real product calls an LLM;
 * the demo parses the prompt with rules, so editing the text really does
 * change what comes out.
 */
export function extract(prompt: string) {
  const sentences = prompt.split(/\.\s+/)
  const title = (sentences[0] ?? "New attraction").replace(/\.$/, "")
  const city = prompt.match(/\bin ([A-Z][a-zA-Z]+)/)?.[1] ?? "—"
  const duration = prompt.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/i)?.[1]
  const pickup = prompt.match(/pick-?up[^.]*?(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i)?.[1]
  const currency = prompt.match(/\b(AED|USD|INR|EUR)\b|\$|₹/)?.[0] ?? "AED"
  const adult = prompt.match(/(\d+)\s*(?:per\s+)?adult/i)?.[1]
  const child = prompt.match(/(\d+)\s*(?:per\s+)?(?:child|kid)/i)?.[1]
  const cancel = prompt.match(/free cancell?ation[^.]*/i)?.[0]
  const inclusions = (sentences.find((s) => /,/.test(s) && !/pickup|adult|child/i.test(s)) ?? "")
    .split(/,\s*/)
    .filter((x) => x && !/^\d+\s*(hours?|hrs?|h)$/i.test(x.trim()))
    .map((x) => x.trim().replace(/\.$/, ""))
  const category = /safari|desert|dune|skydiv|zipline/i.test(prompt)
    ? "Adventure"
    : /museum|heritage|tour/i.test(prompt)
      ? "Culture"
      : /cruise|dhow|boat|yacht/i.test(prompt)
        ? "Cruise"
        : "Experience"
  const emoji = { Adventure: "🐪", Culture: "🏛️", Cruise: "⛵", Experience: "🎟️" }[category]

  const fields = [
    { label: "Title", value: title.charAt(0).toUpperCase() + title.slice(1) },
    { label: "City", value: city },
    { label: "Category", value: category },
    { label: "Duration", value: duration ? `${duration} hours` : "—" },
    { label: "Pickup", value: pickup ? `Hotel pickup · ${pickup}` : "—" },
    { label: "Inclusions", value: inclusions.length ? inclusions.join(" · ") : "—" },
    { label: "Adult price", value: adult ? `${currency} ${adult}` : "—" },
    { label: "Child price", value: child ? `${currency} ${child}` : "—" },
    { label: "Cancellation", value: cancel ?? "Non-refundable" },
    {
      label: "Description",
      value: `${duration ? `${duration}-hour ` : ""}${title.charAt(0).toLowerCase() + title.slice(1)}${
        inclusions.length ? ` with ${inclusions.slice(0, 3).join(", ")}` : ""
      }.${pickup ? ` Pickup from your hotel at ${pickup}.` : ""}`,
    },
  ]

  const listing: Omit<Listing, "id"> = {
    kind: "attraction",
    name: fields[0].value,
    meta: `${duration ? `${duration}h` : "flexible"} · adult`,
    price: adult ? Math.max(1, Math.round(Number(adult) * (TO_USD[currency] ?? 1))) : 0,
    emoji,
    ai: true,
  }

  return { fields, listing }
}

const EMPTY = extract("").fields.map((f) => ({ label: f.label, value: "" }))

export function AiListing({ onSaved }: { onSaved?: (listing: Listing) => void }) {
  const reduced = useReducedMotion()
  const addListing = useTrypNow((s) => s.addListing)
  const [prompt, setPrompt] = React.useState(DEFAULT_PROMPT)
  const [result, setResult] = React.useState<ReturnType<typeof extract> | null>(null)
  const [filled, setFilled] = React.useState(0)
  const [saved, setSaved] = React.useState(false)
  const fields = result?.fields
  const busy = !!fields && filled < fields.length

  React.useEffect(() => {
    if (!fields || filled >= fields.length) return
    const id = window.setTimeout(() => setFilled((n) => n + 1), reduced ? 0 : filled === 0 ? 600 : 220)
    return () => window.clearTimeout(id)
  }, [fields, filled, reduced])

  return (
    <div className="@container">
      <div className="grid grid-cols-[minmax(0,1fr)] @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col gap-3 border-b border-tn-line bg-tn-ink p-4 text-white @3xl:border-b-0 @3xl:border-r">
          <p className="flex items-center gap-1.5 text-sm font-bold">
            <Sparkles className="size-4 text-tn-accent" aria-hidden /> Describe it like a human
          </p>
          <label className="sr-only" htmlFor="trypnow-prompt">
            Attraction description
          </label>
          <textarea
            id="trypnow-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={7}
            data-tour="tn-ai-prompt"
            className="w-full resize-none rounded-md bg-white/10 p-3 text-sm leading-relaxed outline-none focus:bg-white/15"
          />
          <button
            type="button"
            disabled={busy || !prompt.trim()}
            data-tour="tn-ai-generate"
            onClick={() => {
              setFilled(0)
              setSaved(false)
              setResult(extract(prompt))
            }}
            className="rounded-md bg-tn-accent px-4 py-2 text-sm font-bold text-tn-ink hover:brightness-105 disabled:opacity-50"
          >
            {busy ? "Generating…" : "Generate listing"}
          </button>
          <p className="text-xs text-white/70">One prompt in. Ten fields out. Your wrist says thanks.</p>
        </div>
        <div className="@container flex flex-col gap-3 p-4">
          <div className="grid gap-2 @lg:grid-cols-2">
            {(fields ?? EMPTY).map((f, i) => {
              const done = !!fields && i < filled
              return (
                <div key={f.label} className={cn(f.label === "Description" || f.label === "Inclusions" ? "@lg:col-span-2" : "")}>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-tn-muted">{f.label}</p>
                  <motion.div
                    className={cn(
                      "mt-0.5 min-h-9 rounded-md border px-2 py-1.5 text-sm",
                      done ? "border-tn-teal bg-tn-soft text-tn-ink" : "border-tn-line bg-white text-tn-faint"
                    )}
                    animate={done && !reduced ? { backgroundColor: ["#c9f5ec", "#f1f8f7"] } : undefined}
                    transition={{ duration: 0.6 }}
                  >
                    {done ? f.value : fields && i === filled ? <span className="animate-pulse">▍</span> : "…"}
                  </motion.div>
                </div>
              )
            })}
          </div>
          {onSaved && result && !busy && (
            <div className="flex items-center justify-end gap-3">
              {result.listing.price === 0 && <p className="text-xs text-tn-muted">Add an adult price to save it.</p>}
              <button
                type="button"
                disabled={saved || result.listing.price === 0}
                data-tour="tn-ai-save"
                onClick={() => {
                  const listing = addListing(result.listing)
                  setSaved(true)
                  onSaved(listing)
                }}
                className="rounded-md bg-tn-teal px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d6961] disabled:opacity-40"
              >
                {saved ? "Saved to inventory ✓" : "Save to inventory"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
