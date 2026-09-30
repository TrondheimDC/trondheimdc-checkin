import { strFromU8, strToU8, unzipSync, zipSync } from "fflate"
import QRCode from "qrcode"

/**
 * Brother's QR barcode object (`barcode:qrcodeStyle`) has a `cellSize` in pt
 * — a fixed module size. QR `version` (module count) auto-scales with data
 * length, so a fixed cellSize renders a visibly different physical size for
 * a short URL (e.g. a printer login token) than a long one (e.g. a printer
 * setup URL) from the same template. `cellSize="auto"` looked like the
 * obvious fix, but Smooth Print doesn't honor it as "fill the frame" —
 * tested on device, it rendered the QR smaller, not larger. So we compute
 * the fill ourselves: figure out the QR's real module count for the exact
 * string being printed, then patch cellSize into the template so
 * `modules * cellSize` lands on a fixed physical size, regardless of how
 * long the data is.
 */

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

/**
 * Module grid size Brother's QR object (model 2, ECC M) produces for `data`.
 *
 * Byte mode, deliberately: the template's own geometry says Brother does not
 * do mixed-mode segment optimization. The frame is 99pt at cellSize 2pt =
 * 49.5 modules, and the printer setup URL is 49 modules in byte mode (45 if
 * segment-optimized) — i.e. the known-good template is calibrated for the
 * byte-mode count.
 */
function qrModuleCount(data: string): number {
  const bytes = new TextEncoder().encode(data)
  return QRCode.create([{ data: bytes, mode: "byte" }], { errorCorrectionLevel: "M" }).modules.size
}

/** Width (pt) of the QR object's frame, so the template stays the source of truth. */
function barcodeFrameWidthPt(labelXml: string): number {
  const match = labelXml.match(/<barcode:barcode>[\s\S]*?<pt:objectStyle[^>]*\bwidth="([\d.]+)pt"/)
  if (!match) throw new Error("lbx_barcode_frame_not_found")
  return Number(match[1])
}

/**
 * Rewrites the sticker template's QR `cellSize` so `qr` fills the QR object's
 * frame no matter how long it is. Rounds down, since the object is
 * `allowOutOfBoundsTransfer="false"` — overflowing the frame would clip the
 * QR and make it unscannable, while a hair too small is harmless.
 */
export async function fitStickerQrCellSize(fileBase64: string, qr: string): Promise<string> {
  // Keep every entry: the sticker art ships as Object*.bmp next to label.xml.
  const entries = unzipSync(base64ToBytes(fileBase64))
  const labelEntry = entries["label.xml"]
  if (!labelEntry) throw new Error("lbx_entry_not_found")
  const labelXml = strFromU8(labelEntry)

  const modules = qrModuleCount(qr)
  const cellSize = (Math.floor((barcodeFrameWidthPt(labelXml) / modules) * 100) / 100).toFixed(2)
  const patchedXml = labelXml.replace(/cellSize="[^"]*"/, `cellSize="${cellSize}pt"`)
  if (patchedXml === labelXml) throw new Error("lbx_cellsize_not_found")

  entries["label.xml"] = strToU8(patchedXml)
  return bytesToBase64(zipSync(entries))
}
