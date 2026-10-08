import { useMemo } from "react"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { onReset } from "@/os/kernel/reset"
import { createRng } from "@/os/kernel/rng"
import { safeStorage } from "@/os/kernel/storage"

/**
 * TrypNow's in-browser "backend": a supplier (a Dubai DMC) with inventory and
 * packages, agents who book them, and the bookings that connect the two. All
 * of it is seeded, persisted per visitor, and resettable from the app.
 */

export type Kind = "hotel" | "attraction" | "transfer"

export type Listing = {
  id: string
  kind: Kind
  name: string
  meta: string
  price: number
  emoji: string
  /** Created with the AI listing generator rather than seeded. */
  ai?: boolean
}

export type Package = {
  id: string
  name: string
  city: string
  country: string
  supplier: string
  nights: number
  pricePerPax: number
  highlights: string[]
  publishedAt: string
  emoji: string
}

export type BookingStatus = "pending" | "confirmed" | "cancelled"

export type Booking = {
  id: string
  ref: string
  packageId: string
  packageName: string
  supplier: string
  agency: string
  agentName: string
  travellers: number
  travelDate: string
  amount: number
  status: BookingStatus
  createdAt: string
}

/** Who the visitor plays on each side of the marketplace. */
export const SUPPLIER = "Desert Rose DMC"
export const AGENCY = "Wanderlust Travels"
export const AGENT_NAME = "Riya Kapoor"

const SEED = 20250601
const DAY = 86_400_000

const INVENTORY: Listing[] = [
  { id: "h1", kind: "hotel", name: "Palm Resort ★5", meta: "per night", price: 420, emoji: "🏨" },
  { id: "h2", kind: "hotel", name: "Downtown Inn ★3", meta: "per night", price: 95, emoji: "🏨" },
  { id: "h3", kind: "hotel", name: "Marina Suites ★4", meta: "per night", price: 210, emoji: "🏨" },
  { id: "a1", kind: "attraction", name: "Desert Safari + BBQ", meta: "6h · adult", price: 60, emoji: "🐪" },
  { id: "a2", kind: "attraction", name: "Skyscraper Top Deck", meta: "1h · adult", price: 45, emoji: "🏙️" },
  { id: "a3", kind: "attraction", name: "Dhow Dinner Cruise", meta: "2h · adult", price: 55, emoji: "⛵" },
  { id: "a4", kind: "attraction", name: "Museum of Tomorrow", meta: "2h · adult", price: 40, emoji: "🛸" },
  { id: "a5", kind: "attraction", name: "Old Souk Walking Tour", meta: "3h · adult", price: 30, emoji: "🧭" },
  { id: "t1", kind: "transfer", name: "Airport pickup", meta: "private · 1 way", price: 35, emoji: "🚐" },
  { id: "t2", kind: "transfer", name: "Car + driver", meta: "full day", price: 120, emoji: "🚗" },
]

type PackageSeed = Omit<Package, "id" | "publishedAt">

const OWN_PACKAGES: PackageSeed[] = [
  {
    name: "Dubai Getaway",
    city: "Dubai",
    country: "UAE",
    supplier: SUPPLIER,
    nights: 3,
    pricePerPax: 1495,
    highlights: ["Palm Resort ★5", "Desert Safari + BBQ", "Dhow Dinner Cruise"],
    emoji: "🌴",
  },
  {
    name: "Dubai on a Budget",
    city: "Dubai",
    country: "UAE",
    supplier: SUPPLIER,
    nights: 4,
    pricePerPax: 610,
    highlights: ["Downtown Inn ★3", "Old Souk Walking Tour", "Skyscraper Top Deck"],
    emoji: "🏙️",
  },
  {
    name: "Family Fun Dubai",
    city: "Dubai",
    country: "UAE",
    supplier: SUPPLIER,
    nights: 5,
    pricePerPax: 1320,
    highlights: ["Marina Suites ★4", "Museum of Tomorrow", "Car + driver"],
    emoji: "🎡",
  },
]

const OTHER_PACKAGES: PackageSeed[] = [
  { name: "Bali Rice & Reefs", city: "Ubud", country: "Indonesia", supplier: "Island Hopper DMC", nights: 6, pricePerPax: 980, highlights: ["Jungle villa", "Snorkel day trip", "Rice terrace walk"], emoji: "🌾" },
  { name: "Singapore City Lights", city: "Singapore", country: "Singapore", supplier: "Lion City Tours", nights: 3, pricePerPax: 1150, highlights: ["Marina Bay hotel", "Night safari", "Hawker food trail"], emoji: "🌃" },
  { name: "Maldives Overwater", city: "Malé", country: "Maldives", supplier: "Blue Lagoon Holidays", nights: 4, pricePerPax: 2890, highlights: ["Water villa", "Seaplane transfer", "Sunset cruise"], emoji: "🏝️" },
  { name: "Swiss Alps Express", city: "Interlaken", country: "Switzerland", supplier: "Alpine Way DMC", nights: 5, pricePerPax: 2350, highlights: ["Jungfraujoch", "Scenic rail pass", "Lake cruise"], emoji: "🏔️" },
  { name: "Kerala Backwaters", city: "Alleppey", country: "India", supplier: "Spice Coast DMC", nights: 4, pricePerPax: 520, highlights: ["Houseboat night", "Ayurveda spa", "Tea estate visit"], emoji: "🛶" },
]

