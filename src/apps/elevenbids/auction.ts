/**
 * The auction rules, as pure functions over a lot's state, so the store, the
 * simulated room and the tests all agree on what a bid does.
 *
 * - Bids step up by the house increment table (`increment`).
 * - The visitor can leave a maximum: the house then bids for them, one step
 *   at a time, until someone goes past it (proxy bidding).
 * - A bid in the last two minutes pushes the close back to two minutes from
 *   that bid, so nobody wins by sniping.
 * - A lot sells only if the hammer price meets its reserve.
 */

export const YOU = "you"

/** A bid in the closing window pushes the close back to this far from the bid. */
export const EXTEND_MS = 2 * 60_000

/** Charged on top of the hammer price. */
export const BUYERS_PREMIUM = 0.25

export type Bid = {
  id: string
  bidder: string
  amount: number
  at: number
  /** Placed by the house on the visitor's behalf, from their maximum. */
  auto?: boolean
}

export type LotState = {
  id: string
  startPrice: number
  reserve: number
  endsAt: number
  /** Oldest first. */
  bids: Bid[]
  /** The visitor's proxy ceiling, while they have one on this lot. */
  yourMax?: number
}

export type BidEvent =
  | { type: "outbid"; by: string; amount: number }
  | { type: "auto"; amount: number }
  | { type: "extended"; endsAt: number }

export type BidResult =
  | { ok: true; lot: LotState; events: BidEvent[] }
  | { ok: false; error: string }

const TABLE: [below: number, step: number][] = [
  [1_000, 50],
  [2_000, 100],
  [5_000, 250],
  [10_000, 500],
  [20_000, 1_000],
  [50_000, 2_500],
  [100_000, 5_000],
  [200_000, 10_000],
  [500_000, 25_000],
  [1_000_000, 50_000],
  [2_000_000, 100_000],
  [5_000_000, 250_000],
]

/** How much the next bid must add to `amount`. */
export function increment(amount: number) {
  for (const [below, step] of TABLE) if (amount < below) return step
  return 500_000
}

export const currentBid = (lot: LotState) => lot.bids.at(-1)?.amount ?? 0

export const leader = (lot: LotState) => lot.bids.at(-1)?.bidder

export const isOpen = (lot: LotState, now: number) => now < lot.endsAt

/** The lowest bid the room will take right now. */
export function nextMinimum(lot: LotState) {
  const last = lot.bids.at(-1)
  return last ? last.amount + increment(last.amount) : lot.startPrice
}

/** Rounds a typed amount up onto the increment ladder above `from`. */
export function snapUp(amount: number, from: number) {
  let value = from
  while (value < amount) value += increment(value)
  return value
}

export const reserveMet = (lot: LotState) => currentBid(lot) >= lot.reserve

export type Outcome =
  | { status: "live" }
  | { status: "sold"; winner: string; hammer: number }
  | { status: "passed"; highest: number }

export function outcome(lot: LotState, now: number): Outcome {
  if (isOpen(lot, now)) return { status: "live" }
  const last = lot.bids.at(-1)
  if (last && last.amount >= lot.reserve) return { status: "sold", winner: last.bidder, hammer: last.amount }
  return { status: "passed", highest: last?.amount ?? 0 }
}

let serial = 0
const bidId = (at: number) => `b${at.toString(36)}${(serial++).toString(36)}`

function push(lot: LotState, bidder: string, amount: number, at: number, auto = false): LotState {
  return { ...lot, bids: [...lot.bids, { id: bidId(at), bidder, amount, at, ...(auto && { auto }) }] }
}

function extend(lot: LotState, now: number, events: BidEvent[]): LotState {
  if (lot.endsAt - now >= EXTEND_MS) return lot
  const endsAt = now + EXTEND_MS
  events.push({ type: "extended", endsAt })
  return { ...lot, endsAt }
}

/**
 * The visitor bids `amount`, optionally leaving `max` for the house to bid
 * up to. If they already lead, only their maximum changes: nobody bids
 * against themselves.
 */
export function bidAsYou(lot: LotState, amount: number, now: number, max?: number): BidResult {
  if (!isOpen(lot, now)) return { ok: false, error: "Bidding on this lot has closed." }
  const ceiling = Math.max(amount, max ?? 0)
  if (leader(lot) === YOU) {
    if (ceiling <= (lot.yourMax ?? currentBid(lot))) {
      return { ok: false, error: "You're already the highest bidder. Raise your maximum instead." }
    }
    return { ok: true, lot: { ...lot, yourMax: ceiling }, events: [] }
  }
  const min = nextMinimum(lot)
  if (amount < min) return { ok: false, error: `The next bid must be at least ${formatMoney(min)}.` }
  const events: BidEvent[] = []
  let next = push(lot, YOU, amount, now)
  next = { ...next, yourMax: ceiling > amount ? ceiling : undefined }
  next = extend(next, now, events)
  return { ok: true, lot: next, events }
}

/**
 * Someone else in the room bids `amount`. If the visitor's maximum covers
 * it, the house answers for them straight away.
 */
export function bidAsRival(lot: LotState, bidder: string, amount: number, now: number): BidResult {
  if (!isOpen(lot, now)) return { ok: false, error: "Bidding on this lot has closed." }
  const min = nextMinimum(lot)
  if (amount < min) return { ok: false, error: `The next bid must be at least ${formatMoney(min)}.` }
  const events: BidEvent[] = []
  const wasLeading = leader(lot) === YOU
  const max = wasLeading ? lot.yourMax : undefined
  let next = push(lot, bidder, amount, now)
  next = extend(next, now, events)

  const answer = amount + increment(amount)
  if (max !== undefined && max >= answer) {
    // Never above the maximum, never below the next step.
    next = push(next, YOU, answer, now + 1, true)
    if (answer >= max) next = { ...next, yourMax: undefined }
    events.push({ type: "auto", amount: answer })
  } else if (max !== undefined && max >= amount) {
    // A tie goes to whoever got there first: the visitor's maximum stands
    // at the rival's amount.
    next = { ...next, bids: [...next.bids.slice(0, -1), { ...next.bids.at(-1)!, bidder: YOU, auto: true }] }
    next = { ...next, yourMax: undefined }
    events.push({ type: "auto", amount })
  } else if (wasLeading) {
    next = { ...next, yourMax: undefined }
    events.push({ type: "outbid", by: bidder, amount })
  }
  return { ok: true, lot: next, events }
}

/** What the winner pays: hammer plus the buyer's premium. */
export const withPremium = (hammer: number) => Math.round(hammer * (1 + BUYERS_PREMIUM))

const whole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

export const formatMoney = (amount: number) => whole.format(amount)

/** $1.2M, $350K — for tight spaces like cards. */
export function formatShort(amount: number) {
  if (amount >= 1_000_000) return `$${+(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 1 : 2)}M`
  if (amount >= 10_000) return `$${Math.round(amount / 1_000)}K`
  return whole.format(amount)
}
