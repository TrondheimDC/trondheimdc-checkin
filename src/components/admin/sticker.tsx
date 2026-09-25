"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { LoaderCircle, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { platformFromNavigator, supportsAndroidIntent } from "@/lib/platform"
import {
  buildAndroidStickerIntent,
  buildStickerPrintUrl,
  DEFAULT_PAPER_SIZE_ID,
  loadTemplateBase64,
} from "@/lib/print-url"
import { apiPath } from "@/lib/utils"

export function StickerPreview({ name, url }: { name: string; url: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(url, { margin: 1, width: 280, color: { dark: "#0f0f0f", light: "#fefefe" } }).then(
      (data) => {
        if (!cancelled) setSrc(data)
      },
    )
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className="mx-auto flex w-40 flex-col items-center rounded-2xl bg-[var(--color-white-1)] px-3 py-4 text-[var(--color-black)]">
      <p className="w-full truncate text-center font-display text-lg font-bold">{name || "Navn"}</p>
      {src ? <img src={src} alt="" className="mt-2 size-32" /> : <div className="mt-2 size-32 bg-black/10" />}
    </div>
  )
}

export function PrintStickerButton({ name, url }: { name: string; url: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function print() {
    setError(null)
    setBusy(true)
    try {
      const fileBase64 = await loadTemplateBase64("printer.lbx")
      const input = {
        fileBase64,
        paperSizeId: DEFAULT_PAPER_SIZE_ID,
        name,
        qr: url,
      }
      const platform = platformFromNavigator()
      if (platform === "android" && supportsAndroidIntent()) {
        const fallbackUrl = `${window.location.origin}${apiPath("/admin/printers")}`
        window.location.href = buildAndroidStickerIntent({ ...input, fallbackUrl })
      } else {
        window.location.href = buildStickerPrintUrl(input)
      }
    } catch {
      setError("Klarte ikke å hente etikettmalen.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-base text-[var(--color-bg-danger)]">{error}</p> : null}
      <Button size="lg" disabled={busy || !name || !url} onClick={() => void print()}>
        {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Printer className="size-5" aria-hidden />}
        Skriv ut etikett
      </Button>
    </div>
  )
}
