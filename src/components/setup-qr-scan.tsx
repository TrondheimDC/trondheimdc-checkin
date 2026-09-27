"use client"

import { ScanCamera } from "@/components/scan-camera"
import { parsePrinterSetupUrl, type PrinterSetupParams } from "@/lib/printer-setup"

export function SetupQrScan({ onFound }: { onFound: (printer: PrinterSetupParams) => void }) {
  return (
    <ScanCamera
      mode="qr"
      parse={parsePrinterSetupUrl}
      onFound={onFound}
      invalidMessage="Det er ikke en printer-QR. Skann klistremerket på printeren."
      cameraError="Ingen tilgang til kamera. Tillat kamera, eller velg manuelt oppsett."
      hint="Skann klistremerket på printeren"
    />
  )
}
