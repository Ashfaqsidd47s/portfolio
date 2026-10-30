import { BOUNDS, PLACES, type Vec2 } from "./geo"
import { hash2 } from "./kit/noise"
import { WARPS } from "./world/fantasy"
import type { Plan } from "./world/plan"

/**
 * The adventurer's map: the island in parchment over a sea of cloud, inked
 * roads with their names, the lake, wax seals on the named places, warp
 * crystals, and a compass rose. North is up. Drawn once per size; the
 * markers for you, your friend and the quest go on top each frame.
 */

const ZONE: Record<string, string> = {
  isbt: "#d6c39a",
  cantt: "#bfd18e",
  parade: "#dcc28c",
  monastery: "#ecd8a4",
  courtyard: "#e2cfa8",
  lawn: "#c8dc9a",
  path: "#dcc79a",
}

const INK = "#5a3e22"

export type MapFrame = { cx: number; cz: number; scale: number; w: number; h: number }

export const toMap = (f: MapFrame, [x, z]: Vec2): Vec2 => [f.w / 2 + (x - f.cx) * f.scale, f.h / 2 + (z - f.cz) * f.scale]

/** A cyan crystal glyph. */
export function crystalGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - s * 1.4)
  ctx.lineTo(x + s, y)
  ctx.lineTo(x, y + s * 1.4)
  ctx.lineTo(x - s, y)
  ctx.closePath()
  ctx.fillStyle = "#7ff6ff"
  ctx.fill()
  ctx.strokeStyle = "#1d5a78"
  ctx.lineWidth = 1.2
  ctx.stroke()
}

export function drawMap(ctx: CanvasRenderingContext2D, plan: Plan, f: MapFrame, labels = true) {
  ctx.save()
  // The sky round the island, with drifting puffs of cloud.
  const sky = ctx.createLinearGradient(0, 0, 0, f.h)
  sky.addColorStop(0, "#bcd8f0")
  sky.addColorStop(1, "#dfeaf6")
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, f.w, f.h)
  ctx.fillStyle = "#ffffffcc"
  for (let i = 0; i < 60; i++) {
    const x = hash2(i, 1) * f.w
    const y = hash2(i, 2) * f.h
    const r = 6 + hash2(i, 3) * 18
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.arc(x + r * 0.9, y + r * 0.2, r * 0.7, 0, Math.PI * 2)
    ctx.fill()
  }

  const poly = (pts: Vec2[]) => {
    ctx.beginPath()
    pts.forEach((p, i) => {
      const [x, y] = toMap(f, p)
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.closePath()
  }
  const island: Vec2[] = [
    [BOUNDS.minX, BOUNDS.minZ],
    [BOUNDS.maxX, BOUNDS.minZ],
    [BOUNDS.maxX, BOUNDS.maxZ],
    [BOUNDS.minX, BOUNDS.maxZ],
  ]
  // The island's rocky underside peeks out below its parchment top.
  ctx.save()
  ctx.translate(0, 5)
  poly(island)
  ctx.fillStyle = "#6a5a7a"
  ctx.fill()
  ctx.restore()
  poly(island)
  ctx.fillStyle = "#ecdcb0"
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.stroke()

  for (const z of plan.zones) {
    poly(z.poly)
    ctx.fillStyle = ZONE[z.kind] ?? "#ddd"
    ctx.fill()
  }
  for (const w of plan.water) {
    poly(w)
    ctx.fillStyle = "#7fb6cc"
    ctx.fill()
    ctx.strokeStyle = "#3f6f88"
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  const order = { lane: 0, main: 1, highway: 2 } as const
  const roads = [...plan.roads].sort((a, b) => order[a.kind] - order[b.kind])
  const stroke = (pts: Vec2[], width: number, colour: string) => {
    ctx.beginPath()
    pts.forEach((p, i) => {
      const [x, y] = toMap(f, p)
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = colour
    ctx.lineWidth = width
    ctx.stroke()
  }
  // Inked casing first, then the road's own colour.
  for (const road of roads) stroke(road.points, Math.max(2.5, road.width * f.scale * 1.4) + 2, INK)
  for (const road of roads) {
    stroke(road.points, Math.max(1.5, road.width * f.scale * 1.4), road.kind === "highway" ? "#e8b25a" : road.kind === "main" ? "#fbf1d6" : "#efe2c0")
  }

  for (const id of WARPS) {
    const m = plan.marks.get(`warp-${id}`)
    if (!m) continue
    const [x, y] = toMap(f, m.p)
    crystalGlyph(ctx, x, y, labels ? 5 : 3.5)
  }

  if (labels) {
    ctx.font = `${Math.max(8, Math.min(11, f.scale * 18))}px "Pixelify Sans", sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    for (const road of plan.roads.filter((r) => r.kind !== "lane")) {
      const mid = road.points[Math.floor(road.points.length / 2)]
      const prev = road.points[Math.max(0, Math.floor(road.points.length / 2) - 1)]
      const [x, y] = toMap(f, mid)
      const [px, py] = toMap(f, prev)
      let a = Math.atan2(y - py, x - px)
      if (a > Math.PI / 2) a -= Math.PI
      if (a < -Math.PI / 2) a += Math.PI
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(a)
      ctx.fillStyle = INK
      ctx.fillText(road.name, 0, -8)
      ctx.restore()
    }
    for (const p of PLACES) {
      const [x, y] = toMap(f, p.at)
      // A wax seal.
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fillStyle = "#a3243f"
      ctx.fill()
      ctx.strokeStyle = "#ffd36a"
      ctx.lineWidth = 1
      ctx.stroke()
      // Only the main places get a name: the rest sit too close together.
      if (!p.travel) continue
      ctx.font = `600 ${Math.max(9, Math.min(12, f.scale * 20))}px "Pixelify Sans", sans-serif`
      ctx.lineWidth = 3
      ctx.strokeStyle = "#f6ecd0"
      ctx.strokeText(p.name, x, y - 11)
      ctx.fillStyle = "#2a1a0e"
      ctx.fillText(p.name, x, y - 11)
    }
    compass(ctx, f.w - 34, 40, 22)
  }
  ctx.restore()
}

/** An eight-point compass rose. */
function compass(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save()
  ctx.translate(x, y)
  for (let i = 0; i < 8; i++) {
    const long = i % 2 === 1
    const len = long ? r : r * 0.55
    ctx.rotate(Math.PI / 4)
    ctx.beginPath()
    ctx.moveTo(0, -len)
    ctx.lineTo(r * 0.16, 0)
    ctx.lineTo(-r * 0.16, 0)
    ctx.closePath()
    ctx.fillStyle = i === 7 ? "#a3243f" : long ? INK : "#a88a5a"
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2)
  ctx.fillStyle = "#ffd36a"
  ctx.fill()
  ctx.fillStyle = INK
  ctx.font = `600 10px "Pixelify Sans", sans-serif`
  ctx.textAlign = "center"
  ctx.fillText("N", 0, -r - 6)
  ctx.restore()
}
