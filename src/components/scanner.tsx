"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser"
import { Camera, Flashlight, FlashlightOff, MapPin, Search, Settings } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { ScanResultSheet } from "@/components/scan-result-sheet"
import { Button } from "@/components/ui/button"
import {
  applyTorch,
  openRearCamera,
  pickRearCamera,
  trackSupportsTorch,
  videoTrackFrom,
  type TorchTrack,
} from "@/lib/camera-torch"
import { attendeeResponseSchema, attendeeStatsSchema, type Attendee } from "@/lib/db/schema"
import { refinePlatform, platformFromNavigator } from "@/lib/platform"
import { consumePrintOutcome } from "@/lib/print-outcome"
import { parsePrinterSetupUrl, printerSetupPath } from "@/lib/printer-setup"
import {
  SCAN_AUTO_PRINT_DEFAULT,
  SCAN_AUTO_PRINT_KEY,
  SCAN_INLINE_DEFAULT,
  SCAN_INLINE_KEY,
} from "@/lib/scan-settings"
import { useLocalFlag } from "@/lib/use-local-flag"
import { apiPath } from "@/lib/utils"

const SETUP_KEY = "tdc-checkin-printer-seen"
/** Ignore the same barcode for a moment so one hold does not re-fire. */
const SAME_CODE_COOLDOWN_MS = 2500

const iconButtonClass =
  "scan-icon-btn flex size-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-black/75 active:scale-95"

