import { CELL, LEVEL, type Castle, type LineRow, type Vec3 } from "./castle"
import { fromAxes, multiply, type Mat3 } from "./orient"

/**
 * The castle's long train paths, as data. In the film the castle isn't only
 * rooms: there are endless decks and corridors running off in every
 * direction, with whole buildings sliding along them like carriages, and
 * each one keeps its own "down".
 *
 * Two lines, laid along the rows the castle keeps clear for them:
 *
 * - The ring, in the x–y plane. Its floor runs through the castle along x,
 *   meets a deck standing straight up at either end (an inside corner: walk
 *   into it and that wall is the floor), and the two meet again overhead in
 *   a deck hanging upside down above everything. Carriages loop along the
 *   level decks, folding away at the corners; lifts shuttle up and down the
 *   standing ones.
 * - The z-line crosses it a level or more away, between two great halls of
 *   pillars: one upright, the other turned on its side so that its floor is
 *   the wall the line ends at. A train shuttles between them, one of its
 *   carriages tipped on its side.
 *
 * Every line has a frame: local x runs along it, y is its up (the deck's
 * floor), z across. Cars and halls carry their own frames, and their floors
 * are what the visitor's gravity turns to (see `World.floorAhead`).
 */

export type CarKind = "carriage" | "pavilion" | "tower"
export type DeckKind = "deck2" | "deck1"
export type HallKind = "greatHall" | "greatHallTurned"

export type Motion =
  /** Round and round, folding away into the ends; `speed` is signed. */
  | { kind: "loop"; speed: number }
  /** Back and forth between two stops, pausing at each; `phase` in seconds. */
  | { kind: "shuttle"; from: number; to: number; speed: number; pause: number; phase: number }

export type CarSpec = {
  kind: CarKind
  /** Along the run, from the train's reference point (a loop's start, a shuttle's stop). */
  at: number
  /** Tipped on its side: its floor faces across the line. */
  roll?: boolean
}

export type Lane = { offset: number; motion: Motion; cars: CarSpec[] }

export type LineSpec = {
  key: string
  deck: DeckKind
  orient: Mat3
  /** The deck's surface on its centreline at the start of the run. */
  origin: Vec3
  length: number
  lanes: Lane[]
}

export type HallSpec = { key: string; kind: HallKind; orient: Mat3; pos: Vec3 }

export type Network = { lines: LineSpec[]; halls: HallSpec[]; keepOut: { min: Vec3; max: Vec3 }[] }

/** Car lengths along the run, and their half-width across it. */
export const CAR_LENGTH: Record<CarKind, number> = { carriage: 12, pavilion: 9, tower: 10 }
export const CAR_HALF = 2.5
/** A car's floor rides this far above the deck: low enough to step onto. */
export const CAR_LIFT = 0.4
/** Deck segments: their nominal length, and each kind's half-width (kerb not included). */
export const SEGMENT = 24
export const DECK_HALF: Record<DeckKind, number> = { deck2: 5.5, deck1: 3.4 }
/** The great halls: half their inside width, and their height. */
export const GREAT_R = 15
export const GREAT_H = 14
/** Height of the overhead deck, above Nakime's roof and below the castle beyond. */
export const RING_TOP = 75
/** Where the ring's standing decks are, either side of the castle. */
export const RING_X: [number, number] = [-36, 132]

const X: Vec3 = [1, 0, 0]
const Y: Vec3 = [0, 1, 0]
const Z: Vec3 = [0, 0, 1]
const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]]

/** A quarter roll about the run: the car's up turns to face across the line. */
const ROLL: Mat3 = [1, 0, 0, 0, 0, -1, 0, 1, 0]

/** How tall each car stands above its floor (roof included). */
export const CAR_HEIGHT: Record<CarKind, number> = { carriage: 4.2, pavilion: 4.0, tower: 7.6 }

export function buildNetwork(castle: Castle): Network {
  const lines: LineSpec[] = []
  const halls: HallSpec[] = []
  const keepOut: Network["keepOut"] = []
  const ring = castle.rows.find((r) => r.axis === 0)
  const cross = castle.rows.find((r) => r.axis === 2)
  if (ring) ringLines(ring, lines, keepOut)
  if (cross) crossLine(cross, castle, lines, halls, keepOut)
  return { lines, halls, keepOut }
}

function ringLines(row: LineRow, lines: LineSpec[], keepOut: Network["keepOut"]) {
  const z = row.at * CELL
  const bottom = row.level * LEVEL
  const [x0, x1] = RING_X
  const across = x1 - x0
  const rise = RING_TOP - bottom
  const loop = (kinds: CarKind[], spacing: number, start = 0): CarSpec[] =>
    kinds.map((kind, i) => ({ kind, at: (start + i * spacing) % across }))
  const lift = (phase: number): Lane => ({
    offset: 0,
    motion: { kind: "shuttle", from: 9, to: rise - 9, speed: 5, pause: 4, phase },
    cars: [{ kind: "pavilion", at: 0 }],
  })
  lines.push({
    key: "ring-floor",
    deck: "deck2",
    orient: fromAxes(X, Y),
    origin: [x0, bottom, z],
    length: across,
    lanes: [
      { offset: -2.75, motion: { kind: "loop", speed: 5.5 }, cars: loop(["carriage", "pavilion", "carriage", "carriage"], 42) },
      { offset: 2.75, motion: { kind: "loop", speed: -4.5 }, cars: loop(["pavilion", "carriage", "carriage", "pavilion"], 42, 20) },
    ],
  })
  lines.push({
    key: "ring-east",
    deck: "deck2",
    orient: fromAxes(Y, neg(X)),
    origin: [x1, bottom, z],
    length: rise,
    lanes: [
      { ...lift(0), offset: -2.75 },
      { ...lift(11), offset: 2.75 },
    ],
  })
  lines.push({
    key: "ring-top",
    deck: "deck2",
    orient: fromAxes(neg(X), neg(Y)),
    origin: [x1, RING_TOP, z],
    length: across,
    lanes: [
      { offset: -2.75, motion: { kind: "loop", speed: 3.6 }, cars: loop(["tower", "carriage", "tower"], 56) },
      { offset: 2.75, motion: { kind: "loop", speed: -3 }, cars: loop(["carriage", "tower", "pavilion"], 56, 28) },
    ],
  })
  lines.push({
    key: "ring-west",
    deck: "deck2",
    orient: fromAxes(neg(Y), X),
    origin: [x0, RING_TOP, z],
    length: rise,
    lanes: [
      { ...lift(5), offset: -2.75 },
      { ...lift(16), offset: 2.75 },
    ],
  })
  keepOut.push({ min: [x0 - 8, bottom - 8, z - 12], max: [x1 + 8, RING_TOP + 8, z + 12] })
}

