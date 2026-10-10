"use client"

import { useEffect, useSyncExternalStore } from "react"
import { appPrinterSupported, reconnectAppPrinter, restoreAppPrinter } from "@/lib/app-printer"
import { type LabelPrinterState, printerState, subscribePrinter } from "@/lib/label-printer"
import { currentPrintMethod } from "@/lib/print-method"
import { connectUsbPrinter, restoreUsbPrinter, usbSupported } from "@/lib/usb-printer"

const SERVER_STATE: LabelPrinterState = { kind: "connecting" }
const UNSUPPORTED_STATE: LabelPrinterState = { kind: "unsupported" }

function supported(): boolean {
  return currentPrintMethod() === "app" ? appPrinterSupported() : usbSupported()
}

/** Connection state; also re-opens a remembered printer on first use. */
export function useLabelPrinter(): LabelPrinterState {
  useEffect(() => {
    // Android Chrome has WebUSB too, but phones in the browser print through Smooth Print.
    const method = currentPrintMethod()
    if (method === "usb") void restoreUsbPrinter()
    if (method === "app") void restoreAppPrinter()
  }, [])
  return useSyncExternalStore(
    subscribePrinter,
    () => (supported() ? printerState() : UNSUPPORTED_STATE),
    () => SERVER_STATE,
  )
}

/**
 * «Koble til printer»: Chrome's USB picker on PC/Mac, the remembered Bluetooth
 * printer in the app. False when nothing was connected.
 */
export function connectLabelPrinter(): Promise<boolean> {
  return currentPrintMethod() === "app" ? reconnectAppPrinter() : connectUsbPrinter()
}
