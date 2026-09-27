"use client"

import { LoaderCircle, Printer } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  refinePlatform,
  supportsAndroidIntent,
  type PhonePlatform,
} from "@/lib/platform"
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
  body: "Last ned og installer appen. Lukk den helt etterpå, så den ikke ligger åpen i bakgrunnen.",
}

const BT_ON: Step = {
  id: "bt-on",
  kind: "guide",
  image: "/oppsett/oppsett-bluetooth.png",
  title: "Slå på Bluetooth",
  body: "Trykk Menu på printeren, velg Bluetooth og slå den på.",
}

const PAIR: Step = {
  id: "pair",
  kind: "guide",
  image: "/oppsett/oppsett-paring.png",
  title: "Koble telefonen til printeren",
  body: "Gå til Innstillinger → Bluetooth og velg QL-820NWB(XXXX). Sjekk at koden er lik på begge, og bekreft på printeren og telefonen.",
}

const CONNECT_IOS: Step = {
  id: "connect",
  kind: "connect",
  title: "Koble til i Smooth Print",
  body: "Ett trykk åpner Smooth Print og velger denne printeren.",
}

const CONNECT_ANDROID: Step = {
  id: "connect",
  kind: "connect",
  title: "Legg til i Smooth Print",
  body: "Ett trykk legger printeren inn i Smooth Print. Lukk appen helt etterpå.",
}

const CONFIRM_IOS: Step = {
  id: "confirm",
  kind: "confirm",
  image: "/oppsett/oppsett-bekreft.png",
  title: "Velg printeren i Smooth Print",
  body: "Åpne Smooth Print og sjekk at QL-820NWB(XXXX) er valgt.",
}

const CONFIRM_ANDROID: Step = {
  id: "confirm",
  kind: "confirm",
  image: "/oppsett/oppsett-bekreft.png",
  title: "Velg printeren i Smooth Print",
  body: "Åpne Smooth Print og velg QL-820NWB(XXXX). Lukk appen helt etterpå.",
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
  body: "Smooth Print viser et vindu over denne siden. Åpnes appen i stedet, lukk den helt og prøv igjen.",
}

/**
 * Linear setup on both platforms. Sticker deeplink (`path=qr` + printer fields) uses
 * connect after OS pair; plain /oppsett uses manual confirm in Smooth Print.
 */
function buildPathSteps(path: SetupPath, platform: PhonePlatform): Step[] {
  const install = platform === "android" ? INSTALL_ANDROID : INSTALL_IOS
  const test = platform === "android" ? TEST_PRINT_ANDROID : TEST_PRINT_IOS

  if (path === "qr") {
    const connect = platform === "android" ? CONNECT_ANDROID : CONNECT_IOS
    return [install, BT_ON, PAIR, connect, test]
  }

  const confirm = platform === "android" ? CONFIRM_ANDROID : CONFIRM_IOS
  return [install, BT_ON, PAIR, confirm, test]
}

function pathStepIndex(path: SetupPath, id: Step["id"], platform: PhonePlatform) {
  return buildPathSteps(path, platform).findIndex((item) => item.id === id)
}

export type SetupStepId = Step["id"]

function resolveEntry(input: {
  platform: PhonePlatform
  initialPath: SetupPath | null
  initialStep: SetupStepId | null
  initialPrinter: PrinterSetupParams | null
  afterConnect: boolean
  initialPrimed: boolean
}): {
  path: SetupPath
  step: number
  connected: boolean
} {
  // Sticker URL with printer fields → connect after OS pair. Otherwise manual confirm.
  const path: SetupPath = input.initialPrinter ? "qr" : "manual"

  if (input.afterConnect) {
    const at = pathStepIndex(path, "test-print", input.platform)
    return { path, step: at >= 0 ? at : 0, connected: true }
  }

  if (input.initialStep) {
    const at = pathStepIndex(path, input.initialStep, input.platform)
    if (at >= 0) {
      const pairAt = pathStepIndex(path, "pair", input.platform)
      // Fresh sticker deeplink (`step=connect`) must still walk install → BT → pair.
      // Help links and refresh pass step=pair (or later) with primed=1 and should resume.
      if (!input.initialPrimed && at > pairAt) {
        return { path, step: 0, connected: false }
      }
      return { path, step: at, connected: false }
    }
  }

  return { path, step: 0, connected: false }
}

