import QRCode from "qrcode"

/** DK-11208 printable area (paper 107.7pt, margins 4.3 / 4.4). */
const PRINTABLE_WIDTH_PT = 99
const MARGIN_LEFT_PT = 4.3
/** QL-820NWB prints at 300 dpi; a QR module is a whole number of dots. */
const DPI = 300
/** margin="true" adds a quiet zone of 2 modules on each side. */
const QUIET_ZONE_MODULES = 4

/** On-screen preview only. The printed QR is drawn by Smooth Print from barcode_QR. */
export function stickerQrDataUrl(qrUrl: string): Promise<string> {
  return QRCode.toDataURL(qrUrl, {
    width: 280,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0f0f0f", light: "#fefefe" },
  })
}

/**
 * Smooth Print draws the QR top-left in its object at cellSize per module and
 * shrinks it when it would overflow, so the object must match the symbol exactly
 * and be centered. version must stay "auto": a fixed version drops the code.
 */
export function buildPrinterStickerLbx(qrUrl: string): string {
  // eccLevel="15%" is QR level M.
  const modules = QRCode.create(qrUrl, { errorCorrectionLevel: "M" }).modules.size + QUIET_ZONE_MODULES
  const printableDots = Math.floor((PRINTABLE_WIDTH_PT * DPI) / 72)
  const dotsPerModule = Math.floor(printableDots / modules)
  const cell = (dotsPerModule * 72) / DPI
  const size = modules * cell
  const x = MARGIN_LEFT_PT + (PRINTABLE_WIDTH_PT - size) / 2
  const label = printerLabelXml({ cell, x, y: 34, size })
  return bytesToBase64(
    zipStore([
      { name: "label.xml", data: label },
      { name: "prop.xml", data: PROP_XML },
    ]),
  )
}

function pt(value: number): string {
  return `${value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}pt`
}

function printerLabelXml(input: { cell: number; x: number; y: number; size: number }): string {
  return `<?xml version="1.0" encoding="UTF-8"?><pt:document xmlns:pt="http://schemas.brother.info/ptouch/2007/lbx/main" xmlns:style="http://schemas.brother.info/ptouch/2007/lbx/style" xmlns:text="http://schemas.brother.info/ptouch/2007/lbx/text" xmlns:draw="http://schemas.brother.info/ptouch/2007/lbx/draw" xmlns:image="http://schemas.brother.info/ptouch/2007/lbx/image" xmlns:barcode="http://schemas.brother.info/ptouch/2007/lbx/barcode" xmlns:database="http://schemas.brother.info/ptouch/2007/lbx/database" xmlns:table="http://schemas.brother.info/ptouch/2007/lbx/table" xmlns:cable="http://schemas.brother.info/ptouch/2007/lbx/cable" version="1.7" generator="P-touch Editor 5.4.005 Windows"><pt:body currentSheet="Sheet 1" direction="LTR"><style:sheet name="Sheet 1"><style:paper media="0" width="107.7pt" height="255.1pt" marginLeft="4.3pt" marginTop="8.4pt" marginRight="4.4pt" marginBottom="8.5pt" orientation="portrait" autoLength="false" monochromeDisplay="true" printColorDisplay="false" printColorsID="0" paperColor="#FFFFFF" paperInk="#000000" split="1" format="259" backgroundTheme="0" printerID="16692" printerName="Brother QL-820NWB"/><style:cutLine regularCut="0pt" freeCut=""/><style:backGround x="4.3pt" y="8.4pt" width="99.0pt" height="238.2pt" brushStyle="NULL" brushId="0" userPattern="NONE" userPatternId="0" color="#000000" printColorNumber="1" backColor="#FFFFFF" backPrintColorNumber="0"/><pt:objects><text:text><pt:objectStyle x="4.3pt" y="8.4pt" width="99.0pt" height="22.0pt" backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="0" anchor="TOPLEFT" flip="NONE"><pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"/><pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"/><pt:expanded objectName="NAME" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" templateMergeID="0" linkStatus="NONE" linkID="0"/></pt:objectStyle><text:ptFontInfo><text:logFont name="Helsinki" width="0" italic="false" weight="700" charSet="0" pitchAndFamily="34"/><text:fontExt effect="NOEFFECT" underline="0" strikeout="0" size="14pt" orgSize="14pt" textColor="#000000" textPrintColorNumber="1"/></text:ptFontInfo><text:textControl control="FIXEDFRAME" clipFrame="false" aspectNormal="true" shrink="true" autoLF="false" avoidImage="false"/><text:textAlign horizontalAlignment="CENTER" verticalAlignment="CENTER" inLineAlignment="CENTER"/><text:textStyle vertical="false" nullBlock="false" charSpace="0" lineSpace="0" orgPoint="14pt" combinedChars="false"/><pt:data>Printer</pt:data><text:stringItem charLen="7"><text:ptFontInfo><text:logFont name="Helsinki" width="0" italic="false" weight="700" charSet="0" pitchAndFamily="34"/><text:fontExt effect="NOEFFECT" underline="0" strikeout="0" size="14pt" orgSize="14pt" textColor="#000000" textPrintColorNumber="1"/></text:ptFontInfo></text:stringItem></text:text><barcode:barcode><pt:objectStyle x="${pt(input.x)}" y="${pt(input.y)}" width="${pt(input.size)}" height="${pt(input.size)}" backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="0" anchor="TOPLEFT" flip="NONE"><pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"/><pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"/><pt:expanded objectName="QR" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" templateMergeID="0" allowOutOfBoundsTransfer="false" linkStatus="NONE" linkID="0"/></pt:objectStyle><barcode:barcodeStyle protocol="QRCODE" lengths="0" zeroFill="false" barWidth="0.8pt" barRatio="1:3" humanReadable="false" humanReadableAlignment="LEFT" checkDigit="false" autoLengths="true" margin="true" sameLengthBar="false" bearerBar="false"/><barcode:qrcodeStyle model="2" eccLevel="15%" cellSize="${pt(input.cell)}" mbcs="auto" joint="1" version="auto"/><pt:data>https://trondheimdc.no</pt:data></barcode:barcode></pt:objects></style:sheet></pt:body></pt:document>`
}

