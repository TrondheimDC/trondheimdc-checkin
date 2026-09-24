"use client"

import { LoaderCircle, Printer } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { refinePlatform, supportsAndroidIntent, type PhonePlatform } from "@/lib/platform"
import {
  buildAndroidPrintIntent,
  buildPrintUrl,
  DEFAULT_PAPER_SIZE_ID,
  loadTemplateBase64,
} from "@/lib/print-url"
import { apiPath } from "@/lib/utils"

const SETUP_KEY = "tdc-checkin-printer-seen"
const IOS_APP = "https://apps.apple.com/us/app/smooth-print/id1629559918"

const TEST_NAME = "Test"
const TEST_LINE2 = "TrondheimDC"

export type { PhonePlatform }

const steps = [
  {
    kind: "guide" as const,
    image: "/oppsett/smooth-print.jpg",
    title: "Installer Smooth Print",
    body: "Last ned appen, og kom tilbake hit.",
  },
  {
    kind: "guide" as const,
    image: "/oppsett/oppsett-bluetooth.png",
    title: "Slå på Bluetooth",
    body: "På printeren: gå til Menu → Bluetooth, og slå den på.",
  },
  {
    kind: "guide" as const,
    image: "/oppsett/oppsett-paring.png",
    title: "Koble til telefonen",
    body: "Åpne Innstillinger → Bluetooth, og velg QL-820NWB. Oppgi paringskoden som vises på telefonen. Den kan også dukke opp på printerens skjerm.",
  },
  {
    kind: "confirm" as const,
    image: "/oppsett/oppsett-bekreft.png",
    title: "Se printeren i appen",
    body: "Åpne Smooth Print. QL-820NWBc skal være valgt i appen.",
  },
  {
    kind: "test-print" as const,
    title: "Skriv ut et testskilt",
    body: "Én utskrift viser at Smooth Print åpnes og at navneskiltet kommer ut av printeren.",
  },
]

export function SetupFlow({ platform: platformProp, androidUrl }: { platform: PhonePlatform; androidUrl: string }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [seen, setSeen] = useState(false)
  const [printedOk, setPrintedOk] = useState(false)
  const [didPrint, setDidPrint] = useState(false)
  const [busy, setBusy] = useState(false)
  const [printError, setPrintError] = useState<string | null>(null)
  const [platform, setPlatform] = useState(platformProp)
  const current = steps[step]
  const last = step === steps.length - 1

  useEffect(() => {
    setPlatform(refinePlatform(platformProp))
  }, [platformProp])

  function finish() {
    window.localStorage.setItem(SETUP_KEY, "1")
    router.push("/")
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
        const fallbackUrl = `${window.location.origin}${apiPath("/oppsett")}`
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

  return (
    <main className="mx-auto flex h-svh max-w-md flex-col overflow-hidden px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mb-3 flex shrink-0 gap-2">
        {steps.map((item, index) => (
          <span
            key={item.title}
            className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-[var(--color-fg-brand)]" : "bg-[var(--color-bg-surface)]"}`}
          />
        ))}
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {current.kind === "test-print" ? (
          <div className="w-full max-w-sm rounded-2xl bg-[var(--color-black-3)] px-6 py-7">
            <p className="text-4xl leading-tight">{TEST_NAME}</p>
            <p className="mt-3 text-xl opacity-80">{TEST_LINE2}</p>
            <p className="mt-5 font-mono text-xs tracking-wide opacity-45">Sjekker ingen ekte deltaker</p>
          </div>
        ) : (
          steps.map((item, index) =>
            item.kind === "test-print" ? null : (
              <img
                key={item.image}
                src={item.image}
                alt={index === 0 ? "Smooth Print" : ""}
                className={`absolute top-1/2 left-1/2 max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 object-contain ${
                  index === 0 ? "h-28 w-28 rounded-[22%] object-cover" : ""
                } ${index === step ? "opacity-100" : "pointer-events-none opacity-0"}`}
                aria-hidden={index !== step}
              />
            ),
          )
        )}
      </div>

      <p className="mt-2 shrink-0 font-mono text-sm text-[var(--color-fg-brand)]">
        {step + 1} av {steps.length}
      </p>
      <h1 className="mt-1 shrink-0 text-3xl">{current.title}</h1>
      <p className="mt-2 shrink-0 text-base leading-snug">{current.body}</p>

      {step === 0 && platform === "ios" ? (
        <Button asChild className="mt-3 h-12 w-full shrink-0 text-base">
          <a href={IOS_APP} target="_blank" rel="noopener noreferrer">
            Hent i App Store
          </a>
        </Button>
      ) : null}
      {step === 0 && platform === "android" ? (
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
      {step === 0 && platform === "other" ? (
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
        ) : current.kind === "confirm" ? (
          <Button
            className="h-12 w-full text-base"
            disabled={!seen}
            onClick={() => setStep((value) => value + 1)}
          >
            Neste
          </Button>
        ) : (
          <Button className="h-12 w-full text-base" onClick={() => setStep((value) => value + 1)}>
            Neste
          </Button>
        )}
        {step > 0 ? (
          <Button variant="ghost" className="h-12 w-full text-base" onClick={() => setStep((value) => value - 1)}>
            Tilbake
          </Button>
        ) : (
          <Button asChild variant="ghost" className="h-12 w-full text-base">
            <Link href="/">Avbryt</Link>
          </Button>
        )}
      </div>
    </main>
  )
}
