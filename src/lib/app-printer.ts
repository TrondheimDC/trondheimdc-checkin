"use client"

import { Capacitor, type PluginListenerHandle, registerPlugin } from "@capacitor/core"
import type { Transport } from "@thermal-label/brother-ql-core"
import {
  closePrinter,
  hasOpenPrinter,
  LabelPrintError,
  openPrinter,
  printerState,
  setPrinterState,
} from "@/lib/label-printer"

/**
 * Android app connector: Bluetooth Classic (SPP) to the QL through the app's
 * `LabelPrinter` plugin (`capacitor/android/.../LabelPrinterPlugin.java`). The
 * plugin only moves bytes; raster and status come from `@thermal-label/brother-ql-*`,
 * same as WebUSB. Android pairs on the first connect, so there is no OS pair step.
 */

export type AppPrinter = { name: string | null; address: string }

type LabelPrinterPlugin = {
  status(): Promise<{
    available: boolean
    enabled: boolean
    permission: boolean
    connected: boolean
    address: string | null
  }>
  enableBluetooth(): Promise<{ enabled: boolean }>
  pairedPrinters(): Promise<{ printers: AppPrinter[] }>
  connect(options: { address: string }): Promise<AppPrinter>
  write(options: { data: string }): Promise<void>
  disconnect(): Promise<void>
  addListener(
    event: "data",
    listener: (event: { data: string }) => void,
  ): Promise<PluginListenerHandle>
  addListener(event: "disconnected", listener: () => void): Promise<PluginListenerHandle>
}

const LabelPrinter = registerPlugin<LabelPrinterPlugin>("LabelPrinter")

/** Last printer this phone printed to; the app reconnects to it on start. */
const REMEMBERED_KEY = "tdc-app-printer"

let restoreStarted = false

export function appPrinterSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LabelPrinter")
}

export function rememberedAppPrinter(): AppPrinter | null {
  try {
    const raw = window.localStorage.getItem(REMEMBERED_KEY)
    return raw ? (JSON.parse(raw) as AppPrinter) : null
  } catch {
    return null
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** brother-ql-web tells a closed link from a hiccup by error name. */
function namedError(name: "TransportClosedError" | "TransportTimeoutError", message: string) {
  const error = new Error(message)
  error.name = name
  return error
}

/**
 * Pull-based `Transport` over the plugin's push events: incoming bytes are
 * buffered until `read(length)` can be satisfied.
 */
class BluetoothTransport implements Transport {
  private buffer = new Uint8Array(0)
  private wake: (() => void) | null = null
  private handles: PluginListenerHandle[] = []
  connected = true

  async listen() {
    this.handles = [
      await LabelPrinter.addListener("data", (event) => {
        const incoming = fromBase64(event.data)
        const next = new Uint8Array(this.buffer.length + incoming.length)
        next.set(this.buffer)
        next.set(incoming, this.buffer.length)
        this.buffer = next
        this.wake?.()
      }),
      await LabelPrinter.addListener("disconnected", () => {
        void this.shutdown()
        // Not forgotten: the next print reconnects to the same printer.
        void closePrinter()
      }),
    ]
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.connected) throw namedError("TransportClosedError", "Bluetooth link closed")
    await LabelPrinter.write({ data: toBase64(data) })
  }

  async read(length: number, timeout?: number): Promise<Uint8Array> {
    const deadline = timeout ? Date.now() + timeout : null
    while (this.buffer.length < length) {
      if (!this.connected) throw namedError("TransportClosedError", "Bluetooth link closed")
      const remaining = deadline ? deadline - Date.now() : null
      if (remaining !== null && remaining <= 0) {
        throw namedError("TransportTimeoutError", "Bluetooth read timed out")
      }
      await new Promise<void>((resolve) => {
        const timer = remaining !== null ? setTimeout(resolve, remaining) : null
        this.wake = () => {
          if (timer) clearTimeout(timer)
          this.wake = null
          resolve()
        }
      })
    }
    const out = this.buffer.slice(0, length)
    this.buffer = this.buffer.slice(length)
    return out
  }

  private async shutdown() {
    if (!this.connected) return
    this.connected = false
    this.wake?.()
    for (const handle of this.handles) await handle.remove()
    this.handles = []
  }

  async close(): Promise<void> {
    await this.shutdown()
    await LabelPrinter.disconnect().catch(() => {})
  }
}

function pluginCode(error: unknown): string | null {
  return typeof error === "object" && error && "code" in error ? String(error.code) : null
}

function describeOpenError(error: unknown): LabelPrintError {
  switch (pluginCode(error)) {
    case "permission_denied":
      return new LabelPrintError(
        "Appen fikk ikke bruke Bluetooth. Tillat «Enheter i nærheten» i appinnstillingene.",
      )
    case "bluetooth_off":
      return new LabelPrintError("Bluetooth er av på telefonen. Slå det på og prøv igjen.")
    case "bluetooth_unavailable":
      return new LabelPrintError("Telefonen har ikke Bluetooth.")
    default:
      return new LabelPrintError(
        "Fant ikke printeren. Sjekk at den er på og har Bluetooth slått på.",
      )
  }
}

function open(address: string): Promise<void> {
  return openPrinter(
    "bluetooth",
    async () => {
      const [{ WebBrotherQLPrinter }, { findDevice }] = await Promise.all([
        import("@thermal-label/brother-ql-web"),
        import("@thermal-label/brother-ql-core"),
      ])
      // The QL-820NWB / NWBc descriptor, looked up by its USB ids.
      const device = findDevice(0x04f9, 0x209d)
      if (!device) throw new Error("ql820_descriptor_missing")
      const connected = await LabelPrinter.connect({ address })
      const transport = new BluetoothTransport()
      await transport.listen()
      window.localStorage.setItem(REMEMBERED_KEY, JSON.stringify(connected))
      return { printer: new WebBrotherQLPrinter(device, transport), name: connected.name }
    },
    describeOpenError,
    { reopen: () => open(address) },
  )
}

/** Reconnect to the printer this phone used last, without asking. */
export async function restoreAppPrinter() {
  if (restoreStarted || !appPrinterSupported()) return
  restoreStarted = true
  const remembered = rememberedAppPrinter()
  if (remembered && !hasOpenPrinter()) await open(remembered.address)
  else if (printerState().kind === "connecting") setPrinterState({ kind: "idle" })
}

/** Connect to a printer by Bluetooth MAC (sticker / inventory). Android pairs if needed. */
export async function connectAppPrinter(address: string): Promise<boolean> {
  if (!appPrinterSupported()) return false
  if (hasOpenPrinter()) await closePrinter({ forget: true })
  await open(address.trim().toUpperCase())
  return printerState().kind === "ready"
}

/**
 * «Koble til printer» outside setup: the remembered printer, or the only paired QL.
 * False when there is nothing to pick — then staff scan the sticker in /oppsett.
 */
export async function reconnectAppPrinter(): Promise<boolean> {
  const remembered = rememberedAppPrinter()
  if (remembered) return connectAppPrinter(remembered.address)
  const paired = await pairedAppPrinters().catch(() => [])
  const only = paired.length === 1 ? paired[0] : undefined
  return only ? connectAppPrinter(only.address) : false
}

export async function pairedAppPrinters(): Promise<AppPrinter[]> {
  const { printers } = await LabelPrinter.pairedPrinters()
  return printers
}

/** Phone Bluetooth: asks Android to switch it on when it is off. */
export async function enablePhoneBluetooth(): Promise<boolean> {
  const { enabled } = await LabelPrinter.enableBluetooth()
  return enabled
}
