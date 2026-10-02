// Pixel fonts are self-hosted and only pulled in by the journey.
import "@fontsource/press-start-2p/latin.css"
import "@fontsource/vt323/latin.css"
import "@fontsource/pixelify-sans/latin-400.css"
import "@fontsource/pixelify-sans/latin-600.css"
import { useDocumentMeta } from "@/hooks/use-document-meta"
import { Hud } from "@/components/journey/hud"
import { SceneIntro } from "@/components/journey/scene-intro"
import { StageHelloWorld } from "@/components/journey/stage-hello-world"
import { StageSnake } from "@/components/journey/stage-snake"
import { StageAndroid, StageSavePoint } from "@/components/journey/stage-save-android"
import { StageFullStack, StageWeb } from "@/components/journey/stage-web"
import { StageInternship } from "@/components/journey/stage-internship"
import { StageAiEra, StageBoss, StageFreelance } from "@/components/journey/stage-boss"
import { StageContinue, StageFirstJob, StageMatrix } from "@/components/journey/stage-job"

export default function Home() {
  useDocumentMeta({
    title: "Mohammad Ashfaq — Full-Stack Developer",
    description:
      "A scroll-through game of my developer journey: from Turbo C++ and a love calculator in 2018 to owning 11Matrix, a multi-store commerce platform, today.",
    path: "/",
  })

  return (
    <div className="pixel-world">
      <Hud />
      <SceneIntro />
      <StageHelloWorld />
      <StageSnake />
      <StageSavePoint />
      <StageAndroid />
      <StageWeb />
      <StageFullStack />
      <StageInternship />
      <StageAiEra />
      <StageBoss />
      <StageFreelance />
      <StageFirstJob />
      <StageMatrix />
      <StageContinue />
    </div>
  )
}
