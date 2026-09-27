"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { apiPath } from "@/lib/utils"

const steps = [
  {
    image: "/oppsett/android-innstillinger.png",
    title: "Åpne Innstillinger",
    body: "Åpne Innstillinger på telefonen.",
  },
  {
    image: "/oppsett/android-apper.png",
    title: "Trykk på Apper",
    body: "Trykk på Apper.",
  },
  {
    image: "/oppsett/android-spesiell-apptilgang.png",
    title: "Spesiell apptilgang",
    body: "Trykk på Spesiell apptilgang.",
  },
  {
    image: "/oppsett/android-ukjente-apper.png",
    title: "Installer ukjente apper",
    body: "Trykk på Installer ukjente apper.",
  },
  {
    image: "/oppsett/android-velg-chrome.png",
    title: "Velg nettleseren",
    body: "Velg nettleseren du lastet ned filen med, for eksempel Chrome.",
  },
  {
    image: "/oppsett/android-tillat-kilde.png",
    title: "Tillat fra denne kilden",
    body: "Slå på Tillat fra denne kilden.",
  },
  {
    image: "/oppsett/android-apne-fil.png",
    title: "Åpne filen på nytt",
    body: "Gå deretter tilbake, og åpne filen på nytt.",
  },
]

export function AndroidInstallFlow() {
  const [step, setStep] = useState(0)
  const current = steps[step]
  const last = step === steps.length - 1

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
            alt=""
            className={`absolute top-1/2 left-1/2 max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 object-contain ${
              index === step ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            aria-hidden={index !== step}
          />
        ))}
      </div>

      <p className="mt-2 shrink-0 font-mono text-sm text-[var(--color-fg-brand)]">
        {step + 1} av {steps.length}
      </p>
      <h1 className="mt-1 shrink-0 text-3xl">{current.title}</h1>
      <p className="mt-2 shrink-0 text-base leading-snug">{current.body}</p>

      <div className="mt-auto flex shrink-0 flex-col gap-2 pt-3">
        {last ? (
          <Button asChild className="h-12 w-full text-base">
            <Link href={apiPath("/oppsett?step=install&primed=1")}>Tilbake til oppsett</Link>
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
            <Link href={apiPath("/oppsett?step=install&primed=1")}>Avbryt</Link>
          </Button>
        )}
      </div>
    </main>
  )
}
