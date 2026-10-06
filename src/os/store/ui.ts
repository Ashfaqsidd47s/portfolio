import { create } from "zustand"

/** Short-lived OS state that should not survive a reload. */

export type Toast = {
  id: number
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

type UiState = {
  /** The boot sequence is on screen. */
  booting: boolean
  spotlightOpen: boolean
  aboutOpen: boolean
  screensaverOn: boolean
  toasts: Toast[]
  setBooting: (on: boolean) => void
  setSpotlightOpen: (on: boolean) => void
  setAboutOpen: (on: boolean) => void
  setScreensaverOn: (on: boolean) => void
  toast: (t: Omit<Toast, "id">, ms?: number) => void
  dismissToast: (id: number) => void
}

let nextToast = 1

export const useUi = create<UiState>()((set, get) => ({
  booting: false,
  spotlightOpen: false,
  aboutOpen: false,
  screensaverOn: false,
  toasts: [],
  setBooting: (booting) => set({ booting }),
  setSpotlightOpen: (spotlightOpen) => set({ spotlightOpen }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  setScreensaverOn: (screensaverOn) => set({ screensaverOn }),
  toast: (t, ms = 5000) => {
    const id = nextToast++
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }))
    window.setTimeout(() => get().dismissToast(id), ms)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
