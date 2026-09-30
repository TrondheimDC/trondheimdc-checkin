"use client"

import { useState } from "react"
import { ScanCamera } from "@/components/scan-camera"
import {
  type PrinterSetupParams,
  type PrinterSticker,
  parsePrinterSetupUrl,
  printerSetupResponseSchema,
} from "@/lib/printer-setup"
import { apiPath } from "@/lib/utils"

async function fetchPrinterSetup(printerId: string): Promise<PrinterSetupParams | null> {
  const response = await fetch(apiPath(`/api/oppsett/printer/${encodeURIComponent(printerId)}`))
  if (!response.ok) return null
  const parsed = printerSetupResponseSchema.safeParse(await response.json())
  return parsed.success ? parsed.data.printer : null
}

export function SetupQrScan({ onFound }: { onFound: (printer: PrinterSetupParams) => void }) {
  // Remount the camera after a failed lookup; it stops scanning once it finds a code.
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function onSticker(sticker: PrinterSticker) {
    if ("params" in sticker) {
      onFound(sticker.params)
      return
    }
    setError(null)
    const printer = await fetchPrinterSetup(sticker.printerId).catch(() => null)
    if (printer) {
      onFound(printer)
      return
    }
    setError("Fant ikke printeren. Sjekk at den ligger i inventaret, og skann på nytt.")
    setAttempt((value) => value + 1)
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <ScanCamera
        key={attempt}
        mode="qr"
        parse={parsePrinterSetupUrl}
        onFound={(sticker) => void onSticker(sticker)}
        invalidMessage="Det er ikke en printer-QR. Skann klistremerket på printeren."
        cameraError="Ingen tilgang til kamera. Tillat kamera, eller velg manuelt oppsett."
        hint="Skann klistremerket på printeren"
      />
      {error ? <p className="text-base text-[var(--color-bg-danger)]">{error}</p> : null}
    </div>
  )
}
