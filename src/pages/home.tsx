// Pixel fonts are self-hosted and only pulled in by the journey.
import "@fontsource/press-start-2p/latin.css"
import "@fontsource/vt323/latin.css"
import "@fontsource/pixelify-sans/latin-400.css"
import "@fontsource/pixelify-sans/latin-600.css"
import { useDocumentMeta } from "@/hooks/use-document-meta"
import { Hud } from "@/components/journey/hud"
import { CompanionProvider } from "@/components/journey/companion"
import { SceneIntro } from "@/components/journey/scene-intro"
import { StageHelloWorld } from "@/components/journey/stage-hello-world"
import { StageSnake } from "@/components/journey/stage-snake"
import { StageAndroid } from "@/components/journey/stage-android"
import { StageFullStack, StageWeb } from "@/components/journey/stage-web"
import { StageInternship } from "@/components/journey/stage-internship"
import { StageAiEra, StageBoss, StageFreelance } from "@/components/journey/stage-boss"
import { StageContinue, StageFirstJob, StageMatrix } from "@/components/journey/stage-job"
import { StageElevenJobs, StageSureGem, StageTrypNow } from "@/components/journey/stage-apps"

export default function Home() {
  useDocumentMeta({
    title: "Mohammad Ashfaq — Full-Stack Developer",
    description:
      "A scroll-through game of my developer journey: from Turbo C++ in 2018 to running live demos of TrypNow, SureGem, 11jobs and 11Matrix today.",
    path: "/",
  })

  return (
    <CompanionProvider>
      <div className="pixel-world">
        <Hud />
        <SceneIntro />
        <StageHelloWorld />
        <StageSnake />
        <StageAndroid />
        <StageWeb />
        <StageFullStack />
        <StageInternship />
        <StageAiEra />
        <StageBoss />
        <StageTrypNow />
        <StageFreelance />
        <StageFirstJob />
        <StageSureGem />
        <StageElevenJobs />
        <StageMatrix />
        <StageContinue />
      </div>
    </CompanionProvider>
  )
}
