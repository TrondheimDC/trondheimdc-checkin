/**
 * Android launcher icons for the Capacitor app, from the web app icon (`src/app/icon1.svg`).
 *
 *   pnpm build:android-icons
 *
 * Writes legacy square + round PNGs and the adaptive-icon foreground per density.
 * The adaptive background is the icon's own dark tile colour (`values/ic_launcher_background.xml`).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"

const SOURCE = "src/app/icon1.svg"
const RES = "capacitor/android/app/src/main/res"

/** Icon tile colour in icon1.svg. */
const TILE = "#141414"

/** Bounding box of the printer art inside the 1024 viewBox. */
const ART = { x: 228, y: 157, width: 584, height: 687 }

/** Legacy launcher icon size (dp 48) and adaptive layer size (dp 108) per density. */
const DENSITIES = [
  { name: "mdpi", legacy: 48, adaptive: 108 },
  { name: "hdpi", legacy: 72, adaptive: 162 },
  { name: "xhdpi", legacy: 96, adaptive: 216 },
  { name: "xxhdpi", legacy: 144, adaptive: 324 },
  { name: "xxxhdpi", legacy: 192, adaptive: 432 },
]

const svg = readFileSync(SOURCE, "utf8")
/** The art without its rounded tile: the adaptive background supplies the tile. */
const art = svg.replace(/<rect[^>]*\/>/, "")

/** Same art, centred on a square canvas `scale` times the art height. */
function framed(scale: number, background: "none" | "circle"): string {
  const side = ART.height * scale
  const cx = ART.x + ART.width / 2
  const cy = ART.y + ART.height / 2
  const viewBox = `${cx - side / 2} ${cy - side / 2} ${side} ${side}`
  const circle =
    background === "circle" ? `<circle cx="${cx}" cy="${cy}" r="${side / 2}" fill="${TILE}"/>` : ""
  return art
    .replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`)
    .replace(/(<svg[^>]*>)/, `$1${circle}`)
}

// Launchers mask the 108 dp layer down to ~66 dp; art at half the layer stays clear of the mask.
const foreground = framed(2, "none")
const round = framed(1.45, "circle")

async function render(source: string, size: number, file: string) {
  const png = await sharp(Buffer.from(source), { density: 300 }).resize(size, size).png().toBuffer()
  writeFileSync(file, png)
}

async function main() {
  for (const density of DENSITIES) {
    const dir = join(RES, `mipmap-${density.name}`)
    mkdirSync(dir, { recursive: true })
    await render(svg, density.legacy, join(dir, "ic_launcher.png"))
    await render(round, density.legacy, join(dir, "ic_launcher_round.png"))
    await render(foreground, density.adaptive, join(dir, "ic_launcher_foreground.png"))
  }

  writeFileSync(
    join(RES, "values/ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${TILE}</color>\n</resources>\n`,
  )

  console.log(`Wrote launcher icons for ${DENSITIES.length} densities to ${RES}`)
}

void main()
