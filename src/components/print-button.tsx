"use client"

import { LoaderCircle, Printer } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { PhonePlatform } from "@/lib/platform"
import {
  IOS_APP_STORE,
  buildAndroidPrintIntent,
  buildPrintUrl,
  loadTemplateBase64,
} from "@/lib/print-url"
import { apiPath } from "@/lib/utils"

export function PrintButton({
  name,
  line2,
  paperSizeId,
  platform,
}: {
  name: string
  line2: string
  paperSizeId: string
  platform: PhonePlatform
}) {
  const [printed, setPrinted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [iosHint, setIosHint] = useState(false)

  async function print() {
    setError(null)
    setIosHint(false)
    setBusy(true)
    try {
      const fileBase64 = await loadTemplateBase64()
      const input = { fileBase64, paperSizeId, name, line2 }

      if (platform === "android") {
        // If Smooth Print is missing, Chrome follows browser_fallback_url to /oppsett.
        const fallbackUrl = `${window.location.origin}${apiPath("/oppsett")}`
        window.location.href = buildAndroidPrintIntent({ ...input, fallbackUrl })
      } else {
        window.location.href = buildPrintUrl(input)
        if (platform === "ios") {
          // iOS often backgrounds Safari when the app opens. If we stay visible,
          // the scheme likely did nothing (app missing). Android success keeps
          // the tab visible, so this hint is iOS-only.
          window.setTimeout(() => {
            if (document.visibilityState === "visible") setIosHint(true)
          }, 2000)
        }
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
      {iosHint ? (
        <p className="rounded-xl bg-[var(--color-bg-surface)] px-4 py-3 text-base leading-snug">
          Skjedde det ingenting?{" "}
          <a href={IOS_APP_STORE} className="text-[var(--color-fg-brand)] underline" target="_blank" rel="noopener noreferrer">
            Installer Smooth Print
          </a>{" "}
          eller se{" "}
          <Link href="/oppsett" className="text-[var(--color-fg-brand)] underline">
            oppsett
          </Link>
          .
        </p>
      ) : null}
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
