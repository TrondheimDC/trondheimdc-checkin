"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useId, useState } from "react"
import type { ChangeEvent } from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import {
  MacMenuIllustration,
  SerialIllustration,
  StickerIllustration,
} from "@/components/admin/enroll-illustrations"
import { PrinterModelOption } from "@/components/admin/printer-model"
import { SerialScanButton } from "@/components/admin/serial-scan"
import { PrintStickerButton, StickerPreview } from "@/components/admin/sticker"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group"
import { printerBodySchema, printerResponseSchema, type Printer } from "@/lib/db/schema"
import { printersQueryKey } from "@/lib/printer-queries"
import { printerSetupPath } from "@/lib/printer-setup"
import {
  formatBluetoothMac,
  formatMacInput,
  isCompleteBluetoothMac,
  macBackspace,
  macDelete,
  normalizePrinterSerial,
} from "@/lib/printer-format"
import {
  DEFAULT_PRINTER_MODEL,
  PRINTER_MODELS,
  type PrinterModelId,
} from "@/lib/printer-models"
import { apiPath, cn } from "@/lib/utils"

type PrinterFormValues = z.input<typeof printerBodySchema>
type PrinterBody = z.output<typeof printerBodySchema>

const steps = [
  {
    title: "Les av Bluetooth-adressen",
    body: "Menu → Bluetooth → Bluetooth Status. Address er MAC-en. Ikke bruk adressen under WLAN.",
    art: MacMenuIllustration,
  },
  {
    title: "Skann serienummeret",
    body: "Strekkoden står på etiketten inni lokket, ved DK-rullen. iOS trenger serienummeret for Bluetooth.",
    art: SerialIllustration,
  },
  {
    title: "Skriv ut og lim på",
    body: "Navnet kommer over QR-koden på samme DK-11208-etikett. Lim den på printeren.",
    art: StickerIllustration,
  },
]

const enrollInputGroupClass =
  "h-14 rounded-xl border-0 bg-[var(--color-bg-surface)] shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-[var(--color-fg-brand)]/40 dark:bg-[var(--color-bg-surface)]"

const enrollControlClass =
  "h-14 px-4 text-lg text-[var(--color-fg-base)] placeholder:text-[var(--color-fg-base)]/40 md:text-lg"

const enrollMonoControlClass = `${enrollControlClass} font-mono uppercase`

function upperOnChange(registerOnChange: (event: ChangeEvent<HTMLInputElement>) => void) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    event.target.value = event.target.value.toUpperCase()
    registerOnChange(event)
  }
}

function commitMac(input: HTMLInputElement, next: { value: string; caret: number }, notify: () => void) {
  input.value = next.value
  input.setSelectionRange(next.caret, next.caret)
  notify()
  const caret = next.caret
  requestAnimationFrame(() => {
    if (input.value === next.value) input.setSelectionRange(caret, caret)
  })
}

