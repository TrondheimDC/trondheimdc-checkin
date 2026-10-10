"use client"

import {
  BrowserMultiFormatReader,
  BrowserQRCodeReader,
  type IScannerControls,
} from "@zxing/browser"
import { Flashlight, FlashlightOff } from "lucide-react"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import {
  applyTorch,
  BLANK_VIDEO_POSTER,
  openRearCamera,
  setTorch,
  type TorchTrack,
  trackSupportsTorch,
  videoTrackFrom,
} from "@/lib/camera-torch"
import { cn } from "@/lib/utils"

const torchButtonClass =
  "flex size-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-black/75 active:scale-95"

type ScanMode = "qr" | "multi"

/**
 * Shared rear-camera scan surface (torch + zxing).
 * `parse` returns a normalized value or null; on null we keep scanning and show invalidMessage.
 */
export function ScanCamera<T>({
  mode = "qr",
  parse,
  onFound,
  invalidMessage = "Ugyldig kode. Prøv igjen.",
  cameraError = "Ingen tilgang til kamera.",
  hint,
  aspectClassName = "aspect-[3/4] w-full max-h-full",
}: {
  mode?: ScanMode
  parse: (raw: string) => T | null
  onFound: (value: T) => void
  invalidMessage?: string
  cameraError?: string
  hint?: string
  /** Size the preview. Dialogs should pass a viewport-capped height so iPad does not overflow. */
  aspectClassName?: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<TorchTrack | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  // Bumped when Android ends the camera track under us; reopens the camera.
  const [cameraRestarts, setCameraRestarts] = useState(0)

  const handleParse = useEffectEvent(parse)
  const handleFound = useEffectEvent(onFound)

  // biome-ignore lint/correctness/useExhaustiveDependencies: cameraRestarts only reopens the camera
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const reader = mode === "multi" ? new BrowserMultiFormatReader() : new BrowserQRCodeReader()
    let stopped = false
    // Cancels an open still in flight when this run is cleaned up (see openRearCamera).
    const cancel = new AbortController()
    let found = false
    const torchPolls: number[] = []
    const controlsRef: { current: IScannerControls | null } = { current: null }
    setTorchOn(false)
    setTorchSupported(false)
    setError(null)
    trackRef.current = null

    const refreshTorch = () => {
      if (stopped) return
      const track = trackRef.current ?? videoTrackFrom(video)
      if (!track) return
      trackRef.current = track
      setTorchSupported(trackSupportsTorch(track))
    }

    const controlsPromise = openRearCamera(undefined, cancel.signal).then((stream) => {
      const track = stream.getVideoTracks()[0] as TorchTrack | undefined
      trackRef.current = track ?? null
      if (stopped) {
        for (const item of stream.getTracks()) item.stop()
        throw new Error("stopped")
      }
      return reader.decodeFromStream(stream, video, (result) => {
        if (!result || stopped || found) return
        const value = handleParse(result.getText())
        if (value == null) {
          setError(invalidMessage)
          return
        }
        found = true
        stopped = true
        setError(null)
        controlsRef.current?.stop()
        handleFound(value)
      })
    })

    controlsPromise
      .then((controls) => {
        if (stopped) {
          controls.stop()
          return
        }
        controlsRef.current = controls
        const track = trackRef.current
        // Start dark, and offer the button only once that has settled: a quick tap on
        // a fresh camera must not be undone by this reset.
        if (track) {
          void applyTorch(track, false)
            .catch(() => undefined)
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
      />
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset ring-[var(--color-fg-brand)]/50" />
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
      {error ? (
        <p className="absolute inset-x-3 bottom-3 rounded-xl bg-black/75 px-3 py-2 text-center text-sm">
          {error}
        </p>
      ) : hint ? (
        <p className="absolute inset-x-3 bottom-3 rounded-xl bg-black/70 px-3 py-2 text-center text-sm text-white/85">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
