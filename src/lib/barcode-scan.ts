import { BarcodeFormat, BrowserCodeReader, BrowserMultiFormatOneDReader } from "@zxing/browser"
import { DecodeHintType, type ResultPoint } from "@zxing/library"
// Not in the package index: QR finding and decoding run as two steps, so a found but
// unreadable code can still be shown and cropped to.
import QRCodeDecoder from "@zxing/library/esm/core/qrcode/decoder/Decoder"
import QRCodeDetector from "@zxing/library/esm/core/qrcode/detector/Detector"
import { focusCameraAt } from "@/lib/camera-torch"
import { SCAN_ZXING_DEFAULT, SCAN_ZXING_KEY } from "@/lib/scan-settings"

/** Ticket / sticker / login QR, or the 1D serial barcode on the printer's label. */
export type ScanTarget = "qr" | "serial"

/** Part of the on-screen preview (after `object-cover` cropping), as fractions of its box. */
export type ScanRegion = { left: number; top: number; width: number; height: number }

/** Where a code is in the preview: `found` (ZXing located a QR it could not read yet) or `read`. */
export type ScanSpot = { box: ScanRegion; state: "found" | "read" }

export type ScanControls = {
  stop: () => void
  /** Look harder around this point of the preview (fractions of its box), e.g. after a tap. */
  focusAt: (x: number, y: number) => void
}

/** Pause between attempts. ZXing's own default is 500 ms, which misses a code held still briefly. */
const SCAN_INTERVAL_MS = 60
/** Longest side handed to ZXing; the QR scanner does not need every pixel of a full frame. */
const ZXING_MAX_SIDE = 1600
/** A crop around a tap or a found QR is upscaled to at least this, so small modules survive binarizing. */
const CROP_MIN_SIDE = 720
/** A tap's crop: this share of the preview's shorter side. */
const TAP_SIZE = 0.45
/** How long a tap or a found QR keeps ZXing on its crop before it looks at the whole frame again. */
const TAP_HOLD_MS = 2500
const FOUND_HOLD_MS = 1200
/** The same code held in view is shown as read once per this long, not every frame. */
const READ_SPOT_REPEAT_MS = 1500

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

/**
 * Set for this browser session when the BarcodeDetector threw mid-scan (e.g. no Play Services
 * barcode module). Session only: the module can arrive later.
 */
const NATIVE_BROKEN_KEY = "tdc-scan-native-broken"

function nativeBroken() {
  return window.sessionStorage.getItem(NATIVE_BROKEN_KEY) === "1"
}

/**
 * The browser's BarcodeDetector can read QR codes here: it exists (Chrome on Android / macOS,
 * Android WebView), lists `qr_code`, and has not failed this session. Otherwise it is ZXing.
 */
export async function nativeQrSupported() {
  const Detector = nativeDetectorClass()
  if (!Detector || nativeBroken()) return false
  try {
    return (await Detector.getSupportedFormats()).includes("qr_code")
  } catch {
    return false
  }
}

function preferZxing() {
  const value = window.localStorage.getItem(SCAN_ZXING_KEY)
  return value == null ? SCAN_ZXING_DEFAULT : value === "1"
}

/** Null when unavailable: no API, ZXing forced in settings, or no backend for these formats. */
async function nativeDetector(target: ScanTarget): Promise<NativeDetector | null> {
  const Detector = nativeDetectorClass()
  if (!Detector || nativeBroken() || preferZxing()) return null
  try {
    const supported = await Detector.getSupportedFormats()
    const formats = NATIVE_FORMATS[target].filter((format) => supported.includes(format))
    return formats.length > 0 ? new Detector({ formats }) : null
  } catch {
    return null
  }
}

