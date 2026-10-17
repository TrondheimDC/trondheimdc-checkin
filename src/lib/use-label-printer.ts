"use client"

import { useEffect, useSyncExternalStore } from "react"
import {
  appPrinterSupported,
  appRadioState,
  reconnectAppPrinter,
  restoreAppPrinter,
  subscribeAppRadio,
  watchAppRadio,
} from "@/lib/app-printer"
import {
  isOpening,
  type LabelPrinterState,
  printerState,
  subscribePrinter,
} from "@/lib/label-printer"
import { currentPrintMethod, usePrintMethod } from "@/lib/print-method"
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
    if (method === "app") {
      watchAppRadio()
      void restoreAppPrinter()
    }
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

const SERVER_RADIO = { bluetooth: "unknown" as const, pairing: false }

/** What the Android app should show for the printer link. `inactive` on every other platform. */
export type AppLinkPhase =
  | { kind: "inactive" }
  | { kind: "ready" }
  | { kind: "bluetooth-off" }
  | { kind: "pairing" }
  | { kind: "connecting"; opening: boolean }
  | { kind: "disconnected" }
  | { kind: "error"; message: string }
  | { kind: "unsupported" }

export function appLinkPhase(
  method: ReturnType<typeof usePrintMethod>,
  printer: LabelPrinterState,
  radio: { bluetooth: "unknown" | "on" | "off"; pairing: boolean },
  opening: boolean,
): AppLinkPhase {
  if (method !== "app") return { kind: "inactive" }
  if (radio.bluetooth === "off") return { kind: "bluetooth-off" }
  if (radio.pairing) return { kind: "pairing" }
  if (printer.kind === "connecting") return { kind: "connecting", opening }
  if (printer.kind === "error") return { kind: "error", message: printer.message }
  if (printer.kind === "unsupported") return { kind: "unsupported" }
  if (printer.kind === "ready") return { kind: "ready" }
  return { kind: "disconnected" }
}

export function useAppLinkPhase(): AppLinkPhase {
  const method = usePrintMethod()
  const printer = useLabelPrinter()
  const radio = useSyncExternalStore(subscribeAppRadio, appRadioState, () => SERVER_RADIO)
  return appLinkPhase(method, printer, radio, isOpening())
}

/** Staff have to tap: Bluetooth on, connect, or retry. Same slot as desktop «Koble til printer». */
export function appLinkNeedsAction(phase: AppLinkPhase): boolean {
  return (
    phase.kind === "bluetooth-off" ||
    phase.kind === "disconnected" ||
    phase.kind === "error" ||
    phase.kind === "unsupported"
  )
}

/** Socket is opening or Android is showing the pairing dialog. */
export function appLinkBusy(phase: AppLinkPhase): boolean {
  return phase.kind === "pairing" || (phase.kind === "connecting" && phase.opening)
}

export function appLinkBusyLabel(phase: AppLinkPhase): string {
  return phase.kind === "pairing" ? "Bekreft paring…" : "Kobler til…"
}

/** Top status bar. Hidden while the app is only checking a remembered printer. */
export function appLinkStatusVisible(phase: AppLinkPhase): boolean {
  return appLinkNeedsAction(phase) || appLinkBusy(phase)
}