function crossLine(row: LineRow, castle: Castle, lines: LineSpec[], halls: HallSpec[], keepOut: Network["keepOut"]) {
  const x = row.at * CELL
  const y = row.level * LEVEL
  // From the upright hall's gate to the turned hall's floor: six whole segments.
  const z0 = -20
  const z1 = (castle.size.z - 1) * CELL + 28
  const length = z1 - z0
  // The train: its first carriage leads into the upright hall, the pavilion into the turned one.
  const cars: CarSpec[] = [
    { kind: "carriage", at: 0 },
    { kind: "carriage", at: 13.5, roll: true },
    { kind: "pavilion", at: 25 },
  ]
  const stopA = -19
  const stopB = length - 1.5 - 25 - CAR_LENGTH.pavilion / 2
  lines.push({
    key: "cross",
    deck: "deck1",
    orient: fromAxes(Z, Y),
    origin: [x, y, z0],
    length,
    lanes: [{ offset: 0, motion: { kind: "shuttle", from: stopA, to: stopB, speed: 9, pause: 6, phase: 0 }, cars }],
  })
  halls.push({ key: "hall-a", kind: "greatHall", orient: fromAxes(X, Y), pos: [x, y, z0 - 0.4 - GREAT_R] })
  // On its side: its floor is the wall the line runs into, and the line lies along one of its walls.
  halls.push({ key: "hall-b", kind: "greatHallTurned", orient: fromAxes(X, neg(Z)), pos: [x, y - 0.25 + GREAT_R, z1] })
  keepOut.push({ min: [x - 20, y - 8, z0 - 2 * GREAT_R - 8], max: [x + 20, y + 2 * GREAT_R + 6, z1 + 8] })
}

/** A line's frame applied to a point in it: s along, a across, u up. */
export function linePoint(line: LineSpec, s: number, a: number, u: number): Vec3 {
  const m = line.orient
  const o = line.origin
  return [o[0] + m[0] * s + m[1] * u + m[2] * a, o[1] + m[3] * s + m[4] * u + m[5] * a, o[2] + m[6] * s + m[7] * u + m[8] * a]
}

/** A car's frame: the line's, or rolled onto its side. */
export const carOrient = (line: LineSpec, car: CarSpec): Mat3 => (car.roll ? multiply(line.orient, ROLL) : line.orient)

/** Where a car's centre sits, across and up, for a lane: rolled cars sit on what was their wall. */
export function carSeat(car: CarSpec, lane: Lane): { across: number; up: number } {
  if (!car.roll) return { across: lane.offset, up: CAR_LIFT }
  // Its up now points across the line: its floor is one side, its wall the bottom.
  return { across: lane.offset - (CAR_HEIGHT[car.kind] - 0.1) / 2, up: CAR_HALF + 0.25 }
}

const mod = (a: number, n: number) => ((a % n) + n) % n

/** A shuttle's reference point at time t: eased out of each stop, eased into the next. */
export function shuttleAt(m: Extract<Motion, { kind: "shuttle" }>, t: number) {
  const dist = Math.abs(m.to - m.from)
  const travel = (dist / m.speed) * (Math.PI / 2)
  const period = 2 * (travel + m.pause)
  const u = mod(t + m.phase, period)
  const ease = (k: number) => (1 - Math.cos(Math.PI * k)) / 2
  if (u < m.pause) return m.from
  if (u < m.pause + travel) return m.from + (m.to - m.from) * ease((u - m.pause) / travel)
  if (u < 2 * m.pause + travel) return m.to
  return m.to + (m.from - m.to) * ease((u - 2 * m.pause - travel) / travel)
}

/**
 * Where a car is along its line at time t, and how far it's unfolded (a
 * looping car folds away as it nears either end, and unfolds out of the
 * other). Folded cars aren't solid.
 */
export function carAt(line: LineSpec, lane: Lane, car: CarSpec, t: number): { s: number; extend: number } {
  const m = lane.motion
  if (m.kind === "shuttle") return { s: shuttleAt(m, t) + car.at, extend: 1 }
  const L = line.length
  const s = mod(car.at + m.speed * t, L)
  const margin = CAR_LENGTH[car.kind] / 2 + 0.6
  const extend = Math.max(0, Math.min(1, Math.min(s - margin, L - margin - s) / 6))
  return { s, extend }
}

/** How a line is cut into deck segments: count, and the stretch that makes them fit. */
export function segments(line: LineSpec) {
  const count = Math.max(1, Math.round(line.length / SEGMENT))
  return { count, stretch: line.length / (count * SEGMENT) }
}
