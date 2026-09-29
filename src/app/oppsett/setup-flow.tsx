"use client"

import { Camera, LoaderCircle, Printer } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type ComponentType, useCallback, useEffect, useMemo, useState } from "react"
import {
  PhonePairIllustration,
  PrinterBluetoothIllustration,
  ScanStickerIllustration,
} from "@/components/illustrations"
import { SetupQrScan } from "@/components/setup-qr-scan"
import { Button } from "@/components/ui/button"
import { type PhonePlatform, refinePlatform, supportsAndroidIntent } from "@/lib/platform"
import {
  buildAndroidPrintIntent,
  buildConnectUrl,
  buildPrintUrl,
  DEFAULT_PAPER_SIZE_ID,
  DEFAULT_PRINTER_MODEL,
  loadTemplateBase64,
  openSmoothPrintScheme,
} from "@/lib/print-url"
import type { PrinterSetupParams } from "@/lib/printer-setup"
import { apiPath } from "@/lib/utils"

const SETUP_KEY = "tdc-checkin-printer-seen"
const IOS_APP = "https://apps.apple.com/us/app/smooth-print/id1629559918"

const TEST_NAME = "Test"
const TEST_LINE2 = "TDC"

type SetupPath = "qr" | "manual"

type Art = ComponentType<{ className?: string }>

type Step =
  | {
      id: "install"
      kind: "install"
      image: string
      title: string
      body: string
    }
  | {
      id: "camera"
      kind: "camera"
      title: string
      body: string
    }
  | {
      id: "scan"
      kind: "scan"
      title: string
      body: string
    }
  | {
      id: "connect"
      kind: "connect"
      title: string
      body: string
    }
  | {
      id: "bt-on" | "pair"
      kind: "guide"
      art: Art
      title: string
      body: string
    }
  | {
      id: "confirm"
      kind: "confirm"
      image: string
      title: string
      body: string
    }
  | {
      id: "test-print"
      kind: "test-print"
      title: string
      body: string
    }

const INSTALL_IOS: Step = {
  id: "install",
  kind: "install",
  image: "/oppsett/smooth-print.jpg",
  title: "Installer Smooth Print",
  body: "Last ned appen og kom tilbake hit.",
}

const INSTALL_ANDROID: Step = {
  id: "install",
  kind: "install",
  image: "/oppsett/smooth-print.jpg",
  title: "Installer Smooth Print",
  body: "Last ned og installer appen. Trykk Ferdig — ikke åpne den. Kom tilbake hit etterpå.",
}

const CAMERA_IOS: Step = {
  id: "camera",
  kind: "camera",
  title: "Tillat kamera alltid",
  body: "I Safari: trykk aA i adressefeltet → Nettstedsinnstillinger → Kamera → Tillat. Da spør ikke Safari hver gang du skanner.",
}

const BT_ON: Step = {
  id: "bt-on",
  kind: "guide",
  art: PrinterBluetoothIllustration,
  title: "Sjekk Bluetooth",
  body: "Bluetooth-ikonet skal synes øverst til høyre på printerskjermen. Mangler det: Menu → Bluetooth (6), og slå den på.",
}

const SCAN: Step = {
  id: "scan",
  kind: "scan",
  title: "Skann QR på printeren",
  body: "Skann klistremerket for å koble telefonen til printeren.",
}

const PAIR: Step = {
  id: "pair",
  kind: "guide",
  art: PhonePairIllustration,
  title: "Koble telefonen til printeren",
  body: "Gå til Innstillinger → Bluetooth og velg QL-820NWB(XXXX). Sjekk at koden er lik på begge, og bekreft på printeren og telefonen.",
}

const CONNECT_IOS: Step = {
  id: "connect",
  kind: "connect",
  title: "Koble til i Smooth Print",
  body: "Telefonen må være paret først (forrige steg). Trykk Åpne når Safari spør — det spør hver gang Smooth Print åpnes.",
}

