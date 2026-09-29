import type { ReactNode } from "react"
import { loginStickerText } from "@/lib/public-app-url"
import { cn } from "@/lib/utils"
import {
  BluetoothGlyph,
  brand,
  ink,
  lcdText,
  Phone,
  paper,
  QlPrinter,
  Sticker,
  Toggle,
} from "./parts"

type ArtProps = { className?: string }

/** Placeholder text on drawn stickers. */
const printerName = "Printernavn"

/** Setup sticker on the front of a printer that is already set up (`QlPrinter` units). */
function FrontSticker() {
  return <Sticker x={65} y={141} w={40} name={printerName} seed={3} />
}

function Scene({ label, className, children }: ArtProps & { label: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 320 240"
      className={cn("h-auto w-full font-sans", className)}
      role="img"
      aria-label={label}
    >
      {children}
    </svg>
  )
}

/** Idle printer screen: a few status bars and the Bluetooth icon top right. */
function LcdIdle({ bluetooth = lcdText }: { bluetooth?: string }) {
  return (
    <>
      <rect x="6" y="6" width="26" height="3" rx="1.5" fill={lcdText} opacity="0.5" />
      <rect x="6" y="16" width="56" height="5" rx="2" fill={lcdText} opacity="0.85" />
      <rect x="6" y="25" width="36" height="4" rx="2" fill={lcdText} opacity="0.5" />
      <BluetoothGlyph x={81} y={3} size={11} color={bluetooth} />
    </>
  )
}

