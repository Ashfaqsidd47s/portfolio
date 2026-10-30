import { BOUNDS, PLACES, type Vec2 } from "./geo"
import type { Plan } from "./world/plan"

/**
 * The paper map: zones, the lake, every road with its name, the named
 * places. North is up. Drawn into a canvas once per size; the player's
 * marker goes on top each frame.
 */

const ZONE: Record<string, string> = {
  isbt: "#b8b0a2",
  cantt: "#a9c48a",
  parade: "#cdb98c",
  monastery: "#e6d6b0",
  courtyard: "#d9cfbd",
  lawn: "#b9d39a",
  path: "#d8c8a6",
}

export type MapFrame = { cx: number; cz: number; scale: number; w: number; h: number }

export const toMap = (f: MapFrame, [x, z]: Vec2): Vec2 => [f.w / 2 + (x - f.cx) * f.scale, f.h / 2 + (z - f.cz) * f.scale]

export function drawMap(ctx: CanvasRenderingContext2D, plan: Plan, f: MapFrame, labels = true) {
  ctx.save()
  ctx.fillStyle = "#e9e2cc"
  ctx.fillRect(0, 0, f.w, f.h)
  const poly = (pts: Vec2[]) => {
    ctx.beginPath()
    pts.forEach((p, i) => {
      const [x, y] = toMap(f, p)
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.closePath()
  }
  // Land inside the map's edge.
  poly([
    [BOUNDS.minX, BOUNDS.minZ],
    [BOUNDS.maxX, BOUNDS.minZ],
    [BOUNDS.maxX, BOUNDS.maxZ],
    [BOUNDS.minX, BOUNDS.maxZ],
  ])
  ctx.fillStyle = "#d8dcb8"
  ctx.fill()
  ctx.strokeStyle = "#7a6a4a"
  ctx.lineWidth = 2
  ctx.stroke()

  for (const z of plan.zones) {
    poly(z.poly)
    ctx.fillStyle = ZONE[z.kind] ?? "#ccc"
    ctx.fill()
  }
  for (const w of plan.water) {
    poly(w)
    ctx.fillStyle = "#6fa6c8"
    ctx.fill()
  }

  const order = { lane: 0, main: 1, highway: 2 } as const
  for (const road of [...plan.roads].sort((a, b) => order[a.kind] - order[b.kind])) {
    ctx.beginPath()
    road.points.forEach((p, i) => {
      const [x, y] = toMap(f, p)
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = road.kind === "highway" ? "#e8a33a" : road.kind === "main" ? "#ffffff" : "#f4f0e4"
    ctx.lineWidth = Math.max(1.5, road.width * f.scale * 1.4)
    ctx.stroke()
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
      ctx.fillStyle = "#4a3a2a"
      ctx.fillText(road.name, 0, -8)
      ctx.restore()
    }
    for (const p of PLACES) {
      const [x, y] = toMap(f, p.at)
      ctx.fillStyle = "#8e1b3a"
      ctx.fillRect(x - 3, y - 3, 6, 6)
      // Only the main places get a name: the rest sit too close together.
      if (!p.travel) continue
      ctx.fillStyle = "#2a2018"
      ctx.font = `600 ${Math.max(9, Math.min(12, f.scale * 20))}px "Pixelify Sans", sans-serif`
      ctx.fillText(p.name, x, y - 10)
    }
  }
  ctx.restore()
}
