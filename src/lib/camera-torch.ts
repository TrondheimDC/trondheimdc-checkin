/** MediaTrack torch helpers. Samsung often needs the advanced constraint form. */

export type TorchTrack = MediaStreamTrack & {
  getCapabilities?: () => MediaTrackCapabilities & { torch?: boolean }
  getSettings: () => MediaTrackSettings & { torch?: boolean }
}

export function videoTrackFrom(video: HTMLVideoElement | null): TorchTrack | null {
  const stream = video?.srcObject
  if (!(stream instanceof MediaStream)) return null
  return (stream.getVideoTracks()[0] as TorchTrack | undefined) ?? null
}

export function trackSupportsTorch(track: TorchTrack): boolean {
  const caps = track.getCapabilities?.() as { torch?: boolean } | undefined
  return caps?.torch === true
}

export async function applyTorch(track: TorchTrack, on: boolean) {
  const attempts: MediaTrackConstraints[] = [
    { advanced: [{ torch: on } as MediaTrackConstraintSet] },
    { torch: on } as MediaTrackConstraints,
  ]
  let lastError: unknown
  for (const constraints of attempts) {
    try {
      await track.applyConstraints(constraints)
      return
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error("torch")
}

/** Main rear sensor. Logical / ultra-wide cameras on Samsung accept torch and do nothing. */
export function pickRearCamera(devices: MediaDeviceInfo[]) {
  const rear = devices.filter((device) => /back|rear|environment|bak/i.test(device.label))
  const pool = rear.length > 0 ? rear : devices
  const main = pool.find(
    (device) =>
      /camera2?\s*0\b|back camera/i.test(device.label) &&
      !/ultra|wide|tele|depth|macro/i.test(device.label),
  )
  const plain = pool.find((device) => !/ultra|wide|tele|depth|macro/i.test(device.label))
  return (main ?? plain ?? pool[0])?.deviceId
}

/**
 * Main rear sensor found the last time camera labels were visible. Android WebView (the
 * app) hides labels until a stream is open on every page load, unlike Chrome's
 * remembered site permission, so without this every open would guess by facingMode.
 */
const AUTO_CAMERA_KEY = "tdc-scan-camera-auto"

async function openFirst(attempts: MediaTrackConstraints[]): Promise<MediaStream> {
  let lastError: unknown
  for (const video of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video, audio: false })
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error("camera")
}

function constraintsFor(deviceId: string | undefined): MediaTrackConstraints[] {
  const rear: MediaTrackConstraints[] = [
    { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    { facingMode: "environment" },
  ]
  // A stored deviceId can go stale (camera unplugged, browser rotated ids) — fall back to rear.
  return deviceId
    ? [
        { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
        { deviceId: { exact: deviceId } },
        ...rear,
      ]
    : rear
}

export async function openRearCamera(deviceId: string | undefined) {
  // Pick before opening; re-picking after the stream is live means a second getUserMedia (flash).
  const chosen = Boolean(deviceId)
  if (!deviceId) {
    const devices = await navigator.mediaDevices.enumerateDevices()
    deviceId =
      pickRearCamera(devices.filter((d) => d.kind === "videoinput" && d.label)) ??
      window.localStorage.getItem(AUTO_CAMERA_KEY) ??
      undefined
  }
  const stream = await openFirst(constraintsFor(deviceId))
  if (chosen) return stream

  // Labels are visible now. facingMode alone can land on an ultra-wide without a torch:
  // remember the main sensor, and switch to it once if we are on another lens.
  const labelled = (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === "videoinput" && d.label,
  )
  // Only phones: a desktop has no rear-labelled cameras, and the browser's default webcam is fine.
  if (!labelled.some((device) => cameraKind(device) === "rear")) return stream
  const main = pickRearCamera(labelled)
  if (!main) return stream
  window.localStorage.setItem(AUTO_CAMERA_KEY, main)
  const live = stream.getVideoTracks()[0]?.getSettings().deviceId
  if (!live || live === main) return stream
  for (const track of stream.getTracks()) track.stop()
  return openFirst(constraintsFor(main))
}

/**
 * Transparent 1×1 poster. Without one, Android WebView (the app) paints its grey
 * play-icon placeholder over the video until the first camera frame arrives.
 */
export const BLANK_VIDEO_POSTER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"

/** Chrome appends the USB vendor:product id, e.g. "HD Pro Webcam C920 (046d:082d)". */
export function cameraLabel(device: MediaDeviceInfo, index: number) {
  const label = device.label.replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, "").trim()
  return label || `Kamera ${index + 1}`
}

export function cameraKind(device: MediaDeviceInfo): "front" | "rear" | "other" {
  if (/front|user|selfie|fram/i.test(device.label)) return "front"
  if (/back|rear|environment|bak/i.test(device.label)) return "rear"
  return "other"
}
