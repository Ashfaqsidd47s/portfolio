import type { Voicebank } from "./dsp/voicebank"

/**
 * The voicebank lives in this browser (IndexedDB), never on a server: the
 * cut list plus the 16 kHz recording (as 16-bit samples) and its pitch
 * track, so "Speak" works after a reload without loading the files again.
 */

export type SavedVoice = {
  vb: Voicebank
  pcm: Int16Array
  f0: Float32Array
  conf: Float32Array
  savedAt: number
}

const DB = "studio"
const STORE = "voicebanks"
const KEY = "current"

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  }).finally(() => db.close())
}

export const saveVoice = (v: SavedVoice) => run<IDBValidKey>("readwrite", (s) => s.put(v, KEY)).catch(() => undefined)
export const loadVoice = () => run<SavedVoice | undefined>("readonly", (s) => s.get(KEY)).catch(() => undefined)
export const deleteVoice = () => run<undefined>("readwrite", (s) => s.delete(KEY)).catch(() => undefined)

export const toPcm = (x: Float32Array) => Int16Array.from(x, (v) => Math.round(Math.max(-1, Math.min(1, v)) * 32767))
export const fromPcm = (p: Int16Array) => Float32Array.from(p, (v) => v / 32768)
