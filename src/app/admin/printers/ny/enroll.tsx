"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import {
  MacMenuIllustration,
  SerialIllustration,
  StickerIllustration,
} from "@/components/admin/enroll-illustrations"
import { PrintStickerButton, StickerPreview } from "@/components/admin/sticker"
import { Button } from "@/components/ui/button"
import { printerBodySchema, printerResponseSchema, type Printer } from "@/lib/db/schema"
import { printersQueryKey } from "@/lib/printer-queries"
import { printerSetupPath } from "@/lib/printer-setup"
import { DEFAULT_PRINTER_MODEL } from "@/lib/print-url"
import { apiPath } from "@/lib/utils"

type PrinterFormValues = z.input<typeof printerBodySchema>
type PrinterBody = z.output<typeof printerBodySchema>

const steps = [
  {
    title: "Les av Bluetooth-adressen",
    body: "Menu → Bluetooth → Bluetooth Status. Address er MAC-en. Ikke bruk adressen under WLAN.",
    art: MacMenuIllustration,
  },
  {
    title: "Finn serienummeret",
    body: "Det står på etiketten inni lokket, ved DK-rullen. iOS trenger det for Bluetooth-tilkobling.",
    art: SerialIllustration,
  },
  {
    title: "Skriv ut og lim på",
    body: "Navnet kommer over QR-koden på samme DK-11208-etikett. Lim den på printeren.",
    art: StickerIllustration,
  },
]

const fieldClass = "h-14 rounded-xl bg-[var(--color-bg-surface)] px-4 text-lg"
const monoFieldClass = `${fieldClass} font-mono`

export function EnrollPrinter() {
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState<Printer | null>(null)
  const [origin, setOrigin] = useState("")

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PrinterFormValues, unknown, PrinterBody>({
    resolver: zodResolver(printerBodySchema),
    defaultValues: {
      name: "",
      address: "",
      serial: "",
      model: DEFAULT_PRINTER_MODEL,
      connectType: "BT",
    },
  })

  const name = watch("name") ?? ""
  const address = watch("address") ?? ""
  const serial = watch("serial") ?? ""
  const model = watch("model") ?? DEFAULT_PRINTER_MODEL

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const save = useMutation({
    mutationFn: async (body: PrinterBody) => {
      const response = await fetch(apiPath("/api/printers"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error("save failed")
      return printerResponseSchema.parse(await response.json()).printer
    },
    onSuccess: (printer) => {
      setSaved(printer)
      queryClient.setQueryData<Printer[]>(printersQueryKey, (current) => {
        const list = current ?? []
        if (list.some((item) => item.id === printer.id)) return list
        return [...list, printer]
      })
    },
  })

  const previewPath = printerSetupPath({
    address: address || "00:00:00:00:00:00",
    serial,
    model,
    connectType: "BT",
  })
  const previewUrl = origin ? `${origin}${apiPath(previewPath)}` : previewPath
  const savedUrl = saved && origin ? `${origin}${apiPath(printerSetupPath(saved))}` : ""

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="pt-2">
        <h1 className="text-4xl">Ny printer</h1>
        <p className="mt-2 max-w-xl text-base opacity-70">
          Tre steg: les av printeren, lagre den, skriv ut klistremerket.
        </p>
      </header>

      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-2xl bg-[var(--color-bg-surface)] p-3">
            <step.art />
            <p className="mt-2 font-mono text-xs text-[var(--color-fg-brand)]">0{index + 1}</p>
            <h2 className="mt-1 text-xl">{step.title}</h2>
            <p className="mt-1 text-sm leading-snug opacity-70">{step.body}</p>
          </li>
        ))}
      </ol>

      {saved && savedUrl ? (
        <section className="flex flex-col items-center gap-4 rounded-2xl bg-[var(--color-bg-surface)] p-6">
          <h2 className="text-2xl">{saved.name} er lagret</h2>
          <StickerPreview name={saved.name} url={savedUrl} />
          <div className="w-full max-w-sm">
            <PrintStickerButton name={saved.name} url={savedUrl} />
          </div>
          <Button asChild variant="surface">
            <Link href="/admin/printers">Til inventaret</Link>
          </Button>
        </section>
      ) : (
        <form
          className="grid gap-6 md:grid-cols-[1fr_11rem]"
          onSubmit={handleSubmit((data) => save.mutate(data))}
        >
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              Navn på printeren
              <input
                {...register("name")}
                placeholder="Dør 1"
                aria-invalid={Boolean(errors.name)}
                className={fieldClass}
              />
              {errors.name ? (
                <p className="text-sm text-[var(--color-bg-danger)]">{errors.name.message}</p>
              ) : null}
            </label>
            <label className="flex flex-col gap-2">
              Bluetooth-MAC
              <input
                {...register("address")}
                placeholder="00:1B:A9:00:00:00"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={Boolean(errors.address)}
                className={monoFieldClass}
              />
              {errors.address ? (
                <p className="text-sm text-[var(--color-bg-danger)]">{errors.address.message}</p>
              ) : null}
            </label>
            <label className="flex flex-col gap-2">
              Serienummer
              <input
                {...register("serial")}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={Boolean(errors.serial)}
                className={monoFieldClass}
              />
              {errors.serial ? (
                <p className="text-sm text-[var(--color-bg-danger)]">{errors.serial.message}</p>
              ) : null}
            </label>
            <label className="flex flex-col gap-2">
              Modell
              <input
                {...register("model")}
                aria-invalid={Boolean(errors.model)}
                className={monoFieldClass}
              />
              {errors.model ? (
                <p className="text-sm text-[var(--color-bg-danger)]">{errors.model.message}</p>
              ) : null}
            </label>
            {save.isError ? (
              <p className="text-[var(--color-bg-danger)]">Klarte ikke å lagre printeren.</p>
            ) : null}
            <Button type="submit" size="lg" disabled={save.isPending}>
              Lagre i inventaret
            </Button>
          </div>
          <StickerPreview name={name} url={previewUrl} />
        </form>
      )}
    </main>
  )
}