const PROP_XML = `<?xml version="1.0" encoding="UTF-8"?><meta:properties xmlns:meta="http://schemas.brother.info/ptouch/2007/lbx/meta" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"><meta:appName>P-touch Editor</meta:appName><dc:title>Printer sticker</dc:title><dc:subject></dc:subject><dc:creator>Administrator</dc:creator><meta:keyword></meta:keyword><dc:description>DK-11208 name above QR</dc:description><meta:template></meta:template><dcterms:created>2022-06-27T18:46:25Z</dcterms:created><dcterms:modified>2026-09-25T17:58:00Z</dcterms:modified><meta:lastPrinted></meta:lastPrinted><meta:modifiedBy>Administrator</meta:modifiedBy><meta:revision>1</meta:revision><meta:editTime>0</meta:editTime><meta:numPages>1</meta:numPages><meta:numWords>0</meta:numWords><meta:numChars>0</meta:numChars><meta:security>0</meta:security></meta:properties>`

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function zipStore(files: { name: string; data: string }[]): Uint8Array {
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const file of files) {
    const name = new TextEncoder().encode(file.name)
    const data = new TextEncoder().encode(file.data)
    const crc = crc32(data)
    const local = new Uint8Array(30 + name.length + data.length)
    const view = new DataView(local.buffer)
    view.setUint32(0, 0x04034b50, true)
    view.setUint16(4, 20, true)
    view.setUint32(14, crc, true)
    view.setUint32(18, data.length, true)
    view.setUint32(22, data.length, true)
    view.setUint16(26, name.length, true)
    local.set(name, 30)
    local.set(data, 30 + name.length)
    locals.push(local)

    const central = new Uint8Array(46 + name.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, data.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint32(42, offset, true)
    central.set(name, 46)
    centrals.push(central)
    offset += local.length
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)
  const out = new Uint8Array(offset + centralSize + end.length)
  let cursor = 0
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, cursor)
    cursor += part.length
  }
  return out
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]!
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}
