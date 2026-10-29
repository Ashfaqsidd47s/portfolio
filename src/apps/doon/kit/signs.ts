import * as THREE from "three"

/**
 * Shop boards and road signs, drawn once into one atlas in a pixel font and
 * snapped to two colours so they stay crisp at the game's resolution.
 */

export type UvRect = [number, number, number, number]

export type SignStyle = {
  bg: number
  fg: number
  border?: number
  /** Twice the size, for the big boards (ISBT, the cantonment arch). */
  big?: boolean
  /** A second line under the first, e.g. the Hindi name. */
  sub?: string
}

export type SignRect = { rect: UvRect; aspect: number }

export interface Signs {
  get(text: string, style: SignStyle): SignRect
}

/** Stands in where there's no canvas (tests). */
export class NoSigns implements Signs {
  get(text: string, style: SignStyle): SignRect {
    return { rect: [0, 0, 1, 1], aspect: Math.max(2, text.length * (style.big ? 0.9 : 0.6)) }
  }
}

const SIZE = 1024
const PIXEL = `"Press Start 2P", "VT323", monospace`
const DEVANAGARI = `"Noto Sans Devanagari", "Nirmala UI", "Kohinoor Devanagari", "Mangal", sans-serif`

const css = (hex: number) => `#${hex.toString(16).padStart(6, "0")}`

export class SignAtlas implements Signs {
  readonly canvas: HTMLCanvasElement
  readonly texture: THREE.CanvasTexture
  private ctx: CanvasRenderingContext2D
  private cache = new Map<string, SignRect>()
  private x = 0
  private y = 0
  private rowH = 0

  constructor() {
    this.canvas = document.createElement("canvas")
    this.canvas.width = SIZE
    this.canvas.height = SIZE
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!
    this.ctx.imageSmoothingEnabled = false
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.magFilter = THREE.NearestFilter
    this.texture.minFilter = THREE.NearestFilter
    this.texture.generateMipmaps = false
    this.texture.colorSpace = THREE.SRGBColorSpace
  }

  get(text: string, style: SignStyle): SignRect {
    const key = `${text}|${style.bg}|${style.fg}|${style.border ?? -1}|${style.big ? 1 : 0}|${style.sub ?? ""}`
    const hit = this.cache.get(key)
    if (hit) return hit

    const ctx = this.ctx
    const unit = style.big ? 16 : 8
    const subPx = style.big ? 14 : 10
    ctx.font = `${unit}px ${PIXEL}`
    const mainW = Math.ceil(ctx.measureText(text).width)
    let subW = 0
    if (style.sub) {
      ctx.font = `bold ${subPx}px ${DEVANAGARI}`
      subW = Math.ceil(ctx.measureText(style.sub).width)
    }
    const pad = style.big ? 10 : 5
    const w = Math.max(mainW, subW) + pad * 2
    const h = unit + pad * 2 + (style.sub ? subPx + 4 : 0)

    if (this.x + w + 2 > SIZE) {
      this.x = 0
      this.y += this.rowH + 2
      this.rowH = 0
    }
    if (this.y + h > SIZE) {
      // Full: reuse the first sign rather than fail.
      const first = this.cache.values().next().value
      return first ?? { rect: [0, 0, 1, 1], aspect: w / h }
    }
    const x = this.x
    const y = this.y
    this.x += w + 2
    this.rowH = Math.max(this.rowH, h)

    ctx.fillStyle = css(style.bg)
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = css(style.fg)
    ctx.textBaseline = "top"
    ctx.textAlign = "center"
    ctx.font = `${unit}px ${PIXEL}`
    ctx.fillText(text, x + w / 2, y + pad)
    if (style.sub) {
      ctx.font = `bold ${subPx}px ${DEVANAGARI}`
      ctx.fillText(style.sub, x + w / 2, y + pad + unit + 2)
    }
    this.snap(x, y, w, h, style.bg, style.fg)
    if (style.border !== undefined) {
      ctx.fillStyle = css(style.border)
      const b = style.big ? 2 : 1
      ctx.fillRect(x, y, w, b)
      ctx.fillRect(x, y + h - b, w, b)
      ctx.fillRect(x, y, b, h)
      ctx.fillRect(x + w - b, y, b, h)
    }
    this.texture.needsUpdate = true

    // Canvas y runs down, texture v runs up (flipY).
    const rect: UvRect = [x / SIZE, 1 - (y + h) / SIZE, (x + w) / SIZE, 1 - y / SIZE]
    const out = { rect, aspect: w / h }
    this.cache.set(key, out)
    return out
  }

  /** Every pixel becomes either the board or the letters: no grey fringe. */
  private snap(x: number, y: number, w: number, h: number, bg: number, fg: number) {
    const img = this.ctx.getImageData(x, y, w, h)
    const d = img.data
    const b = [(bg >> 16) & 255, (bg >> 8) & 255, bg & 255]
    const f = [(fg >> 16) & 255, (fg >> 8) & 255, fg & 255]
    for (let i = 0; i < d.length; i += 4) {
      const db = Math.abs(d[i] - b[0]) + Math.abs(d[i + 1] - b[1]) + Math.abs(d[i + 2] - b[2])
      const df = Math.abs(d[i] - f[0]) + Math.abs(d[i + 1] - f[1]) + Math.abs(d[i + 2] - f[2])
      const c = df < db ? f : b
      d[i] = c[0]
      d[i + 1] = c[1]
      d[i + 2] = c[2]
      d[i + 3] = 255
    }
    this.ctx.putImageData(img, x, y)
  }
}
