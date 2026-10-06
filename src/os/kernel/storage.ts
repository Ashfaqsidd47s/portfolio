import { createJSONStorage, type StateStorage } from "zustand/middleware"

/**
 * localStorage that never throws. Private windows, blocked site data and full
 * quotas all make storage calls throw; the OS should simply forget instead.
 */
const guarded: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value)
    } catch {
      /* non-fatal */
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name)
    } catch {
      /* non-fatal */
    }
  },
}

export const safeStorage = <T>() => createJSONStorage<T>(() => guarded)