function buildSetupSearch(input: {
  path: SetupPath
  stepId: SetupStepId
  printer: PrinterSetupParams | null
  phaseConnected: boolean
  connectResult: string | null
}): string {
  const params = new URLSearchParams()
  params.set("path", input.path)
  params.set("step", input.stepId)
  // primed=1: staff have already been through the early steps in this session, so a
  // refresh/deeplink may resume at `step`. Without it, a sticker URL with step=connect
  // still starts at install (must not skip BT-on / OS pair).
  params.set("primed", "1")
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
  /** From the request UA so the first paint matches Android vs iOS copy. */
  initialPlatform?: PhonePlatform
  initialPath?: SetupPath | null
  initialStep?: SetupStepId | null
  initialPrinter?: PrinterSetupParams | null
  afterConnect?: boolean
  connectResult?: string | null
  initialPrimed?: boolean
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
}: SetupFlowProps) {
  const router = useRouter()
  const [platform, setPlatform] = useState<PhonePlatform>(initialPlatform)
  const [entry] = useState(() =>
    resolveEntry({
      platform: initialPlatform,
      initialPath,
      initialStep,
      initialPrinter,
      afterConnect,
      initialPrimed,
    }),
  )
  const [path] = useState<SetupPath>(entry.path)
  const [printer] = useState<PrinterSetupParams | null>(initialPrinter)
  const [step, setStep] = useState(entry.step)
  const [seen, setSeen] = useState(false)
  const [connectedOk, setConnectedOk] = useState(entry.connected)
  const [didConnect, setDidConnect] = useState(entry.connected)
  const [printedOk, setPrintedOk] = useState(false)
  const [didPrint, setDidPrint] = useState(false)
  const [busy, setBusy] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)

  const pathSteps = useMemo(() => buildPathSteps(path, platform), [path, platform])
  const current: Step = pathSteps[Math.min(step, pathSteps.length - 1)] ?? INSTALL_IOS
  const progress = { index: step, total: pathSteps.length }

  const connectOkHint =
    connectResult != null && connectResult.toUpperCase().includes("SUCCESS")
      ? "Smooth Print meldte at tilkoblingen lyktes."
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
  })

  useEffect(() => {
    const next = apiPath(`/oppsett?${setupSearch}`)
    if (`${window.location.pathname}${window.location.search}` === next) return
    // replaceState keeps the wizard from remounting on each step; Next's router does
    // not track it, so help pages link back to a concrete `step` instead of history.back().
    window.history.replaceState(window.history.state, "", next)
  }, [setupSearch])

  function finish() {
    window.localStorage.setItem(SETUP_KEY, "1")
    router.push("/")
  }

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

  function goBack() {
    if (step === 0) {
      router.push("/")
      return
    }
    setStep((value) => value - 1)
  }

  const atStart = step === 0

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
            <p className="mt-5 font-mono text-xs tracking-wide opacity-45">Sjekker ikke inn noen deltaker</p>
          </div>
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
              <p className="mt-4 text-sm opacity-60">Mangler serienummer. iPhone trenger det for Bluetooth.</p>
            )}
            <p className="mt-4 font-mono text-sm opacity-60">{printer.model}</p>
            {connectOkHint ? <p className="mt-4 text-sm text-[var(--color-fg-brand)]">{connectOkHint}</p> : null}
          </div>
        ) : current.kind === "connect" && !printer ? (
          <p className="text-base opacity-70">Mangler printeropplysninger. Åpne oppsettet fra QR-koden på printeren.</p>
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
            <a href={androidUrl} target="_blank" rel="noopener noreferrer">
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
            {platform === "android"
              ? "Printeren er valgt, og Smooth Print er lukket"
              : "Printeren er valgt i Smooth Print"}
          </label>
        ) : null}

        {current.kind === "connect" ? (
          <>
            <Button className="h-12 w-full text-base" disabled={!printer} onClick={openConnect}>
              {didConnect
                ? "Åpne Smooth Print igjen"
                : platform === "android"
                  ? "Legg til i Smooth Print"
                  : "Koble til i Smooth Print"}
            </Button>
            {didConnect ? (
              <label className="flex items-center gap-3 text-lg">
                <input
                  type="checkbox"
                  className="h-6 w-6"
                  checked={connectedOk}
                  onChange={(event) => setConnectedOk(event.target.checked)}
                />
                {platform === "android"
                  ? "Printeren er lagt til, og Smooth Print er lukket"
                  : "Printeren er valgt i Smooth Print"}
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

        {current.kind === "install" || current.kind === "guide" ? (
          <Button className="h-12 w-full text-base" onClick={() => setStep((value) => value + 1)}>
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
