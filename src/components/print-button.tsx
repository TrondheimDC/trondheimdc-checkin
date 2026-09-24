"use client"

import { LoaderCircle, Printer } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
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
  checkedIn = false,
  onCheckIn,
  idleLabel = "Skriv ut navneskilt",
  doneLabel = "Skriv ut igjen",
  onPrinted,
}: {
  name: string
  line2: string
  paperSizeId: string
  platform: PhonePlatform
  checkedIn?: boolean
  onCheckIn?: () => Promise<void>
  idleLabel?: string
  doneLabel?: string
  onPrinted?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [printed, setPrinted] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const platform = refinePlatform(platformProp)
  const alreadyPrinted = checkedIn || printed

  function openPrint(fileBase64: string) {
    const input = { fileBase64, paperSizeId, name, line2 }

    if (platform === "android" && supportsAndroidIntent()) {
      const fallbackUrl = `${window.location.origin}${apiPath("/oppsett")}`
      window.location.href = buildAndroidPrintIntent({ ...input, fallbackUrl })
    } else {
      window.location.href = buildPrintUrl(input)
    }
  }

  async function print({ checkIn }: { checkIn: boolean }) {
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

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-base text-[var(--color-bg-danger)]">{error}</p> : null}
      <Button
        size="lg"
        disabled={busy}
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
        {busy ? "Henter mal…" : alreadyPrinted ? doneLabel : idleLabel}
      </Button>

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
