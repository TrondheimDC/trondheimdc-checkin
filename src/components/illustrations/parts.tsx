import type { ReactNode } from "react"

/** Shared palette for guide illustrations — matches the app tokens on a dark surface. */
export const ink = "#0f0f0f"
export const paper = "#fefefe"
export const brand = "#9bf7a9"
export const lcdFill = "#56605a"
export const lcdText = "#dfe9e1"

type Place = { x?: number; y?: number; scale?: number }

function place({ x = 0, y = 0, scale = 1 }: Place) {
  return `translate(${x} ${y}) scale(${scale})`
}

/** Printer screen size in `QlPrinter` local units. */
export const lcdSize = { w: 96, h: 34 }

/**
 * Brother QL-820NWBc seen from the front: white shell, black hood and face,
 * LCD, button row, label exit, tall white base. Local box is 170 × 190.
 * `lcd` draws inside the 96 × 34 screen. `children` draw on top in local units.
 */
export function QlPrinter({
  lcd,
  open = false,
  children,
  ...at
}: Place & { lcd?: ReactNode; open?: boolean; children?: ReactNode }) {
  const hood = "M0 28a28 28 0 0 1 28-28h114a28 28 0 0 1 28 28v6c0 14-8 22-22 26H22C8 56 0 48 0 34z"
  return (
    <g transform={place(at)}>
      <ellipse cx="85" cy="190" rx="84" ry="6" fill="#000" opacity="0.35" />

      {/* Shell with a darker base lip */}
      <rect x="0" y="0" width="170" height="188" rx="28" fill="#cfcfcf" />
      <rect x="0" y="0" width="170" height="176" rx="28" fill="#f2f2f2" />

      {open ? (
        <>
          {/* Roll compartment with the DK roll; the serial barcode label sits below the roll */}
          <rect x="8" y="10" width="154" height="58" rx="14" fill="#0a0a0a" />
          <rect x="38" y="24" width="94" height="28" rx="14" fill="#fafafa" />
          <rect x="30" y="21" width="14" height="34" rx="4" fill="#2e2e2e" />
          <rect x="126" y="21" width="14" height="34" rx="4" fill="#2e2e2e" />
          <rect x="46" y="56" width="78" height="10" rx="2" fill={paper} />
          {Array.from({ length: 22 }, (_, i) => (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: static decoration
              key={i}
              x={50 + i * 3.4}
              y="58"
              width={i % 3 === 0 ? 2 : 1.1}
              height="6"
              fill={ink}
            />
          ))}
          <rect x="24" y="-26" width="6" height="36" fill="#2a2a2a" />
          <rect x="140" y="-26" width="6" height="36" fill="#2a2a2a" />
          <g transform="translate(0 -46)">
            <path d={hood} fill="#1d1d1d" />
            <rect x="18" y="5" width="134" height="4" rx="2" fill="#2e2e2e" />
          </g>
        </>
      ) : (
        <>
          <path d={hood} fill="#1d1d1d" />
          <rect x="18" y="5" width="134" height="4" rx="2" fill="#2c2c2c" />
          <text
            x="85"
            y="24"
            textAnchor="middle"
            fill="#e8e8e8"
            fontSize="10"
            fontWeight="700"
            letterSpacing="-0.3"
          >
            brother
          </text>
        </>
      )}

      {/* Front face */}
      <rect x="14" y={open ? 72 : 34} width="142" height={open ? 78 : 116} rx="16" fill="#161616" />

      {open ? null : (
        <>
          <rect x="33" y="42" width="104" height="42" rx="5" fill="#0b0b0b" />
          <rect x="37" y="46" width={lcdSize.w} height={lcdSize.h} rx="3" fill={lcdFill} />
          <g transform="translate(37 46)">{lcd}</g>
        </>
      )}

      <circle cx="26" cy="100" r="2" fill="#6bf07f" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <circle
          key={i}
          cx={38 + i * 15.67}
          cy="100"
          r="5"
          fill="#2a2a2a"
          stroke="#3d3d3d"
          strokeWidth="1"
        />
      ))}

      {/* Label exit */}
      <rect x="28" y="116" width="114" height="24" rx="5" fill="#070707" />
      <rect x="36" y="124" width="98" height="3" rx="1.5" fill="#262626" />

      {children}
    </g>
  )
}

/** Portrait phone. `children` draw in local units on a `w × h` screen (inset 6). */
export function Phone({
  x = 0,
  y = 0,
  w,
  h,
  screen = "#161616",
  children,
}: {
  x?: number
  y?: number
  w: number
  h: number
  screen?: string
  children?: ReactNode
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        x="0"
        y="0"
        width={w}
        height={h}
        rx="22"
        fill="#0d0d0d"
        stroke="#7a7a7a"
        strokeWidth="3"
      />
      <rect x="6" y="6" width={w - 12} height={h - 12} rx="16" fill={screen} />
      <rect x={w / 2 - 18} y="12" width="36" height="9" rx="4.5" fill="#000" />
      {children}
    </g>
  )
}

/** Deterministic QR-looking grid: three finder patterns plus hashed data modules. */
function qrPath(seed: number) {
  const n = 21
  const finder = (x: number, y: number) => {
    for (const [fx, fy] of [
      [0, 0],
      [n - 7, 0],
      [0, n - 7],
    ]) {
      const dx = x - fx
      const dy = y - fy
      if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) {
        if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return false
        const ring = dx === 0 || dy === 0 || dx === 6 || dy === 6
        const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4
        return ring || core
      }
    }
    return null
  }
  let d = ""
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let on = finder(x, y)
      if (on === null) {
        if (x === 6 || y === 6) on = (x + y) % 2 === 0
        else {
          let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0
          h = Math.imul(h ^ (h >>> 13), 1274126177)
          h ^= h >>> 16
          on = (h >>> 0) % 100 < 50
        }
      }
      if (on) d += `M${x} ${y}h1v1h-1z`
    }
  }
  return d
}

export function Qr({
  x = 0,
  y = 0,
  size,
  seed = 1,
}: {
  x?: number
  y?: number
  size: number
  seed?: number
}) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${size / 21})`}
      d={qrPath(seed)}
      fill={ink}
      shapeRendering="crispEdges"
    />
  )
}

/** Printed sticker: name above a square QR (same layout as `StickerPreview`). */
export function Sticker({
  x = 0,
  y = 0,
  w,
  name,
  seed,
}: {
  x?: number
  y?: number
  w: number
  name: string
  seed?: number
}) {
  const qr = w * 0.72
  const h = w * 0.3 + qr + w * 0.14
  // Long names shrink to fit, like the template's fixed text frame.
  const fontSize = Math.min(w * 0.16, (w * 0.9) / (name.length * 0.56))
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width={w} height={h} rx={w * 0.08} fill={paper} />
      <text
        x={w / 2}
        y={w * 0.15 + fontSize * 0.36}
        textAnchor="middle"
        fill={ink}
        fontSize={fontSize}
        fontWeight="700"
      >
        {name}
      </text>
      <Qr x={(w - qr) / 2} y={w * 0.3} size={qr} seed={seed} />
    </g>
  )
}

export function BluetoothGlyph({
  x = 0,
  y = 0,
  size,
  color,
}: {
  x?: number
  y?: number
  size: number
  color: string
}) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${size / 24})`}
      d="m7 7 10 10-5 5V2l5 5L7 17"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

export function Toggle({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width="24" height="14" rx="7" fill="#4cd964" />
      <circle cx="17" cy="7" r="5.5" fill={paper} />
    </g>
  )
}
