/** Canvases the stage draws as textures: the wordmark, and a stand-in for a photo that won't load. */

import serif500 from "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2?url"
import serifItalic from "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-italic.woff2?url"
import sans400 from "@fontsource/jost/files/jost-latin-400-normal.woff2?url"

const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif"
const SANS = "'Jost', 'Futura', 'Avenir Next', system-ui, sans-serif"

export async function fontsReady() {
  if (!document.fonts) return
  await Promise.race([
    Promise.all([
      document.fonts.load(`500 200px "Cormorant Garamond"`),
      document.fonts.load(`italic 400 200px "Cormorant Garamond"`),
      document.fonts.load(`400 40px "Jost"`),
    ]),
    new Promise((r) => window.setTimeout(r, 1200)),
  ])
}

const WORDMARK_FONTS = [
  { family: "EB Serif", style: "normal", weight: 500, url: serif500 },
  { family: "EB Serif", style: "italic", weight: 400, url: serifItalic },
  { family: "EB Sans", style: "normal", weight: 400, url: sans400 },
]

async function asDataUrl(url: string) {
  const blob = await (await fetch(url)).blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

const W = 2400
const H = 1000

/**
 * "11bits" in ivory, the "bits" in italic, on transparent ground.
 *
 * Drawn from an SVG rather than canvas text, because canvas can't ask for
 * Cormorant's lining figures, and its old-style "11" reads as "II".
 */
export async function drawWordmark() {
  const c = document.createElement("canvas")
  c.width = W
  c.height = H
  const ctx = c.getContext("2d")!
  try {
    const faces = await Promise.all(
      WORDMARK_FONTS.map(async (f) => `@font-face{font-family:"${f.family}";font-style:${f.style};font-weight:${f.weight};src:url(${await asDataUrl(f.url)}) format("woff2")}`)
    )
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><style>${faces.join("")}text{font-variant-numeric:lining-nums}</style>
<linearGradient id="g" x1="0" y1="220" x2="0" y2="700" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#fbf7ef"/><stop offset="0.55" stop-color="#f1e7d4"/><stop offset="1" stop-color="#cbb185"/></linearGradient></defs>
<text x="${W / 2}" y="640" text-anchor="middle" fill="url(#g)" font-family="EB Serif" font-size="520"><tspan font-weight="500">11</tspan><tspan font-style="italic" font-weight="400">bits</tspan></text>
<text x="${W / 2}" y="800" text-anchor="middle" fill="rgba(201,169,110,0.9)" font-family="EB Sans" font-size="46" letter-spacing="26">FINE AUCTIONS</text>
<rect x="${W / 2 - 400}" y="786" width="150" height="2" fill="rgba(201,169,110,0.9)"/>
<rect x="${W / 2 + 250}" y="786" width="150" height="2" fill="rgba(201,169,110,0.9)"/>
</svg>`
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      ctx.drawImage(img, 0, 0)
    } finally {
      URL.revokeObjectURL(url)
    }
    // Some browsers taint a canvas an SVG was drawn into; WebGL can't use that.
    ctx.getImageData(0, 0, 1, 1)
    return c
  } catch {
    return drawWordmarkText()
  }
}

/** The same mark in plain canvas text, for browsers that won't draw the SVG. */
function drawWordmarkText() {
  const c = document.createElement("canvas")
  c.width = W
  c.height = H
  const ctx = c.getContext("2d")!
  ctx.textBaseline = "alphabetic"
  const upright = `500 520px ${SERIF}`
  const italic = `italic 400 520px ${SERIF}`
  ctx.font = upright
  const w11 = ctx.measureText("11").width
  ctx.font = italic
  const wBits = ctx.measureText("bits").width
  const x = (W - w11 - wBits) / 2
  const fill = ctx.createLinearGradient(0, 220, 0, 700)
  fill.addColorStop(0, "#fbf7ef")
  fill.addColorStop(0.55, "#f1e7d4")
  fill.addColorStop(1, "#cbb185")
  ctx.fillStyle = fill
  ctx.font = upright
  ctx.fillText("11", x, 640)
  ctx.font = italic
  ctx.fillText("bits", x + w11, 640)
  ctx.font = `400 46px ${SANS}`
  ctx.fillStyle = "rgba(201, 169, 110, 0.9)"
  ctx.textAlign = "center"
  ctx.fillText("F I N E   A U C T I O N S", W / 2, 800)
  return c
}

/** A dark catalogue card with the lot's name, for when its photograph can't be fetched. */
export function drawPlaceholder(maker: string, title: string) {
  const c = document.createElement("canvas")
  c.width = 1000
  c.height = 1250
  const ctx = c.getContext("2d")!
  const g = ctx.createRadialGradient(500, 520, 40, 500, 620, 760)
  g.addColorStop(0, "#2a251e")
  g.addColorStop(1, "#0c0b0a")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.strokeStyle = "rgba(201,169,110,0.35)"
  ctx.lineWidth = 2
  ctx.strokeRect(48, 48, c.width - 96, c.height - 96)
  ctx.textAlign = "center"
  ctx.fillStyle = "#c9a96e"
  ctx.font = `400 30px ${SANS}`
  ctx.fillText(maker.toUpperCase().split("").join(" "), 500, 560)
  ctx.fillStyle = "#f4efe6"
  ctx.font = `italic 400 76px ${SERIF}`
  wrap(ctx, title, 500, 660, 760, 84)
  return c
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number) {
  const words = text.split(" ")
  let line = ""
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > width && line) {
      ctx.fillText(line, x, y)
      line = word
      y += lineHeight
    } else {
      line = test
    }
  }
  ctx.fillText(line, x, y)
}
