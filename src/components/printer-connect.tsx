"use client"

import { Usb } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import type { LabelPrinterState } from "@/lib/label-printer"
import { desktopOsFromNavigator } from "@/lib/platform"
import { connectLabelPrinter } from "@/lib/use-label-printer"
import { apiPath } from "@/lib/utils"

export const USB_UNSUPPORTED_COPY =
  "Bruk en nettleser som støtter WebUSB (Chrome eller Edge) for å skrive ut fra PC/Mac."

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
  const message =
    error ??
    (printer.kind === "unsupported"
      ? USB_UNSUPPORTED_COPY
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

/** Opens Chrome's USB picker. Must be tapped — the browser refuses it otherwise. */
export function PrinterConnectButton({
  className,
  size = "lg",
}: {
  className?: string
  size?: "lg" | "default"
}) {
  return (
    <Button
      type="button"
      size={size}
      className={className}
      onClick={() => void connectLabelPrinter()}
    >
      <Usb className="size-5" aria-hidden />
      Koble til printer
    </Button>
  )
}