function DottedArrow({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  const dots = []
  for (let x = x1; x < x2 - 10; x += 9) dots.push(x)
  return (
    <g fill={brand}>
      {dots.map((x) => (
        <circle key={x} cx={x} cy={y} r="2.4" />
      ))}
      <path
        d={`M${x2 - 8} ${y - 6}l7 6-7 6`}
        fill="none"
        stroke={brand}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

/** `/oppsett` Bluetooth-on: the icon sits top right on the printer screen. */
export function PrinterBluetoothIllustration({ className }: ArtProps) {
  // LCD icon centre in scene units: printer at (40, 30) × 1.02, icon at local (123.5, 54.5).
  const ix = 40 + 123.5 * 1.02
  const iy = 30 + 54.5 * 1.02
  return (
    <Scene label="Bluetooth-ikonet øverst til høyre på printerskjermen" className={className}>
      <QlPrinter x={40} y={30} scale={1.02} lcd={<LcdIdle bluetooth={brand} />}>
        <FrontSticker />
      </QlPrinter>
      <circle cx={ix} cy={iy} r="9" fill="none" stroke={brand} strokeWidth="2" />
      <path
        d={`M${ix + 7} ${iy - 7}L256 58`}
        stroke={brand}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="276" cy="44" r="28" fill="#1d1d1d" stroke={brand} strokeWidth="2.5" />
      <BluetoothGlyph x={258} y={26} size={36} color={brand} />
    </Scene>
  )
}

/** `/oppsett` pair: pick the printer under Bluetooth in phone settings. */
export function PhonePairIllustration({ className }: ArtProps) {
  return (
    <Scene label="Telefonens Bluetooth-liste med QL-820NWB valgt" className={className}>
      <Phone x={12} y={12} w={124} h={216}>
        <BluetoothGlyph x={14} y={36} size={13} color="#8a8a8a" />
        <text x="32" y="47" fill={paper} fontSize="11" fontWeight="600">
          Bluetooth
        </text>
        <Toggle x={88} y={37} />

        <rect x="12" y="62" width="100" height="28" rx="7" fill={brand} />
        <text x="20" y="80" fill={ink} fontSize="9" fontWeight="700">
          QL-820NWB(XXXX)
        </text>
        {[98, 128].map((y) => (
          <g key={y}>
            <rect x="20" y={y + 10} width="54" height="6" rx="3" fill="#3a3a3a" />
            <circle cx="102" cy={y + 13} r="5" fill="none" stroke="#4a4a4a" strokeWidth="1.5" />
            <rect x="12" y={y + 26} width="100" height="1" fill="#2a2a2a" />
          </g>
        ))}
      </Phone>
      <DottedArrow x1={150} x2={198} y={120} />
      <QlPrinter x={204} y={62} scale={0.62} lcd={<LcdIdle bluetooth={brand} />}>
        <FrontSticker />
      </QlPrinter>
    </Scene>
  )
}

/** `/oppsett` scan: the setup sticker sits on the front of the printer. */
export function ScanStickerIllustration({ className }: ArtProps) {
  const corner = (x: number, y: number, dx: number, dy: number) => (
    <path
      d={`M${x} ${y + dy * 12}V${y}H${x + dx * 12}`}
      fill="none"
      stroke={brand}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
  return (
    <Scene label="Skann QR-klistremerket foran på printeren" className={className}>
      <QlPrinter x={14} y={26} scale={1} lcd={<LcdIdle />}>
        <FrontSticker />
        <rect
          x="60"
          y="136"
          width="50"
          height="56.4"
          rx="7"
          fill="none"
          stroke={brand}
          strokeWidth="2.5"
        />
      </QlPrinter>

      <Phone x={206} y={24} w={102} h={192} screen="#1d1d1d">
        <Sticker x={22} y={62} w={58} name={printerName} seed={3} />
        {corner(12, 50, 1, 1)}
        {corner(90, 50, -1, 1)}
        {corner(12, 142, 1, -1)}
        {corner(90, 142, -1, -1)}
      </Phone>
    </Scene>
  )
}

/** Door login: the login sticker is on the underside of the printer. */
export function LoginQrUnderPrinterIllustration({ className }: ArtProps) {
  return (
    <Scene label="Innloggings-QR limt under printeren" className={className}>
      <QlPrinter x={20} y={40} scale={0.7} lcd={<LcdIdle />}>
        <FrontSticker />
      </QlPrinter>

      <path
        d="M96 204C116 236 166 236 186 198"
        fill="none"
        stroke={brand}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M176.2 203L186 198l1.4 10.9"
        fill="none"
        stroke={brand}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Underside: the printer's base, feet in the corners */}
      <rect x="196" y="30" width="108" height="172" rx="24" fill="#e4e4e4" />
      <rect
        x="206"
        y="40"
        width="88"
        height="152"
        rx="16"
        fill="none"
        stroke="#cfcfcf"
        strokeWidth="1.5"
      />
      {[
        [216, 50],
        [284, 50],
        [216, 182],
        [284, 182],
      ].map(([cx, cy]) => (
        <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx="8" ry="5" fill="#3a3a3a" />
      ))}
      <Sticker x={210} y={72} w={80} name={loginStickerText(printerName)} seed={7} />
    </Scene>
  )
}

/** Enroll: read the Bluetooth address from the printer menu. */
export function MacMenuIllustration({ className }: ArtProps) {
  return (
    <Scene label="Printermeny som viser Bluetooth-adresse" className={className}>
      <QlPrinter x={16} y={66} scale={0.62} lcd={<LcdIdle />} />
      <path
        d="M98.5 94.5L154 52M98.5 115.6L154 164"
        stroke={paper}
        strokeOpacity="0.25"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <rect x="148" y="46" width="164" height="124" rx="10" fill="#0b0b0b" />
      <rect x="154" y="52" width="152" height="112" rx="6" fill="#56605a" />
      <g className="font-mono">
        <text x="164" y="76" fill={lcdText} fontSize="12" fontWeight="700">
          Bluetooth Status
        </text>
        <text x="164" y="100" fill={lcdText} fontSize="11">
          Device: QL-820NWB
        </text>
        <rect x="158" y="114" width="144" height="26" rx="4" fill={brand} />
        <text x="164" y="131" fill={ink} fontSize="11" fontWeight="700">
          Address: 00:1B:A9:…
        </text>
      </g>
    </Scene>
  )
}

/** Enroll: the serial barcode label is inside the printer, below the DK roll. */
export function SerialIllustration({ className }: ArtProps) {
  // Serial label under the roll on the open printer: local (85, 61) at (16, 84) × 0.66.
  const sx = 16 + 85 * 0.66
  const sy = 84 + 61 * 0.66
  return (
    <Scene
      label="Strekkode med serienummer inne i printeren, under etikettrullen"
      className={className}
    >
      <QlPrinter x={16} y={84} scale={0.66} open />
      <circle cx={sx} cy={sy} r="13" fill="none" stroke={brand} strokeWidth="2" />
      <path
        d={`M${sx + 12} ${sy - 6}L168 76M${sx + 12} ${sy + 6}L168 150`}
        stroke={paper}
        strokeOpacity="0.25"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <rect x="168" y="62" width="140" height="100" rx="8" fill={paper} />
      {Array.from({ length: 30 }, (_, i) => (
        <rect
          // biome-ignore lint/suspicious/noArrayIndexKey: static decoration
          key={i}
          x={182 + i * 3.8}
          y="78"
          width={i % 3 === 0 ? 2.4 : i % 2 === 0 ? 1.6 : 1}
          height="44"
          fill={ink}
        />
      ))}
      <text
        x="238"
        y="146"
        textAnchor="middle"
        fill={ink}
        fontSize="13"
        fontWeight="700"
        className="font-mono"
      >
        E00000…
      </text>
    </Scene>
  )
}

/** Enroll / inventory: the printer prints the setup sticker (name above QR). */
export function StickerIllustration({ className }: ArtProps) {
  return (
    <Scene label="Printeren skriver ut etikett med navn over QR" className={className}>
      <QlPrinter x={79} y={8} scale={0.95} lcd={<LcdIdle />}>
        <FrontSticker />
      </QlPrinter>
    </Scene>
  )
}