const CONNECT_ANDROID: Step = {
  id: "connect",
  kind: "connect",
  title: "Koble til printeren",
  body: "Ett trykk åpner Smooth Print. Første gang må du godta vilkår og Bluetooth. Når tilkoblingen er ferdig, kommer du tilbake hit.",
}

const CONFIRM_IOS: Step = {
  id: "confirm",
  kind: "confirm",
  image: "/oppsett/smooth-print.jpg",
  title: "Velg printeren i Smooth Print",
  body: "Åpne Smooth Print og sjekk at QL-820NWB(XXXX) er valgt.",
}

const CONFIRM_ANDROID: Step = {
  id: "confirm",
  kind: "confirm",
  image: "/oppsett/smooth-print.jpg",
  title: "Velg printeren i Smooth Print",
  body: "Åpne Smooth Print og velg QL-820NWB(XXXX). Lukk appen helt etterpå, før testutskriften.",
}

const TEST_PRINT_IOS: Step = {
  id: "test-print",
  kind: "test-print",
  title: "Skriv ut et testskilt",
  body: "Smooth Print blir liggende åpen etter utskriften. Gå tilbake hit etterpå.",
}

const TEST_PRINT_ANDROID: Step = {
  id: "test-print",
  kind: "test-print",
  title: "Skriv ut et testskilt",
  body: "Lukk Smooth Print helt først (sveip bort). Da viser appen et vindu over denne siden.",
}

const artClassName = "max-h-full rounded-2xl bg-[var(--color-bg-surface)]"

/** Shared before the fork — install, (iOS) camera permission, printer Bluetooth on. */
function buildPrelude(platform: PhonePlatform): Step[] {
  if (platform === "android") return [INSTALL_ANDROID, BT_ON]
  if (platform === "ios") return [INSTALL_IOS, CAMERA_IOS, BT_ON]
  return [INSTALL_IOS, BT_ON]
}

/**
 * Happy path (`qr`): scan sticker → connect in Smooth Print.
 * iOS also needs OS Bluetooth pair before connect (MFi); Android does not.
 * Sticker deeplink with printer fields omits scan (`omitScan`).
 * Manual fallback: OS Bluetooth pair → select in Smooth Print.
 */
function buildPathSteps(path: SetupPath, platform: PhonePlatform, omitScan: boolean): Step[] {
  const prelude = buildPrelude(platform)
  const test = platform === "android" ? TEST_PRINT_ANDROID : TEST_PRINT_IOS

  if (path === "qr") {
    const scan = omitScan ? [] : [SCAN]
    if (platform === "ios") return [...prelude, ...scan, PAIR, CONNECT_IOS, test]
    const connect = platform === "android" ? CONNECT_ANDROID : CONNECT_IOS
    return [...prelude, ...scan, connect, test]
  }

  const confirm = platform === "android" ? CONFIRM_ANDROID : CONFIRM_IOS
  return [...prelude, PAIR, confirm, test]
}

function pathStepIndex(
  path: SetupPath,
  id: Step["id"],
  platform: PhonePlatform,
  omitScan: boolean,
) {
  return buildPathSteps(path, platform, omitScan).findIndex((item) => item.id === id)
}

function firstPathStepId(path: SetupPath, omitScan: boolean): Step["id"] {
  if (path === "qr") return omitScan ? "connect" : "scan"
  return "pair"
}

export type SetupStepId = Step["id"]

function inferPathForStep(stepId: SetupStepId, fallback: SetupPath | null): SetupPath | null {
  if (fallback) return fallback
  if (stepId === "scan" || stepId === "connect") return "qr"
  if (stepId === "pair" || stepId === "confirm") return "manual"
  return fallback
}

type PendingResume = { path: SetupPath; stepId: SetupStepId }

