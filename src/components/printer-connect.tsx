"use client"

import { Bluetooth, LoaderCircle, Usb } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { type LabelPrinterState, printerState } from "@/lib/label-printer"
import { desktopOsFromNavigator } from "@/lib/platform"
import { usePrintMethod } from "@/lib/print-method"
import { connectLabelPrinter } from "@/lib/use-label-printer"
import { apiPath } from "@/lib/utils"

export const USB_UNSUPPORTED_COPY =
  "Bruk en nettleser som støtter WebUSB (Chrome eller Edge) for å skrive ut fra PC/Mac."

const APP_UNSUPPORTED_COPY = "Denne versjonen av appen kan ikke skrive ut. Installer den nyeste."

/** Where the app sends staff when there is no printer to reconnect to. */
export const APP_SETUP_SCAN_PATH = "/oppsett?step=scan&primed=1"

/** True when the print button should be replaced by «Koble til printer». */
export function printerNeedsConnect(printer: LabelPrinterState): boolean {
  return printer.kind === "idle" || printer.kind === "error"
}

/**
 * Print button stays in place but disabled: no way to print here, or a remembered
 * printer is still re-opening on page load (so the button does not flip to «Koble til printer»).
 */
export function printerBlocksPrint(printer: LabelPrinterState): boolean {
  return printer.kind === "unsupported" || printer.kind === "connecting"
}

/** Error line for a printer state; `error` (from the last print) wins. */
export function PrinterMessage({
  printer,
  error,
}: {
  printer: LabelPrinterState
  error: string | null
}) {
  const app = usePrintMethod() === "app"
  const message =
    error ??
    (printer.kind === "unsupported"
      ? app
        ? APP_UNSUPPORTED_COPY
        : USB_UNSUPPORTED_COPY
      : printer.kind === "error"
        ? printer.message
        : null)
  if (!message) return null
  // Mac has no driver step; there «in use» just means another tab.
  const os = typeof navigator === "undefined" ? "other" : desktopOsFromNavigator()
  const help =
    !error && printer.kind === "error" && printer.driverHelp && (os === "windows" || os === "linux")
  return (
    <p className="text-base text-[var(--color-bg-danger)]">
      {message}{" "}
      {help ? (
        <Link href={apiPath("/oppsett?step=driver")} className="underline underline-offset-4">
          Hjelp
        </Link>
      ) : null}
    </p>
  )
}

/**
 * PC/Mac: opens Chrome's USB picker (must be tapped — the browser refuses it otherwise).
 * App: reconnects the remembered Bluetooth printer, or goes to setup to scan one.
 */
export function PrinterConnectButton({
  className,
  size = "lg",
}: {
  className?: string
  size?: "lg" | "default"
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const app = usePrintMethod() === "app"

  async function connect() {
    setBusy(true)
    try {
      const connected = await connectLabelPrinter()
      // Still idle: no remembered or paired printer to try. A failed attempt shows its error instead.
      if (!connected && app && printerState().kind === "idle") router.push(APP_SETUP_SCAN_PATH)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      size={size}
      className={className}
      disabled={busy}
      onClick={() => void connect()}
    >
      {busy ? (
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
      ) : app ? (
        <Bluetooth className="size-5" aria-hidden />
      ) : (
        <Usb className="size-5" aria-hidden />
      )}
      Koble til printer
    </Button>
  )
}