const AGENCIES = [AGENCY, "Skyline Holidays", "Globe Trotters", "Nomad & Co", "Sunset Journeys", "Blue Compass", "Atlas Getaways"]
const AGENTS = ["Arjun Mehta", "Sara Khan", "Dev Patel", "Neha Rao", "Kabir Singh", "Ananya Iyer", "Omar Farooq"]

function seed(now: number) {
  const rng = createRng(SEED)

  const packages: Package[] = [...OWN_PACKAGES, ...OTHER_PACKAGES].map((p, i) => ({
    ...p,
    id: `p${i + 1}`,
    publishedAt: new Date(now - rng.int(20, 120) * DAY).toISOString(),
  }))

  const bookings: Booking[] = []
  for (let i = 0; i < 46; i++) {
    // Most bookings are on the supplier's own packages — it's their dashboard.
    const pkg = i < 38 ? packages[rng.int(0, OWN_PACKAGES.length - 1)] : rng.pick(packages.slice(OWN_PACKAGES.length))
    const agency = i >= 38 ? AGENCY : rng.pick(AGENCIES)
    const travellers = rng.int(1, 6)
    const createdAt = now - rng.int(0, 29) * DAY - rng.int(0, 23) * 3_600_000
    const age = (now - createdAt) / DAY
    bookings.push({
      id: `b${i + 1}`,
      ref: `TN-${24000 + i * 7 + rng.int(0, 6)}`,
      packageId: pkg.id,
      packageName: pkg.name,
      supplier: pkg.supplier,
      agency,
      agentName: agency === AGENCY ? AGENT_NAME : rng.pick(AGENTS),
      travellers,
      travelDate: new Date(createdAt + rng.int(10, 90) * DAY).toISOString(),
      amount: pkg.pricePerPax * travellers,
      // Fresh bookings are still waiting on the supplier.
      status: age < 3 && rng.chance(0.7) ? "pending" : rng.chance(0.1) ? "cancelled" : "confirmed",
      createdAt: new Date(createdAt).toISOString(),
    })
  }
  bookings.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return { listings: INVENTORY, packages, bookings }
}

type Data = ReturnType<typeof seed>

type Actions = {
  publishPackage: (p: Omit<Package, "id" | "publishedAt" | "supplier" | "country">) => Package
  addListing: (l: Omit<Listing, "id">) => Listing
  createBooking: (b: { packageId: string; travellers: number; travelDate: string }) => Booking
  setBookingStatus: (id: string, status: BookingStatus) => void
  reset: () => void
}

let counter = 0
const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`

export const useTrypNow = create<Data & Actions>()(
  persist(
    (set, get) => ({
      ...seed(Date.now()),

      publishPackage: (input) => {
        const pkg: Package = {
          ...input,
          id: uid("p"),
          supplier: SUPPLIER,
          country: "UAE",
          publishedAt: new Date().toISOString(),
        }
        set((s) => ({ packages: [pkg, ...s.packages] }))
        return pkg
      },

      addListing: (input) => {
        const listing: Listing = { ...input, id: uid("l") }
        set((s) => ({ listings: [...s.listings, listing] }))
        return listing
      },

      createBooking: ({ packageId, travellers, travelDate }) => {
        const pkg = get().packages.find((p) => p.id === packageId)
        if (!pkg) throw new Error("Package not found")
        const refs = get().bookings.map((b) => Number(b.ref.slice(3)))
        const booking: Booking = {
          id: uid("b"),
          ref: `TN-${Math.max(24000, ...refs) + 1}`,
          packageId,
          packageName: pkg.name,
          supplier: pkg.supplier,
          agency: AGENCY,
          agentName: AGENT_NAME,
          travellers,
          travelDate,
          amount: pkg.pricePerPax * travellers,
          status: "pending",
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ bookings: [booking, ...s.bookings] }))
        return booking
      },

      setBookingStatus: (id, status) =>
        set((s) => ({ bookings: s.bookings.map((b) => (b.id === id ? { ...b, status } : b)) })),

      reset: () => set(seed(Date.now())),
    }),
    {
      name: "os:trypnow:v1",
      storage: safeStorage(),
      partialize: ({ listings, packages, bookings }) => ({ listings, packages, bookings }),
    }
  )
)

export type Side = "supplier" | "agent"

/** The bookings one side of the marketplace can see. */
export function useSideBookings(side: Side) {
  const bookings = useTrypNow((s) => s.bookings)
  return useMemo(
    () => bookings.filter((b) => (side === "supplier" ? b.supplier === SUPPLIER : b.agency === AGENCY)),
    [bookings, side]
  )
}

export const money = (n: number) => `$${n.toLocaleString("en-US")}`

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })

export const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })

export function timeAgo(iso: string, now = Date.now()) {
  const mins = Math.round((now - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

onReset("trypnow", () => useTrypNow.getState().reset())
