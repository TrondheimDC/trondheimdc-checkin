import type { ReactNode } from "react"

/** Shared palette for guide illustrations — matches the app tokens on a dark surface. */
export const ink = "#0f0f0f"
export const paper = "#fefefe"
export const brand = "#9bf7a9"
export const danger = "#f1422a"
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

/** 12 × 12 duck from public/badge/8bit-duck-dither.png, by grey level. */
const duckRows = [
  "......---...",
  ".....=----..",
  ".....=--#-..",
  ".....=----x-",
  ".....x=---..",
  "......x==...",
  "-....-----..",
  "-=------=-=.",
  "--------=-=.",
  "=--========.",
  ".x========x.",
  "..xxxxxxxx..",
]
const duckShades: Record<string, string> = {
  "-": "#d0d0d0",
  "=": "#909090",
  x: "#585858",
  "#": ink,
}

function Duck({ x, y, size }: { x: number; y: number; size: number }) {
  const cell = size / 12
  return (
    <g transform={`translate(${x} ${y}) scale(${cell})`} shapeRendering="crispEdges">
      {duckRows.flatMap((row, cy) =>
        [...row].map((shade, cx) =>
          shade === "." ? null : (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: static pixel art
              key={`${cx}-${cy}`}
              x={cx}
              y={cy}
              width="1.05"
              height="1.05"
              fill={duckShades[shade]}
            />
          ),
        ),
      )}
    </g>
  )
}

/** TDC wordmark (tdc-logo.tsx) in ink; `h` tall, 248.56 / 52 as wide. */
function TdcMark({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${h / 52})`} fill={ink}>
      <path d="M10.1 17.33H0V0h39.81v17.33H29.72V52H10.1z" />
      <path
        transform="translate(47.28 0)"
        d="M153.73 34.67C153.73 44.24 145.98 52 136.42 52H0V0h136.42c9.56 0 17.31 7.76 17.31 17.33z"
      />
      <path
        transform="translate(208.56 0)"
        d="M39.81 17.33H19.91v17.34h19.9V52H17.31C7.75 52 0 44.24 0 34.67V17.33C0 7.76 7.75 0 17.31 0h22.5z"
      />
    </g>
  )
}

/**
 * Printed DK-11208 sticker, landscape (90 × 38 mm): QR left, title top right,
 * duck, URL and TDC mark below — same frames as `StickerPreview` and
 * scripts/build-sticker-templates.ts. Drawn in template points (255.1 × 107.7),
 * scaled to `w`. `login` adds the model line of the stasjon.lbx sticker.
 */
export function Sticker({
  x = 0,
  y = 0,
  w,
  name,
  seed,
  login = false,
}: {
  x?: number
  y?: number
  w: number
  name: string
  seed?: number
  login?: boolean
}) {
  // Long names shrink to fit the 128 pt NAME frame, like the template.
  const fontSize = Math.min(15, 128 / (name.length * 0.56))
  return (
    <g transform={`translate(${x} ${y}) scale(${w / 255.1})`}>
      <rect x="0" y="0" width="255.1" height="107.7" rx="10" fill={paper} />
      <Qr x={8.4} y={4.35} size={99} seed={seed} />
      {login ? (
        <text x="244" y="12" textAnchor="end" fill={ink} fontSize="6.5" fontWeight="700">
          Model QL-820NWBc
        </text>
      ) : null}
      <text x="116" y={28 + fontSize * 0.36} fill={ink} fontSize={fontSize} fontWeight="700">
        {name}
      </text>
      <Duck x={116} y={54} size={46} />
      <text x="244" y="82" textAnchor="end" fill={ink} fontSize="6.5">
        innsjekk.trondheimdc.no
      </text>
      <TdcMark x={177.1} y={86} h={14} />
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

/** Open laptop. `children` draw in local units on a `w × h` screen (inset 6). */
export function Laptop({
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
      <ellipse cx={w / 2} cy={h + 16} rx={w / 2 + 16} ry="5" fill="#000" opacity="0.35" />
      <rect
        x="0"
        y="0"
        width={w}
        height={h}
        rx="10"
        fill="#0d0d0d"
        stroke="#7a7a7a"
        strokeWidth="3"
      />
      <rect x="6" y="6" width={w - 12} height={h - 12} rx="5" fill={screen} />
      <path d={`M-14 ${h + 2}h${w + 28}l-6 10H-8z`} fill="#cfcfcf" />
      <rect x={w / 2 - 18} y={h + 2} width="36" height="3" rx="1.5" fill="#9a9a9a" />
      {children}
    </g>
  )
}

/** Desktop window with a title bar. `children` draw in local units below the bar. */
export function AppWindow({
  x = 0,
  y = 0,
  w,
  h,
  title,
  light = false,
  children,
}: {
  x?: number
  y?: number
  w: number
  h: number
  title: string
  light?: boolean
  children?: ReactNode
}) {
  const bar = light ? "#ffffff" : "#2a2a2a"
  const body = light ? "#f0f0f0" : "#0b0b0b"
  const text = light ? ink : paper
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="0" width={w} height={h} rx="8" fill={body} />
      <path d={`M0 8a8 8 0 0 1 8-8h${w - 16}a8 8 0 0 1 8 8v14H0z`} fill={bar} />
      <text x="12" y="15" fill={text} fontSize="9" fontWeight="600">
        {title}
      </text>
      <g stroke={text} strokeOpacity="0.6" strokeWidth="1.2" fill="none">
        <path d={`M${w - 52} 11h8`} />
        <rect x={w - 36} y="7" width="7" height="7" />
        <path d={`M${w - 18} 7l7 7m0-7l-7 7`} />
      </g>
      <g transform="translate(0 22)">{children}</g>
    </g>
  )
}

export function UsbGlyph({
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
    <g
      transform={`translate(${x} ${y}) scale(${size / 24})`}
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="7" r="1" />
      <circle cx="4" cy="20" r="1" />
      <path d="M4.7 19.3 19 5" />
      <path d="m21 3-3 1 2 2Z" />
      <path d="M9.26 7.68 5 12l2 5" />
      <path d="m10 14 5 2 3.5-3.5" />
      <path d="m18 12 1-1 1 1-1 1Z" />
    </g>
  )
}
