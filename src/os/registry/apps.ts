import type { ComponentType } from "react"
import {
  AudioLines,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  FileText,
  Gamepad2,
  Gem,
  Grid3x3,
  Joystick,
  Plane,
  ShieldCheck,
  UserRound,
  Wind,
  type LucideIcon,
} from "lucide-react"
import { projects, sideProjects, type Project } from "@/data/profile"
import { appsMeta, type AppMeta } from "./apps-meta"

/** What every app component receives from the shell it runs in. */
export type AppProps = {
  appId: string
  /** Running full-screen on the phone OS rather than in a desktop window. */
  isPhone: boolean
  /** The window is on top (always true on the phone). */
  isFocused: boolean
  /**
   * The window can be seen: not minimised, not mostly covered by other
   * windows, tab in view. Apps pause timers and animations when false.
   */
  isVisible: boolean
}

type AppModule = { default: ComponentType<AppProps> }

export type AppDef = AppMeta & {
  icon: LucideIcon
  /** Two stops of the icon tile's gradient. */
  tint: [string, string]
  /** Lazy loader, so each app is its own chunk. Absent for `href` apps. */
  load?: () => Promise<AppModule>
  liveUrl?: string
  repo?: string
}

const projectInfo = () => import("@/apps/project-info")

const extras: Record<string, Pick<AppDef, "icon" | "tint" | "load">> = {
  trypnow: { icon: Plane, tint: ["#2dd4bf", "#0f766e"], load: () => import("@/apps/trypnow") },
  suregem: { icon: Gem, tint: ["#7dd3fc", "#4338ca"], load: projectInfo },
  "11jobs": { icon: BriefcaseBusiness, tint: ["#c4b5fd", "#7c3aed"], load: projectInfo },
  "11matrix": { icon: ChartNoAxesCombined, tint: ["#fdba74", "#ea580c"], load: projectInfo },
  fujin: { icon: Wind, tint: ["#a5f3fc", "#0e7490"], load: projectInfo },
  "bingo-master": { icon: Grid3x3, tint: ["#f9a8d4", "#db2777"], load: projectInfo },
  "gaming-era": { icon: Gamepad2, tint: ["#a78bfa", "#4c1d95"], load: projectInfo },
  "file-scanner": { icon: ShieldCheck, tint: ["#86efac", "#15803d"], load: projectInfo },
  studio: { icon: AudioLines, tint: ["#f0abfc", "#7e22ce"], load: () => import("@/apps/studio") },
  about: { icon: UserRound, tint: ["#fcd34d", "#d97706"], load: () => import("@/apps/about") },
  resume: { icon: FileText, tint: ["#cbd5e1", "#475569"] },
  journey: { icon: Joystick, tint: ["#ff4d8d", "#17153a"] },
}

const allProjects: Project[] = [...projects, ...sideProjects]

export const findProject = (name?: string) => allProjects.find((p) => p.name === name)

export const apps: AppDef[] = appsMeta.map((meta) => {
  const project = findProject(meta.project)
  return { ...meta, ...extras[meta.id], liveUrl: project?.url, repo: project?.repo }
})

const byId = new Map(apps.map((a) => [a.id, a]))

export const getApp = (id: string | undefined) => (id ? byId.get(id) : undefined)
