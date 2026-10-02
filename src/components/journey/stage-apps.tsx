import { Badge } from "@/components/ui/8bit/badge"
import { projects } from "@/data/profile"
import { ElevenJobsApp } from "./app-11jobs"
import { SureGemApp } from "./app-suregem"
import { TrypNowApp } from "./app-trypnow"
import { Achievement, Dialogue, Sfx, Stage, StageTitle } from "./primitives"

function Stack({ name }: { name: string }) {
  const p = projects.find((x) => x.name === name)
  if (!p) return null
  return (
    <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-4 px-4">
      {p.stack.map((s) => (
        <Badge key={s} variant="secondary" className="text-[0.5rem] text-cream">
          {s}
        </Badge>
      ))}
    </div>
  )
}

export function StageTrypNow() {
  return (
    <Stage id="trypnow" className="overflow-clip bg-[#0c2423] pb-28">
      <StageTitle id="trypnow" kicker="Meanwhile, the actual product: B2B travel for DMCs." />
      <Dialogue speaker="ASHFAQ · 2025" tone="green" className="px-4">
        I ran the supplier side: hotels, attractions, packages, 30+ data tables. The fun bits: drag-and-drop package building, and an AI that turns one sentence into a ten-field form.
      </Dialogue>
      <Stack name="TrypNow" />
      <div className="mt-14 px-4">
        <TrypNowApp />
      </div>
    </Stage>
  )
}

export function StageSureGem() {
  return (
    <Stage id="suregem" className="overflow-clip bg-[#0d1530] pb-28">
      <StageTitle id="suregem" kicker="B2B diamonds. Buy, sell, filter by every C known to humanity." />
      <div className="relative">
        <Sfx className="right-[8%] -top-6 hidden text-6xl text-px-cyan md:block">キラッ</Sfx>
        <Dialogue speaker="QUEST 2 · OWNED" tone="cyan" className="px-4">
          A Nivoda-style marketplace. Mostly frontend, fully owned: I set the project structure everyone follows. Go on, find yourself a diamond.
        </Dialogue>
      </div>
      <Stack name="SureGem" />
      <div className="mt-14 px-4">
        <SureGemApp />
      </div>
    </Stage>
  )
}

export function StageElevenJobs() {
  return (
    <Stage id="eleven-jobs" className="overflow-clip bg-[#150f2e] pb-28">
      <StageTitle id="eleven-jobs" kicker="Hiring workflows on autopilot. Rounds, sections, questions, done." />
      <Dialogue speaker="QUEST 3 · FRONT + BACK" tone="pink" className="px-4">
        Recruiters build assessment workflows, candidates take them, proctoring watches. My favourite part: I built the entire MCP server. One sentence in, whole job out. Zero clicks.
      </Dialogue>
      <Stack name="11Jobs" />
      <div className="mt-14 px-4">
        <ElevenJobsApp />
      </div>
      <Achievement className="mt-14" title="Clicks saved: all of them" detail="create_job → add_round → add_section → add_question, by chat" />
    </Stage>
  )
}