export function Scanner({ printerName }: { printerName?: string }) {
  const stats = useQuery({
    queryKey: ["attendee-stats"],
    queryFn: async () => {
      const response = await fetch(apiPath("/api/attendees/stats"))
      if (!response.ok) throw new Error("stats failed")
      return attendeeStatsSchema.parse(await response.json())
    },
  })
  const queryClient = useQueryClient()
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const trackRef = useRef<TorchTrack | null>(null)
  const busyRef = useRef(false)
  const lastAcceptedRef = useRef<{ text: string; at: number } | null>(null)
  const ready = useLocalFlag(SETUP_KEY)
  const scanInlineFlag = useLocalFlag(SCAN_INLINE_KEY, SCAN_INLINE_DEFAULT)
  const autoPrintFlag = useLocalFlag(SCAN_AUTO_PRINT_KEY, SCAN_AUTO_PRINT_DEFAULT)
  const [error, setError] = useState<string | null>(null)
  const [scanHint, setScanHint] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [pickingCamera, setPickingCamera] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [tabVisible, setTabVisible] = useState(true)
  const [sheetAttendee, setSheetAttendee] = useState<Attendee | null>(null)

  useEffect(() => {
    const sync = () => setTabVisible(document.visibilityState === "visible")
    sync()
    document.addEventListener("visibilitychange", sync)
    return () => document.removeEventListener("visibilitychange", sync)
  }, [])

  useEffect(() => {
    const platform = refinePlatform(platformFromNavigator())
    consumePrintOutcome(platform)
  }, [])

  const handleDecoded = useEffectEvent(async (text: string) => {
    const printer = parsePrinterSetupUrl(text)
    if (printer) {
      router.push(printerSetupPath(printer))
      return
    }

    setScanHint(null)
    try {
      const response = await fetch(apiPath(`/api/attendees/${encodeURIComponent(text)}`))
      if (response.status === 404) {
        lastAcceptedRef.current = { text, at: Date.now() }
        setScanHint("Ukjent QR — skann på nytt")
        window.setTimeout(() => setScanHint((current) => (current?.startsWith("Ukjent") ? null : current)), 2000)
        return
      }
      if (!response.ok) throw new Error("lookup failed")
      const body = attendeeResponseSchema.parse(await response.json())
      queryClient.setQueryData(["attendee", body.attendee.id], body.attendee)
      lastAcceptedRef.current = { text, at: Date.now() }

      if (scanInlineFlag === true) {
        setSheetAttendee(body.attendee)
        return
      }

      if (scanInlineFlag === null) return

      router.push(`/deltaker/${encodeURIComponent(body.attendee.id)}`)
    } catch {
      setScanHint("Kunne ikke hente deltaker. Prøv igjen.")
      window.setTimeout(() => setScanHint((current) => (current?.startsWith("Kunne") ? null : current)), 2000)
    } finally {
      busyRef.current = false
    }
  })

  useEffect(() => {
    if (!ready || !tabVisible || !videoRef.current) return
    const reader = new BrowserQRCodeReader()
    const video = videoRef.current
    let stopped = false
    busyRef.current = false
    const torchPolls: number[] = []
    setTorchOn(false)
    setTorchSupported(false)
    controlsRef.current = null
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
        if (!result || stopped || busyRef.current) return
        const text = result.getText().trim()
        if (!text) return
        const last = lastAcceptedRef.current
        if (last && last.text === text && Date.now() - last.at < SAME_CODE_COOLDOWN_MS) return
        // Only gate while a lookup is in flight — camera stays up for continuous scan.
        busyRef.current = true
        void handleDecoded(text)
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
  }, [ready, deviceId, tabVisible])

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

  if (ready === null) {
    return <main className="min-h-dvh bg-black" />
  }

  if (!ready) {
    return (
      <main className="attendee-reveal relative flex min-h-dvh flex-col justify-end overflow-hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="attendee-badge-glow" aria-hidden />
        <div className="relative flex flex-col gap-4">
          <p className="text-sm tracking-wide text-[var(--color-fg-brand)]">Førstegangsoppsett</p>
          <h1 className="text-4xl">Koble til printeren først</h1>
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

  const hudMessage = error ?? scanHint
  const hudLabel = error ? "Kamera" : scanHint ? "Skann" : "Skanner"

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-black">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        muted
        playsInline
        autoPlay
        disablePictureInPicture
      />

      <div className="relative z-10 flex shrink-0 items-start justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
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
            className={`${iconButtonClass} ${
              !torchSupported
                ? "scan-torch-disabled pointer-events-none"
                : torchOn
                  ? "bg-[var(--color-fg-brand)] text-[var(--color-fg-always-dark)] hover:bg-[var(--color-green-3)]"
                  : ""
            }`}
            style={{ animationDelay: "120ms" }}
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
        </div>
        <Link
          href="/innstillinger"
          className={iconButtonClass}
          style={{ animationDelay: "160ms" }}
          aria-label="Innstillinger"
        >
          <Settings className="size-6" />
        </Link>
      </div>

      {printerName ? (
        <div className="pointer-events-none absolute inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-10 flex justify-center">
          <span
            className="scan-icon-btn flex h-12 items-center gap-2 rounded-full bg-black/55 px-4 text-sm font-medium text-white backdrop-blur-md"
            style={{ animationDelay: "140ms" }}
          >
            <MapPin className="size-4 text-[var(--color-fg-brand)]" aria-hidden />
            {printerName}
          </span>
        </div>
      ) : null}

      <div className="relative z-10 flex flex-1 items-center justify-center px-7">
        <div className="scan-reticle" aria-hidden>
          <span className="scan-reticle-corner tl" />
          <span className="scan-reticle-corner tr" />
          <span className="scan-reticle-corner bl" />
          <span className="scan-reticle-corner br" />
          {!error ? <span className="scan-reticle-line" /> : null}
        </div>
      </div>

      <div className="scan-hud relative z-10 flex shrink-0 flex-col gap-3 bg-gradient-to-t from-black via-black/85 to-transparent p-4 pt-16 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          {!hudMessage ? (
            <span className="scan-live-dot size-2.5 rounded-full bg-[var(--color-fg-brand)]" aria-hidden />
          ) : null}
          <p
            className={`text-sm tracking-wide ${
              scanHint && !error ? "text-[var(--color-bg-danger)]" : "text-[var(--color-fg-brand)]"
            }`}
          >
            {hudLabel}
          </p>
        </div>
        {error ? (
          <p className="text-lg leading-snug">{error}</p>
        ) : scanHint ? (
          <p className="text-xl leading-snug">{scanHint}</p>
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

        {!sheetAttendee ? (
          <>
            <Button asChild variant="surface" size="lg">
              <Link href="/sok">
                <Search className="size-5" aria-hidden />
                Søk
              </Link>
            </Button>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              {(
                [
                  { label: "Totalt", value: stats.data?.total },
                  { label: "Innsjekket", value: stats.data?.checkedIn },
                  {
                    label: "Igjen",
                    value:
                      stats.data != null ? stats.data.total - stats.data.checkedIn : undefined,
                  },
                ] as const
              ).map((item) => (
                <div key={item.label} className="rounded-xl bg-black/35 px-2 py-2.5 backdrop-blur-sm">
                  <p className="font-display text-2xl tabular-nums leading-none">
                    {item.value != null ? item.value : "–"}
                  </p>
                  <p className="mt-1 text-xs tracking-wide opacity-60">{item.label}</p>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <ScanResultSheet
        attendee={sheetAttendee}
        autoPrint={autoPrintFlag === true}
        onDismiss={() => setSheetAttendee(null)}
        onPrinted={() => setSheetAttendee(null)}
      />
    </main>
  )
}
