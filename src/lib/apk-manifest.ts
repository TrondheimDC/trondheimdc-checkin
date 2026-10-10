import { readFile } from "node:fs/promises"
import { unzipSync } from "fflate"

/**
 * `package`, `versionCode` and `versionName` from an APK, read from the root `<manifest>`
 * element of its binary `AndroidManifest.xml` (Android's compiled XML, "AXML"). Only that
 * first element is parsed — enough to tell which app and which build an upload is.
 */
export type ApkManifest = {
  packageName: string | null
  versionCode: number | null
  versionName: string | null
}

const CHUNK_STRING_POOL = 0x0001
const CHUNK_RESOURCE_MAP = 0x0180
const CHUNK_START_ELEMENT = 0x0102
const UTF8_FLAG = 1 << 8
/** android:versionCode / android:versionName resource ids. */
const ATTR_VERSION_CODE = 0x0101021b
const ATTR_VERSION_NAME = 0x0101021c
const TYPE_STRING = 0x03
const TYPE_INT_DEC = 0x10
const TYPE_INT_HEX = 0x11
const NO_INDEX = 0xffffffff

function readStringPool(view: DataView, start: number): string[] {
  const count = view.getUint32(start + 8, true)
  const utf8 = (view.getUint32(start + 16, true) & UTF8_FLAG) !== 0
  const stringsStart = start + view.getUint32(start + 20, true)
  const offsets = start + view.getUint16(start + 2, true)
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  const strings: string[] = []
  for (let i = 0; i < count; i++) {
    let at = stringsStart + view.getUint32(offsets + i * 4, true)
    if (utf8) {
      // UTF-16 length, then UTF-8 byte length; each one or two bytes.
      at += view.getUint8(at) & 0x80 ? 2 : 1
      let length = view.getUint8(at)
      if (length & 0x80) {
        length = ((length & 0x7f) << 8) | view.getUint8(at + 1)
        at += 2
      } else {
        at += 1
      }
      strings.push(new TextDecoder().decode(bytes.subarray(at, at + length)))
    } else {
      let length = view.getUint16(at, true)
      if (length & 0x8000) {
        length = ((length & 0x7fff) << 16) | view.getUint16(at + 2, true)
        at += 4
      } else {
        at += 2
      }
      strings.push(new TextDecoder("utf-16le").decode(bytes.subarray(at, at + length * 2)))
    }
  }
  return strings
}

export function parseManifestXml(data: Uint8Array): ApkManifest {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const result: ApkManifest = { packageName: null, versionCode: null, versionName: null }
  let strings: string[] = []
  let resourceIds: number[] = []
  // File header (8 bytes), then chunks.
  let at = view.getUint16(2, true)
  while (at + 8 <= view.byteLength) {
    const type = view.getUint16(at, true)
    const headerSize = view.getUint16(at + 2, true)
    const size = view.getUint32(at + 4, true)
    if (size === 0) break
    if (type === CHUNK_STRING_POOL) strings = readStringPool(view, at)
    if (type === CHUNK_RESOURCE_MAP) {
      resourceIds = []
      for (let i = at + headerSize; i < at + size; i += 4) resourceIds.push(view.getUint32(i, true))
    }
    if (type === CHUNK_START_ELEMENT) {
      const ext = at + headerSize
      const attributeStart = view.getUint16(ext + 8, true)
      const attributeSize = view.getUint16(ext + 10, true)
      const attributeCount = view.getUint16(ext + 12, true)
      for (let i = 0; i < attributeCount; i++) {
        const attr = ext + attributeStart + i * attributeSize
        const name = view.getUint32(attr + 4, true)
        const raw = view.getUint32(attr + 8, true)
        const dataType = view.getUint8(attr + 15)
        const value = view.getUint32(attr + 16, true)
        const text =
          dataType === TYPE_STRING ? strings[value] : raw !== NO_INDEX ? strings[raw] : null
        const resourceId = resourceIds[name]
        if (
          resourceId === ATTR_VERSION_CODE &&
          (dataType === TYPE_INT_DEC || dataType === TYPE_INT_HEX)
        ) {
          result.versionCode = value
        } else if (resourceId === ATTR_VERSION_NAME) {
          result.versionName = text ?? null
        } else if (strings[name] === "package") {
          result.packageName = text ?? null
        }
      }
      // The root <manifest> element is the first one.
      break
    }
    at += size
  }
  return result
}

/** Read `AndroidManifest.xml` out of an APK on disk. Null when it is not a readable APK. */
export async function readApkManifest(path: string): Promise<ApkManifest | null> {
  try {
    const entries = unzipSync(new Uint8Array(await readFile(path)), {
      filter: (file) => file.name === "AndroidManifest.xml",
    })
    const manifest = entries["AndroidManifest.xml"]
    return manifest ? parseManifestXml(manifest) : null
  } catch {
    return null
  }
}
