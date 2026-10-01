"use client"

import type { WebBrotherQLPrinter } from "@thermal-label/brother-ql-web"
import { useEffect, useSyncExternalStore } from "react"
import { type BadgeInput, badgePrintImage, renderBadge, renderSticker } from "@/lib/badge-render"
import { currentPrintMethod } from "@/lib/print-method"

/**
 * PC/Mac printing: WebUSB from Chrome/Edge to the QL over its USB-B cable.
 * One connection per tab, kept across client navigations. Phones keep Smooth Print.
 */

/** QL-820NWB / NWBc (same PID). Other QL models are not enrolled. */
const QL_820_FILTER: USBDeviceFilter = { vendorId: 0x04f9, productId: 0x209d }
/** Brother media id for the 38 × 90 mm die-cut (DK-11208). */
const DK_11208_MEDIA_ID = 272

export type UsbPrinterState =
  | { kind: "unsupported" }
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "ready"; serial: string | null }
  | { kind: "error"; message: string; driverHelp: boolean }

export class UsbPrintError extends Error {
  constructor(
    message: string,
    readonly driverHelp = false,
  ) {
    super(message)
  }
}

/** Starts as connecting: the first `restore()` re-opens a remembered printer or settles on idle. */
let state: UsbPrinterState = { kind: "connecting" }
let printer: WebBrotherQLPrinter | null = null
let opening: Promise<void> | null = null
let restoreStarted = false
const listeners = new Set<() => void>()

function setState(next: UsbPrinterState) {
  state = next
  for (const listener of listeners) listener()
}

export function usbSupported(): boolean {
  return typeof navigator !== "undefined" && "usb" in navigator
}

function isQl820(device: USBDevice): boolean {
  return device.vendorId === QL_820_FILTER.vendorId && device.productId === QL_820_FILTER.productId
}

/** Browser USB errors → staff copy. `driverHelp` points at the OS driver instructions. */
function describeOpenError(error: unknown): UsbPrintError {
  const name = error instanceof DOMException ? error.name : ""
  const message = error instanceof Error ? error.message : ""
  if (name === "SecurityError" || /access denied/i.test(message)) {
    return new UsbPrintError("Nettleseren fikk ikke tilgang til printeren.", true)
  }
  if (/claim interface/i.test(message) || name === "InvalidStateError") {
    return new UsbPrintError(
      "Printeren er i bruk i en annen fane eller et annet program. Lukk det og prøv igjen.",
      true,
    )
  }
  return new UsbPrintError("Klarte ikke å koble til printeren. Sjekk kabelen og prøv igjen.")
}

function open(device: USBDevice): Promise<void> {
  // The connect event and restore() can race for the same device.
  opening ??= (async () => {
    setState({ kind: "connecting" })
    try {
      const { fromUSBDevice } = await import("@thermal-label/brother-ql-web")
      printer = await fromUSBDevice(device)
      setState({ kind: "ready", serial: device.serialNumber ?? null })
    } catch (error) {
      printer = null
      const failure = describeOpenError(error)
      setState({ kind: "error", message: failure.message, driverHelp: failure.driverHelp })
    } finally {
      opening = null
    }
  })()
  return opening
}

/** Re-open a printer this site already has permission for, without the picker. */
async function restore() {
  if (restoreStarted || !usbSupported()) return
  restoreStarted = true

  navigator.usb.addEventListener("connect", (event) => {
    if (!printer && isQl820(event.device)) void open(event.device)
  })
  navigator.usb.addEventListener("disconnect", (event) => {
    if (!isQl820(event.device)) return
    printer = null
    setState({ kind: "idle" })
  })

  const devices = await navigator.usb.getDevices().catch(() => [])
  const known = devices.find(isQl820)
  if (known && !printer) await open(known)
  else if (state.kind === "connecting" && !opening) setState({ kind: "idle" })
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
  if (printer) {
    await printer.close().catch(() => {})
    printer = null
  }
  await open(device)
  return state.kind === "ready"
}

