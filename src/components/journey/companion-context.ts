import * as React from "react"

export type Tone = "pink" | "cyan" | "yellow" | "green"
export type Line = { speaker: string; text: string; tone?: Tone }

export const CompanionContext = React.createContext<(line: Line) => void>(() => {})

/** Hand a line of narration to the companion. */
export function useSay() {
  return React.useContext(CompanionContext)
}
