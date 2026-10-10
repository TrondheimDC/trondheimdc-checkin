"use client"

import { Bluetooth, Camera, CircleCheck, LoaderCircle, Printer } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { BadgePreview } from "@/components/badge-preview"
import {
  PhonePairIllustration,
  PrinterBluetoothIllustration,
  ScanStickerIllustration,
} from "@/components/illustrations"
import { PrinterMessage, printerBlocksPrint } from "@/components/printer-connect"
import { SetupQrScan } from "@/components/setup-qr-scan"
import { Button } from "@/components/ui/button"
import {
  type AppPrinter,
  connectAppPrinter,
  enablePhoneBluetooth,
  pairedAppPrinters,
} from "@/lib/app-printer"
import { LabelPrintError, printBadge } from "@/lib/label-printer"
import type { PrinterSetupParams } from "@/lib/printer-setup"
import { useLabelPrinter } from "@/lib/use-label-printer"
import { apiPath } from "@/lib/utils"

const SETUP_KEY = "tdc-checkin-printer-seen"
const TEST_NAME = "Test"
const TEST_LINE2 = "TDC"

const artClassName = "max-h-full rounded-2xl bg-[var(--color-bg-surface)]"

type AppStepId = "bt-on" | "scan" | "select" | "connect" | "test-print"
type AppPath = "qr" | "manual"

const STEPS: Record<AppStepId, { title: string; body: string }> = {
  "bt-on": {
    title: "Sjekk Bluetooth",
    body: "Bluetooth-ikonet skal synes øverst til høyre på printerskjermen. Mangler det: Menu → Bluetooth (6), og slå den på.",
  },
  scan: {
    title: "Skann QR på printeren",
    body: "Skann klistremerket for å koble telefonen til printeren.",
  },
  select: {
    title: "Velg printeren",
    body: "Printere telefonen allerede er paret med.",
  },
  connect: {
    title: "Koble til printeren",
    body: "Første gang spør telefonen om å pare. Sjekk at koden er lik på begge, og bekreft.",
  },
  "test-print": {
    title: "Skriv ut et testskilt",
    body: "Sjekker ikke inn noen deltaker.",
  },
}

function stepsFor(path: AppPath): AppStepId[] {
  return path === "manual"
    ? ["bt-on", "select", "connect", "test-print"]
    : ["bt-on", "scan", "connect", "test-print"]
}

/**
 * Android app setup: no Smooth Print. Printer Bluetooth on → scan the sticker →
 * the app connects over Bluetooth (Android pairs on the way) → test print.
 * Fallback from scan: pick a printer the phone is already paired with.
 */
