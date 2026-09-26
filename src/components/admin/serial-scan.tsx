"use client"

import { ScanBarcode } from "lucide-react"
import { useState } from "react"
import { ScanCamera } from "@/components/scan-camera"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { InputGroupButton } from "@/components/ui/input-group"
import { normalizePrinterSerial } from "@/lib/printer-format"

/** Icon button for InputGroupAddon — opens strekkode-skanning. */
export function SerialScanButton({ onScan }: { onScan: (serial: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <InputGroupButton
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Skann strekkode"
        className="size-10 rounded-lg text-[var(--color-fg-base)] opacity-70 hover:bg-black/10 hover:opacity-100"
        onClick={() => setOpen(true)}
      >
        <ScanBarcode className="size-5" aria-hidden />
      </InputGroupButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex w-[min(100%-1.5rem,28rem)] max-w-none flex-col p-4">
          <DialogTitle>Skann serienummer</DialogTitle>
          <DialogDescription>
            Strekkoden står vanligvis på etiketten inni lokket, ved DK-rullen.
          </DialogDescription>
          <div className="mt-4 flex min-h-0 justify-center">
            {open ? (
              <ScanCamera
                mode="multi"
                aspectClassName="aspect-[4/3] h-[min(55dvh,22rem)] w-auto max-w-full"
                parse={(raw) => {
                  const serial = normalizePrinterSerial(raw)
                  return serial || null
                }}
                onFound={(serial) => {
                  onScan(serial)
                  setOpen(false)
                }}
                invalidMessage="Tom strekkode. Prøv igjen."
                cameraError="Ingen tilgang til kamera. Skriv inn serienummeret manuelt."
                hint="Pek på strekkoden på printeren"
              />
            ) : null}
          </div>
          <DialogClose asChild>
            <Button type="button" variant="surface" size="lg" className="mt-4 w-full">
              Avbryt
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </>
  )
}
