import QRCode from "qrcode"

/**
 * Draws DK-11208 labels (badge, printer stickers) in the browser for USB printing (PC/Mac).
 *
 * Phones print `public/templates/*.lbx` through Smooth Print. Over USB the
 * printer only takes raster dots, so this redraws the same layout. The numbers
 * below are copied from each template's `label.xml` — change them together
 * with the LBX when the badge layout moves.
 */

/** QL-820NWB head resolution. */
const DPI = 300

/** Printable area of DK-11208 at 300 dpi: 413 dots across the head, 991 along the feed. */
export const BADGE_DOTS = { across: 413, along: 991 } as const

/** LBX page is portrait 107.7 × 255.1 pt with these margins; the printable area starts here. */
const PAGE_MARGIN_PT = { left: 4.3, top: 8.4 }

type PtRect = { x: number; y: number; width: number; height: number }
type DotRect = PtRect

/** Portrait LBX frames (pt). Text uses angle="90", so it runs along the 90 mm edge. */
const NAME_FRAME: PtRect = { x: 45.8, y: 8.4, width: 48, height: 238.2 }
const LINE2_FRAME: PtRect = { x: 13.8, y: 8.4, width: 26, height: 238.2 }
const DUCK_FRAME: PtRect = { x: 6.3, y: 224.6, width: 20, height: 20 }

const NAME_FONT = { sizePt: 32, weight: 700 }
const LINE2_FONT = { sizePt: 16, weight: 400 }

/** `printer.lbx` / `stasjon.lbx`: upright name on top, QR under it. */
const STICKER_NAME_FRAME: PtRect = { x: 4.3, y: 8.4, width: 99, height: 20 }
const STICKER_NAME_FONT = { sizePt: 14, weight: 700 }
const STICKER_QR_TOP_PT = 30
/**
 * The LBX QR frame is the full printable width. Keep ~2 mm inside it so the QR
 * keeps a quiet zone on the 38 mm label, and snap to whole dots per module.
 */
const STICKER_QR_MAX_DOTS = 372

/** P-touch "Helsinki" is Brother's Helvetica; use whatever Helvetica/Arial the desktop has. */
const FONT_FAMILY = '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif'

type DuckStyle = "dither" | "mono"

/** Keyed by the `.lbx` filename phones use, so both paths pick the same variant. */
const TEMPLATE_DUCK: Record<string, DuckStyle | null> = {
  "badge.lbx": "dither",
  "badge-duck-mono.lbx": "mono",
  "badge-plain.lbx": null,
}

const DUCK_ASSET: Record<DuckStyle, string> = {
  dither: "/badge/8bit-duck-dither.png",
  mono: "/badge/8bit-duck-mono.png",
}

function ptToDots(pt: number): number {
  return (pt * DPI) / 72
}

/**
 * Portrait LBX frame → rect on the landscape canvas (how the badge is read).
 * Reading the badge turns the portrait page a quarter turn counter-clockwise:
 * the NAME frame (right side of the page) ends up on top, the duck bottom-right.
 */
function landscapeRect(frame: PtRect): DotRect {
  const px = ptToDots(frame.x - PAGE_MARGIN_PT.left)
  const py = ptToDots(frame.y - PAGE_MARGIN_PT.top)
  const pw = ptToDots(frame.width)
  const ph = ptToDots(frame.height)
  return { x: py, y: BADGE_DOTS.across - px - pw, width: ph, height: pw }
}

/** Portrait LBX frame → rect on the portrait canvas (sticker layout, no rotation). */
function portraitRect(frame: PtRect): DotRect {
  return {
    x: ptToDots(frame.x - PAGE_MARGIN_PT.left),
    y: ptToDots(frame.y - PAGE_MARGIN_PT.top),
    width: ptToDots(frame.width),
    height: ptToDots(frame.height),
  }
}

function assetUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || ""
  return `${base}${path}`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`image load failed: ${src}`))
    image.src = src
  })
}

/** Single line, centred, shrunk to fit — like the LBX `FIXEDFRAME` + `shrink="true"`. */
function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  rect: DotRect,
  font: { sizePt: number; weight: number },
) {
  const value = text.trim()
  if (!value) return
  let size = ptToDots(font.sizePt)
  ctx.font = `${font.weight} ${size}px ${FONT_FAMILY}`
  const measured = ctx.measureText(value).width
  if (measured > rect.width) {
    size = (size * rect.width) / measured
    ctx.font = `${font.weight} ${size}px ${FONT_FAMILY}`
  }
  const metrics = ctx.measureText(value)
  const ascent = metrics.fontBoundingBoxAscent ?? size * 0.8
  const descent = metrics.fontBoundingBoxDescent ?? size * 0.2
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  ctx.fillText(value, rect.x + rect.width / 2, rect.y + rect.height / 2 + (ascent - descent) / 2)
}

/** 8×8 Bayer thresholds for the duck's grey cells (P-touch uses a mesh dither here). */
const BAYER_8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28,
  52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7,
  39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
]

function luminance(data: Uint8ClampedArray, i: number): number {
  // Transparent pixels are the white label.
  const alpha = data[i + 3]! / 255
  const lum = 0.3 * data[i]! + 0.59 * data[i + 1]! + 0.11 * data[i + 2]!
  return lum * alpha + 255 * (1 - alpha)
}