export function AppSetupFlow({
  initialStep,
  initialPath,
  initialPrinter,
  initialPrimed,
}: {
  initialStep: string | null
  initialPath: AppPath | null
  initialPrinter: PrinterSetupParams | null
  initialPrimed: boolean
}) {
  const router = useRouter()
  const connection = useLabelPrinter()
  const [path, setPath] = useState<AppPath>(initialPath ?? "qr")
  const [stepId, setStepId] = useState<AppStepId>(() => {
    const steps = stepsFor(initialPath ?? "qr")
    const wanted = steps.find((id) => id === initialStep)
    // A fresh sticker deeplink still starts at Bluetooth on; once primed, resume.
    if (wanted && initialPrimed) return wanted
    return "bt-on"
  })
  const [printer, setPrinter] = useState<PrinterSetupParams | null>(initialPrinter)
  const [cameraOn, setCameraOn] = useState(false)
  const [paired, setPaired] = useState<AppPrinter[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [printed, setPrinted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const steps = stepsFor(path)
  const step = Math.max(0, steps.indexOf(stepId))
  const primed = stepId !== "bt-on"
  const current = STEPS[stepId]
  const ready = connection.kind === "ready"

  useEffect(() => {
    const params = new URLSearchParams({ path, step: stepId })
    if (primed) params.set("primed", "1")
    if (printer?.id) params.set("printer", printer.id)
    else if (printer) params.set("address", printer.address)
    const next = apiPath(`/oppsett?${params}`)
    if (`${window.location.pathname}${window.location.search}` === next) return
    // Same as the phone wizard: replaceState so a step change does not remount the flow.
    window.history.replaceState(window.history.state, "", next)
  }, [path, stepId, primed, printer])

  useEffect(() => {
    setCameraOn(false)
    setError(null)
    if (stepId !== "select") return
    pairedAppPrinters()
      .then(setPaired)
      .catch(() => setPaired([]))
  }, [stepId])

  function go(next: AppStepId) {
    setStepId(next)
  }

  function back() {
    const previous = steps[step - 1]
    if (previous) setStepId(previous)
  }

  async function afterBluetoothOn() {
    // Phone Bluetooth too: Android shows its own «Slå på?» dialog when it is off.
    await enablePhoneBluetooth().catch(() => false)
    go(printer ? "connect" : path === "manual" ? "select" : "scan")
  }

  function chooseManual() {
    setPrinter(null)
    setPath("manual")
    go("select")
  }

  function choosePaired(found: AppPrinter) {
    setPrinter({ address: found.address, serial: "", model: found.name ?? "", connectType: "BT" })
    go("connect")
  }

  async function connect() {
    if (!printer) return
    setError(null)
    setBusy(true)
    try {
      if (await connectAppPrinter(printer.address)) go("test-print")
    } finally {
      setBusy(false)
    }
  }

  async function printTest() {
    setError(null)
    setBusy(true)
    try {
      await printBadge({ name: TEST_NAME, line2: TEST_LINE2 })
      setPrinted(true)
    } catch (caught) {
      setError(caught instanceof LabelPrintError ? caught.message : "Klarte ikke å skrive ut.")
    } finally {
      setBusy(false)
    }
  }

  function finish() {
    window.localStorage.setItem(SETUP_KEY, "1")
    router.push("/")
  }

  return (
    <main className="mx-auto flex h-svh max-w-md flex-col overflow-hidden px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mb-3 flex shrink-0 gap-2">
        {steps.map((id, index) => (
          <span
            key={id}
            className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-[var(--color-fg-brand)]" : "bg-[var(--color-bg-surface)]"}`}
          />
        ))}
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {stepId === "bt-on" ? (
          <PrinterBluetoothIllustration className={artClassName} />
        ) : stepId === "scan" && cameraOn ? (
          <SetupQrScan
            onFound={(found) => {
              setPrinter(found)
              go("connect")
            }}
          />
        ) : stepId === "scan" ? (
          <ScanStickerIllustration className={artClassName} />
        ) : stepId === "select" ? (
          paired && paired.length > 0 ? (
            <div className="flex w-full flex-col gap-2">
              {paired.map((item) => (
                <Button
                  key={item.address}
                  variant="surface"
                  className="h-auto w-full items-start justify-start px-5 py-4 text-left whitespace-normal"
                  onClick={() => choosePaired(item)}
                >
                  <Bluetooth className="mt-0.5 size-5 shrink-0" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-lg">{item.name ?? "QL-820NWB"}</span>
                    <span className="block font-mono text-sm break-all opacity-60">
                      {item.address}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          ) : paired ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <PhonePairIllustration className={artClassName} />
              <p className="text-lg">Ingen paret printer</p>
            </div>
          ) : (
            <LoaderCircle className="size-8 animate-spin opacity-60" aria-hidden />
          )
        ) : stepId === "connect" ? (
          printer ? (
            <div className="flex w-full items-center gap-4 rounded-2xl bg-[var(--color-bg-surface)] px-5 py-6">
              {ready ? (
                <CircleCheck className="size-8 shrink-0 text-[var(--color-fg-brand)]" aria-hidden />
              ) : connection.kind === "connecting" || busy ? (
                <LoaderCircle className="size-8 shrink-0 animate-spin opacity-60" aria-hidden />
              ) : (
                <Bluetooth className="size-8 shrink-0 opacity-60" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="text-lg">
                  {ready ? `${connection.name ?? "Printeren"} er koblet til` : printer.model}
                </p>
                <p className="mt-1 font-mono text-sm break-all opacity-60">{printer.address}</p>
              </div>
            </div>
          ) : (
            <p className="text-base opacity-70">
              Mangler printeropplysninger. Gå tilbake og skann QR.
            </p>
          )
        ) : (
          <BadgePreview name={TEST_NAME} line2={TEST_LINE2} />
        )}
      </div>

      <p className="mt-2 shrink-0 font-mono text-sm text-[var(--color-fg-brand)]">
        {step + 1} av {steps.length}
      </p>
      <h1 className="mt-1 shrink-0 text-3xl">{current.title}</h1>
      <p className="mt-2 shrink-0 text-base leading-snug">
        {stepId === "select" && paired?.length === 0
          ? "Gå tilbake og skann QR-en på printeren. Da kobler appen til selv."
          : current.body}
      </p>

      <div className="mt-auto flex shrink-0 flex-col gap-2 pt-3">
        {stepId === "bt-on" ? (
          <Button className="h-12 w-full text-base" onClick={() => void afterBluetoothOn()}>
            Neste
          </Button>
        ) : null}

        {stepId === "scan" ? (
          <>
            {cameraOn ? (
              <Button
                variant="surface"
                className="h-12 w-full text-base"
                onClick={() => setCameraOn(false)}
              >
                Lukk kamera
              </Button>
            ) : (
              <Button className="h-12 w-full text-base" onClick={() => setCameraOn(true)}>
                <Camera className="size-5" aria-hidden />
                Start kamera
              </Button>
            )}
            <Button variant="ghost" className="h-12 w-full text-base" onClick={chooseManual}>
              Manuelt oppsett
            </Button>
          </>
        ) : null}

        {stepId === "connect" ? (
          <>
            {connection.kind === "error" ? (
              <PrinterMessage printer={connection} error={null} />
            ) : null}
            {ready ? (
              <Button className="h-12 w-full text-base" onClick={() => go("test-print")}>
                Neste
              </Button>
            ) : (
              <Button
                className="h-12 w-full text-base"
                disabled={!printer || busy || connection.kind === "connecting"}
                onClick={() => void connect()}
              >
                <Bluetooth className="size-5" aria-hidden />
                {connection.kind === "error" ? "Prøv igjen" : "Koble til printeren"}
              </Button>
            )}
          </>
        ) : null}

        {stepId === "test-print" ? (
          <>
            <PrinterMessage printer={connection} error={error} />
            <Button
              variant={printed ? "surface" : "default"}
              className="h-12 w-full text-base"
              disabled={busy || printerBlocksPrint(connection)}
              onClick={() => void printTest()}
            >
              {busy ? (
                <LoaderCircle className="size-5 animate-spin" aria-hidden />
              ) : (
                <Printer className="size-5" aria-hidden />
              )}
              {busy ? "Skriver ut…" : printed ? "Skriv ut igjen" : "Skriv ut testskilt"}
            </Button>
            <Button className="h-12 w-full text-base" disabled={!printed} onClick={finish}>
              Begynn å skanne
            </Button>
            <Button variant="ghost" className="h-12 w-full text-base" onClick={finish}>
              Hopp over testen
            </Button>
          </>
        ) : null}

        {step === 0 ? (
          <Button asChild variant="ghost" className="h-12 w-full text-base">
            <Link href="/">Avbryt</Link>
          </Button>
        ) : (
          <Button variant="ghost" className="h-12 w-full text-base" onClick={back}>
            Tilbake
          </Button>
        )}
      </div>
    </main>
  )
}
