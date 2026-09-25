"use client"

import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useLayoutEffect, useState } from "react"
import { StickerIllustration } from "@/components/admin/enroll-illustrations"
import { PrinterModelMeta, PrinterModelThumb } from "@/components/admin/printer-model"
import { PrintStickerButton, ShowStickerQrButton } from "@/components/admin/sticker"
import { RemovePrinterButton } from "@/components/admin/remove-printer"
import { Button } from "@/components/ui/button"
import type { Printer } from "@/lib/db/schema"
import { fetchPrinters, printersQueryKey } from "@/lib/printer-queries"
import { printerSetupPath } from "@/lib/printer-setup"
import { apiPath } from "@/lib/utils"

export function PrinterInventory({
  origin,
  printers: serverPrinters,
}: {
  origin: string
  printers: Printer[]
}) {
  const queryClient = useQueryClient()
  const [cacheReady, setCacheReady] = useState(false)

  useLayoutEffect(() => {
    queryClient.setQueryData(printersQueryKey, serverPrinters)
    setCacheReady(true)
  }, [queryClient, serverPrinters])

  const { data } = useQuery({
    queryKey: printersQueryKey,
    queryFn: fetchPrinters,
    staleTime: 30_000,
  })

  const printers = cacheReady ? (data ?? serverPrinters) : serverPrinters

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-4xl">Printere</h1>
          <p className="mt-2 max-w-xl text-base opacity-70">
            Klistremerker til QL-printerne. Skann QR-koden for å koble telefonen i Smooth Print.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/printers/ny">Ny printer</Link>
        </Button>
      </header>

      {printers.length === 0 ? (
        <section className="flex flex-col items-center gap-4 rounded-2xl bg-[var(--color-bg-surface)] px-6 py-10 text-center">
          <div className="w-full max-w-xs">
            <StickerIllustration />
          </div>
          <h2 className="text-2xl">Ingen printere</h2>
          <p className="max-w-sm text-base opacity-70">Legg inn en printer og skriv ut klistremerket.</p>
        </section>
      ) : (
        <ul className="flex flex-col gap-4">
          {printers.map((printer) => {
            const url = `${origin}${apiPath(printerSetupPath(printer))}`
            return (
              <li
                key={printer.id}
                className="flex flex-col gap-4 rounded-2xl bg-[var(--color-bg-surface)] p-4"
              >
                <div className="flex gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <h2 className="text-2xl">{printer.name}</h2>
                    <PrinterModelMeta modelId={printer.model} />
                    <p className="font-mono text-sm break-all opacity-70">
                      {printer.connectType === "WiFi" ? "IP" : "MAC"} {printer.address}
                    </p>
                    {printer.serial ? (
                      <p className="font-mono text-sm break-all opacity-70">SN {printer.serial}</p>
                    ) : null}
                  </div>
                  <PrinterModelThumb modelId={printer.model} size="lg" className="self-start" />
                </div>
                <div className="flex flex-col gap-2">
                  <PrintStickerButton name={printer.name} url={url} />
                  <ShowStickerQrButton name={printer.name} url={url} />
                  <RemovePrinterButton id={printer.id} name={printer.name} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
