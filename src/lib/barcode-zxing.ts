// ZXing, loaded only when the browser has no usable BarcodeDetector (see barcode-scan.ts).
// Deep imports: the package indexes pull in every format (PDF417, Aztec, Data Matrix, …).
import BarcodeFormat from "@zxing/library/esm/core/BarcodeFormat"
import BinaryBitmap from "@zxing/library/esm/core/BinaryBitmap"
import HybridBinarizer from "@zxing/library/esm/core/common/HybridBinarizer"
import DecodeHintType from "@zxing/library/esm/core/DecodeHintType"
import MultiFormatOneDReader from "@zxing/library/esm/core/oned/MultiFormatOneDReader"
import QRCodeDecoder from "@zxing/library/esm/core/qrcode/decoder/Decoder"
import QRCodeDetector from "@zxing/library/esm/core/qrcode/detector/Detector"
import type ResultPoint from "@zxing/library/esm/core/ResultPoint"
import RGBLuminanceSource from "@zxing/library/esm/core/RGBLuminanceSource"

type Rect = { x: number; y: number; width: number; height: number }

/**
 * `read`: the text, and where the code is when known. `found`: a QR located but not readable
 * yet (blur, glare, too small). Boxes are in the image's pixels.
 */
export type ZxingResult =
  | { kind: "read"; text: string; box: Rect | null }
  | { kind: "found"; box: Rect }
  | null

function bitmapOf(image: ImageData) {
  const { data, width, height } = image
  const luminance = new Uint8ClampedArray(width * height)
  for (let i = 0, p = 0; i < luminance.length; i++, p += 4) {
    // ZXing's own weights for RGB → grey.
    luminance[i] = (data[p] * 306 + data[p + 1] * 601 + data[p + 2] * 117) >> 10
  }
  return new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, width, height)))
}

/**
 * ZXing's three QR finder centres (plus the alignment pattern) sit inside the code. Grow
 * their bounds to the code's outer edge: a finder centre is 3.5 modules in from it, and
 * `modules - 7` modules from the next one.
 */
function qrBox(points: ResultPoint[], modules: number): Rect {
  const xs = points.map((point) => point.getX())
  const ys = points.map((point) => point.getY())
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  const width = Math.max(...xs) - x
  const height = Math.max(...ys) - y
  const pad = (Math.max(width, height) * 3.5) / Math.max(1, modules - 7)
  return { x: x - pad, y: y - pad, width: width + pad * 2, height: height + pad * 2 }
}

function qrDecoder() {
  const decoder = new QRCodeDecoder()
  return (image: ImageData): ZxingResult => {
    let box: Rect | null = null
    try {
      // Find and decode as two steps, so a found but unreadable code can still be shown.
      const detected = new QRCodeDetector(bitmapOf(image).getBlackMatrix()).detect(new Map())
      box = qrBox(detected.getPoints(), detected.getBits().getWidth())
      const text = decoder.decodeBitMatrix(detected.getBits(), new Map()).getText()
      return { kind: "read", text, box }
    } catch {
      return box ? { kind: "found", box } : null
    }
  }
}

function serialDecoder() {
  const hints = new Map<DecodeHintType, unknown>([
    [
      DecodeHintType.POSSIBLE_FORMATS,
      [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93],
    ],
    // Every row of the crop: without it ZXing reads ~15 rows across the middle.
    [DecodeHintType.TRY_HARDER, true],
  ])
  const reader = new MultiFormatOneDReader(hints)
  return (image: ImageData): ZxingResult => {
    try {
      return { kind: "read", text: reader.decode(bitmapOf(image), hints).getText(), box: null }
    } catch {
      // NotFound / checksum / format: nothing readable in this frame.
      return null
    }
  }
}

export function zxingDecoder(target: "qr" | "serial") {
  return target === "qr" ? qrDecoder() : serialDecoder()
}
