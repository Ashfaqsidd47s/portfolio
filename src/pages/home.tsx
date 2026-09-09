import { useDocumentMeta } from "@/hooks/use-document-meta"
import { Hero } from "@/components/sections/hero"
import { ExperienceSection } from "@/components/sections/experience"
import { ProjectsSection } from "@/components/sections/projects"
import { AboutSection } from "@/components/sections/about"
import { ContactSection } from "@/components/sections/contact"

export default function Home() {
  useDocumentMeta({
    title: "Mohammad Ashfaq — Full-Stack Developer",
    description:
      "Full-stack developer in Dehradun, India building AI-native, real-time web products on Next.js/React and Go/Node backends.",
    path: "/",
  })

  return (
    <>
      <Hero />
      <ExperienceSection />
      <ProjectsSection />
      <AboutSection />
      <ContactSection />
    </>
  )
}
