"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"

const SETUP_KEY = "tdc-checkin-printer-seen"
const IOS_APP = "https://apps.apple.com/us/app/smooth-print/id1629559918"

export type PhonePlatform = "ios" | "android" | "other"

const steps = [
  {
    image: "/oppsett/smooth-print.jpg",
    title: "Installer Smooth Print",
    body: "Last ned appen, og kom tilbake hit.",
  },
  {
    image: "/oppsett/oppsett-bluetooth.png",
    title: "Slå på Bluetooth",
    body: "På skriveren: gå til Menu → Bluetooth, og slå den på.",
  },
  {
    image: "/oppsett/oppsett-paring.png",
    title: "Koble til telefonen",
    body: "Åpne Innstillinger → Bluetooth, og velg QL-820NWB. Oppgi paringskoden som dukker opp. Det er usikkert om koden også vises på skriverens skjerm.",
  },
  {
    image: "/oppsett/oppsett-bekreft.png",
    title: "Se skriveren i appen",
    body: "Åpne Smooth Print. QL-820NWBc skal være valgt i appen.",
  },
]

export function SetupFlow({ platform, androidUrl }: { platform: PhonePlatform; androidUrl: string }) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [seen, setSeen] = useState(false)
  const current = steps[step]
  const last = step === steps.length - 1

  function finish() {
    window.localStorage.setItem(SETUP_KEY, "1")
    router.push("/")
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
        {steps.map((item, index) => (
          <img
            key={item.image}
            src={item.image}
            alt={index === 0 ? "Smooth Print" : ""}
            className={`absolute top-1/2 left-1/2 max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 object-contain ${
              index === 0 ? "h-28 w-28 rounded-[22%] object-cover" : ""
            } ${index === step ? "opacity-100" : "pointer-events-none opacity-0"}`}
            aria-hidden={index !== step}
          />
        ))}
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
        {last ? (
          <label className="flex items-center gap-3 text-lg">
            <input
              type="checkbox"
              className="h-6 w-6"
              checked={seen}
              onChange={(event) => setSeen(event.target.checked)}
            />
            Jeg ser skriveren i Smooth Print
          </label>
        ) : null}
        {last ? (
          <Button className="h-12 w-full text-base" disabled={!seen} onClick={finish}>
            Start å skanne
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