function resolveEntry(input: {
  platform: PhonePlatform
  initialPath: SetupPath | null
  initialStep: SetupStepId | null
  initialPrinter: PrinterSetupParams | null
  afterConnect: boolean
  connectResult: string | null
  initialPrimed: boolean
}): {
  path: SetupPath | null
  preludeStep: number
  step: number
  connected: boolean
  pendingResume: PendingResume | null
} {
  const omitScan = Boolean(input.initialPrinter)
  const connectOk = !input.connectResult || input.connectResult.toUpperCase().includes("SUCCESS")

  if (input.afterConnect && connectOk) {
    const path = input.initialPath ?? "qr"
    const at = pathStepIndex(path, "test-print", input.platform, omitScan)
    return { path, preludeStep: 0, step: at >= 0 ? at : 0, connected: true, pendingResume: null }
  }

  if (input.afterConnect && !connectOk) {
    const path = input.initialPath ?? "qr"
    const at = pathStepIndex(path, "connect", input.platform, omitScan)
    return {
      path,
      preludeStep: 0,
      step: at >= 0 ? at : 0,
      connected: false,
      pendingResume: null,
    }
  }

  const stepId = input.initialStep
  if (stepId) {
    if (stepId === "install" || stepId === "camera" || stepId === "bt-on") {
      if (!input.initialPath && !input.initialPrinter) {
        const prelude = buildPrelude(input.platform)
        const preludeIdx = prelude.findIndex((item) => item.id === stepId)
        return {
          path: null,
          preludeStep: preludeIdx >= 0 ? preludeIdx : 0,
          step: 0,
          connected: false,
          pendingResume: null,
        }
      }
    }

    const path = inferPathForStep(stepId, input.initialPath)
    if (path) {
      const at = pathStepIndex(path, stepId, input.platform, omitScan)
      if (at >= 0) {
        // Fresh sticker deeplink (`step=connect`) must still walk install → BT-on.
        // Once primed, refresh/deeplink resumes at the real step.
        if (input.initialPrinter && !input.initialPrimed) {
          return {
            path: null,
            preludeStep: 0,
            step: 0,
            connected: false,
            pendingResume: { path, stepId },
          }
        }
        return { path, preludeStep: 0, step: at, connected: false, pendingResume: null }
      }
    }

    const preludeIdx = buildPrelude(input.platform).findIndex((item) => item.id === stepId)
    if (preludeIdx >= 0) {
      return { path: null, preludeStep: preludeIdx, step: 0, connected: false, pendingResume: null }
    }
  }

  if (input.initialPath) {
    const at = pathStepIndex(
      input.initialPath,
      firstPathStepId(input.initialPath, omitScan),
      input.platform,
      omitScan,
    )
    return {
      path: input.initialPath,
      preludeStep: 0,
      step: at >= 0 ? at : 0,
      connected: false,
      pendingResume: null,
    }
  }

  return { path: null, preludeStep: 0, step: 0, connected: false, pendingResume: null }
}

function buildSetupSearch(input: {
  path: SetupPath | null
  stepId: SetupStepId
  printer: PrinterSetupParams | null
  phaseConnected: boolean
  connectResult: string | null
  connectDebug?: boolean
}): string {
  const params = new URLSearchParams()
  if (input.path) params.set("path", input.path)
  params.set("step", input.stepId)
  // primed=1: this session already passed the install/BT-on prelude, so a refresh
  // may resume at `step`. Without it, a sticker URL with step=connect starts at install.
  if (input.path) params.set("primed", "1")
  if (input.printer) {
    params.set("address", input.printer.address)
    if (input.printer.serial) params.set("serial", input.printer.serial)
    params.set("model", input.printer.model)
    params.set("type", input.printer.connectType)
  }
  if (input.connectDebug) params.set("connectdebug", "1")
  if (input.phaseConnected) {
    params.set("phase", "connected")
    if (input.connectResult) params.set("result", input.connectResult)
  }
  return params.toString()
}

export type SetupFlowProps = {
  androidUrl: string
  /** From the request UA so the first paint matches Android vs iOS copy. */
  initialPlatform?: PhonePlatform
  initialPath?: SetupPath | null
  initialStep?: SetupStepId | null
  initialPrinter?: PrinterSetupParams | null
  afterConnect?: boolean
  connectResult?: string | null
  initialPrimed?: boolean
  /** Attach Smooth Print connectcallback while testing (`?connectdebug=1`). */
  connectDebug?: boolean
}

