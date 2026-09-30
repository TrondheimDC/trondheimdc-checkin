"use client"

import { LoaderCircle, Printer, QrCode } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { TdcLogo } from "@/components/tdc-logo"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  UsbConnectButton,
  UsbPrintMessage,
  usbBlocksPrint,
  usbNeedsConnect,
} from "@/components/usb-connect"
import { fitStickerQrCellSize } from "@/lib/lbx-patch"
import { platformFromNavigator, supportsAndroidIntent } from "@/lib/platform"
import { currentPrintMethod, usePrintMethod } from "@/lib/print-method"
import {
  buildAndroidStickerIntent,
  buildStickerPrintUrl,
  DEFAULT_PAPER_SIZE_ID,
  loadTemplateBase64,
} from "@/lib/print-url"
import { stickerQrDataUrl } from "@/lib/printer-sticker-lbx"
import { setupStickerText } from "@/lib/public-app-url"
import { printStickerUsb, UsbPrintError, useUsbPrinter } from "@/lib/usb-printer"
import { apiPath } from "@/lib/utils"

/**
 * On-screen stand-in for the landscape DK-11208 sticker (90 × 38 mm): QR on the
 * left, name and TDC art on the right. Mirrors printer.lbx / stasjon.lbx, which
 * scripts/build-sticker-templates.py generates.
 */
export function StickerPreview({
  name,
  url,
  variant = "setup",
}: {
  name: string
  url: string
  /** `login` is the stasjon.lbx sticker that covers the printer's model label. */
  variant?: "setup" | "login"
}) {
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

  const login = variant === "login"

  return (
    <div className="mx-auto flex aspect-[90/38] w-80 max-w-full gap-[4%] rounded-xl bg-[var(--color-white-1)] p-[3%] text-[var(--color-black)]">
      {src ? (
        <img src={src} alt="" className="aspect-square h-full" />
      ) : (
        <div className="aspect-square h-full bg-black/10" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="h-2 self-end text-[0.5rem] font-bold leading-none">
          {login ? "Model QL-820NWBc" : null}
        </p>
        <p
          className={`mt-1 truncate font-bold leading-tight ${
            name.length > 24 ? "text-xs" : name.length > 18 ? "text-sm" : "text-base"
          }`}
        >
          {name || "Navn"}
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 [--color-fg-brand:var(--color-black)]">
          <img
            src={apiPath("/badge/8bit-duck-dither.png")}
            alt=""
            className="size-12 [image-rendering:pixelated]"
          />
          <div className="flex flex-col items-end gap-1">
            <p className="text-[0.5rem] leading-none">innsjekk.trondheimdc.no</p>
            <TdcLogo className="h-3 gap-[0.105rem]" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ShowStickerQrButton({
  name,
  url,
  label = "Oppsett-QR",
  description = "Skann koden for å koble telefonen i Smooth Print.",
  className,
  fallbackPath,
  templateFile,
}: {
  name: string
  url: string
  label?: string
  description?: string
  className?: string
  fallbackPath?: string
  templateFile?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="surface" className={className} onClick={() => setOpen(true)}>
        <QrCode className="size-5" aria-hidden />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>QR for {name}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          <div className="mt-4 flex flex-col items-center gap-3">
            <StickerPreview name={setupStickerText(name)} url={url} />
            <PrintStickerButton
              name={setupStickerText(name)}
              url={url}
              fallbackPath={fallbackPath}
              templateFile={templateFile}
            />
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

export function PrintStickerButton({
  name,
  url,
  fallbackPath = "/admin/printers",
  templateFile = "printer.lbx",
}: {
  name: string
  url: string
  /** Path for Android intent fallback when Smooth Print is missing. */
  fallbackPath?: string
  /**
   * `printer.lbx` (front, setup) or `stasjon.lbx` (login). Both get their QR
   * cellSize fitted to the data length before printing: a template's cell
   * size is a fixed pt value, but QR version (module count) scales with data
   * length, so a fixed size prints a short URL smaller than a long one.
   */
  templateFile?: string
}) {
  const [busy, setBusy] = useState(false)
  const [usbError, setUsbError] = useState<string | null>(null)
  const usbMode = usePrintMethod() === "usb"
  const usb = useUsbPrinter()

  async function printUsb() {
    setUsbError(null)
    setBusy(true)
    try {
      // Drawn in the browser, so no LBX cellSize fitting — the QR is sized to the label.
      await printStickerUsb({ name, qr: url })
      toast.success("Etiketten er sendt til printeren.")
    } catch (caught) {
      setUsbError(caught instanceof UsbPrintError ? caught.message : "Klarte ikke å skrive ut.")
    } finally {
      setBusy(false)
    }
  }

  async function print() {
    if (currentPrintMethod() === "usb") {
      await printUsb()
      return
    }
    setBusy(true)
    try {
      const fileBase64 = await fitStickerQrCellSize(await loadTemplateBase64(templateFile), url)
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
              fallbackUrl: `${window.location.origin}${apiPath(fallbackPath)}`,
            })
          : buildStickerPrintUrl(input)
      window.location.href = href
    } catch {
      toast.error("Klarte ikke å åpne Smooth Print med etiketten.")
    } finally {
      setBusy(false)
    }
  }

  const button =
    usbMode && usbNeedsConnect(usb) ? (
      <UsbConnectButton />
    ) : (
      <Button
        type="button"
        size="lg"
        disabled={busy || !name || !url || (usbMode && usbBlocksPrint(usb))}
        onClick={() => void print()}
      >
        {busy ? (
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
        ) : (
          <Printer className="size-5" aria-hidden />
        )}
        Skriv ut etikett
      </Button>
    )

  if (!usbMode) return button
  return (
    <div className="flex w-full flex-col gap-2">
      <UsbPrintMessage usb={usb} error={usbError} />
      {button}
    </div>
  )
}
