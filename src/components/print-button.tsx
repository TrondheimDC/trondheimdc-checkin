"use client"

import { LoaderCircle, Printer } from "lucide-react"
import { useEffect, useRef, useState } from "react"
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
import { type PhonePlatform, refinePlatform, supportsAndroidIntent } from "@/lib/platform"
import { currentPrintMethod, usePrintMethod } from "@/lib/print-method"
import { consumePrintOutcome, primeForIosTabReuse } from "@/lib/print-outcome"
import {
  buildAndroidPrintIntent,
  buildPrintUrl,
  DEFAULT_PAPER_SIZE_ID,
  loadTemplateBase64,
  type PrintCallback,
} from "@/lib/print-url"
import { printBadgeUsb, UsbPrintError, useUsbPrinter } from "@/lib/usb-printer"
import { apiPath } from "@/lib/utils"

/**
 * Smooth Print concatenates its result onto the end of this string verbatim, so the
 * URL has to end in a bare "key=" for the append to land as a value. Anything else
 * corrupts the path: a trailing "#utskrift" came back as
 * "%23utskriftSUCCESS&errorcode=SUCCESS" inside the path (it percent-encodes "#",
 * so a fragment cannot survive this round trip).
 *
 * iOS then also appends "&errorcode=SUCCESS". Android's success callback is only
 * "?result=SUCCESS" — no errorcode — which matches Brother's documented success URL.
 * Android badge prints omit the callback pair entirely (Smooth Print's dialog is
 * better UX than a new Chrome tab per print).
 *
 * Same URL for both callbacks — Brother only requires the pair to be present, not
 * distinct, and the appended value says which one fired.
 */
function buildPrintCallback(): PrintCallback {
  const target = new URL(window.location.pathname, window.location.origin)
  target.searchParams.set("result", "")
  const callbackUrl = target.toString()
  return { successCallback: callbackUrl, failureCallback: callbackUrl }
}

export function PrintButton({
  name,
  line2,
  platform: platformProp,
  checkedIn = false,
  onCheckIn,
  idleLabel = "Skriv ut navneskilt",
  doneLabel = "Skriv ut igjen",
  onPrinted,
  autoPrint = false,
}: {
  name: string
  line2: string
  platform: PhonePlatform
  checkedIn?: boolean
  onCheckIn?: () => Promise<void>
  idleLabel?: string
  doneLabel?: string
  onPrinted?: () => void
  /** Fire print once on mount when the attendee is not already checked in. */
  autoPrint?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [printed, setPrinted] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const platform = refinePlatform(platformProp)
  const alreadyPrinted = checkedIn || printed
  const autoPrintStarted = useRef(false)
  const method = usePrintMethod()
  const usb = useUsbPrinter()
  const usbMode = method === "usb"
  const usbReady = usb.kind === "ready"

  useEffect(() => {
    const result = consumePrintOutcome(platform)
    if (!result) return
    if (result.success) setPrinted(true)
    else {
      setPrinted(false)
      setError("Smooth Print meldte at utskriften feilet. Prøv igjen.")
    }
    // Only ever meant to consume the callback this page load arrived with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openPrint(fileBase64: string) {
    // Android: no successCallback/failureCallback. With the pair set, Chrome opens
    // a new tab per print; without it, Smooth Print shows its result dialog over
    // the same tab. iOS needs the pair or Smooth Print stays in front.
    const input = {
      fileBase64,
      paperSizeId: DEFAULT_PAPER_SIZE_ID,
      name,
      line2,
      ...(platform === "ios" ? { callback: buildPrintCallback() } : {}),
    }

    if (platform === "ios") primeForIosTabReuse()

    if (platform === "android" && supportsAndroidIntent()) {
      const fallbackUrl = `${window.location.origin}${apiPath("/oppsett")}`
      window.location.href = buildAndroidPrintIntent({ ...input, fallbackUrl })
    } else {
      window.location.href = buildPrintUrl(input)
    }
  }

  async function printUsb({ checkIn }: { checkIn: boolean }) {
    setError(null)
    setBusy(true)
    try {
      await printBadgeUsb(
        { name, line2 },
        { beforeSend: checkIn && onCheckIn ? onCheckIn : undefined },
      )
      setPrinted(true)
      onPrinted?.()
    } catch (caught) {
      setError(
        caught instanceof UsbPrintError
          ? caught.message
          : checkIn
            ? "Klarte ikke å sjekke inn. Prøv igjen."
            : "Klarte ikke å skrive ut. Prøv igjen.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function print({ checkIn }: { checkIn: boolean }) {
    if (currentPrintMethod() === "usb") {
      await printUsb({ checkIn })
      return
    }
    setError(null)
    setBusy(true)
    try {
      const fileBase64 = await loadTemplateBase64()
      if (checkIn && onCheckIn) await onCheckIn()
      openPrint(fileBase64)
      setPrinted(true)
      onPrinted?.()
    } catch {
      setError(
        checkIn
          ? "Klarte ikke å sjekke inn eller hente malen. Prøv igjen."
          : "Klarte ikke å hente malen. Sjekk nettverket og prøv igjen.",
      )
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (autoPrint !== true || checkedIn || alreadyPrinted || autoPrintStarted.current) return
    if (method === null) return
    // USB can only auto-print to a printer that is already open (the picker needs a tap).
    if (method === "usb" && !usbReady) return
    autoPrintStarted.current = true
    void print({ checkIn: Boolean(onCheckIn) })
    // Intentionally once per mount when autoPrint is explicitly true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, checkedIn, method, usbReady])

  return (
    <div className="flex flex-col gap-3">
      {usbMode ? (
        <UsbPrintMessage usb={usb} error={error} />
      ) : error ? (
        <p className="text-base text-[var(--color-bg-danger)]">{error}</p>
      ) : null}
      {usbMode && usbNeedsConnect(usb) ? (
        <UsbConnectButton />
      ) : (
        <Button
          size="lg"
          disabled={busy || (usbMode && usbBlocksPrint(usb))}
          onClick={() => {
            if (alreadyPrinted) setConfirmOpen(true)
            else void print({ checkIn: Boolean(onCheckIn) })
          }}
        >
          {busy ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden />
          ) : (
            <Printer className="size-5" aria-hidden />
          )}
          {busy
            ? usbMode
              ? "Skriver ut…"
              : "Henter mal…"
            : alreadyPrinted
              ? doneLabel
              : idleLabel}
        </Button>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>Skriv ut igjen?</DialogTitle>
          <DialogDescription>
            Navneskiltet er allerede skrevet ut. Vil du skrive ut en gang til?
          </DialogDescription>
          <div className="mt-6 flex flex-col gap-3">
            <Button
              size="lg"
              disabled={busy}
              onClick={() => {
                setConfirmOpen(false)
                void print({ checkIn: false })
              }}
            >
              {doneLabel}
            </Button>
            <DialogClose asChild>
              <Button variant="surface" size="lg">
                Avbryt
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
