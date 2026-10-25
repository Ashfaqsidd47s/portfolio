import * as React from "react"
import type Lenis from "lenis"
import type { Category } from "./catalogue"

export type View =
  | { name: "home" }
  | { name: "lots"; category?: Category }
  | { name: "lot"; id: string }
  | { name: "account"; tab?: "bids" | "watch" }

export type Shell = {
  view: View
  go: (view: View) => void
  back: () => void
  /** Opens sign-in; `then` runs once the visitor is signed in. */
  requireAccount: (then?: () => void, mode?: "in" | "up") => void
  /** Opens the bid review for a lot at an amount. */
  reviewBid: (lotId: string, amount: number, max?: number) => void
  scroller: React.RefObject<HTMLDivElement | null>
  lenis: React.RefObject<Lenis | null>
  /** The app's own height in px: a window, a phone, or the journey. */
  height: number
  width: number
  visible: boolean
  reduced: boolean
}

export const ShellContext = React.createContext<Shell | null>(null)

export function useShell() {
  const shell = React.useContext(ShellContext)
  if (!shell) throw new Error("useShell outside 11bits")
  return shell
}
