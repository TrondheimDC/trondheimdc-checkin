"use client"

import { Bluetooth, BluetoothOff, LoaderCircle, Usb } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"
import {
  appRadioState,
  enablePhoneBluetooth,
  restoreAppPrinter,
  resumeBondedPrinter,
  subscribeAppRadio,
  watchAppRadio,
} from "@/lib/app-printer"
import {
  isOpening,
  type LabelPrinterState,
  printerState,
  subscribePrinter,
} from "@/lib/label-printer"
import { desktopOsFromNavigator } from "@/lib/platform"
import { currentPrintMethod, usePrintMethod } from "@/lib/print-method"
import {
  type AppLinkPhase,
  appLinkPhase,
  appLinkStatusVisible,
  connectLabelPrinter,
} from "@/lib/use-label-printer"
import { apiPath, cn } from "@/lib/utils"

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

const PHASE_LABEL: Record<Exclude<AppLinkPhase["kind"], "inactive" | "ready">, string> = {
  "bluetooth-off": "Slå på Bluetooth",
  pairing: "Bekreft paring…",
  connecting: "Kobler til…",
  disconnected: "Koble til printer",
  error: "Prøv igjen",
  unsupported: "Kan ikke skrive ut",
}

/**
 * Android app stand-in for the print button while the printer link is down.
 * Follows phone Bluetooth, pairing, and connect — staff tap this instead of a dead «Skriv ut».
 */
export function AppPhaseButton({
  phase,
  className,
  size = "lg",
  compact = false,
}: {
  phase: AppLinkPhase
  className?: string
  size?: "lg" | "default" | "sm"
  /** Short label for the status bar. The print button keeps the full sentence. */
  compact?: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const waiting =
    phase.kind === "pairing" || phase.kind === "connecting" || phase.kind === "unsupported"
  const label = compact
    ? phase.kind === "bluetooth-off"
      ? "Slå på"
      : phase.kind === "error" || phase.kind === "unsupported"
        ? "Prøv igjen"
        : "Koble til"
    : phase.kind === "connecting" && !phase.opening
      ? "Sjekker tilkobling…"
      : phase.kind === "inactive" || phase.kind === "ready"
        ? "Koble til printer"
        : PHASE_LABEL[phase.kind]

  async function run() {
    if (waiting) return
    setBusy(true)
    try {
      if (phase.kind === "bluetooth-off") {
        const enabled = await enablePhoneBluetooth()
        if (enabled) await resumeBondedPrinter()
        return
      }
      const connected = await connectLabelPrinter()
      if (!connected && printerState().kind === "idle") router.push(APP_SETUP_SCAN_PATH)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      size={size}
      className={className}
      disabled={busy || waiting}
      onClick={() => void run()}
    >
      {busy || phase.kind === "connecting" || phase.kind === "pairing" ? (
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
      ) : phase.kind === "bluetooth-off" ? (
        <BluetoothOff className="size-5" aria-hidden />
      ) : (
        <Bluetooth className="size-5" aria-hidden />
      )}
      {label}
    </Button>
  )
}

const STATUS_COPY: Record<
  Exclude<AppLinkPhase["kind"], "inactive" | "ready" | "connecting">,
  string
> = {
  "bluetooth-off": "Bluetooth er av på telefonen",
  pairing: "Bekreft koden på telefonen og printeren",
  disconnected: "Ikke koblet til printeren",
  error: "",
  unsupported: APP_UNSUPPORTED_COPY,
}

const SERVER_PRINTER: LabelPrinterState = { kind: "connecting" }
const SERVER_RADIO = { bluetooth: "unknown" as const, pairing: false }

/** Shown while the print button is busy opening the link, in place of «Skriv ut». */
export function ConnectingPrintButton({ label, className }: { label: string; className?: string }) {
  return (
    <Button type="button" size="lg" className={cn("disabled:opacity-100", className)} disabled>
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      {label}
    </Button>
  )
}

// Screens that print a badge (scanner, participant) ask for the bar while they are mounted.
// Keyed on the mounted screen, not the URL: after login the URL is `/` a moment before the server redirects a fresh device to /oppsett.
let statusScreens = 0
const statusScreenListeners = new Set<() => void>()

function subscribeStatusScreens(listener: () => void) {
  statusScreenListeners.add(listener)
  return () => statusScreenListeners.delete(listener)
}

function setStatusScreens(count: number) {
  statusScreens = count
  for (const listener of statusScreenListeners) listener()
}

/** Show the printer status bar while this screen is mounted. Elsewhere (search, login, settings, /oppsett, admin) it stays hidden. */
export function usePrinterStatusBar() {
  useEffect(() => {
    setStatusScreens(statusScreens + 1)
    return () => setStatusScreens(statusScreens - 1)
  }, [])
}

/** Slim bar while the Android app has no live link to the printer. Slides down; stays mounted so it can slide back up. */
export function PrinterStatusBar() {
  const wanted = useSyncExternalStore(
    subscribeStatusScreens,
    () => statusScreens > 0,
    () => false,
  )
  const method = usePrintMethod()
  const printer = useSyncExternalStore(subscribePrinter, printerState, () => SERVER_PRINTER)
  const radio = useSyncExternalStore(subscribeAppRadio, appRadioState, () => SERVER_RADIO)
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    if (currentPrintMethod() !== "app") return
    watchAppRadio()
    void restoreAppPrinter()
  }, [])
  const phase = appLinkPhase(method, printer, radio, isOpening())
  const inApp = method === "app"
  const visible = inApp && wanted && appLinkStatusVisible(phase)
  const shown = entered && visible

  // Mount hidden, then slide in.
  useEffect(() => setEntered(true), [])

  useEffect(() => {
    document.documentElement.style.setProperty("--printer-status-bar", shown ? "2.75rem" : "0px")
    return () => document.documentElement.style.setProperty("--printer-status-bar", "0px")
  }, [shown])

  if (!inApp) return null

  const alert =
    phase.kind === "bluetooth-off" || phase.kind === "error" || phase.kind === "unsupported"
  const message =
    phase.kind === "connecting" || phase.kind === "pairing"
      ? phase.kind === "pairing"
        ? STATUS_COPY.pairing
        : "Kobler til printeren…"
      : phase.kind === "error"
        ? phase.message
        : phase.kind === "inactive" || phase.kind === "ready"
          ? "Koblet til printeren"
          : STATUS_COPY[phase.kind]

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)] transition-transform duration-300 ease-out motion-reduce:transition-none",
        shown ? "translate-y-0" : "-translate-y-full",
      )}
      inert={!shown}
    >
      <div
        className={cn(
          "pointer-events-auto flex h-11 items-center gap-3 px-4 text-sm",
          alert
            ? "bg-[var(--color-bg-danger)] text-white"
            : "bg-[var(--color-bg-surface)] text-[var(--color-fg-base)]",
        )}
      >
        {phase.kind === "connecting" || phase.kind === "pairing" ? (
          <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden />
        ) : phase.kind === "bluetooth-off" || phase.kind === "error" ? (
          <BluetoothOff className="size-4 shrink-0" aria-hidden />
        ) : (
          <Bluetooth className="size-4 shrink-0" aria-hidden />
        )}
        <p className="min-w-0 flex-1 truncate">{message}</p>
        {phase.kind === "connecting" || phase.kind === "pairing" ? null : (
          <AppPhaseButton phase={phase} size="sm" compact className="w-auto shrink-0" />
        )}
      </div>
    </div>
  )
}
