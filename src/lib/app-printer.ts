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
  /** `pair` false refuses to open the system pairing dialog. */
  isBonded(options: { address: string }): Promise<{ bonded: boolean }>
  connect(options: { address: string; pair?: boolean }): Promise<AppPrinter>
  write(options: { data: string }): Promise<void>
  disconnect(): Promise<void>
  addListener(
    event: "data",
    listener: (event: { data: string }) => void,
  ): Promise<PluginListenerHandle>
  addListener(event: "disconnected", listener: () => void): Promise<PluginListenerHandle>
  addListener(
    event: "bluetooth",
    listener: (event: { enabled: boolean }) => void,
  ): Promise<PluginListenerHandle>
  addListener(
    event: "bond",
    listener: (event: { state: "bonding" | "bonded" | "none"; address: string | null }) => void,
  ): Promise<PluginListenerHandle>
}

export type PhoneBluetooth = "unknown" | "on" | "off"

type AppRadio = { bluetooth: PhoneBluetooth; pairing: boolean }

const RADIO_IDLE: AppRadio = { bluetooth: "unknown", pairing: false }
let radio: AppRadio = RADIO_IDLE
const radioListeners = new Set<() => void>()
let radioWatchStarted = false
/** Printer the app is opening a socket to; bond events for other devices are ignored. */
let openingAddress: string | null = null

function setRadio(next: AppRadio) {
  if (next.bluetooth === radio.bluetooth && next.pairing === radio.pairing) return
  radio = next
  for (const listener of radioListeners) listener()
}

export function appRadioState(): AppRadio {
  return radio
}

export function subscribeAppRadio(listener: () => void): () => void {
  radioListeners.add(listener)
  return () => radioListeners.delete(listener)
}

/** Follow phone Bluetooth and the system pairing dialog. Safe to call more than once. */
function pullPhoneBluetooth() {
  void LabelPrinter.status()
    .then((status) => setRadio({ ...appRadioState(), bluetooth: status.enabled ? "on" : "off" }))
    .catch(() => {})
}

export function watchAppRadio() {
  if (radioWatchStarted || !appPrinterSupported()) return
  radioWatchStarted = true
  pullPhoneBluetooth()
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pullPhoneBluetooth()
  })
  void LabelPrinter.addListener("bluetooth", (event) => {
    setRadio({ ...appRadioState(), bluetooth: event.enabled ? "on" : "off" })
    if (event.enabled) void resumeBondedPrinter()
    else void closePrinter()
  })
  void LabelPrinter.addListener("bond", (event) => {
    if (!openingAddress || event.address?.toUpperCase() !== openingAddress) return
    setRadio({ ...appRadioState(), pairing: event.state === "bonding" })
  })
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
    case "not_paired":
      return new LabelPrintError("Printeren er ikke paret. Koble til for å pare.")
    default:
      return new LabelPrintError(
        "Fant ikke printeren. Sjekk at den er på og har Bluetooth slått på.",
      )
  }
}

function open(address: string, options: { pair?: boolean } = {}): Promise<void> {
  const pair = options.pair !== false
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
      openingAddress = address.toUpperCase()
      try {
        const connected = await LabelPrinter.connect({ address, pair })
        const transport = new BluetoothTransport()
        await transport.listen()
        window.localStorage.setItem(REMEMBERED_KEY, JSON.stringify(connected))
        return { printer: new WebBrotherQLPrinter(device, transport), name: connected.name }
      } finally {
        openingAddress = null
        setRadio({ ...appRadioState(), pairing: false })
      }
    },
    describeOpenError,
    // A dropped link reconnects only when already paired — never starts pairing on its own.
    { reopen: () => open(address, { pair: false }) },
  )
}

/** Already paired with this address. Does not start pairing. */
async function isAddressBonded(address: string): Promise<boolean> {
  const wanted = address.toUpperCase()
  try {
    const { bonded } = await LabelPrinter.isBonded({ address: wanted })
    return bonded
  } catch {
    // Older app builds have no isBonded. The paired-QL list is the same check.
    const { printers } = await LabelPrinter.pairedPrinters()
    return printers.some((item) => item.address.toUpperCase() === wanted)
  }
}

/**
 * Reconnect to the printer this phone used last.
 * Only when it is already paired. A socket connect to an unpaired printer makes
 * Android open the pairing dialog by itself.
 */
export async function restoreAppPrinter() {
  if (restoreStarted || !appPrinterSupported()) return
  restoreStarted = true
  watchAppRadio()
  const remembered = rememberedAppPrinter()
  if (!remembered || hasOpenPrinter()) {
    if (printerState().kind === "connecting") setPrinterState({ kind: "idle" })
    return
  }
  try {
    const status = await LabelPrinter.status()
    setRadio({ ...appRadioState(), bluetooth: status.enabled ? "on" : "off" })
    if (!status.enabled) {
      setPrinterState({ kind: "idle" })
      return
    }
    if (!(await isAddressBonded(remembered.address))) {
      setPrinterState({ kind: "idle" })
      return
    }
  } catch {
    setPrinterState({ kind: "idle" })
    return
  }
  await open(remembered.address, { pair: false })
}

/**
 * After the phone radio comes back on: reconnect only if this printer is already
 * paired. Turning Bluetooth on must not open the pairing dialog.
 */
export async function resumeBondedPrinter(): Promise<void> {
  const remembered = rememberedAppPrinter()
  if (!remembered || hasOpenPrinter() || !appPrinterSupported()) return
  try {
    if (!(await isAddressBonded(remembered.address))) return
  } catch {
    return
  }
  await open(remembered.address, { pair: false })
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
