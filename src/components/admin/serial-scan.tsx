"use client"

import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser"
import { Flashlight, FlashlightOff, ScanBarcode } from "lucide-react"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { InputGroupButton } from "@/components/ui/input-group"
import {
  applyTorch,
  openRearCamera,
  pickRearCamera,
  trackSupportsTorch,
  videoTrackFrom,
  type TorchTrack,
} from "@/lib/camera-torch"
import { normalizePrinterSerial } from "@/lib/printer-format"

const torchButtonClass =
  "flex size-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-black/75 active:scale-95"

function SerialScanCamera({ onFound }: { onFound: (serial: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<TorchTrack | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)

  const handleFound = useEffectEvent((serial: string) => {
    onFound(serial)
  })

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const reader = new BrowserMultiFormatReader()
    let stopped = false
    let found = false
    const torchPolls: number[] = []
    const controlsRef: { current: IScannerControls | null } = { current: null }
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
        const serial = normalizePrinterSerial(result.getText())
        if (!serial) {
          setError("Tom strekkode. Prøv igjen.")
          return
        }
        found = true
        stopped = true
        setError(null)
        handleFound(serial)
      })
    })

    controlsPromise
      .then(async (controls) => {
        if (stopped) {
          controls.stop()
          return
        }
        controlsRef.current = controls
        refreshTorch()
        const track = trackRef.current
        if (track) void applyTorch(track, false).catch(() => undefined)
        torchPolls.push(window.setTimeout(refreshTorch, 400), window.setTimeout(refreshTorch, 1200))

        const devices = await BrowserMultiFormatReader.listVideoInputDevices()
        if (stopped) return
        if (!deviceId) {
          const picked = pickRearCamera(devices)
          const current = trackRef.current?.getSettings().deviceId
          if (picked && picked !== current) setDeviceId(picked)
        }
      })
      .catch((err: unknown) => {
        if (stopped || (err instanceof Error && err.message === "stopped")) return
        setError("Ingen tilgang til kamera. Skriv inn serienummeret manuelt.")
      })

    return () => {
      stopped = true
      for (const id of torchPolls) window.clearTimeout(id)
      controlsRef.current?.stop()
      const track = trackRef.current
      if (track) void applyTorch(track, false).catch(() => undefined)
      trackRef.current = null
    }
  }, [deviceId])

  async function toggleTorch() {
    const track = trackRef.current ?? (videoRef.current ? videoTrackFrom(videoRef.current) : null)
    if (!track || !trackSupportsTorch(track)) return
    trackRef.current = track
    const next = !torchOn
    try {
      await applyTorch(track, next)
      setTorchOn(next)
    } catch {
      setTorchOn(false)
      setTorchSupported(trackSupportsTorch(track))
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline autoPlay />
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-16 -translate-y-1/2 rounded-lg border-2 border-[var(--color-fg-brand)]/80" />
      <div className="absolute top-3 right-3">
        <button
          type="button"
          className={torchButtonClass}
          disabled={!torchSupported}
          onClick={() => void toggleTorch()}
          aria-label={torchOn ? "Slå av lykt" : "Slå på lykt"}
        >
          {torchOn ? <FlashlightOff className="size-5" /> : <Flashlight className="size-5" />}
        </button>
      </div>
      {error ? (
        <p className="absolute inset-x-0 bottom-0 bg-black/80 p-3 text-center text-sm text-[var(--color-bg-danger)]">
          {error}
        </p>
      ) : (
        <p className="absolute inset-x-0 bottom-0 bg-black/70 p-3 text-center text-sm text-white/80">
          Pek på strekkoden på printeren
        </p>
      )}
    </div>
  )
}

/** Icon button for InputGroupAddon — opens strekkode-skanning. */
export function SerialScanButton({ onScan }: { onScan: (serial: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <InputGroupButton
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Skann strekkode"
        className="size-10 rounded-lg text-[var(--color-fg-base)] opacity-70 hover:bg-black/10 hover:opacity-100"
        onClick={() => setOpen(true)}
      >
        <ScanBarcode className="size-5" aria-hidden />
      </InputGroupButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(100%-1.5rem,28rem)] p-4">
          <DialogTitle>Skann serienummer</DialogTitle>
          <DialogDescription>
            Strekkoden står vanligvis på etiketten inni lokket, ved DK-rullen.
          </DialogDescription>
          <div className="mt-4">
            {open ? (
              <SerialScanCamera
                onFound={(serial) => {
                  onScan(serial)
                  setOpen(false)
                }}
              />
            ) : null}
          </div>
          <DialogClose asChild>
            <Button type="button" variant="surface" size="lg" className="mt-4 w-full">
              Avbryt
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  )
}
