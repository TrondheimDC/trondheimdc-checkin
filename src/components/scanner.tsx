"use client"

import { BrowserQRCodeReader } from "@zxing/browser"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

const SETUP_KEY = "tdc-checkin-printer-seen"

export function Scanner() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [pickingCamera, setPickingCamera] = useState(false)

  useEffect(() => {
    setReady(window.localStorage.getItem(SETUP_KEY) === "1")
  }, [])

  useEffect(() => {
    if (!ready || !videoRef.current) return
    const reader = new BrowserQRCodeReader()
    let stopped = false
    const controlsPromise = reader.decodeFromVideoDevice(deviceId, videoRef.current, (result) => {
      if (!result || stopped) return
      stopped = true
      const id = result.getText().trim()
      if (id) router.push(`/deltaker/${encodeURIComponent(id)}`)
    })

    controlsPromise
      .then(async () => {
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
      void controlsPromise.then((controls) => controls.stop())
    }
  }, [ready, router, deviceId])

  if (!ready) {
    return (
      <main className="flex min-h-dvh flex-col justify-end gap-4 p-4">
        <h1 className="text-4xl">Koble til skriveren først</h1>
        <p className="text-lg leading-relaxed">
          Åpne Smooth Print og sjekk at QL-820NWBc er valgt.
        </p>
        <Button asChild size="lg">
          <Link href="/oppsett">Sett opp</Link>
        </Button>
      </main>
    )
  }

  return (
    <main className="relative min-h-dvh bg-black">
      <video ref={videoRef} className="h-dvh w-full object-cover" muted playsInline />
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-48 -translate-y-1/2 rounded-2xl border-4 border-[var(--color-fg-brand)]" />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-black p-4 pb-6">
        {error ? <p className="text-lg">{error}</p> : <p className="text-lg">Hold QR-koden innenfor rammen</p>}
        {pickingCamera ? (
          <div className="flex flex-col gap-2">
            {cameras.map((camera, index) => {
              const selected = camera.deviceId === deviceId
              return (
                <button
                  key={camera.deviceId}
                  type="button"
                  onClick={() => setDeviceId(camera.deviceId)}
                  className={`h-14 truncate rounded-xl px-4 text-left text-lg font-semibold ${
                    selected
                      ? "bg-[var(--color-fg-brand)] text-[var(--color-fg-always-dark)]"
                      : "bg-[var(--color-bg-surface)] text-[var(--color-fg-base)]"
                  }`}
                >
                  {camera.label || `Kamera ${index + 1}`}
                </button>
              )
            })}
            <Button size="lg" onClick={() => setPickingCamera(false)}>
              Ferdig
            </Button>
          </div>
        ) : (
          <Button variant="surface" size="lg" onClick={() => setPickingCamera(true)}>
            Kamera
          </Button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="surface" size="lg">
            <Link href="/sok">Søk</Link>
          </Button>
          <Button asChild variant="surface" size="lg">
            <Link href="/oppsett">Oppsett</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
