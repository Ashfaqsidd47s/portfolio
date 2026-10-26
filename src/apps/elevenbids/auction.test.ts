import { describe, expect, it } from "vitest"
import {
  EXTEND_MS,
  YOU,
  bidAsRival,
  bidAsYou,
  currentBid,
  formatShort,
  increment,
  leader,
  nextMinimum,
  outcome,
  snapUp,
  type LotState,
} from "./auction"

const NOW = 1_000_000_000_000
const HOUR = 3_600_000

const lot = (over: Partial<LotState> = {}): LotState => ({
  id: "l1",
  startPrice: 10_000,
  reserve: 15_000,
  endsAt: NOW + HOUR,
  bids: [],
  ...over,
})

const ok = <T extends { ok: boolean }>(r: T) => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r)}`)
  return r as Extract<T, { ok: true }>
}

describe("increments", () => {
  it("follow the house table", () => {
    expect(increment(900)).toBe(50)
    expect(increment(10_000)).toBe(1_000)
    expect(increment(120_000)).toBe(10_000)
    expect(increment(2_400_000)).toBe(250_000)
    expect(increment(9_000_000)).toBe(500_000)
  })

  it("opens at the start price, then steps from the last bid", () => {
    const l = lot()
    expect(nextMinimum(l)).toBe(10_000)
    const after = ok(bidAsRival(l, "p1", 10_000, NOW)).lot
    expect(nextMinimum(after)).toBe(11_000)
  })

  it("snaps typed amounts up onto the ladder", () => {
    expect(snapUp(12_300, 10_000)).toBe(13_000)
    expect(snapUp(13_000, 10_000)).toBe(13_000)
  })
})

describe("bidding as the visitor", () => {
  it("rejects bids under the next minimum and after the close", () => {
    expect(bidAsYou(lot(), 9_000, NOW).ok).toBe(false)
    expect(bidAsYou(lot({ endsAt: NOW - 1 }), 10_000, NOW).ok).toBe(false)
  })

  it("takes the lead", () => {
    const r = ok(bidAsYou(lot(), 10_000, NOW))
    expect(leader(r.lot)).toBe(YOU)
    expect(currentBid(r.lot)).toBe(10_000)
  })

  it("only raises the maximum when already leading", () => {
    const first = ok(bidAsYou(lot(), 10_000, NOW, 20_000)).lot
    expect(bidAsYou(first, 11_000, NOW, 15_000).ok).toBe(false)
    const raised = ok(bidAsYou(first, 11_000, NOW, 30_000)).lot
    expect(raised.bids).toHaveLength(1)
    expect(raised.yourMax).toBe(30_000)
  })
})

describe("proxy bidding", () => {
  it("answers a rival one step up, within the maximum", () => {
    const mine = ok(bidAsYou(lot(), 10_000, NOW, 20_000)).lot
    const r = ok(bidAsRival(mine, "p1", 11_000, NOW + 10))
    expect(leader(r.lot)).toBe(YOU)
    expect(currentBid(r.lot)).toBe(12_000)
    expect(r.lot.bids.at(-1)?.auto).toBe(true)
    expect(r.events).toContainEqual({ type: "auto", amount: 12_000 })
  })

  it("holds the lead on a tie at the maximum", () => {
    const mine = ok(bidAsYou(lot(), 10_000, NOW, 14_000)).lot
    const r = ok(bidAsRival(mine, "p1", 14_000, NOW + 10))
    expect(leader(r.lot)).toBe(YOU)
    expect(currentBid(r.lot)).toBe(14_000)
    expect(r.lot.yourMax).toBeUndefined()
  })

  it("reports being outbid once the maximum is passed", () => {
    const mine = ok(bidAsYou(lot(), 10_000, NOW, 14_000)).lot
    const r = ok(bidAsRival(mine, "p1", 15_000, NOW + 10))
    expect(leader(r.lot)).toBe("p1")
    expect(r.events).toContainEqual({ type: "outbid", by: "p1", amount: 15_000 })
    expect(r.lot.yourMax).toBeUndefined()
  })

  it("raises no events between two rivals", () => {
    const rival = ok(bidAsRival(lot(), "p1", 10_000, NOW)).lot
    const r = ok(bidAsRival(rival, "p2", 11_000, NOW + 10))
    expect(r.events).toEqual([])
  })
})

describe("closing", () => {
  it("extends a lot bid on in its last two minutes", () => {
    const closing = lot({ endsAt: NOW + 30_000 })
    const r = ok(bidAsYou(closing, 10_000, NOW))
    expect(r.lot.endsAt).toBe(NOW + EXTEND_MS)
    expect(r.events).toContainEqual({ type: "extended", endsAt: NOW + EXTEND_MS })
  })

  it("leaves the close alone earlier on", () => {
    const r = ok(bidAsYou(lot(), 10_000, NOW))
    expect(r.lot.endsAt).toBe(NOW + HOUR)
  })

  it("sells at or above the reserve, passes below it", () => {
    const low = ok(bidAsYou(lot(), 10_000, NOW)).lot
    expect(outcome(low, NOW)).toEqual({ status: "live" })
    expect(outcome(low, NOW + 2 * HOUR)).toEqual({ status: "passed", highest: 10_000 })
    const high = ok(bidAsYou(lot(), 16_000, NOW)).lot
    expect(outcome(high, NOW + 2 * HOUR)).toEqual({ status: "sold", winner: YOU, hammer: 16_000 })
  })
})

describe("formatShort", () => {
  it("abbreviates large sums", () => {
    expect(formatShort(1_250_000)).toBe("$1.25M")
    expect(formatShort(350_000)).toBe("$350K")
    expect(formatShort(4_500)).toBe("$4,500")
  })
})
