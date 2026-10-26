/** The house fonts, and the card the stage draws for a photo that won't load. */

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
