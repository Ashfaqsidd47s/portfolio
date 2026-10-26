import { create } from "zustand"
import { persist } from "zustand/middleware"
import { onReset } from "@/os/kernel/reset"
import { createRng } from "@/os/kernel/rng"
import { safeStorage } from "@/os/kernel/storage"
import {
  YOU,
  bidAsRival,
  bidAsYou,
  currentBid,
  increment,
  isOpen,
  leader,
  nextMinimum,
  outcome,
  type BidEvent,
  type LotState,
} from "./auction"
import { LOTS, getLot, type CatalogueLot } from "./catalogue"

/**
 * 11bids' in-browser auction house: the live state of every lot, the room
 * of other bidders, and the visitor's account, bids and watchlist. Seeded,
 * so everyone opens on the same sale, then persisted per visitor.
 */

export type Account = { name: string; email: string }

type StoredAccount = Account & { key: string }

export type Toast = {
  id: number
  tone: "good" | "bad" | "info"
  title: string
  body?: string
  lotId?: string
}

/** Who else is in the room. */
const PADDLES = [
  ["0417", "Geneva"],
  ["1288", "Hong Kong"],
  ["0093", "New York"],
  ["2351", "London"],
  ["0716", "Dubai"],
  ["1904", "Singapore"],
  ["0582", "Monaco"],
  ["3127", "Tokyo"],
  ["0240", "Paris"],
  ["1765", "Milan"],
  ["0861", "Los Angeles"],
  ["2008", "Zürich"],
] as const

export const bidderLabel = (id: string) => {
  if (id === YOU) return "You"
  const p = PADDLES.find(([n]) => `p${n}` === id)
  return p ? `Paddle ${p[0]}` : "Online bidder"
}

export const bidderCity = (id: string) => PADDLES.find(([n]) => `p${n}` === id)?.[1]

const HOUR = 3_600_000

/**
 * How high the room will go on a lot right now. It warms up as the close
 * nears, so prices climb through the sale instead of all at once, and the
 * last minutes still have somewhere to go.
 */
function ceilingFor(lot: CatalogueLot, left: number) {
  const floor = lot.estimate[0] * 0.85
  const top = lot.estimate[1] * lot.appetite
  const warmth = 1 / (1 + Math.max(0, left) / (20 * 60_000))
  return floor + (top - floor) * warmth
}

/** A fresh sale of one lot: its close, and the bids already on the book. */
function list(lot: CatalogueLot, opensAt: number, seed: number): LotState {
  const rng = createRng(seed + lot.number * 7919)
  const endsAt = opensAt + lot.closesAfter
  let state: LotState = { id: lot.id, startPrice: lot.startPrice, reserve: lot.reserve, endsAt, bids: [] }
  // The book so far climbs to somewhere around the low estimate.
  const target = lot.estimate[0] * (0.72 + rng.next() * 0.3)
  const span = Math.min(3 * 24 * HOUR, lot.closesAfter * 6 + 6 * HOUR)
  const times = Array.from({ length: lot.openingBids }, () => opensAt - rng.next() * span).sort((a, b) => a - b)
  let last = ""
  for (const at of times) {
    if (nextMinimum(state) > target && state.bids.length > 2) break
    let paddle = rng.pick(PADDLES)[0]
    while (`p${paddle}` === last) paddle = rng.pick(PADDLES)[0]
    last = `p${paddle}`
    let amount = nextMinimum(state)
    if (rng.chance(0.2)) amount += increment(amount)
    const result = bidAsRival(state, last, amount, Math.min(at, endsAt - 1))
    if (result.ok) state = result.lot
  }
  return state
}

function seedSale(now: number, seed = 11) {
  return Object.fromEntries(LOTS.map((lot) => [lot.id, list(lot, now, seed)]))
}

