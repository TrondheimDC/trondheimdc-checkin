"use client"

import { Usb } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { desktopOsFromNavigator } from "@/lib/platform"
import { connectUsbPrinter, type UsbPrinterState } from "@/lib/usb-printer"
import { apiPath } from "@/lib/utils"

export const USB_UNSUPPORTED_COPY =
  "Bruk en nettleser som støtter WebUSB (Chrome eller Edge) for å skrive ut fra PC/Mac."

/** True when the print button should be replaced by «Koble til printer». */
export function usbNeedsConnect(usb: UsbPrinterState): boolean {
  return usb.kind === "idle" || usb.kind === "error"
}

/**
 * Print button stays in place but disabled: no WebUSB, or a remembered printer is
 * still re-opening on page load (so the button does not flip to «Koble til printer»).
 */
export function usbBlocksPrint(usb: UsbPrinterState): boolean {
  return usb.kind === "unsupported" || usb.kind === "connecting"
}

/** Error line for a USB printer state; `error` (from the last print) wins. */
export function UsbPrintMessage({ usb, error }: { usb: UsbPrinterState; error: string | null }) {
  const message =
    error ??
    (usb.kind === "unsupported" ? USB_UNSUPPORTED_COPY : usb.kind === "error" ? usb.message : null)
  if (!message) {
    if (usb.kind !== "ready" || !usb.mismatch) return null
    return (
      <p className="text-base text-[var(--color-bg-danger)]">
        Dette ser ikke ut som printeren for {usb.mismatch}. Sjekk at riktig printer er koblet til.
      </p>
    )
  }
  // Mac has no driver step; there «in use» just means another tab.
  const os = typeof navigator === "undefined" ? "other" : desktopOsFromNavigator()
  const help =
    !error && usb.kind === "error" && usb.driverHelp && (os === "windows" || os === "linux")
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
export function UsbConnectButton({
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
      onClick={() => void connectUsbPrinter()}
    >
      <Usb className="size-5" aria-hidden />
      Koble til printer
    </Button>
  )
}
