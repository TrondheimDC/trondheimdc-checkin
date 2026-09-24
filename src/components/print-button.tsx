"use client"

import { LoaderCircle, Printer } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { refinePlatform, supportsAndroidIntent, type PhonePlatform } from "@/lib/platform"
import {
  buildAndroidPrintIntent,
  buildPrintUrl,
  loadTemplateBase64,
} from "@/lib/print-url"
import { apiPath } from "@/lib/utils"

export function PrintButton({
  name,
  line2,
  paperSizeId,
  platform: platformProp,
}: {
  name: string
  line2: string
  paperSizeId: string
  platform: PhonePlatform
}) {
  const [printed, setPrinted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const platform = refinePlatform(platformProp)

  async function print() {
    setError(null)
    setBusy(true)
    try {
      const fileBase64 = await loadTemplateBase64()
      const input = { fileBase64, paperSizeId, name, line2 }

      if (platform === "android" && supportsAndroidIntent()) {
        // Chromium follows browser_fallback_url to /oppsett when Smooth Print is missing.
        const fallbackUrl = `${window.location.origin}${apiPath("/oppsett")}`
        window.location.href = buildAndroidPrintIntent({ ...input, fallbackUrl })
      } else {
        window.location.href = buildPrintUrl(input)
      }
      setPrinted(true)
    } catch {
      setError("Klarte ikke å hente malen. Sjekk nettverket og prøv igjen.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-base text-[var(--color-bg-danger)]">{error}</p> : null}
      <Button size="lg" disabled={busy} onClick={() => void print()}>
        {busy ? (
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
        ) : (
          <Printer className="size-5" aria-hidden />
        )}
        {busy ? "Henter mal…" : printed ? "Skriv ut igjen" : "Skriv ut navneskilt"}
      </Button>
    </div>
  )
}
