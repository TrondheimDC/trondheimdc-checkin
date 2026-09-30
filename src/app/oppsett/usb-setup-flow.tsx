"use client"

import { CircleCheck, LoaderCircle, Printer } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { BadgePreview } from "@/components/badge-preview"
import { Button } from "@/components/ui/button"
import {
  UsbConnectButton,
  UsbPrintMessage,
  usbBlocksPrint,
  usbNeedsConnect,
} from "@/components/usb-connect"
import { connectUsbPrinter, printBadgeUsb, UsbPrintError, useUsbPrinter } from "@/lib/usb-printer"
import { apiPath } from "@/lib/utils"

const SETUP_KEY = "tdc-checkin-printer-seen"
const TEST_NAME = "Test"
const TEST_LINE2 = "TDC"

const USB_STEP_IDS = ["usb", "connect", "test-print"] as const
type UsbStepId = (typeof USB_STEP_IDS)[number]

const STEPS: Record<UsbStepId, { title: string; body: string }> = {
  usb: {
    title: "Koble til med USB",
    body: "Sett USB-kabelen i printeren og maskinen, og slå printeren på. Lyset på Editor Lite-knappen skal være av.",
  },
  connect: {
    title: "Velg printeren",
    body: "Trykk Koble til printer og velg QL-820NWB i listen nettleseren viser.",
  },
  "test-print": {
    title: "Skriv ut et testskilt",
    body: "Sjekker ikke inn noen deltaker.",
  },
}

