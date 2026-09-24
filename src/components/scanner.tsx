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

export function Scanner() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  // null = not checked yet (avoids flashing the setup gate on reload)
  const [ready, setReady] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [pickingCamera, setPickingCamera] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)

  useEffect(() => {
    setReady(window.localStorage.getItem(SETUP_KEY) === "1")
  }, [])

  useEffect(() => {
    if (!ready || !videoRef.current) return
    const reader = new BrowserQRCodeReader()
    let stopped = false
    setTorchOn(false)
    setTorchAvailable(false)
    controlsRef.current = null

    const controlsPromise = reader.decodeFromVideoDevice(deviceId, videoRef.current, (result) => {
      if (!result || stopped) return
      stopped = true
      const id = result.getText().trim()
      if (id) router.push(`/deltaker/${encodeURIComponent(id)}`)
    })

    controlsPromise
      .then(async (controls) => {
        if (stopped) {
          controls.stop()
          return
        }
        controlsRef.current = controls
        setTorchAvailable(typeof controls.switchTorch === "function")
        const devices = await BrowserQRCodeReader.listVideoInputDevices()
        if (stopped) return
        setCameras(devices)
        if (!deviceId && devices[0]) {
          const back = devices.find((camera) => /back|rear|environment|bak/i.test(camera.label))
          setDeviceId((back ?? devices[0]).deviceId)
        }
      })
      .catch(() => {
        setError("Ingen tilgang til kamera. Tillat kamera i nettleseren, eller søk etter navn.")
      })

    return () => {
      stopped = true
      controlsRef.current = null
      void controlsPromise.then((controls) => controls.stop())
    }
  }, [ready, router, deviceId])

  async function toggleTorch() {
    const switchTorch = controlsRef.current?.switchTorch
    if (!switchTorch) return
    const next = !torchOn
    try {
      await switchTorch(next)
      setTorchOn(next)
    } catch {
      setTorchAvailable(false)
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
          {torchAvailable ? (
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
          ) : null}
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
