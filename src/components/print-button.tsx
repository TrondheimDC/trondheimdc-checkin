"use client"

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { buildPrintUrl, loadTemplateBase64 } from "@/lib/print-url"

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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function print() {
    setError(null)
    setBusy(true)
    try {
      const fileBase64 = await loadTemplateBase64()
      const url = buildPrintUrl({
        fileBase64,
        paperSizeId,
        name,
        line2,
      })
      window.location.href = url
      window.setTimeout(() => {
        if (document.visibilityState === "visible") setStillHere(true)
      }, 1500)
      setPrinted(true)
    } catch {
      setError("Klarte ikke å hente malen. Sjekk nettverket og prøv igjen.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`grid transition-[grid-template-rows] duration-200 ${stillHere ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <p className="mb-3 rounded-xl bg-[var(--color-bg-surface)] px-4 py-3 text-base leading-snug">
            Smooth Print ble ikke åpnet.{" "}
            <Link href="/oppsett" className="text-[var(--color-fg-brand)] underline">
              Installer appen
            </Link>{" "}
            og prøv igjen.
          </p>
        </div>
      </div>
      {error ? <p className="text-base text-[var(--color-bg-danger)]">{error}</p> : null}
      <Button size="lg" disabled={busy} onClick={() => void print()}>
        {busy ? "Henter mal…" : printed ? "Skriv ut igjen" : "Skriv ut navneskilt"}
      </Button>
    </div>
  )
}