/** PC/Mac setup: USB cable → pick the printer in Chrome → test print. Phones use SetupFlow. */
export function UsbSetupFlow({ initialStep }: { initialStep: string | null }) {
  const router = useRouter()
  const usb = useUsbPrinter()
  const [step, setStep] = useState(() =>
    Math.max(0, USB_STEP_IDS.indexOf((initialStep ?? "usb") as UsbStepId)),
  )
  const [busy, setBusy] = useState(false)
  const [printed, setPrinted] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const stepId = USB_STEP_IDS[step] ?? "usb"
  const current = STEPS[stepId]
  const unsupported = usb.kind === "unsupported"

  useEffect(() => {
    const next = apiPath(`/oppsett?step=${stepId}`)
    if (`${window.location.pathname}${window.location.search}` === next) return
    // Same as the phone wizard: replaceState so a step change does not remount the flow.
    window.history.replaceState(window.history.state, "", next)
  }, [stepId])

  function finish() {
    window.localStorage.setItem(SETUP_KEY, "1")
    router.push("/")
  }

  async function printTest() {
    setPrintError(null)
    setBusy(true)
    try {
      await printBadgeUsb({ name: TEST_NAME, line2: TEST_LINE2 })
      setPrinted(true)
    } catch (caught) {
      setPrintError(caught instanceof UsbPrintError ? caught.message : "Klarte ikke å skrive ut.")
    } finally {
      setBusy(false)
    }
  }

  if (unsupported) {
    return (
      <main className="mx-auto flex h-svh max-w-md flex-col overflow-hidden px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <img
            src="/printers/ql-820nwbc.jpg"
            alt=""
            className="max-h-full max-w-full rounded-2xl"
          />
        </div>
        <h1 className="mt-1 shrink-0 text-3xl">Bruk Chrome eller Edge</h1>
        <p className="mt-2 shrink-0 text-base leading-snug">
          Utskrift fra PC/Mac går over USB, og bare nettlesere som støtter WebUSB kan det.{" "}
          <a
            href="https://caniuse.com/webusb"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4"
          >
            Se hvilke
          </a>
        </p>
        <div className="mt-auto flex shrink-0 flex-col gap-2 pt-3">
          <Button asChild variant="ghost" className="h-12 w-full text-base">
            <Link href="/">Avbryt</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex h-svh max-w-md flex-col overflow-hidden px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mb-3 flex shrink-0 gap-2">
        {USB_STEP_IDS.map((id, index) => (
          <span
            key={id}
            className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-[var(--color-fg-brand)]" : "bg-[var(--color-bg-surface)]"}`}
          />
        ))}
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {stepId === "usb" ? (
          <img
            src="/printers/ql-820nwbc.jpg"
            alt=""
            className="max-h-full max-w-full rounded-2xl"
          />
        ) : stepId === "connect" ? (
          <div className="flex w-full items-center gap-4 rounded-2xl bg-[var(--color-bg-surface)] px-5 py-6">
            {usb.kind === "ready" ? (
              <CircleCheck className="size-8 shrink-0 text-[var(--color-fg-brand)]" aria-hidden />
            ) : usb.kind === "connecting" ? (
              <LoaderCircle className="size-8 shrink-0 animate-spin opacity-60" aria-hidden />
            ) : (
              <Printer className="size-8 shrink-0 opacity-60" aria-hidden />
            )}
            <div className="min-w-0">
              <p className="text-lg">
                {usb.kind === "ready"
                  ? "QL-820NWB er koblet til"
                  : usb.kind === "connecting"
                    ? "Kobler til…"
                    : "Ingen printer valgt"}
              </p>
              <p className="mt-1 font-mono text-sm break-all opacity-60">
                {usb.kind === "ready" && usb.serial ? `SN ${usb.serial}` : "USB"}
              </p>
            </div>
          </div>
        ) : (
          <BadgePreview name={TEST_NAME} line2={TEST_LINE2} />
        )}
      </div>

      <p className="mt-2 shrink-0 font-mono text-sm text-[var(--color-fg-brand)]">
        {step + 1} av {USB_STEP_IDS.length}
      </p>
      <h1 className="mt-1 shrink-0 text-3xl">{current.title}</h1>
      <p className="mt-2 shrink-0 text-base leading-snug">{current.body}</p>

      <div className="mt-auto flex shrink-0 flex-col gap-2 pt-3">
        {stepId === "usb" ? (
          <>
            <Button className="h-12 w-full text-base" onClick={() => setStep(1)}>
              Neste
            </Button>
            <Button asChild variant="ghost" className="h-12 w-full text-base">
              <Link href="/oppsett/usb">Bruker du Windows eller Linux?</Link>
            </Button>
          </>
        ) : null}

        {stepId === "connect" ? (
          <>
            <UsbPrintMessage usb={usb} error={null} />
            {usbNeedsConnect(usb) ? (
              <UsbConnectButton size="default" className="h-12 w-full text-base" />
            ) : null}
            {usb.kind === "ready" && usb.mismatch ? (
              <Button
                variant="surface"
                className="h-12 w-full text-base"
                onClick={() => void connectUsbPrinter()}
              >
                Velg en annen printer
              </Button>
            ) : null}
            <Button
              className="h-12 w-full text-base"
              disabled={usb.kind !== "ready"}
              onClick={() => setStep(2)}
            >
              Neste
            </Button>
          </>
        ) : null}

        {stepId === "test-print" ? (
          <>
            <UsbPrintMessage usb={usb} error={printError} />
            {usbNeedsConnect(usb) ? (
              <UsbConnectButton size="default" className="h-12 w-full text-base" />
            ) : (
              <Button
                variant={printed ? "surface" : "default"}
                className="h-12 w-full text-base"
                disabled={busy || usbBlocksPrint(usb)}
                onClick={() => void printTest()}
              >
                {busy ? (
                  <LoaderCircle className="size-5 animate-spin" aria-hidden />
                ) : (
                  <Printer className="size-5" aria-hidden />
                )}
                {busy ? "Skriver ut…" : printed ? "Skriv ut igjen" : "Skriv ut testskilt"}
              </Button>
            )}
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
          <Button
            variant="ghost"
            className="h-12 w-full text-base"
            onClick={() => setStep((value) => value - 1)}
          >
            Tilbake
          </Button>
        )}
      </div>
    </main>
  )
}
