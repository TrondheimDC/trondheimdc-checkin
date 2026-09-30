"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { LoaderCircle, Printer } from "lucide-react"
import { useId, useState } from "react"
import { useForm } from "react-hook-form"
import { BadgePreview } from "@/components/badge-preview"
import { Button } from "@/components/ui/button"
import {
  UsbConnectButton,
  UsbPrintMessage,
  usbBlocksPrint,
  usbNeedsConnect,
} from "@/components/usb-connect"
import { platformFromNavigator, supportsAndroidIntent } from "@/lib/platform"
import { currentPrintMethod, type PrintMethod, usePrintMethod } from "@/lib/print-method"
import {
  getPrintSample,
  PRINT_SAMPLES,
  type TestPrintFormValues,
  testPrintFormSchema,
} from "@/lib/print-samples"
import {
  buildAndroidPrintIntent,
  buildPrintUrl,
  DEFAULT_PAPER_SIZE_ID,
  loadTemplateBase64,
} from "@/lib/print-url"
import { printBadgeUsb, UsbPrintError, useUsbPrinter } from "@/lib/usb-printer"
import { apiPath, cn } from "@/lib/utils"

const fieldClass =
  "h-12 w-full rounded-xl border border-white/15 bg-[var(--color-bg-base)] px-4 text-base text-[var(--color-fg-base)] outline-none focus-visible:border-[var(--color-fg-brand)] focus-visible:ring-2 focus-visible:ring-[var(--color-fg-brand)]/40"

export function TestPrintForm({ initialPrintMethod }: { initialPrintMethod: PrintMethod }) {
  const sampleIdField = useId()
  const nameId = useId()
  const line2Id = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const usbMode = usePrintMethod(initialPrintMethod) === "usb"
  const usb = useUsbPrinter()

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TestPrintFormValues>({
    resolver: zodResolver(testPrintFormSchema),
    defaultValues: {
      sampleId: "badge",
      name: "Test Testesen",
      line2: "TDC",
    },
  })

  const sampleId = watch("sampleId")
  const name = watch("name")
  const line2 = watch("line2")
  const sample = getPrintSample(sampleId) ?? PRINT_SAMPLES[0]!

  async function onSubmit(values: TestPrintFormValues) {
    const chosen = getPrintSample(values.sampleId)
    if (!chosen) return

    setError(null)
    setBusy(true)
    if (currentPrintMethod() === "usb") {
      try {
        await printBadgeUsb({ name: values.name, line2: values.line2, template: chosen.template })
      } catch (caught) {
        setError(caught instanceof UsbPrintError ? caught.message : "Klarte ikke å skrive ut.")
      } finally {
        setBusy(false)
      }
      return
    }
    try {
      const fileBase64 = await loadTemplateBase64(chosen.template)
      const input = {
        fileBase64,
        paperSizeId: DEFAULT_PAPER_SIZE_ID,
        name: values.name,
        line2: values.line2,
      }
      const platform = platformFromNavigator()
      if (platform === "android" && supportsAndroidIntent()) {
        const fallbackUrl = `${window.location.origin}${apiPath("/admin/testutskrift")}`
        window.location.href = buildAndroidPrintIntent({ ...input, fallbackUrl })
      } else {
        window.location.href = buildPrintUrl(input)
      }
    } catch {
      setError("Klarte ikke å hente malen. Sjekk nettverket og prøv igjen.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event)
      }}
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={sampleIdField} className="text-sm font-medium opacity-80">
          Prøve
        </label>
        <div className="relative">
          <select
            id={sampleIdField}
            className={cn(fieldClass, "appearance-none pr-10")}
            {...register("sampleId")}
          >
            {PRINT_SAMPLES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <span
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm opacity-50"
            aria-hidden
          >
            ▾
          </span>
        </div>
        {errors.sampleId ? (
          <p className="text-sm text-[var(--color-bg-danger)]">{errors.sampleId.message}</p>
        ) : null}
      </div>

      <div className="flex min-h-[9.5rem] flex-col items-center justify-center gap-3 rounded-2xl bg-[var(--color-bg-surface)] px-6 py-6 text-center">
        {usbMode ? (
          <BadgePreview name={name} line2={line2} template={sample.template} />
        ) : sample.preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- static badge preview asset
          <img
            src={apiPath(sample.preview)}
            alt=""
            width={96}
            height={96}
            className="size-24 bg-white"
            style={{ imageRendering: "pixelated" }}
          />
        ) : (
          <div className="flex size-24 items-center justify-center rounded-xl border border-dashed border-white/20 text-sm opacity-50">
            Kun tekst
          </div>
        )}
        <div className="max-w-sm">
          <p className="text-lg font-medium">{sample.label}</p>
          <p className="mt-1 text-sm opacity-70">{sample.description}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={nameId} className="text-sm font-medium opacity-80">
            Navn
          </label>
          <input id={nameId} className={fieldClass} autoComplete="off" {...register("name")} />
          {errors.name ? (
            <p className="text-sm text-[var(--color-bg-danger)]">{errors.name.message}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={line2Id} className="text-sm font-medium opacity-80">
            Linje 2
          </label>
          <input id={line2Id} className={fieldClass} autoComplete="off" {...register("line2")} />
        </div>
      </div>

      {usbMode ? (
        <UsbPrintMessage usb={usb} error={error} />
      ) : error ? (
        <p className="text-base text-[var(--color-bg-danger)]">{error}</p>
      ) : null}

      {usbMode && usbNeedsConnect(usb) ? (
        <UsbConnectButton />
      ) : (
        <Button type="submit" size="lg" disabled={busy || (usbMode && usbBlocksPrint(usb))}>
          {busy ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden />
          ) : (
            <Printer className="size-5" aria-hidden />
          )}
          {busy ? (usbMode ? "Skriver ut…" : "Henter mal…") : "Skriv ut prøve"}
        </Button>
      )}
    </form>
  )
}
