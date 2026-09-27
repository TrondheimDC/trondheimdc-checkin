import QRCode from "qrcode"

/**
 * Brother's QR barcode object (`barcode:qrcodeStyle`) has a `cellSize` in pt
 * — a fixed module size. QR `version` (module count) auto-scales with data
 * length, so a fixed cellSize renders a visibly different physical size for
 * a short URL (e.g. a stasjon login token) than a long one (e.g. a printer
 * setup URL) from the same template. `cellSize="auto"` looked like the
 * obvious fix, but Smooth Print doesn't honor it as "fill the frame" —
 * tested on device, it rendered the QR smaller, not larger. So we compute
 * the fill ourselves: figure out the QR's real module count for the exact
 * string being printed, then patch cellSize into the template so
 * `modules * cellSize` lands on a fixed physical size, regardless of how
 * long the data is.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function u16(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff])
}

function u32(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff])
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8)
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0
  )
}

/** Minimal ZIP writer: STORED (uncompressed) entries only — plenty for a ~4KB label. */
function buildStoredZip(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const { name, data } of entries) {
    const nameBytes = new TextEncoder().encode(name)
    const crc = crc32(data)
    // DOS date/time 0x21/0x0000 = 1980-01-01 00:00 (no zip comment cares).
    const local = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0x21),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data,
    ])
    localParts.push(local)
    centralParts.push(
      concatBytes([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0x21),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(nameBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBytes,
      ]),
    )
    offset += local.length
  }

  const localBuf = concatBytes(localParts)
  const centralBuf = concatBytes(centralParts)
  const eocd = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(centralBuf.length),
    u32(localBuf.length),
    u16(0),
  ])
  return concatBytes([localBuf, centralBuf, eocd])
}

/** Reads one entry from a STORED-only ZIP via its central directory. */
function readStoredZipEntry(zip: Uint8Array, name: string): Uint8Array {
  const EOCD_SIG = 0x06054b50
  let eocdOffset = -1
  for (let i = zip.length - 22; i >= 0; i--) {
    if (readU32(zip, i) === EOCD_SIG) {
      eocdOffset = i
      break
    }
  }
  if (eocdOffset < 0) throw new Error("lbx_not_a_zip")

  const entryCount = readU16(zip, eocdOffset + 10)
  let ptr = readU32(zip, eocdOffset + 16)

  for (let i = 0; i < entryCount; i++) {
    const method = readU16(zip, ptr + 10)
    const compSize = readU32(zip, ptr + 20)
    const nameLen = readU16(zip, ptr + 28)
    const extraLen = readU16(zip, ptr + 30)
    const commentLen = readU16(zip, ptr + 32)
    const localHeaderOffset = readU32(zip, ptr + 42)
    const entryName = new TextDecoder().decode(zip.subarray(ptr + 46, ptr + 46 + nameLen))

    if (entryName === name) {
      if (method !== 0) throw new Error("lbx_entry_compressed")
      const lNameLen = readU16(zip, localHeaderOffset + 26)
      const lExtraLen = readU16(zip, localHeaderOffset + 28)
      const dataStart = localHeaderOffset + 30 + lNameLen + lExtraLen
      return zip.subarray(dataStart, dataStart + compSize)
    }
    ptr += 46 + nameLen + extraLen + commentLen
  }
  throw new Error("lbx_entry_not_found")
}

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
  return QRCode.create([{ data: bytes, mode: "byte" }], { errorCorrectionLevel: "M" })
    .modules.size
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
  const zip = base64ToBytes(fileBase64)
  const labelXml = new TextDecoder("utf-8").decode(readStoredZipEntry(zip, "label.xml"))
  const propBytes = readStoredZipEntry(zip, "prop.xml")

  const modules = qrModuleCount(qr)
  const cellSize = (Math.floor((barcodeFrameWidthPt(labelXml) / modules) * 100) / 100).toFixed(2)
  const patchedXml = labelXml.replace(/cellSize="[^"]*"/, `cellSize="${cellSize}pt"`)
  if (patchedXml === labelXml) throw new Error("lbx_cellsize_not_found")

  const patchedZip = buildStoredZip([
    { name: "label.xml", data: new TextEncoder().encode(patchedXml) },
    { name: "prop.xml", data: propBytes },
  ])
  return bytesToBase64(patchedZip)
}
