"use client"

import { LoaderCircle, Printer, QrCode, Wrench } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { SetupQrScan } from "@/components/setup-qr-scan"
import { Button } from "@/components/ui/button"
import { platformFromNavigator, supportsAndroidIntent, type PhonePlatform } from "@/lib/platform"
import {
  buildAndroidConnectIntent,
  buildAndroidPrintIntent,
  buildConnectUrl,
  buildPrintUrl,
  DEFAULT_PAPER_SIZE_ID,
  DEFAULT_PRINTER_MODEL,
  loadTemplateBase64,
} from "@/lib/print-url"
import type { PrinterSetupParams } from "@/lib/printer-setup"
import { apiPath } from "@/lib/utils"

const SETUP_KEY = "tdc-checkin-printer-seen"
const IOS_APP = "https://apps.apple.com/us/app/smooth-print/id1629559918"

const TEST_NAME = "Test"
const TEST_LINE2 = "TDC"

type SetupPath = "qr" | "manual"

type Step =
  | {
      id: "install"
      kind: "install"
      image: string
      title: string
      body: string
    }
  | {
      id: "choose"
      kind: "choose"
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
      image: string
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

const INSTALL: Step = {
  id: "install",
  kind: "install",
  image: "/oppsett/smooth-print.jpg",
  title: "Installer Smooth Print",
  body: "Last ned appen, og kom tilbake hit.",
}

const BT_ON: Step = {
  id: "bt-on",
  kind: "guide",
  image: "/oppsett/oppsett-bluetooth.png",
  title: "Slå på Bluetooth",
  body: "På printeren: gå til Menu → Bluetooth, og slå den på.",
}

const CHOOSE: Step = {
  id: "choose",
  kind: "choose",
  title: "Hvordan vil du koble til?",
  body: "Har printeren klistremerke med QR, skann den. Ellers gjør du det manuelt.",
}

const SCAN: Step = {
  id: "scan",
  kind: "scan",
  title: "Skann QR på printeren",
  body: "Hold telefonen mot klistremerket.",
}

const CONNECT: Step = {
  id: "connect",
  kind: "connect",
  title: "Koble til i Smooth Print",
  body: "Ett trykk åpner Smooth Print og velger denne printeren. Første gang kan telefonen fortsatt be om Bluetooth-paring.",
}

const PAIR: Step = {
  id: "pair",
  kind: "guide",
  image: "/oppsett/oppsett-paring.png",
  title: "Koble til telefonen",
  body: "Åpne Innstillinger → Bluetooth, og velg QL-820NWB. Oppgi paringskoden som vises på telefonen. Den kan også dukke opp på printerens skjerm.",
}

const CONFIRM: Step = {
  id: "confirm",
  kind: "confirm",
  image: "/oppsett/oppsett-bekreft.png",
  title: "Se printeren i appen",
  body: "Åpne Smooth Print. QL-820NWBc skal være valgt i appen.",
}

const TEST_PRINT: Step = {
  id: "test-print",
  kind: "test-print",
  title: "Skriv ut et testskilt",
  body: "Én utskrift viser at Smooth Print åpnes og at navneskiltet kommer ut av printeren.",
}

/** Shared before the fork — not mixed into a progress total that later changes. */
const PRELUDE: Step[] = [INSTALL, BT_ON, CHOOSE]

function buildPathSteps(path: SetupPath, omitScan: boolean): Step[] {
  if (path === "qr") {
    return omitScan
      ? [INSTALL, BT_ON, CONNECT, TEST_PRINT]
      : [INSTALL, BT_ON, SCAN, CONNECT, TEST_PRINT]
  }
  return [INSTALL, BT_ON, PAIR, CONFIRM, TEST_PRINT]
}

function pathStepIndex(path: SetupPath, id: Step["id"], omitScan: boolean) {
  return buildPathSteps(path, omitScan).findIndex((item) => item.id === id)
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

function resolveEntry(input: {
  initialPath: SetupPath | null
  initialStep: SetupStepId | null
  initialPrinter: PrinterSetupParams | null
  afterConnect: boolean
}): {
  path: SetupPath | null
  preludeStep: number
  step: number
  connected: boolean
} {
  const omitScan = Boolean(input.initialPrinter)

  if (input.afterConnect) {
    const path = input.initialPath ?? "qr"
    const at = pathStepIndex(path, "test-print", omitScan)
    return { path, preludeStep: 0, step: at >= 0 ? at : 0, connected: true }
  }

  const stepId = input.initialStep
  if (stepId) {
    if (stepId === "choose" || (!input.initialPath && (stepId === "install" || stepId === "bt-on"))) {
      const preludeIdx = PRELUDE.findIndex((item) => item.id === stepId)
      return {
        path: null,
        preludeStep: preludeIdx >= 0 ? preludeIdx : 0,
        step: 0,
        connected: false,
      }
    }

    const path = inferPathForStep(stepId, input.initialPath)
    if (path) {
      const at = pathStepIndex(path, stepId, omitScan)
      if (at >= 0) {
        return { path, preludeStep: 0, step: at, connected: false }
      }
    }

    const preludeIdx = PRELUDE.findIndex((item) => item.id === stepId)
    if (preludeIdx >= 0) {
      return { path: null, preludeStep: preludeIdx, step: 0, connected: false }
    }
  }

  if (input.initialPath) {
    return { path: input.initialPath, preludeStep: 0, step: 0, connected: false }
  }

  return { path: null, preludeStep: 0, step: 0, connected: false }
}

function buildSetupSearch(input: {
  path: SetupPath | null
  stepId: SetupStepId
  printer: PrinterSetupParams | null
  phaseConnected: boolean
  connectResult: string | null
}): string {
  const params = new URLSearchParams()
  if (input.path) params.set("path", input.path)
  params.set("step", input.stepId)
  if (input.printer) {
    params.set("address", input.printer.address)
    if (input.printer.serial) params.set("serial", input.printer.serial)
    params.set("model", input.printer.model)
    params.set("type", input.printer.connectType)
  }
  if (input.phaseConnected) {
    params.set("phase", "connected")
    if (input.connectResult) params.set("result", input.connectResult)
  }
  return params.toString()
}

export type SetupFlowProps = {
  androidUrl: string
  initialPath?: SetupPath | null
  initialStep?: SetupStepId | null
  initialPrinter?: PrinterSetupParams | null
  afterConnect?: boolean
  connectResult?: string | null
}

export function SetupFlow({
  androidUrl,
  initialPath = null,
  initialStep = null,
  initialPrinter = null,
  afterConnect = false,
  connectResult = null,
}: SetupFlowProps) {
  const router = useRouter()
  const omitScan = Boolean(initialPrinter)
  const [entry] = useState(() =>
    resolveEntry({ initialPath, initialStep, initialPrinter, afterConnect }),
  )
  const [path, setPath] = useState<SetupPath | null>(entry.path)
  const [printer, setPrinter] = useState<PrinterSetupParams | null>(initialPrinter)
  /** Index into PRELUDE while path is null. */
  const [preludeStep, setPreludeStep] = useState(entry.preludeStep)
  const [step, setStep] = useState(entry.step)
  const [seen, setSeen] = useState(false)
  const [connectedOk, setConnectedOk] = useState(entry.connected)
  const [didConnect, setDidConnect] = useState(entry.connected)
  const [printedOk, setPrintedOk] = useState(false)
  const [didPrint, setDidPrint] = useState(false)
  const [busy, setBusy] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const [platform, setPlatform] = useState<PhonePlatform>("other")

  const pathSteps = useMemo(
    () => (path ? buildPathSteps(path, omitScan) : null),
    [path, omitScan],
  )
  const current: Step = pathSteps
    ? (pathSteps[Math.min(step, pathSteps.length - 1)] ?? INSTALL)
    : (PRELUDE[Math.min(preludeStep, PRELUDE.length - 1)] ?? INSTALL)

  const progress =
    pathSteps != null
      ? { index: step, total: pathSteps.length }
      : current.kind === "choose"
        ? null
        : { index: preludeStep, total: PRELUDE.length - 1 }

  const connectOkHint =
    connectResult != null && connectResult.toUpperCase().includes("SUCCESS")
      ? "Smooth Print svarte SUCCESS."
      : null

  useEffect(() => {
    setPlatform(platformFromNavigator())
  }, [])

  useEffect(() => {
    const query = buildSetupSearch({
      path,
      stepId: current.id,
      printer,
      phaseConnected: didConnect && current.id === "test-print",
      connectResult,
    })
    const next = apiPath(query ? `/oppsett?${query}` : "/oppsett")
    if (`${window.location.pathname}${window.location.search}` === next) return
    window.history.replaceState(window.history.state, "", next)
  }, [path, current.id, printer, didConnect, connectResult])

  function finish() {
    window.localStorage.setItem(SETUP_KEY, "1")
    router.push("/")
  }

  function choosePath(next: SetupPath) {
    setPath(next)
    if (next === "manual") setPrinter(null)
    const nextOmit = next === "qr" ? omitScan : false
    setStep(pathStepIndex(next, firstPathStepId(next, nextOmit), nextOmit))
  }

  const onQrFound = useCallback((found: PrinterSetupParams) => {
    setPrinter(found)
    setPath("qr")
    setStep(pathStepIndex("qr", "connect", false))
  }, [])

  function openConnect() {
    if (!printer) return
    const origin = window.location.origin
    const callback = new URL(apiPath("/oppsett"), origin)
    callback.searchParams.set("path", "qr")
    callback.searchParams.set("step", "test-print")
    callback.searchParams.set("address", printer.address)
    callback.searchParams.set("serial", printer.serial)
    callback.searchParams.set("model", printer.model)
    callback.searchParams.set("type", printer.connectType)
    callback.searchParams.set("phase", "connected")
    callback.searchParams.set("result", "")
    const callbackUrl = callback.toString()

    const input = {
      connectType: printer.connectType,
      address: printer.address,
      serial: printer.serial,
      model: printer.model || DEFAULT_PRINTER_MODEL,
      callbackUrl,
    }
    const fallbackQuery = buildSetupSearch({
      path: "qr",
      stepId: "connect",
      printer,
      phaseConnected: false,
      connectResult: null,
    })
    const fallbackUrl = `${origin}${apiPath(`/oppsett?${fallbackQuery}`)}`
    if (platform === "android" && supportsAndroidIntent()) {
      window.location.href = buildAndroidConnectIntent({ ...input, fallbackUrl })
    } else {
      window.location.href = buildConnectUrl(input)
    }
    setDidConnect(true)
  }

  async function printTest() {
    setPrintError(null)
    setBusy(true)
    try {
      const fileBase64 = await loadTemplateBase64()
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

  function goBack() {
    if (pathSteps && path) {
      const firstId = firstPathStepId(path, omitScan)
      if (current.id === firstId) {
        setPath(null)
        setPrinter(initialPrinter)
        setPreludeStep(PRELUDE.length - 1)
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

  return (
    <main className="mx-auto flex h-svh max-w-md flex-col overflow-hidden px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      {progress ? (
        <div className="mb-3 flex shrink-0 gap-2">
          {Array.from({ length: progress.total }, (_, index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full ${index <= progress.index ? "bg-[var(--color-fg-brand)]" : "bg-[var(--color-bg-surface)]"}`}
            />
          ))}
        </div>
      ) : (
        <div className="mb-3 h-1.5 shrink-0" />
      )}

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {current.kind === "test-print" ? (
          <div className="w-full max-w-sm rounded-2xl bg-[var(--color-black-3)] px-6 py-7">
            <p className="text-4xl leading-tight">{TEST_NAME}</p>
            <p className="mt-3 text-xl opacity-80">{TEST_LINE2}</p>
            <p className="mt-5 font-mono text-xs tracking-wide opacity-45">Sjekker ingen ekte deltaker</p>
          </div>
        ) : current.kind === "choose" ? (
          <div className="flex w-full flex-col gap-3">
            <Button
              type="button"
              variant="surface"
              onClick={() => choosePath("qr")}
              className="h-auto w-full items-start justify-start gap-4 rounded-2xl p-4 text-left whitespace-normal"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-black/35 text-[var(--color-fg-brand)]">
                <QrCode className="size-6" strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block text-xl font-semibold">Skann QR</span>
                <span className="mt-1 block text-sm font-normal opacity-70">
                  Hopper over telefon-paring og valg i appen
                </span>
              </span>
            </Button>
            <Button
              type="button"
              variant="surface"
              onClick={() => choosePath("manual")}
              className="h-auto w-full items-start justify-start gap-4 rounded-2xl p-4 text-left whitespace-normal"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-black/35 text-[var(--color-fg-brand)]">
                <Wrench className="size-6" strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span className="block text-xl font-semibold">Manuelt</span>
                <span className="mt-1 block text-sm font-normal opacity-70">
                  Paring i telefonens Bluetooth-innstillinger
                </span>
              </span>
            </Button>
          </div>
        ) : current.kind === "scan" ? (
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
              <p className="mt-4 text-sm opacity-60">Ingen serienummer — iOS over Bluetooth kan trenge det.</p>
            )}
            <p className="mt-4 font-mono text-sm opacity-60">{printer.model}</p>
            {connectOkHint ? <p className="mt-4 text-sm text-[var(--color-fg-brand)]">{connectOkHint}</p> : null}
          </div>
        ) : current.kind === "connect" && !printer ? (
          <p className="text-base opacity-70">Ingen printerdata. Gå tilbake og skann QR.</p>
        ) : current.kind === "install" || current.kind === "guide" || current.kind === "confirm" ? (
          <img
            src={current.image}
            alt={current.id === "install" ? "Smooth Print" : ""}
            className={`max-h-full max-w-full object-contain ${
              current.id === "install" ? "h-28 w-28 rounded-[22%] object-cover" : ""
            }`}
          />
        ) : null}
      </div>

      {pathSteps && progress ? (
        <p className="mt-2 shrink-0 font-mono text-sm text-[var(--color-fg-brand)]">
          {progress.index + 1} av {progress.total}
        </p>
      ) : current.kind === "choose" ? (
        <p className="mt-2 shrink-0 font-mono text-sm text-[var(--color-fg-brand)]">Tilkobling</p>
      ) : (
        <p className="mt-2 shrink-0 font-mono text-sm text-[var(--color-fg-brand)]">Oppsett</p>
      )}
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
            <a href={androidUrl} target="_blank" rel="noopener noreferrer">
              Last ned appen
            </a>
          </Button>
          <Button asChild variant="ghost" className="h-12 w-full text-base">
            <Link href="/oppsett/android">Slik tillater du installasjon</Link>
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
            <a href={androidUrl} target="_blank" rel="noopener noreferrer">
              Android
            </a>
          </Button>
        </div>
      ) : null}

      <div className="mt-auto flex shrink-0 flex-col gap-2 pt-3">
        {current.kind === "confirm" ? (
          <label className="flex items-center gap-3 text-lg">
            <input
              type="checkbox"
              className="h-6 w-6"
              checked={seen}
              onChange={(event) => setSeen(event.target.checked)}
            />
            Jeg ser printeren i Smooth Print
          </label>
        ) : null}

        {current.kind === "connect" ? (
          <>
            <Button className="h-12 w-full text-base" disabled={!printer} onClick={openConnect}>
              {didConnect ? "Åpne Smooth Print igjen" : "Koble til i Smooth Print"}
            </Button>
            {didConnect ? (
              <label className="flex items-center gap-3 text-lg">
                <input
                  type="checkbox"
                  className="h-6 w-6"
                  checked={connectedOk}
                  onChange={(event) => setConnectedOk(event.target.checked)}
                />
                Printeren er valgt i Smooth Print
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
            {printError ? <p className="text-base text-[var(--color-bg-danger)]">{printError}</p> : null}
            <Button className="h-12 w-full text-base" disabled={busy} onClick={() => void printTest()}>
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

        {!path && (current.kind === "install" || current.id === "bt-on") ? (
          <Button
            className="h-12 w-full text-base"
            onClick={() => setPreludeStep((value) => value + 1)}
          >
            Neste
          </Button>
        ) : null}

        {path && (current.kind === "install" || current.kind === "guide") ? (
          <Button className="h-12 w-full text-base" onClick={() => setStep((value) => value + 1)}>
            Neste
          </Button>
        ) : null}

        {current.kind === "scan" ? (
          <Button
            variant="ghost"
            className="h-12 w-full text-base"
            onClick={() => {
              setPath("manual")
              setPrinter(null)
              setStep(pathStepIndex("manual", "pair", false))
            }}
          >
            Manuelt i stedet
          </Button>
        ) : null}

        {current.kind === "choose" ? (
          <Button variant="ghost" className="h-12 w-full text-base" onClick={goBack}>
            Tilbake
          </Button>
        ) : atStart ? (
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