function serialReader(): BrowserCodeReader {
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

/** The part of the camera frame the preview shows, in frame pixels (object-cover crops evenly). */
function shownRect(video: HTMLVideoElement): Rect {
  const frameWidth = video.videoWidth
  const frameHeight = video.videoHeight
  const boxWidth = video.clientWidth || frameWidth
  const boxHeight = video.clientHeight || frameHeight
  const scale = Math.max(boxWidth / frameWidth, boxHeight / frameHeight)
  const width = boxWidth / scale
  const height = boxHeight / scale
  return { x: (frameWidth - width) / 2, y: (frameHeight - height) / 2, width, height }
}

/** `region` of the preview in camera-frame pixels; the whole frame when there is no region. */
function frameRect(video: HTMLVideoElement, region: ScanRegion | undefined): Rect {
  if (!region) return { x: 0, y: 0, width: video.videoWidth, height: video.videoHeight }
  const shown = shownRect(video)
  return {
    x: shown.x + region.left * shown.width,
    y: shown.y + region.top * shown.height,
    width: region.width * shown.width,
    height: region.height * shown.height,
  }
}

/** Frame pixels back to fractions of the preview. */
function previewRegion(video: HTMLVideoElement, rect: Rect): ScanRegion {
  const shown = shownRect(video)
  return {
    left: (rect.x - shown.x) / shown.width,
    top: (rect.y - shown.y) / shown.height,
    width: rect.width / shown.width,
    height: rect.height / shown.height,
  }
}

/** Square crop of `side` frame pixels around a frame point, kept inside the frame. */
function squareAround(video: HTMLVideoElement, x: number, y: number, side: number): Rect {
  const size = Math.min(side, video.videoWidth, video.videoHeight)
  return {
    x: Math.min(Math.max(0, x - size / 2), video.videoWidth - size),
    y: Math.min(Math.max(0, y - size / 2), video.videoHeight - size),
    width: size,
    height: size,
  }
}

function boundsOf(points: { x: number; y: number }[]): Rect {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

/**
 * ZXing's three QR finder centres (plus the alignment pattern) sit inside the code. Grow
 * their bounds to the code's outer edge: a finder centre is 3.5 modules in from it, and
 * `modules - 7` modules from the next one.
 */
function qrBox(points: ResultPoint[], modules: number): Rect {
  const bounds = boundsOf(points.map((point) => ({ x: point.getX(), y: point.getY() })))
  const pad = (Math.max(bounds.width, bounds.height) * 3.5) / Math.max(1, modules - 7)
  return {
    x: bounds.x - pad,
    y: bounds.y - pad,
    width: bounds.width + pad * 2,
    height: bounds.height + pad * 2,
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
 * codes inside that part of the preview count. `onSpot` reports where a code is: when read,
 * and (ZXing QR only) when found but not yet readable; null when it is lost.
 */
export function scanVideo(
  video: HTMLVideoElement,
  {
    target,
    region,
    onText,
    onSpot,
  }: {
    target: ScanTarget
    region?: ScanRegion
    onText: (text: string) => void
    onSpot?: (spot: ScanSpot | null) => void
  },
): ScanControls {
  let stopped = false
  let timer: number | undefined
  const detectorReady = nativeDetector(target)
  let serial: BrowserCodeReader | null = null
  const qrDecoder = new QRCodeDecoder()
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d", { willReadFrequently: true })
  // Frame-pixel crop ZXing reads instead of the whole frame, until `until`.
  let focus: { rect: Rect; until: number } | null = null
  let spotShown = false
  let lastRead: { text: string; at: number } | null = null

  const report = (spot: ScanSpot | null) => {
    if (spot == null && !spotShown) return
    spotShown = spot != null
    onSpot?.(spot)
  }

  const decodeNative = async (detector: NativeDetector) => {
    const rect = frameRect(video, region)
    const codes = await detector.detect(video)
    const code = codes.find((item) => item.rawValue && contains(rect, item.boundingBox))
    return code ? { text: code.rawValue, box: code.boundingBox } : undefined
  }

  /** Draw `rect` of the frame into the canvas; returns frame pixels per canvas pixel. */
  const draw = (rect: Rect, cropped: boolean) => {
    if (!context) return null
    const longest = Math.max(rect.width, rect.height)
    const scale = cropped
      ? Math.max(1, CROP_MIN_SIDE / longest)
      : Math.min(1, ZXING_MAX_SIDE / longest)
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
    return scale
  }

  const decodeQr = (rect: Rect, scale: number) => {
    const toFrame = (box: Rect): Rect => ({
      x: rect.x + box.x / scale,
      y: rect.y + box.y / scale,
      width: box.width / scale,
      height: box.height / scale,
    })
    let found: Rect | null = null
    try {
      const bitmap = BrowserCodeReader.createBinaryBitmapFromCanvas(canvas)
      const detected = new QRCodeDetector(bitmap.getBlackMatrix()).detect(new Map())
      found = toFrame(qrBox(detected.getPoints(), detected.getBits().getWidth()))
      const text = qrDecoder.decodeBitMatrix(detected.getBits(), new Map()).getText()
      return { text, box: found }
    } catch {
      if (!found) return undefined
    }
    // Located but unreadable (blur, glare, too small): show it, and read just that spot next.
    const side = Math.max(found.width, found.height) * 1.6
    focus = {
      rect: squareAround(video, found.x + found.width / 2, found.y + found.height / 2, side),
      until: performance.now() + FOUND_HOLD_MS,
    }
    report({ box: previewRegion(video, found), state: "found" })
    return undefined
  }

  const decodeZxing = () => {
    const now = performance.now()
    if (focus && focus.until < now) {
      focus = null
      report(null)
    }
    const rect = focus?.rect ?? frameRect(video, region)
    const scale = draw(rect, focus != null)
    if (scale == null) return undefined
    if (target === "qr") return decodeQr(rect, scale)
    serial ??= serialReader()
    try {
      return { text: serial.decodeFromCanvas(canvas).getText(), box: null }
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
      let read: { text: string; box: Rect | null } | undefined
      if (native) {
        // A detector that throws (e.g. no Play Services backend) hands over to ZXing for good.
        read = await decodeNative(native).catch(() => {
          native = null
          window.sessionStorage.setItem(NATIVE_BROKEN_KEY, "1")
          return undefined
        })
      } else {
        read = decodeZxing()
      }
      if (stopped) return
      if (read?.text) {
        const now = performance.now()
        const repeat = lastRead?.text === read.text && now - lastRead.at < READ_SPOT_REPEAT_MS
        if (!repeat && read.box) report({ box: previewRegion(video, read.box), state: "read" })
        if (!repeat) lastRead = { text: read.text, at: now }
        onText(read.text)
      }
    }
    if (!stopped) timer = window.setTimeout(() => void tick(), SCAN_INTERVAL_MS)
  }
  void tick()

  return {
    stop() {
      stopped = true
      window.clearTimeout(timer)
    },
    focusAt(x, y) {
      // A square crop would cut a wide 1D barcode; the serial scan has its guide box instead.
      if (target !== "qr" || !video.videoWidth) return
      const shown = shownRect(video)
      const side = Math.min(shown.width, shown.height) * TAP_SIZE
      focus = {
        rect: squareAround(video, shown.x + x * shown.width, shown.y + y * shown.height, side),
        until: performance.now() + TAP_HOLD_MS,
      }
    },
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
  const scan = scanVideo(video, options)
  return {
    focusAt(x, y) {
      scan.focusAt(x, y)
      const track = stream.getVideoTracks()[0]
      if (!track || !video.videoWidth) return
      const shown = shownRect(video)
      void focusCameraAt(
        track,
        (shown.x + x * shown.width) / video.videoWidth,
        (shown.y + y * shown.height) / video.videoHeight,
      )
    },
    stop() {
      scan.stop()
      for (const track of stream.getTracks()) track.stop()
      if (video.srcObject === stream) video.srcObject = null
    },
  }
}

/** Short buzz when a code is read. Android only; iOS Safari has no vibrate. */
export function scanFeedback() {
  navigator.vibrate?.(40)
}

/** A pointer position as fractions of the video element's box, for `focusAt`. */
export function previewPoint(video: HTMLVideoElement, clientX: number, clientY: number) {
  const box = video.getBoundingClientRect()
  return { x: (clientX - box.left) / box.width, y: (clientY - box.top) / box.height }
}
