"use client"

import { Flashlight, FlashlightOff } from "lucide-react"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { ScanSpotOverlay, type ScanTap } from "@/components/scan-spot"
import {
  previewPoint,
  type ScanControls,
  type ScanRegion,
  type ScanSpot,
  type ScanTarget,
  scanFeedback,
  scanStream,
} from "@/lib/barcode-scan"
import {
  applyTorch,
  BLANK_VIDEO_POSTER,
  openRearCamera,
  setTorch,
  type TorchTrack,
  trackSupportsTorch,
  trackSupportsZoom,
  tuneCamera,
  videoTrackFrom,
} from "@/lib/camera-torch"
import { cn } from "@/lib/utils"

const torchButtonClass =
  "flex size-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-black/75 active:scale-95"

/** Wide guide box for the serial barcode, as fractions of the preview. */
const SERIAL_GUIDE: ScanRegion = { left: 0.08, top: 0.32, width: 0.84, height: 0.36 }
/** Decode a little beyond the guide, so a barcode touching its edge still reads. */
const SERIAL_DECODE: ScanRegion = { left: 0.02, top: 0.2, width: 0.96, height: 0.6 }
/** Zoom button level: lets a small label be read from 15–20 cm, where lenses still focus. */
const ZOOM_IN = 2
/** Let the frame on a read code show before the dialog moves on. */
const READ_SHOW_MS = 250

/**
 * Shared rear-camera scan surface (torch + BarcodeDetector / zxing).
 * `parse` returns a normalized value or null; on null we keep scanning and show invalidMessage.
 */