export async function disconnectUsbPrinter() {
  const current = printer
  printer = null
  setState({ kind: "idle" })
  await current?.close().catch(() => {})
}

const WRONG_MEDIA_COPY = "Feil etiketter i printeren. Bruk DK-11208 (38 × 90 mm)."

const STATUS_COPY: Record<string, string> = {
  no_media: "Printeren er tom for etiketter. Legg i DK-11208.",
  media_end: "Etikettrullen er tom. Legg i en ny DK-11208.",
  cover_open: "Lokket på printeren er åpent. Lukk det og prøv igjen.",
  cutter_jam: "Kutteren har satt seg fast. Åpne lokket og fjern etiketten.",
  wrong_media: WRONG_MEDIA_COPY,
  not_ready: "Printeren er opptatt. Vent litt og prøv igjen.",
}

type HeadImage = { width: number; height: number; data: Uint8Array }

/**
 * Check the printer, draw, then send. Resolves once the printer has the job.
 * `beforeSend` runs after the printer checks out (e.g. check-in), so a printer with
 * an open lid or wrong labels does not check anyone in.
 */
async function printLabel(
  draw: () => Promise<HeadImage>,
  beforeSend?: () => Promise<void>,
): Promise<void> {
  if (!printer?.connected) throw new UsbPrintError("Printeren er ikke koblet til.")
  const { findMedia } = await import("@thermal-label/brother-ql-core")
  const registered = findMedia(DK_11208_MEDIA_ID)
  if (!registered) throw new UsbPrintError("Mangler etikettformatet DK-11208.")
  // brother-ql-core 0.6.3 lists 0/0 margin pins for this die-cut, which sends
  // 413-pin rows to a 720-pin head. Use the 38 mm geometry (same as its 38 mm
  // continuous roll and Brother's pin table): 12 + 413 + 295 = 720.
  const media = { ...registered, leftMarginPins: 12, rightMarginPins: 295 }

  let status: Awaited<ReturnType<WebBrotherQLPrinter["getStatus"]>>
  try {
    status = await printer.getStatus()
  } catch {
    throw new UsbPrintError("Printeren svarer ikke. Sjekk at den er på, og prøv igjen.")
  }
  const problem = status.errors[0]
  if (problem) throw new UsbPrintError(STATUS_COPY[problem.code] ?? problem.message)
  if (status.detectedMedia && status.detectedMedia.id !== DK_11208_MEDIA_ID) {
    throw new UsbPrintError(WRONG_MEDIA_COPY)
  }

  const image = await draw()
  await beforeSend?.()
  try {
    // The image is already portrait (head × feed) — never let the driver auto-rotate.
    await printer.print(image, media, { rotate: 0 })
  } catch {
    throw new UsbPrintError("Utskriften ble avbrutt. Sjekk kabelen og prøv igjen.")
  }
}

export function printBadgeUsb(
  input: BadgeInput,
  options: { beforeSend?: () => Promise<void> } = {},
): Promise<void> {
  return printLabel(async () => badgePrintImage(await renderBadge(input)), options.beforeSend)
}

/** Setup / login sticker (`printer.lbx` / `stasjon.lbx` layout). */
export function printStickerUsb(input: {
  name: string
  qr: string
  templateFile: string
}): Promise<void> {
  return printLabel(async () => badgePrintImage(await renderSticker(input)))
}

const SERVER_STATE: UsbPrinterState = { kind: "connecting" }
const UNSUPPORTED_STATE: UsbPrinterState = { kind: "unsupported" }

/** Connection state; also re-opens a remembered printer on first use. */
export function useUsbPrinter(): UsbPrinterState {
  useEffect(() => {
    // Android Chrome has WebUSB too, but phones print through Smooth Print.
    if (currentPrintMethod() === "usb") void restore()
  }, [])
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify)
      return () => listeners.delete(notify)
    },
    () => (usbSupported() ? state : UNSUPPORTED_STATE),
    () => SERVER_STATE,
  )
}
