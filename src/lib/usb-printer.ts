"use client"

import {
  closePrinter,
  hasOpenPrinter,
  isOpening,
  LabelPrintError,
  openPrinter,
  printerState,
  setPrinterState,
} from "@/lib/label-printer"

/**
 * PC/Mac connector: WebUSB from Chrome/Edge to the QL over its USB-B cable.
 * Printing itself lives in `label-printer.ts`.
 */

/** QL-820NWB / NWBc (same PID). Other QL models are not enrolled. */
const QL_820_FILTER: USBDeviceFilter = { vendorId: 0x04f9, productId: 0x209d }

let restoreStarted = false

export function usbSupported(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator
}

function isQl820(device: USBDevice): boolean {
  return device.vendorId === QL_820_FILTER.vendorId && device.productId === QL_820_FILTER.productId
}

/** Browser USB errors → staff copy. `driverHelp` points at the OS driver instructions. */
function describeOpenError(error: unknown): LabelPrintError {
  const name = error instanceof DOMException ? error.name : ""
  const message = error instanceof Error ? error.message : ""
  if (name === "SecurityError" || /access denied/i.test(message)) {
    return new LabelPrintError("Nettleseren fikk ikke tilgang til printeren.", true)
  }
  if (/claim interface/i.test(message) || name === "InvalidStateError") {
    return new LabelPrintError(
      "Printeren er i bruk i en annen fane eller et annet program. Lukk det og prøv igjen.",
      true,
    )
  }
  return new LabelPrintError("Klarte ikke å koble til printeren. Sjekk kabelen og prøv igjen.")
}

function open(device: USBDevice): Promise<void> {
  // The connect event and restore can race for the same device.
  return openPrinter(
    "usb",
    async () => {
      const { fromUSBDevice } = await import("@thermal-label/brother-ql-web")
      return { printer: await fromUSBDevice(device), serial: device.serialNumber ?? null }
    },
    describeOpenError,
  )
}

/** Re-open a printer this site already has permission for, without the picker. */
export async function restoreUsbPrinter() {
  if (restoreStarted || !usbSupported()) return
  restoreStarted = true

  navigator.usb.addEventListener("connect", (event) => {
    if (!hasOpenPrinter() && isQl820(event.device)) void open(event.device)
  })
  navigator.usb.addEventListener("disconnect", (event) => {
    if (isQl820(event.device)) void closePrinter()
  })

  const devices = await navigator.usb.getDevices().catch(() => [])
  const known = devices.find(isQl820)
  if (known && !hasOpenPrinter()) await open(known)
  else if (printerState().kind === "connecting" && !isOpening()) setPrinterState({ kind: "idle" })
}

/** Show Chrome's USB picker. Must run inside a click handler. */
export async function connectUsbPrinter(): Promise<boolean> {
  if (!usbSupported()) return false
  let device: USBDevice
  try {
    device = await navigator.usb.requestDevice({ filters: [QL_820_FILTER] })
  } catch {
    // Closed the picker without choosing.
    return false
  }
  if (hasOpenPrinter()) await closePrinter()
  await open(device)
  return printerState().kind === "ready"
}