async function drawDuck(ctx: CanvasRenderingContext2D, style: DuckStyle) {
  const image = await loadImage(assetUrl(DUCK_ASSET[style]))
  const rect = landscapeRect(DUCK_FRAME)
  const x = Math.round(rect.x)
  const y = Math.round(rect.y)
  const size = Math.round(rect.width)

  const scratch = document.createElement("canvas")
  scratch.width = size
  scratch.height = size
  const sctx = scratch.getContext("2d")
  if (!sctx) throw new Error("canvas unavailable")
  // Pixel art: keep the cells crisp.
  sctx.imageSmoothingEnabled = false
  sctx.drawImage(image, 0, 0, size, size)
  const pixels = sctx.getImageData(0, 0, size, size)

  const target = ctx.getImageData(x, y, size, size)
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const i = (row * size + col) * 4
      const lum = luminance(pixels.data, i)
      const threshold =
        style === "mono" ? 128 : ((BAYER_8[(row % 8) * 8 + (col % 8)]! + 0.5) / 64) * 255
      if (lum < threshold) {
        target.data[i] = 0
        target.data[i + 1] = 0
        target.data[i + 2] = 0
        target.data[i + 3] = 255
      }
    }
  }
  ctx.putImageData(target, x, y)
}

/** Snap anti-aliased text to pure black/white so the printer's dither leaves it alone. */
function threshold(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const image = ctx.getImageData(0, 0, width, height)
  const { data } = image
  for (let i = 0; i < data.length; i += 4) {
    const value = luminance(data, i) < 128 ? 0 : 255
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
    data[i + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
}

function blankLabel(width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("canvas unavailable")
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = "#000"
  return { canvas, ctx }
}

export type BadgeInput = {
  name: string
  line2: string
  /** `.lbx` filename from `PRINT_SAMPLES`; defaults to the production badge. */
  template?: string
}

/** Landscape 991 × 413 canvas: exactly the dots that print, the way the badge is read. */
export async function renderBadge(input: BadgeInput): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = blankLabel(BADGE_DOTS.along, BADGE_DOTS.across)
  await document.fonts.ready
  drawFittedText(ctx, input.name, landscapeRect(NAME_FRAME), NAME_FONT)
  drawFittedText(ctx, input.line2, landscapeRect(LINE2_FRAME), LINE2_FONT)
  threshold(ctx, canvas.width, canvas.height)

  const duck = TEMPLATE_DUCK[input.template ?? "badge.lbx"] ?? null
  if (duck) await drawDuck(ctx, duck)
  return canvas
}

/**
 * Portrait 413 × 991 image for the print head (x across the head, y along the feed) —
 * the LBX page orientation. Undo the reading turn: rotate the landscape canvas clockwise.
 */
export function badgePrintImage(landscape: HTMLCanvasElement): {
  width: number
  height: number
  data: Uint8Array
} {
  const ctx = landscape.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("canvas unavailable")
  const source = ctx.getImageData(0, 0, landscape.width, landscape.height)
  const width = landscape.height
  const height = landscape.width
  const out = { width, height, data: new Uint8Array(width * height * 4) }
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const from = ((width - 1 - px) * source.width + py) * 4
      const to = (py * width + px) * 4
      out.data[to] = source.data[from]!
      out.data[to + 1] = source.data[from + 1]!
      out.data[to + 2] = source.data[from + 2]!
      out.data[to + 3] = 255
    }
  }
  return out
}

/**
 * Portrait 413 × 991 printer sticker (`printer.lbx` / `stasjon.lbx` layout):
 * name on top, QR under it. Byte-mode ECC M, like Brother's QR object.
 */
export async function renderSticker(input: {
  name: string
  qr: string
}): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = blankLabel(BADGE_DOTS.across, BADGE_DOTS.along)
  await document.fonts.ready
  drawFittedText(ctx, input.name, portraitRect(STICKER_NAME_FRAME), STICKER_NAME_FONT)
  threshold(ctx, canvas.width, canvas.height)

  const qr = QRCode.create([{ data: new TextEncoder().encode(input.qr), mode: "byte" }], {
    errorCorrectionLevel: "M",
  })
  const count = qr.modules.size
  const cell = Math.floor(STICKER_QR_MAX_DOTS / count)
  const left = Math.round((BADGE_DOTS.across - cell * count) / 2)
  const top = Math.round(ptToDots(STICKER_QR_TOP_PT - PAGE_MARGIN_PT.top))
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.modules.get(row, col)) ctx.fillRect(left + col * cell, top + row * cell, cell, cell)
    }
  }
  return canvas
}

/** Portrait canvas → head image as-is (the sticker is laid out in print orientation). */
export function portraitPrintImage(portrait: HTMLCanvasElement): {
  width: number
  height: number
  data: Uint8Array
} {
  const ctx = portrait.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("canvas unavailable")
  const { data, width, height } = ctx.getImageData(0, 0, portrait.width, portrait.height)
  return { width, height, data: new Uint8Array(data.buffer) }
}
