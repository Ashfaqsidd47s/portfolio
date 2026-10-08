/**
 * "Reset demo": an app with demo data registers how to put it back to its
 * seed, and the window's ↺ button (later Settings → "Reset all demos") calls it.
 */
const handlers = new Map<string, () => void>()

export function onReset(appId: string, reset: () => void) {
  handlers.set(appId, reset)
}

export function resetApp(appId: string) {
  handlers.get(appId)?.()
}
