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
      /camera2?\s*0\b|back camera/i.test(device.label) && !/ultra|wide|tele|depth|macro/i.test(device.label),
  )
  const plain = pool.find((device) => !/ultra|wide|tele|depth|macro/i.test(device.label))
  return (main ?? plain ?? pool[0])?.deviceId
}

export async function openRearCamera(deviceId: string | undefined) {
  const attempts: MediaTrackConstraints[] = deviceId
    ? [
        { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
        { deviceId: { exact: deviceId } },
      ]
    : [
        { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        { facingMode: "environment" },
      ]
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
