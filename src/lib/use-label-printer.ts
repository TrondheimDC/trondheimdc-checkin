"use client"

import { useEffect, useSyncExternalStore } from "react"
import { type LabelPrinterState, printerState, subscribePrinter } from "@/lib/label-printer"
import { currentPrintMethod } from "@/lib/print-method"
import { connectUsbPrinter, restoreUsbPrinter, usbSupported } from "@/lib/usb-printer"

const SERVER_STATE: LabelPrinterState = { kind: "connecting" }
const UNSUPPORTED_STATE: LabelPrinterState = { kind: "unsupported" }

/** Connection state; also re-opens a remembered printer on first use. */
export function useLabelPrinter(): LabelPrinterState {
  useEffect(() => {
    // Android Chrome has WebUSB too, but phones print through Smooth Print.
    if (currentPrintMethod() === "usb") void restoreUsbPrinter()
  }, [])
  return useSyncExternalStore(
    subscribePrinter,
    () => (usbSupported() ? printerState() : UNSUPPORTED_STATE),
    () => SERVER_STATE,
  )
}

/** «Koble til printer»: Chrome's USB picker. False when nothing was connected. */
export function connectLabelPrinter(): Promise<boolean> {
  return connectUsbPrinter()
}