export function SetupFlow({
  androidUrl,
  initialPlatform = "other",
  initialPath = null,
  initialStep = null,
  initialPrinter = null,
  afterConnect = false,
  connectResult = null,
  initialPrimed = false,
  connectDebug = false,
}: SetupFlowProps) {
  const router = useRouter()
  const omitScan = Boolean(initialPrinter)
  const [platform, setPlatform] = useState<PhonePlatform>(initialPlatform)
  const [entry] = useState(() =>
    resolveEntry({
      platform: initialPlatform,
      initialPath,
      initialStep,
      initialPrinter,
      afterConnect,
      connectResult,
      initialPrimed,
    }),
  )
  const [path, setPath] = useState<SetupPath | null>(entry.path)
  const [printer, setPrinter] = useState<PrinterSetupParams | null>(initialPrinter)
  const [preludeStep, setPreludeStep] = useState(entry.preludeStep)
  const [step, setStep] = useState(entry.step)
  const [pendingResume, setPendingResume] = useState<PendingResume | null>(entry.pendingResume)
  const [cameraOn, setCameraOn] = useState(false)
  const [seen, setSeen] = useState(false)
  const [connectedOk, setConnectedOk] = useState(entry.connected)
  const [didConnect, setDidConnect] = useState(entry.connected)
  const [printedOk, setPrintedOk] = useState(false)
  const [didPrint, setDidPrint] = useState(false)
  const [busy, setBusy] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)

  const prelude = useMemo(() => buildPrelude(platform), [platform])
  const pathSteps = useMemo(
    () => (path ? buildPathSteps(path, platform, omitScan) : null),
    [path, platform, omitScan],
  )
  const current: Step = pathSteps
    ? (pathSteps[Math.min(step, pathSteps.length - 1)] ?? INSTALL_IOS)
    : (prelude[Math.min(preludeStep, prelude.length - 1)] ?? INSTALL_IOS)

  const progress =
    pathSteps != null
      ? { index: step, total: pathSteps.length }
      : { index: preludeStep, total: buildPathSteps("qr", platform, omitScan).length }

  const connectOkHint =
    connectResult != null && connectResult.toUpperCase().includes("SUCCESS")
      ? "Smooth Print meldte at tilkoblingen lyktes."
      : null
  const connectFailHint =
    connectResult != null && !connectResult.toUpperCase().includes("SUCCESS")
      ? `Smooth Print klarte ikke å koble til (${connectResult}). Sjekk at telefonen er paret under Innstillinger → Bluetooth, og prøv igjen.`
      : null

  useEffect(() => {
    setPlatform(refinePlatform(initialPlatform))
  }, [initialPlatform])

  const setupSearch = buildSetupSearch({
    path,
    stepId: current.id,
    printer,
    phaseConnected: didConnect && current.id === "test-print",
    connectResult,
    connectDebug,
  })

  useEffect(() => {
    const next = apiPath(setupSearch ? `/oppsett?${setupSearch}` : "/oppsett")
    if (`${window.location.pathname}${window.location.search}` === next) return
    // replaceState keeps the wizard from remounting on each step; Next's router does
    // not track it, so help pages link back to a concrete `step` instead of history.back().
    window.history.replaceState(window.history.state, "", next)
  }, [setupSearch])

  useEffect(() => {
    setCameraOn(false)
  }, [current.id])

  function finish() {
    window.localStorage.setItem(SETUP_KEY, "1")
    router.push("/")
  }

  function enterHappyPath() {
    if (pendingResume) {
      const resume = pendingResume
      setPendingResume(null)
      setPath(resume.path)
      const at = pathStepIndex(resume.path, resume.stepId, platform, omitScan)
      setStep(at >= 0 ? at : 0)
      return
    }
    setPath("qr")
    setStep(pathStepIndex("qr", firstPathStepId("qr", omitScan), platform, omitScan))
  }

  function chooseManual() {
    setCameraOn(false)
    setPrinter(null)
    setPath("manual")
    setStep(pathStepIndex("manual", "pair", platform, false))
  }

  const onQrFound = useCallback(
    (found: PrinterSetupParams) => {
      setPrinter(found)
      setPath("qr")
      setCameraOn(false)
      setStep(pathStepIndex("qr", "connect", platform, false))
    },
    [platform],
  )

  function openConnect() {
    if (!printer) return
    // Mark before launch — location.href on iOS unloads before a later setState can flush.
    setDidConnect(true)

    // No connectcallback in normal use — staff return to the wizard themselves
    // (callback opens a new Safari tab). Opt in with ?connectdebug=1 while testing
    // so Brother's result=Failure|Success lands back in the address bar.
    const callbackUrl = connectDebug
      ? `${window.location.origin}${apiPath("/oppsett")}?${new URLSearchParams({
          path: "qr",
          step: "connect",
          primed: "1",
          address: printer.address,
          serial: printer.serial,
          model: printer.model || DEFAULT_PRINTER_MODEL,
          type: printer.connectType,
          phase: "connected",
          connectdebug: "1",
        }).toString()}&result=`
      : undefined

    openSmoothPrintScheme(
      buildConnectUrl({
        connectType: printer.connectType,
        address: printer.address,
        serial: printer.serial,
        model: printer.model || DEFAULT_PRINTER_MODEL,
        platform,
        callbackUrl,
      }),
      platform,
    )
  }

  async function printTest() {
    setPrintError(null)
    setBusy(true)
    try {
      const fileBase64 = await loadTemplateBase64()
      // No successCallback/failureCallback — Android needs Smooth Print's overlay dialog;
      // setup already asks staff to confirm the label came out.
      const input = {
        fileBase64,
        paperSizeId: DEFAULT_PAPER_SIZE_ID,
        name: TEST_NAME,
        line2: TEST_LINE2,
      }

      if (platform === "android" && supportsAndroidIntent()) {
        const fallbackUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`
        window.location.href = buildAndroidPrintIntent({ ...input, fallbackUrl })
      } else {
        window.location.href = buildPrintUrl(input)
      }
      setDidPrint(true)
    } catch {
      setPrintError("Klarte ikke å hente malen. Sjekk nettverket og prøv igjen.")
    } finally {
      setBusy(false)
    }
  }

  function goNextFromPrelude() {
    if (preludeStep < prelude.length - 1) {
      setPreludeStep((value) => value + 1)
      return
    }
    enterHappyPath()
  }

  function goBack() {
    if (pathSteps && path) {
      const firstId = firstPathStepId(path, path === "qr" ? omitScan : false)
      if (current.id === firstId) {
        setPath(null)
        setPrinter(initialPrinter)
        setCameraOn(false)
        setPreludeStep(prelude.length - 1)
        return
      }
      setStep((value) => value - 1)
      return
    }
    if (preludeStep > 0) {
      setPreludeStep((value) => value - 1)
      return
    }
    router.push("/")
  }

  const atStart = pathSteps ? false : preludeStep === 0
  const androidDirectDownload = androidUrl.includes("/api/smooth-print/apk")

  return (
    <main className="mx-auto flex h-svh max-w-md flex-col overflow-hidden px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mb-3 flex shrink-0 gap-2">
        {Array.from({ length: progress.total }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full ${index <= progress.index ? "bg-[var(--color-fg-brand)]" : "bg-[var(--color-bg-surface)]"}`}
          />
        ))}
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {current.kind === "test-print" ? (
          <div className="w-full max-w-sm rounded-2xl bg-[var(--color-black-3)] px-6 py-7">
            <p className="text-4xl leading-tight">{TEST_NAME}</p>
            <p className="mt-3 text-xl opacity-80">{TEST_LINE2}</p>
            <p className="mt-5 font-mono text-xs tracking-wide opacity-45">
              Sjekker ikke inn noen deltaker
            </p>
          </div>
        ) : current.kind === "scan" && cameraOn ? (
          <SetupQrScan onFound={onQrFound} />
        ) : current.kind === "connect" && printer ? (
          <div className="w-full rounded-2xl bg-[var(--color-bg-surface)] px-5 py-6">
            <p className="font-mono text-sm opacity-60">
              {printer.connectType === "WiFi" ? "IP" : "MAC"}
            </p>
            <p className="mt-1 font-mono text-lg break-all">{printer.address}</p>
            {printer.serial ? (
              <>
                <p className="mt-4 font-mono text-sm opacity-60">SN</p>
                <p className="mt-1 font-mono text-lg break-all">{printer.serial}</p>
              </>
            ) : (
              <p className="mt-4 text-sm opacity-60">
                Mangler serienummer. iPhone trenger det for Bluetooth.
              </p>
            )}
            <p className="mt-4 font-mono text-sm opacity-60">{printer.model}</p>
            {connectOkHint ? (
              <p className="mt-4 text-sm text-[var(--color-fg-brand)]">{connectOkHint}</p>
            ) : null}
            {connectFailHint ? (
              <p className="mt-4 text-sm text-[var(--color-bg-danger)]">{connectFailHint}</p>
            ) : null}
          </div>
        ) : current.kind === "connect" && !printer ? (
          <p className="text-base opacity-70">
            Mangler printeropplysninger. Gå tilbake og skann QR.
          </p>
        ) : current.kind === "install" || current.kind === "confirm" ? (
          <img
            src={current.image}
            alt="Smooth Print"
            className="h-28 w-28 rounded-[22%] object-cover"
          />
        ) : current.kind === "guide" ? (
          <current.art className={artClassName} />
        ) : current.kind === "scan" ? (
          <ScanStickerIllustration className={artClassName} />
        ) : current.kind === "camera" ? (
          <div className="flex size-28 items-center justify-center rounded-2xl bg-[var(--color-bg-surface)] text-[var(--color-fg-brand)]">
            <Camera className="size-12" strokeWidth={1.5} aria-hidden />
          </div>
        ) : null}
      </div>

      <p className="mt-2 shrink-0 font-mono text-sm text-[var(--color-fg-brand)]">
        {progress.index + 1} av {progress.total}
      </p>
      <h1 className="mt-1 shrink-0 text-3xl">{current.title}</h1>
      <p className="mt-2 shrink-0 text-base leading-snug">{current.body}</p>

      {current.kind === "install" && platform === "ios" ? (
        <Button asChild className="mt-3 h-12 w-full shrink-0 text-base">
          <a href={IOS_APP} target="_blank" rel="noopener noreferrer">
            Hent i App Store
          </a>
        </Button>
      ) : null}
      {current.kind === "install" && platform === "android" ? (
        <div className="mt-3 flex shrink-0 flex-col gap-2">
          <p className="text-base leading-snug">Appen ligger ikke i Play Store.</p>
          <Button asChild className="h-12 w-full text-base">
            <a
              href={androidUrl}
              {...(androidDirectDownload
                ? { download: true }
                : { target: "_blank", rel: "noopener noreferrer" })}
            >
              Last ned appen
            </a>
          </Button>
          <Button asChild variant="ghost" className="h-12 w-full text-base">
            <Link href={apiPath("/oppsett/android")}>Slik tillater du installasjon</Link>
          </Button>
        </div>
      ) : null}
      {current.kind === "install" && platform === "other" ? (
        <div className="mt-3 flex shrink-0 flex-col gap-2">
          <Button asChild className="h-12 w-full text-base">
            <a href={IOS_APP} target="_blank" rel="noopener noreferrer">
              iPhone
            </a>
          </Button>
          <Button asChild variant="surface" className="h-12 w-full text-base">
            <a
              href={androidUrl}
              {...(androidDirectDownload
                ? { download: true }
                : { target: "_blank", rel: "noopener noreferrer" })}
            >
              Android
            </a>
          </Button>
        </div>
      ) : null}

      <div className="mt-auto flex shrink-0 flex-col gap-2 pt-3">
        {current.kind === "scan" ? (
          <>
            {cameraOn ? (
              <Button
                variant="surface"
                className="h-12 w-full text-base"
                onClick={() => setCameraOn(false)}
              >
                Lukk kamera
              </Button>
            ) : (
              <Button className="h-12 w-full text-base" onClick={() => setCameraOn(true)}>
                <Camera className="size-5" aria-hidden />
                Start kamera
              </Button>
            )}
            <Button variant="ghost" className="h-12 w-full text-base" onClick={chooseManual}>
              Manuelt oppsett
            </Button>
          </>
        ) : null}

        {current.kind === "confirm" ? (
          <label className="flex items-center gap-3 text-lg">
            <input
              type="checkbox"
              className="h-6 w-6"
              checked={seen}
              onChange={(event) => setSeen(event.target.checked)}
            />
            {platform === "android"
              ? "Printeren er valgt, og Smooth Print er lukket"
              : "Printeren er valgt i Smooth Print"}
          </label>
        ) : null}

        {current.kind === "connect" ? (
          <>
            <Button className="h-12 w-full text-base" disabled={!printer} onClick={openConnect}>
              {didConnect ? "Prøv å koble til igjen" : "Koble til printeren"}
            </Button>
            {didConnect ? (
              <label className="flex items-center gap-3 text-lg">
                <input
                  type="checkbox"
                  className="h-6 w-6"
                  checked={connectedOk}
                  onChange={(event) => setConnectedOk(event.target.checked)}
                />
                Telefonen er koblet til printeren
              </label>
            ) : null}
            <Button
              className="h-12 w-full text-base"
              disabled={!connectedOk}
              onClick={() => setStep((value) => value + 1)}
            >
              Neste
            </Button>
          </>
        ) : null}

        {current.kind === "test-print" ? (
          <>
            {printError ? (
              <p className="text-base text-[var(--color-bg-danger)]">{printError}</p>
            ) : null}
            <Button
              className="h-12 w-full text-base"
              disabled={busy}
              onClick={() => void printTest()}
            >
              {busy ? (
                <LoaderCircle className="size-5 animate-spin" aria-hidden />
              ) : (
                <Printer className="size-5" aria-hidden />
              )}
              {busy ? "Henter mal…" : didPrint ? "Skriv ut igjen" : "Skriv ut testskilt"}
            </Button>
            {didPrint ? (
              <label className="flex items-center gap-3 text-lg">
                <input
                  type="checkbox"
                  className="h-6 w-6"
                  checked={printedOk}
                  onChange={(event) => setPrintedOk(event.target.checked)}
                />
                Testskiltet kom ut av printeren
              </label>
            ) : null}
            <Button className="h-12 w-full text-base" disabled={!printedOk} onClick={finish}>
              Begynn å skanne
            </Button>
            <Button variant="ghost" className="h-12 w-full text-base" onClick={finish}>
              Hopp over testen
            </Button>
          </>
        ) : null}

        {current.kind === "confirm" ? (
          <Button
            className="h-12 w-full text-base"
            disabled={!seen}
            onClick={() => setStep((value) => value + 1)}
          >
            Neste
          </Button>
        ) : null}

        {current.kind === "install" || current.kind === "camera" || current.kind === "guide" ? (
          <Button
            className="h-12 w-full text-base"
            onClick={() => {
              if (pathSteps) {
                setStep((value) => value + 1)
                return
              }
              goNextFromPrelude()
            }}
          >
            Neste
          </Button>
        ) : null}

        {current.id === "pair" ? (
          <Button asChild variant="ghost" className="h-12 w-full text-base">
            <Link href={apiPath("/oppsett/bluetooth")}>Finner du ikke printeren?</Link>
          </Button>
        ) : null}

        {atStart ? (
          <Button asChild variant="ghost" className="h-12 w-full text-base">
            <Link href="/">Avbryt</Link>
          </Button>
        ) : (
          <Button variant="ghost" className="h-12 w-full text-base" onClick={goBack}>
            Tilbake
          </Button>
        )}
      </div>
    </main>
  )
}

export type { PhonePlatform }
