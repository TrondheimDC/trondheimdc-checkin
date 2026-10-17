import {
  BarcodeFormat,
  type BrowserCodeReader,
  BrowserMultiFormatOneDReader,
  BrowserQRCodeReader,
} from "@zxing/browser"
import { DecodeHintType } from "@zxing/library"
import { SCAN_ZXING_DEFAULT, SCAN_ZXING_KEY } from "@/lib/scan-settings"

/** Ticket / sticker / login QR, or the 1D serial barcode on the printer's label. */
export type ScanTarget = "qr" | "serial"

/** Part of the on-screen preview (after `object-cover` cropping), as fractions of its box. */
export type ScanRegion = { left: number; top: number; width: number; height: number }

export type ScanControls = { stop: () => void }

/** Pause between attempts. ZXing's own default is 500 ms, which misses a code held still briefly. */
const SCAN_INTERVAL_MS = 60
/** Longest side handed to ZXing; the QR scanner does not need every pixel of a full frame. */
const ZXING_MAX_SIDE = 1600

const NATIVE_FORMATS: Record<ScanTarget, string[]> = {
  qr: ["qr_code"],
  // Brother serials (e.g. E82696C6G972070) are alphanumeric: only these 1D formats can carry them.
  serial: ["code_128", "code_39", "code_93"],
}

type DetectedBarcode = { rawValue: string; boundingBox: DOMRectReadOnly }
type NativeDetector = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> }
type NativeDetectorClass = {
  new (options: { formats: string[] }): NativeDetector
  getSupportedFormats: () => Promise<string[]>
}

function nativeDetectorClass(): NativeDetectorClass | null {
  return (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector ?? null
}

/** The browser has a BarcodeDetector at all (Chrome on Android / macOS, Android WebView). */
export function hasNativeBarcodeDetector() {
  return nativeDetectorClass() !== null
}

function preferZxing() {
  const value = window.localStorage.getItem(SCAN_ZXING_KEY)
  return value == null ? SCAN_ZXING_DEFAULT : value === "1"
}

/** Null when unavailable: no API, ZXing forced in settings, or no backend for these formats. */
async function nativeDetector(target: ScanTarget): Promise<NativeDetector | null> {
  const Detector = nativeDetectorClass()
  if (!Detector || preferZxing()) return null
  try {
    const supported = await Detector.getSupportedFormats()
    const formats = NATIVE_FORMATS[target].filter((format) => supported.includes(format))
    return formats.length > 0 ? new Detector({ formats }) : null
  } catch {
    return null
  }
}

function zxingReader(target: ScanTarget): BrowserCodeReader {
  if (target === "qr") return new BrowserQRCodeReader()
  const hints = new Map<DecodeHintType, unknown>([
    [
      DecodeHintType.POSSIBLE_FORMATS,
      [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93],
    ],
    // Every row of the crop, and turned 90°: without it ZXing reads ~15 rows across the middle.
    [DecodeHintType.TRY_HARDER, true],
  ])
  return new BrowserMultiFormatOneDReader(hints)
}

type Rect = { x: number; y: number; width: number; height: number }

/** `region` of the preview in camera-frame pixels; the whole frame when there is no region. */
function frameRect(video: HTMLVideoElement, region: ScanRegion | undefined): Rect {
  const frameWidth = video.videoWidth
  const frameHeight = video.videoHeight
  if (!region) return { x: 0, y: 0, width: frameWidth, height: frameHeight }
  const boxWidth = video.clientWidth || frameWidth
  const boxHeight = video.clientHeight || frameHeight
  // object-cover: the frame is scaled to fill the box and the overflow is cropped evenly.
  const scale = Math.max(boxWidth / frameWidth, boxHeight / frameHeight)
  const shownWidth = boxWidth / scale
  const shownHeight = boxHeight / scale
  return {
    x: (frameWidth - shownWidth) / 2 + region.left * shownWidth,
    y: (frameHeight - shownHeight) / 2 + region.top * shownHeight,
    width: region.width * shownWidth,
    height: region.height * shownHeight,
  }
}

function contains(rect: Rect, box: DOMRectReadOnly) {
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height
}

/**
 * Decode `video` until stopped, calling `onText` for every code read (callers dedupe).
 * Uses the browser's BarcodeDetector when it has one, else ZXing. With a `region`, only
 * codes inside that part of the preview count.
 */
export function scanVideo(
  video: HTMLVideoElement,
  {
    target,
    region,
    onText,
  }: { target: ScanTarget; region?: ScanRegion; onText: (text: string) => void },
): () => void {
  let stopped = false
  let timer: number | undefined
  const detectorReady = nativeDetector(target)
  let zxing: BrowserCodeReader | null = null
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d", { willReadFrequently: true })

  const decodeNative = async (detector: NativeDetector) => {
    const rect = frameRect(video, region)
    const codes = await detector.detect(video)
    return codes.find((code) => code.rawValue && contains(rect, code.boundingBox))?.rawValue
  }

  const decodeZxing = () => {
    if (!context) return undefined
    zxing ??= zxingReader(target)
    const rect = frameRect(video, region)
    const scale = Math.min(1, ZXING_MAX_SIDE / Math.max(rect.width, rect.height))
    canvas.width = Math.round(rect.width * scale)
    canvas.height = Math.round(rect.height * scale)
    context.drawImage(
      video,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      canvas.width,
      canvas.height,
    )
    try {
      return zxing.decodeFromCanvas(canvas).getText()
    } catch {
      // NotFound / checksum / format: nothing readable in this frame.
      return undefined
    }
  }

  let native: NativeDetector | null | undefined
  const tick = async () => {
    if (stopped) return
    if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      if (native === undefined) native = await detectorReady
      let text: string | undefined
      if (native) {
        // A detector that throws (e.g. no Play Services backend) hands over to ZXing for good.
        text = await decodeNative(native).catch(() => {
          native = null
          return undefined
        })
      } else {
        text = decodeZxing()
      }
      if (stopped) return
      if (text) onText(text)
    }
    if (!stopped) timer = window.setTimeout(() => void tick(), SCAN_INTERVAL_MS)
  }
  void tick()

  return () => {
    stopped = true
    window.clearTimeout(timer)
  }
}

/** Show `stream` in `video` and decode it. `stop` ends scanning and releases the camera. */
export async function scanStream(
  stream: MediaStream,
  video: HTMLVideoElement,
  options: Parameters<typeof scanVideo>[1],
): Promise<ScanControls> {
  video.srcObject = stream
  // autoPlay + muted normally starts it; play() is the nudge some WebViews need.
  await video.play().catch(() => undefined)
  const stopScan = scanVideo(video, options)
  return {
    stop() {
      stopScan()
      for (const track of stream.getTracks()) track.stop()
      if (video.srcObject === stream) video.srcObject = null
    },
  }
}

/** Short buzz when a code is read. Android only; iOS Safari has no vibrate. */
export function scanFeedback() {
  navigator.vibrate?.(40)
}