export function EnrollPrinter() {
  const queryClient = useQueryClient()
  const [saved, setSaved] = useState<Printer | null>(null)
  const [origin, setOrigin] = useState("")
  const nameId = useId()
  const addressId = useId()
  const serialId = useId()

  const {
    register,
    handleSubmit,
    setValue,
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
  const model = (watch("model") ?? DEFAULT_PRINTER_MODEL) as PrinterModelId

  const addressField = register("address")
  const serialField = register("serial")

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

  const mac = formatBluetoothMac(address)
  const previewPath = printerSetupPath({
    address: isCompleteBluetoothMac(mac) ? mac : "00:00:00:00:00:00",
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
          <FieldGroup className="gap-4">
            <Field data-invalid={Boolean(errors.name) || undefined}>
              <FieldLabel htmlFor={nameId} className="text-base text-[var(--color-fg-base)]">
                Navn på printeren
              </FieldLabel>
              <InputGroup className={enrollInputGroupClass}>
                <InputGroupInput
                  id={nameId}
                  {...register("name")}
                  placeholder="Dør 1"
                  aria-invalid={Boolean(errors.name)}
                  className={enrollControlClass}
                />
              </InputGroup>
              <FieldError
                className="text-[var(--color-bg-danger)]"
                errors={errors.name ? [errors.name] : undefined}
              />
            </Field>

            <Field data-invalid={Boolean(errors.address) || undefined}>
              <FieldLabel htmlFor={addressId} className="text-base text-[var(--color-fg-base)]">
                Bluetooth-MAC
              </FieldLabel>
              <InputGroup className={enrollInputGroupClass}>
                <InputGroupInput
                  id={addressId}
                  {...addressField}
                  placeholder="00:1B:A9:00:00:00"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={Boolean(errors.address)}
                  className={enrollMonoControlClass}
                  onChange={(event) => {
                    const input = event.target
                    const next = formatMacInput(input.value, input.selectionStart ?? input.value.length)
                    commitMac(input, next, () => addressField.onChange(event))
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Backspace" && event.key !== "Delete") return
                    const input = event.currentTarget
                    const start = input.selectionStart ?? 0
                    const end = input.selectionEnd ?? 0
                    if (start !== end) return
                    const next =
                      event.key === "Backspace" ? macBackspace(input.value, start) : macDelete(input.value, start)
                    if (!next) return
                    event.preventDefault()
                    commitMac(input, next, () => addressField.onChange(event))
                  }}
                  onBeforeInput={(event) => {
                    const inputType = (event.nativeEvent as InputEvent).inputType
                    if (inputType !== "deleteContentBackward" && inputType !== "deleteContentForward") return
                    const input = event.currentTarget
                    const start = input.selectionStart ?? 0
                    if ((input.selectionEnd ?? 0) !== start) return
                    const next =
                      inputType === "deleteContentBackward"
                        ? macBackspace(input.value, start)
                        : macDelete(input.value, start)
                    if (!next) return
                    event.preventDefault()
                    commitMac(input, next, () => addressField.onChange(event))
                  }}
                  onBlur={(event) => {
                    event.target.value = formatBluetoothMac(event.target.value)
                    addressField.onChange(event)
                    void addressField.onBlur(event)
                  }}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText
                    className={cn(
                      "font-mono text-xs tabular-nums",
                      isCompleteBluetoothMac(mac)
                        ? "text-[var(--color-fg-brand)]"
                        : "text-[var(--color-fg-base)]/40",
                    )}
                  >
                    {mac.replace(/:/g, "").length}/12
                  </InputGroupText>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription className="text-[var(--color-fg-base)]/60">
                Kolon fylles inn automatisk. Lim gjerne hele linjen fra displayet.
              </FieldDescription>
              <FieldError
                className="text-[var(--color-bg-danger)]"
                errors={errors.address ? [errors.address] : undefined}
              />
            </Field>

            <Field data-invalid={Boolean(errors.serial) || undefined}>
              <FieldLabel htmlFor={serialId} className="text-base text-[var(--color-fg-base)]">
                Serienummer
              </FieldLabel>
              <InputGroup className={enrollInputGroupClass}>
                <InputGroupInput
                  id={serialId}
                  {...serialField}
                  onChange={upperOnChange(serialField.onChange)}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={Boolean(errors.serial)}
                  className={enrollMonoControlClass}
                />
                <InputGroupAddon align="inline-end">
                  <SerialScanButton
                    onScan={(value) => {
                      setValue("serial", normalizePrinterSerial(value), {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }}
                  />
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription className="text-[var(--color-fg-base)]/60">
                Skriv inn, eller skann strekkoden inni lokket.
              </FieldDescription>
              <FieldError
                className="text-[var(--color-bg-danger)]"
                errors={errors.serial ? [errors.serial] : undefined}
              />
            </Field>

            <Field data-invalid={Boolean(errors.model) || undefined}>
              <FieldLabel className="text-base text-[var(--color-fg-base)]">Modell</FieldLabel>
              <div className="flex flex-col gap-2">
                {Object.values(PRINTER_MODELS).map((option) => (
                  <PrinterModelOption
                    key={option.id}
                    model={option}
                    selected={model === option.id}
                    onSelect={() =>
                      setValue("model", option.id, { shouldValidate: true, shouldDirty: true })
                    }
                  />
                ))}
              </div>
              <FieldError
                className="text-[var(--color-bg-danger)]"
                errors={errors.model ? [errors.model] : undefined}
              />
            </Field>

            {save.isError ? (
              <p className="text-[var(--color-bg-danger)]">Klarte ikke å lagre printeren.</p>
            ) : null}
            <Button type="submit" size="lg" disabled={save.isPending}>
              Lagre i inventaret
            </Button>
          </FieldGroup>
          <StickerPreview name={name} url={previewUrl} />
        </form>
      )}
    </main>
  )
}