/** Tiny one-way hash: demo accounts live in this browser only, never sent anywhere. */
function keyOf(email: string, password: string) {
  let h = 2166136261
  for (const ch of `${email.toLowerCase()}:${password}:11bids`) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

type State = {
  lots: Record<string, LotState>
  account: Account | null
  accounts: StoredAccount[]
  watch: string[]
  /** Lots whose close the visitor has already been told about. */
  settled: string[]
  toasts: Toast[]

  bid: (lotId: string, amount: number, max?: number) => { ok: true } | { ok: false; error: string }
  /** One beat of the room: maybe someone bids, maybe a lot closes. */
  tick: (now: number) => void
  /** Puts lots that closed long ago back up, so the sale never runs dry. */
  relist: (now: number) => void
  signUp: (name: string, email: string, password: string) => string | null
  signIn: (email: string, password: string) => string | null
  signOut: () => void
  toggleWatch: (lotId: string) => void
  dismiss: (id: number) => void
  reset: () => void
}

let toastId = 0
const rng = createRng(Date.now() % 100_000)

export const useAuction = create<State>()(
  persist(
    (set, get) => {
      const toast = (t: Omit<Toast, "id">) => {
        const id = ++toastId
        set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }))
        window.setTimeout(() => get().dismiss(id), 6500)
      }

      const announce = (lotId: string, events: BidEvent[]) => {
        const lot = getLot(lotId)
        if (!lot) return
        for (const e of events) {
          if (e.type === "outbid") {
            toast({ tone: "bad", title: "You've been outbid", body: `${lot.maker} ${lot.title} is at ${money(e.amount)}.`, lotId })
          } else if (e.type === "auto") {
            toast({ tone: "info", title: "Your maximum bid answered", body: `You lead ${lot.title} at ${money(e.amount)}.`, lotId })
          } else if (e.type === "extended") {
            toast({ tone: "info", title: "Closing extended", body: `A late bid on ${lot.title} added time to the clock.`, lotId })
          }
        }
      }

      return {
        lots: seedSale(Date.now()),
        account: null,
        accounts: [],
        watch: [],
        settled: [],
        toasts: [],

        bid: (lotId, amount, max) => {
          const state = get().lots[lotId]
          if (!state) return { ok: false, error: "This lot is no longer available." }
          if (!get().account) return { ok: false, error: "Sign in to bid." }
          const result = bidAsYou(state, amount, Date.now(), max)
          if (!result.ok) return result
          set((s) => ({
            lots: { ...s.lots, [lotId]: result.lot },
            watch: s.watch.includes(lotId) ? s.watch : [...s.watch, lotId],
          }))
          announce(lotId, result.events.filter((e) => e.type === "extended"))
          return { ok: true }
        },

        tick: (now) => {
          const { lots, settled, account } = get()
          const live = LOTS.filter((l) => lots[l.id] && isOpen(lots[l.id], now))

          // Someone in the room bids, more often on lots about to close.
          const weights = live.map((l): number => {
            const s = lots[l.id]
            const left = s.endsAt - now
            if (currentBid(s) >= ceilingFor(l, left)) return 0
            return left < 3 * 60_000 ? 9 : left < 30 * 60_000 ? 3 : left < 6 * HOUR ? 1.2 : 0.5
          })
          const total = weights.reduce((a, b) => a + b, 0)
          let next = lots
          if (total > 0 && rng.chance(0.55)) {
            let r = rng.next() * total
            const lot = live.find((_, i) => (r -= weights[i]) <= 0) ?? live[0]
            const s = lots[lot.id]
            let paddle = `p${rng.pick(PADDLES)[0]}`
            while (paddle === leader(s)) paddle = `p${rng.pick(PADDLES)[0]}`
            let amount = nextMinimum(s)
            if (rng.chance(0.15)) amount += increment(amount)
            const result = bidAsRival(s, paddle, amount, now)
            if (result.ok) {
              next = { ...lots, [lot.id]: result.lot }
              set({ lots: next })
              if (account) announce(lot.id, result.events)
            }
          }

          // Lots that have just closed with the visitor involved.
          const closed = LOTS.filter((l) => {
            const s = next[l.id]
            return s && !isOpen(s, now) && !settled.includes(l.id) && s.bids.some((b) => b.bidder === YOU)
          })
          if (closed.length > 0) {
            for (const l of closed) {
              const o = outcome(next[l.id], now)
              if (o.status === "sold" && o.winner === YOU) {
                toast({ tone: "good", title: "Congratulations — you won", body: `${l.maker} ${l.title}, hammer ${money(o.hammer)}.`, lotId: l.id })
              } else if (o.status === "sold") {
                toast({ tone: "bad", title: "Lot closed", body: `${l.title} sold to another bidder for ${money(o.hammer)}.`, lotId: l.id })
              } else {
                toast({ tone: "info", title: "Lot passed", body: `${l.title} closed below its reserve.`, lotId: l.id })
              }
            }
            set((s) => ({ settled: [...s.settled, ...closed.map((l) => l.id)] }))
          }
        },

        relist: (now) => {
          const { lots } = get()
          let changed = false
          const next = { ...lots }
          for (const lot of LOTS) {
            const s = lots[lot.id]
            if (!s || now - s.endsAt > 12 * HOUR) {
              next[lot.id] = list(lot, now, now % 9973)
              changed = true
            }
          }
          if (changed) {
            set((s) => ({ lots: next, settled: s.settled.filter((id) => next[id] === lots[id]) }))
          }
        },

        signUp: (name, email, password) => {
          const clean = email.trim().toLowerCase()
          if (get().accounts.some((a) => a.email === clean)) return "An account with this email already exists. Sign in instead."
          const account = { name: name.trim(), email: clean }
          set((s) => ({ accounts: [...s.accounts, { ...account, key: keyOf(clean, password) }], account }))
          toast({ tone: "good", title: `Welcome to 11bids, ${account.name.split(" ")[0]}`, body: "Your paddle is ready. Happy bidding." })
          return null
        },

        signIn: (email, password) => {
          const clean = email.trim().toLowerCase()
          const found = get().accounts.find((a) => a.email === clean)
          if (!found) return "We couldn't find an account with that email."
          if (found.key !== keyOf(clean, password)) return "That password doesn't match this account."
          set({ account: { name: found.name, email: found.email } })
          toast({ tone: "good", title: `Welcome back, ${found.name.split(" ")[0]}` })
          return null
        },

        signOut: () => set({ account: null }),

        toggleWatch: (lotId) =>
          set((s) => ({ watch: s.watch.includes(lotId) ? s.watch.filter((id) => id !== lotId) : [...s.watch, lotId] })),

        dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

        reset: () =>
          set({ lots: seedSale(Date.now()), watch: [], settled: [], toasts: [] }),
      }
    },
    {
      name: "11bids",
      version: 1,
      storage: safeStorage(),
      partialize: ({ lots, account, accounts, watch, settled }) => ({ lots, account, accounts, watch, settled }),
      onRehydrateStorage: () => (state) => state?.relist(Date.now()),
    }
  )
)

const money = (n: number) => `$${n.toLocaleString("en-US")}`

onReset("11bids", () => useAuction.getState().reset())

export type LotView = CatalogueLot & { state: LotState }

/** The visitor's standing on a lot. */
export function standing(state: LotState, now: number) {
  const mine = state.bids.some((b) => b.bidder === YOU)
  if (!mine) return null
  const o = outcome(state, now)
  if (o.status === "sold") return o.winner === YOU ? "won" : "lost"
  if (o.status === "passed") return "passed"
  return leader(state) === YOU ? "leading" : "outbid"
}
