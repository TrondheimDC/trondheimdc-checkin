"use client"

import { BrowserQRCodeReader } from "@zxing/browser"
import { Flashlight, FlashlightOff } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import {
  applyTorch,
  openRearCamera,
  pickRearCamera,
  trackSupportsTorch,
  videoTrackFrom,
  type TorchTrack,
} from "@/lib/camera-torch"
import { parsePrinterSetupUrl, type PrinterSetupParams } from "@/lib/printer-setup"

const torchButtonClass =
  "flex size-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-black/75 active:scale-95"

export function SetupQrScan({ onFound }: { onFound: (printer: PrinterSetupParams) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<TorchTrack | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const reader = new BrowserQRCodeReader()
    let stopped = false
    let found = false
    const torchPolls: number[] = []
    setTorchOn(false)
    setTorchSupported(false)
    trackRef.current = null

    const refreshTorch = () => {
      if (stopped) return
      const track = trackRef.current ?? videoTrackFrom(video)
      if (!track) return
      trackRef.current = track
      setTorchSupported(trackSupportsTorch(track))
    }

    const controlsPromise = openRearCamera(deviceId).then((stream) => {
      const track = stream.getVideoTracks()[0] as TorchTrack | undefined
      trackRef.current = track ?? null
      if (stopped) {
        for (const item of stream.getTracks()) item.stop()
        throw new Error("stopped")
      }
      return reader.decodeFromStream(stream, video, (result) => {
        if (!result || stopped || found) return
        const printer = parsePrinterSetupUrl(result.getText())
        if (!printer) {
          setError("Det er ikke en printer-QR. Skann klistremerket på printeren.")
          return
        }
        found = true
        stopped = true
        setError(null)
        onFound(printer)
      })
    })

    controlsPromise
      .then(async (controls) => {
        if (stopped) {
          controls.stop()
          return
        }
        refreshTorch()
        const track = trackRef.current
        if (track) void applyTorch(track, false).catch(() => undefined)
        torchPolls.push(window.setTimeout(refreshTorch, 400), window.setTimeout(refreshTorch, 1200))

        const devices = await BrowserQRCodeReader.listVideoInputDevices()
        if (stopped) return
        if (!deviceId) {
          const picked = pickRearCamera(devices)
          const current = trackRef.current?.getSettings().deviceId
          if (picked && picked !== current) setDeviceId(picked)
        }
      })
      .catch((err: unknown) => {
        if (stopped || (err instanceof Error && err.message === "stopped")) return
        setError("Ingen tilgang til kamera. Tillat kamera, eller velg manuelt oppsett.")
      })

    return () => {
      stopped = true
      for (const id of torchPolls) window.clearTimeout(id)
      trackRef.current = null
      void controlsPromise.then((controls) => controls.stop()).catch(() => undefined)
    }
  }, [onFound, deviceId])

  async function toggleTorch() {
    if (!torchSupported) return
    const next = !torchOn
    const track = trackRef.current ?? videoTrackFrom(videoRef.current)
    if (!track) return
    try {
      await applyTorch(track, next)
      setTorchOn(next)
    } catch {
      setTorchOn(false)
      setTorchSupported(trackSupportsTorch(track))
    }
  }

  return (
    <div className="relative aspect-[3/4] w-full max-h-full overflow-hidden rounded-2xl bg-black">
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
      <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-[var(--color-fg-brand)]/50 rounded-2xl" />
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
        <span className="relative inline-flex">
          {torchOn && torchSupported ? (
            <Flashlight className="size-6" />
          ) : (
            <FlashlightOff className="size-6" />
          )}
          {!torchSupported ? <span className="scan-torch-slash" aria-hidden /> : null}
        </span>
      </button>
      {error ? (
        <p className="absolute inset-x-3 bottom-3 rounded-xl bg-black/75 px-3 py-2 text-center text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
