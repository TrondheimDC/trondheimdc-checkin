"use client"

import { useEffect, useState } from "react"
import { LoaderCircle, Printer, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { platformFromNavigator, supportsAndroidIntent } from "@/lib/platform"
import { stickerQrDataUrl } from "@/lib/printer-sticker-lbx"
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
    void stickerQrDataUrl(url).then((data) => {
      if (!cancelled) setSrc(data)
    })
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

export function ShowStickerQrButton({ name, url }: { name: string; url: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="surface" onClick={() => setOpen(true)}>
        <QrCode className="size-5" aria-hidden />
        Vis QR
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>QR for {name}</DialogTitle>
          <DialogDescription>
            Skann koden for å koble telefonen i Smooth Print.
          </DialogDescription>
          <div className="mt-4 flex justify-center">
            <StickerPreview name={name} url={url} />
          </div>
          <div className="mt-6">
            <DialogClose asChild>
              <Button variant="surface" size="lg">
                Lukk
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
      const href =
        platform === "android" && supportsAndroidIntent()
          ? buildAndroidStickerIntent({
              ...input,
              fallbackUrl: `${window.location.origin}${apiPath("/admin/printers")}`,
            })
          : buildStickerPrintUrl(input)
      window.location.href = href
    } catch {
      setError("Klarte ikke å åpne Smooth Print med etiketten.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-base text-[var(--color-bg-danger)]">{error}</p> : null}
      <Button type="button" size="lg" disabled={busy || !name || !url} onClick={() => void print()}>
        {busy ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : <Printer className="size-5" aria-hidden />}
        Skriv ut etikett
      </Button>
    </div>
  )
}
