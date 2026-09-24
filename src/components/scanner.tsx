"use client"

import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser"
import { Camera, Flashlight, FlashlightOff, Search, Settings } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

const SETUP_KEY = "tdc-checkin-printer-seen"

const iconButtonClass =
  "scan-icon-btn flex size-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-black/75 active:scale-95"

type TorchTrack = MediaStreamTrack & {
  getCapabilities?: () => MediaTrackCapabilities & { torch?: boolean }
  getSettings: () => MediaTrackSettings & { torch?: boolean }
}

function videoTrackFrom(video: HTMLVideoElement | null): TorchTrack | null {
  const stream = video?.srcObject
  if (!(stream instanceof MediaStream)) return null
  return (stream.getVideoTracks()[0] as TorchTrack | undefined) ?? null
}

/**
 * Samsung reports getSettings().torch as false even when the LED is on, and a
 * top-level `{ torch }` constraint is ignored. Chrome documents the advanced form.
 */
async function applyTorch(track: TorchTrack, on: boolean) {
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
function pickRearCamera(devices: MediaDeviceInfo[]) {
  const rear = devices.filter((device) => /back|rear|environment|bak/i.test(device.label))
  const pool = rear.length > 0 ? rear : devices
  const main = pool.find(
    (device) =>
      /camera2?\s*0\b|back camera/i.test(device.label) && !/ultra|wide|tele|depth|macro/i.test(device.label),
  )
  const plain = pool.find((device) => !/ultra|wide|tele|depth|macro/i.test(device.label))
  return (main ?? plain ?? pool[0])?.deviceId
}

async function openCamera(deviceId: string | undefined) {
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

export function Scanner() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const trackRef = useRef<TorchTrack | null>(null)
  // null = not checked yet (avoids flashing the setup gate on reload)
  const [ready, setReady] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [pickingCamera, setPickingCamera] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [tabVisible, setTabVisible] = useState(true)

  useEffect(() => {
    setReady(window.localStorage.getItem(SETUP_KEY) === "1")
  }, [])

  useEffect(() => {
    const sync = () => setTabVisible(document.visibilityState === "visible")
    sync()
    document.addEventListener("visibilitychange", sync)
    return () => document.removeEventListener("visibilitychange", sync)
  }, [])

  useEffect(() => {
    if (!ready || !tabVisible || !videoRef.current) return
    const reader = new BrowserQRCodeReader()
    const video = videoRef.current
    let stopped = false
    const torchPolls: number[] = []
    setTorchOn(false)
    controlsRef.current = null
    trackRef.current = null

    const refreshTorch = () => {
      if (stopped) return
      const track = trackRef.current ?? videoTrackFrom(video)
      if (!track) return
      trackRef.current = track
    }

    const controlsPromise = openCamera(deviceId).then((stream) => {
      const track = stream.getVideoTracks()[0] as TorchTrack | undefined
      trackRef.current = track ?? null
      if (stopped) {
        for (const item of stream.getTracks()) item.stop()
        throw new Error("stopped")
      }
      return reader.decodeFromStream(stream, video, (result) => {
        if (!result || stopped) return
        stopped = true
        const id = result.getText().trim()
        if (id) router.push(`/deltaker/${encodeURIComponent(id)}`)
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

        const devices = await BrowserQRCodeReader.listVideoInputDevices()
        if (stopped) return
        setCameras(devices)
        if (!deviceId) {
          const picked = pickRearCamera(devices)
          const current = trackRef.current?.getSettings().deviceId
          if (picked && picked !== current) setDeviceId(picked)
        }
      })
      .catch((error: unknown) => {
        if (stopped || (error instanceof Error && error.message === "stopped")) return
        setError("Ingen tilgang til kamera. Tillat kamera i nettleseren, eller søk etter navn.")
      })

    return () => {
      stopped = true
      for (const id of torchPolls) window.clearTimeout(id)
      controlsRef.current = null
      trackRef.current = null
      void controlsPromise.then((controls) => controls.stop()).catch(() => undefined)
    }
  }, [ready, router, deviceId, tabVisible])

  async function toggleTorch() {
    const next = !torchOn
    const track = trackRef.current ?? videoTrackFrom(videoRef.current)
    if (!track) return
    try {
      await applyTorch(track, next)
      setTorchOn(next)
    } catch {
      setTorchOn(false)
    }
  }

  if (ready === null) {
    return <main className="min-h-dvh bg-black" />
  }

  if (!ready) {
    return (
      <main className="attendee-reveal relative flex min-h-dvh flex-col justify-end overflow-hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="attendee-badge-glow" aria-hidden />
        <div className="relative flex flex-col gap-4">
          <p className="text-sm tracking-wide text-[var(--color-fg-brand)]">Første gangs oppsett</p>
          <h1 className="text-4xl">Koble til skriveren først</h1>
          <p className="text-lg leading-relaxed opacity-75">
            Åpne Smooth Print og sjekk at QL-820NWBc er valgt.
          </p>
          <Button asChild size="lg">
            <Link href="/oppsett">Sett opp</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-black">
      <video ref={videoRef} className="h-dvh w-full object-cover" muted playsInline />

      <div className="scan-reticle" aria-hidden>
        <span className="scan-reticle-corner tl" />
        <span className="scan-reticle-corner tr" />
        <span className="scan-reticle-corner bl" />
        <span className="scan-reticle-corner br" />
        {!error ? <span className="scan-reticle-line" /> : null}
      </div>

      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex gap-2">
          <button
            type="button"
            className={iconButtonClass}
            style={{ animationDelay: "80ms" }}
            aria-label="Velg kamera"
            aria-expanded={pickingCamera}
            onClick={() => setPickingCamera((open) => !open)}
          >
            <Camera className="size-6" />
          </button>
          <button
            type="button"
            className={`${iconButtonClass} ${torchOn ? "bg-[var(--color-fg-brand)] text-[var(--color-fg-always-dark)] hover:bg-[var(--color-green-3)]" : ""}`}
            style={{ animationDelay: "120ms" }}
            aria-label={torchOn ? "Slå av blitz" : "Slå på blitz"}
            aria-pressed={torchOn}
            onClick={() => void toggleTorch()}
          >
            {torchOn ? <Flashlight className="size-6" /> : <FlashlightOff className="size-6" />}
          </button>
        </div>
        <Link
          href="/oppsett"
          className={iconButtonClass}
          style={{ animationDelay: "160ms" }}
          aria-label="Oppsett"
        >
          <Settings className="size-6" />
        </Link>
      </div>

      <div className="scan-hud absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-black via-black/85 to-transparent p-4 pt-16 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          {!error ? (
            <span className="scan-live-dot size-2.5 rounded-full bg-[var(--color-fg-brand)]" aria-hidden />
          ) : null}
          <p className="text-sm tracking-wide text-[var(--color-fg-brand)]">
            {error ? "Kamera" : "Skanner"}
          </p>
        </div>
        {error ? (
          <p className="text-lg leading-snug">{error}</p>
        ) : (
          <p className="text-xl leading-snug">Hold QR-koden innenfor rammen</p>
        )}

        {pickingCamera ? (
          <div className="flex flex-col gap-2">
            {cameras.map((camera, index) => {
              const selected = camera.deviceId === deviceId
              return (
                <button
                  key={camera.deviceId}
                  type="button"
                  onClick={() => {
                    setDeviceId(camera.deviceId)
                    setPickingCamera(false)
                  }}
                  className={`search-item-in h-14 truncate rounded-xl px-4 text-left text-lg font-semibold transition-transform active:scale-[0.98] ${
                    selected
                      ? "bg-[var(--color-fg-brand)] text-[var(--color-fg-always-dark)]"
                      : "bg-[var(--color-bg-surface)] text-[var(--color-fg-base)]"
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {camera.label || `Kamera ${index + 1}`}
                </button>
              )
            })}
          </div>
        ) : null}

        <Button asChild variant="surface" size="lg">
          <Link href="/sok">
            <Search className="size-5" aria-hidden />
            Søk etter navn
          </Link>
        </Button>
      </div>
    </main>
  )
}