export function ScanCamera<T>({
  mode = "qr",
  parse,
  onFound,
  invalidMessage = "Ugyldig kode. Prøv igjen.",
  cameraError = "Ingen tilgang til kamera.",
  message,
  hint,
  aspectClassName = "aspect-[3/4] w-full max-h-full",
}: {
  mode?: ScanTarget
  parse: (raw: string) => T | null
  onFound: (value: T) => void
  invalidMessage?: string
  cameraError?: string
  /** An error from outside the camera (e.g. a failed lookup), shown like a scan error. */
  message?: string | null
  hint?: string
  /** Size the preview. Dialogs should pass a viewport-capped height so iPad does not overflow. */
  aspectClassName?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<TorchTrack | null>(null)
  const scanRef = useRef<ScanControls | null>(null)
  const [spot, setSpot] = useState<ScanSpot | null>(null)
  const [tap, setTap] = useState<ScanTap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [zoomSupported, setZoomSupported] = useState(false)
  // Bumped when Android ends the camera track under us; reopens the camera.
  const [cameraRestarts, setCameraRestarts] = useState(0)

  const handleParse = useEffectEvent(parse)
  const handleFound = useEffectEvent(onFound)

  // biome-ignore lint/correctness/useExhaustiveDependencies: cameraRestarts only reopens the camera
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const serial = mode === "serial"
    let stopped = false
    // Cancels an open still in flight when this run is cleaned up (see openRearCamera).
    const cancel = new AbortController()
    let found = false
    const torchPolls: number[] = []
    const controlsRef: { current: ScanControls | null } = { current: null }
    setTorchOn(false)
    setTorchSupported(false)
    setZoomed(false)
    setZoomSupported(false)
    setError(null)
    setSpot(null)
    trackRef.current = null
    let readTimer: number | undefined

    const refreshTorch = () => {
      if (stopped) return
      const track = trackRef.current ?? videoTrackFrom(video)
      if (!track) return
      trackRef.current = track
      setTorchSupported(trackSupportsTorch(track))
      setZoomSupported(trackSupportsZoom(track))
    }

    const controlsPromise = openRearCamera(
      undefined,
      cancel.signal,
      serial ? "high" : "default",
    ).then((stream) => {
      const track = stream.getVideoTracks()[0] as TorchTrack | undefined
      trackRef.current = track ?? null
      if (stopped) {
        for (const item of stream.getTracks()) item.stop()
        throw new Error("stopped")
      }
      return scanStream(stream, video, {
        target: mode,
        region: serial ? SERIAL_DECODE : undefined,
        onSpot: (next) => {
          if (!stopped) setSpot(next)
        },
        onText: (text) => {
          if (stopped || found) return
          const value = handleParse(text)
          if (value == null) {
            setError(invalidMessage)
            return
          }
          found = true
          stopped = true
          setError(null)
          scanFeedback()
          controlsRef.current?.stop()
          readTimer = window.setTimeout(() => handleFound(value), READ_SHOW_MS)
        },
      })
    })

    controlsPromise
      .then((controls) => {
        if (stopped) {
          controls.stop()
          return
        }
        controlsRef.current = controls
        scanRef.current = controls
        const track = trackRef.current
        // Start dark, and offer the button only once that has settled: a quick tap on
        // a fresh camera must not be undone by this reset.
        // Focus after the torch reset: some browsers drop constraints a later apply leaves out.
        if (track) {
          void applyTorch(track, false)
            .catch(() => undefined)
            .then(() => tuneCamera(track))
            .finally(refreshTorch)
        } else {
          refreshTorch()
        }
        track?.addEventListener(
          "ended",
          () => {
            if (!stopped) setCameraRestarts((count) => count + 1)
          },
          { once: true },
        )
        torchPolls.push(window.setTimeout(refreshTorch, 400), window.setTimeout(refreshTorch, 1200))
      })
      .catch((err: unknown) => {
        if (stopped || (err instanceof Error && err.message === "stopped")) return
        setError(cameraError)
      })

    return () => {
      stopped = true
      cancel.abort()
      for (const id of torchPolls) window.clearTimeout(id)
      window.clearTimeout(readTimer)
      scanRef.current = null
      controlsRef.current?.stop()
      const track = trackRef.current
      if (track) void applyTorch(track, false).catch(() => undefined)
      trackRef.current = null
      void controlsPromise.then((c) => c.stop()).catch(() => undefined)
    }
  }, [cameraError, invalidMessage, mode, cameraRestarts])

  async function toggleTorch() {
    if (!torchSupported) return
    const next = !torchOn
    const track = trackRef.current ?? videoTrackFrom(videoRef.current)
    if (!track) return
    const state = await setTorch(track, next)
    setTorchOn(state.on)
    setTorchSupported(state.supported)
    if (zoomed) void tuneCamera(track, { zoom: ZOOM_IN })
  }

  function tapPreview(event: React.MouseEvent<HTMLVideoElement>) {
    const video = videoRef.current
    if (!video) return
    const point = previewPoint(video, event.clientX, event.clientY)
    scanRef.current?.focusAt(point.x, point.y)
    setTap({ ...point, key: Date.now() })
  }

  async function toggleZoom() {
    if (!zoomSupported) return
    const track = trackRef.current ?? videoTrackFrom(videoRef.current)
    if (!track) return
    const next = !zoomed
    setZoomed(next)
    await tuneCamera(track, { zoom: next ? ZOOM_IN : 1 })
  }

  return (
    <div className={cn("relative mx-auto overflow-hidden rounded-2xl bg-black", aspectClassName)}>
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        poster={BLANK_VIDEO_POSTER}
        muted
        playsInline
        autoPlay
        onClick={tapPreview}
      />
      <ScanSpotOverlay spot={spot} tap={tap} />
      {mode === "serial" ? (
        <div
          className="scan-guide"
          style={{
            left: `${SERIAL_GUIDE.left * 100}%`,
            top: `${SERIAL_GUIDE.top * 100}%`,
            width: `${SERIAL_GUIDE.width * 100}%`,
            height: `${SERIAL_GUIDE.height * 100}%`,
          }}
          aria-hidden
        >
          <span className="scan-guide-line" />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset ring-[var(--color-fg-brand)]/50" />
      )}
      <button
        type="button"
        className={`absolute top-3 left-3 z-10 text-base font-semibold tabular-nums ${torchButtonClass} ${
          !zoomSupported
            ? "scan-torch-disabled pointer-events-none"
            : zoomed
              ? "bg-[var(--color-fg-brand)] text-[var(--color-fg-always-dark)] hover:bg-[var(--color-green-3)]"
              : ""
        }`}
        aria-label={!zoomSupported ? "Zoom ikke tilgjengelig" : zoomed ? "Zoom ut" : "Zoom inn"}
        aria-pressed={zoomed}
        aria-disabled={!zoomSupported}
        disabled={!zoomSupported}
        onClick={() => void toggleZoom()}
      >
        <span className={zoomSupported ? undefined : "opacity-30"}>
          {zoomed && zoomSupported ? `${ZOOM_IN}×` : "1×"}
        </span>
      </button>
      <button
        type="button"
        className={`absolute top-3 right-3 z-10 ${torchButtonClass} ${
          !torchSupported
            ? "scan-torch-disabled pointer-events-none"
            : torchOn
              ? "bg-[var(--color-fg-brand)] text-[var(--color-fg-always-dark)] hover:bg-[var(--color-green-3)]"
              : ""
        }`}
        aria-label={
          !torchSupported ? "Lykt ikke tilgjengelig" : torchOn ? "Slå av lykt" : "Slå på lykt"
        }
        aria-pressed={torchOn}
        aria-disabled={!torchSupported}
        disabled={!torchSupported}
        onClick={() => void toggleTorch()}
      >
        {torchOn && torchSupported ? (
          <Flashlight className="size-6" />
        ) : (
          <FlashlightOff className="size-6" />
        )}
      </button>
      {error || message ? (
        <p className="absolute inset-x-3 bottom-3 rounded-xl bg-black/75 px-3 py-2 text-center text-sm">
          {error ?? message}
        </p>
      ) : hint ? (
        <p className="absolute inset-x-3 bottom-3 rounded-xl bg-black/70 px-3 py-2 text-center text-sm text-white/85">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
