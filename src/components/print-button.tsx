"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { buildPrintUrl, templateUrl } from "@/lib/print-url"

export function PrintButton({
  name,
  line2,
  paperSizeId,
}: {
  name: string
  line2: string
  paperSizeId: string
}) {
  const [printed, setPrinted] = useState(false)
  const [stillHere, setStillHere] = useState(false)

  function print() {
    const url = buildPrintUrl({
      templateUrl: templateUrl(),
      paperSizeId,
      name,
      line2,
    })
    window.location.href = url
    window.setTimeout(() => {
      if (document.visibilityState === "visible") setStillHere(true)
    }, 1500)
    setPrinted(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`grid transition-[grid-template-rows] duration-200 ${stillHere ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <p className="mb-3 rounded-xl bg-[var(--color-bg-surface)] px-4 py-3 text-base leading-snug">
            Smooth Print åpnet seg ikke.{" "}
            <Link href="/oppsett" className="text-[var(--color-fg-brand)] underline">
              Installer appen
            </Link>{" "}
            og prøv igjen.
          </p>
        </div>
      </div>
      <Button size="lg" onClick={print}>
        {printed ? "Skriv ut igjen" : "Skriv ut merke"}
      </Button>
    </div>
  )
}
