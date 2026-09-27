"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy, Eye, EyeOff, Link2 } from "lucide-react"
import { useEffect, useId, useLayoutEffect, useState } from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import { StickerIllustration, LinkedPrinterIllustration, LoginQrUnderPrinterIllustration } from "@/components/admin/enroll-illustrations"
import { PrintStickerButton, StickerPreview } from "@/components/admin/sticker"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  stasjonCreateBodySchema,
  type Printer,
  type Stasjon,
} from "@/lib/db/schema"
import { fetchPrinters, printersQueryKey } from "@/lib/printer-queries"
import { createStasjon, stasjonerQueryKey } from "@/lib/stasjon-queries"
import {
  defaultWeekendValidityLocal,
  localDatetimeToIso,
  stasjonLoginUrl,
} from "@/lib/stasjon-client"
import { cn } from "@/lib/utils"

type FormValues = z.input<typeof stasjonCreateBodySchema>
type FormBody = z.output<typeof stasjonCreateBodySchema>

const enrollInputGroupClass =
  "h-14 rounded-xl border-0 bg-[var(--color-bg-surface)] shadow-none has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-[var(--color-fg-brand)]/40 dark:bg-[var(--color-bg-surface)]"

const enrollControlClass =
  "h-14 px-4 text-lg text-[var(--color-fg-base)] placeholder:text-[var(--color-fg-base)]/40 md:text-lg"

const steps = [
  {
    title: "Gi stasjonen navn",
    body: "F.eks. Inngang A. Navnet står på innloggingsklistremerket.",
    art: StickerIllustration,
  },
  {
    title: "Koble til printer",
    body: "Én telefon og én printer per dør. Velg printeren fra inventaret.",
    art: LinkedPrinterIllustration,
  },
  {
    title: "Lim QR under printeren",
    body: "Skriv ut etiketten og lim den under printeren. Del PIN på Slack — ikke ved QR.",
    art: LoginQrUnderPrinterIllustration,
  },
]

export function EnrollStasjon({ printers: serverPrinters }: { printers: Printer[] }) {
  const queryClient = useQueryClient()
  const [origin, setOrigin] = useState("")
  const [cacheReady, setCacheReady] = useState(false)
  const [saved, setSaved] = useState<{
    stasjon: Stasjon
    pin: string
    token: string
  } | null>(null)
  const [pinVisible, setPinVisible] = useState(false)
  const [copied, setCopied] = useState<"token" | "url" | null>(null)
  const nameId = useId()
  const fromId = useId()
  const toId = useId()
  const defaults = defaultWeekendValidityLocal()

  useLayoutEffect(() => {
    queryClient.setQueryData(printersQueryKey, serverPrinters)
    setCacheReady(true)
  }, [queryClient, serverPrinters])

  const { data: printersData } = useQuery({
    queryKey: printersQueryKey,
    queryFn: fetchPrinters,
    staleTime: 30_000,
  })
  const printers = cacheReady ? (printersData ?? serverPrinters) : serverPrinters

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues, unknown, FormBody>({
    resolver: zodResolver(stasjonCreateBodySchema),
    defaultValues: {
      name: "",
      printerId: "",
      validFrom: defaults.validFrom,
      validTo: defaults.validTo,
    },
  })

  const name = watch("name") ?? ""
  const printerId = watch("printerId") ?? ""

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const save = useMutation({
    mutationFn: async (body: FormBody) =>
      createStasjon({
        ...body,
        validFrom: localDatetimeToIso(body.validFrom),
        validTo: localDatetimeToIso(body.validTo),
      }),
    onSuccess: (result) => {
      setSaved(result)
      queryClient.setQueryData<Stasjon[]>(stasjonerQueryKey, (current) => {
        const list = current ?? []
        if (list.some((item) => item.id === result.stasjon.id)) return list
        return [result.stasjon, ...list]
      })
    },
  })

  const loginUrl = saved && origin ? stasjonLoginUrl(origin, saved.token) : ""

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="pt-2">
        <h1 className="text-4xl">Ny innsjekkstasjon</h1>
        <p className="mt-2 max-w-xl text-base opacity-70">
          Opprett stasjonen, skriv ut QR under printeren, del PIN på Slack.
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

      {saved && loginUrl ? (
        <section className="flex flex-col items-center gap-6 rounded-2xl bg-[var(--color-bg-surface)] p-6">
          <h2 className="text-2xl">{saved.stasjon.name} er klar</h2>
          <div className="w-full max-w-xs overflow-hidden rounded-2xl bg-[var(--color-bg-base)] p-2">
            <LoginQrUnderPrinterIllustration />
          </div>
          <p className="text-center text-base opacity-70">
            Skriv ut etiketten og lim den under printeren. Del PIN på Slack — ikke lim den ved QR.
          </p>

          <div className="flex w-full max-w-sm flex-col items-center gap-3">
            <p className="font-mono text-3xl tracking-[0.35em] tabular-nums">
              {pinVisible ? saved.pin : "••••••"}
            </p>
            <Button type="button" variant="surface" onClick={() => setPinVisible((v) => !v)}>
              {pinVisible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
              {pinVisible ? "Skjul PIN" : "Vis PIN"}
            </Button>
          </div>

          <StickerPreview name={saved.stasjon.name} url={loginUrl} />
          <div className="flex w-full max-w-sm flex-col gap-2 text-center">
            <p className="break-all font-mono text-sm tracking-wide">{saved.token}</p>
            <p className="break-all font-mono text-xs opacity-50">{loginUrl}</p>
          </div>

          <div className="flex w-full max-w-sm flex-col gap-2">
            <PrintStickerButton
              name={saved.stasjon.name}
              url={loginUrl}
              fallbackPath="/admin/stasjoner"
              templateFile="stasjon.lbx"
            />
            <Button
              type="button"
              variant="surface"
              size="lg"
              onClick={async () => {
                await navigator.clipboard.writeText(saved.token)
                setCopied("token")
                window.setTimeout(() => setCopied(null), 2000)
              }}
            >
              <Copy className="size-5" aria-hidden />
              {copied === "token" ? "Kode kopiert" : "Kopier kode til Slack"}
            </Button>
            <Button
              type="button"
              variant="surface"
              size="lg"
              onClick={async () => {
                await navigator.clipboard.writeText(loginUrl)
                setCopied("url")
                window.setTimeout(() => setCopied(null), 2000)
              }}
            >
              <Link2 className="size-5" aria-hidden />
              {copied === "url" ? "Lenke kopiert" : "Kopier lenke"}
            </Button>
          </div>

          <Button asChild variant="surface">
            <Link href="/admin/stasjoner">Til inventaret</Link>
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
                Navn
              </FieldLabel>
              <InputGroup className={enrollInputGroupClass}>
                <InputGroupInput
                  id={nameId}
                  {...register("name")}
                  placeholder="Inngang A"
                  aria-invalid={Boolean(errors.name)}
                  className={enrollControlClass}
                />
              </InputGroup>
              <FieldError
                className="text-[var(--color-bg-danger)]"
                errors={errors.name ? [errors.name] : undefined}
              />
            </Field>

            <Field data-invalid={Boolean(errors.printerId) || undefined}>
              <FieldLabel className="text-base text-[var(--color-fg-base)]">Printer</FieldLabel>
              {printers.length === 0 ? (
                <div className="rounded-2xl bg-[var(--color-bg-surface)] px-4 py-6 text-center">
                  <p className="text-base opacity-70">Ingen printere i inventaret.</p>
                  <Button asChild variant="surface" className="mt-3">
                    <Link href="/admin/printers/ny">Ny printer</Link>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {printers.map((printer) => (
                    <Button
                      key={printer.id}
                      type="button"
                      variant="surface"
                      className={cn(
                        "h-auto items-start justify-start whitespace-normal px-4 py-3 text-left",
                        printerId === printer.id &&
                          "ring-2 ring-[var(--color-fg-brand)] ring-offset-2 ring-offset-[var(--color-bg-base)]",
                      )}
                      onClick={() =>
                        setValue("printerId", printer.id, {
                          shouldValidate: true,
                          shouldDirty: true,
                        })
                      }
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="text-lg font-semibold">{printer.name}</span>
                        <span className="font-mono text-sm opacity-60">{printer.address}</span>
                      </span>
                    </Button>
                  ))}
                </div>
              )}
              <FieldError
                className="text-[var(--color-bg-danger)]"
                errors={errors.printerId ? [errors.printerId] : undefined}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.validFrom) || undefined}>
                <FieldLabel htmlFor={fromId} className="text-base text-[var(--color-fg-base)]">
                  Gyldig fra
                </FieldLabel>
                <InputGroup className={enrollInputGroupClass}>
                  <InputGroupInput
                    id={fromId}
                    type="datetime-local"
                    {...register("validFrom")}
                    aria-invalid={Boolean(errors.validFrom)}
                    className={enrollControlClass}
                  />
                </InputGroup>
                <FieldError
                  className="text-[var(--color-bg-danger)]"
                  errors={errors.validFrom ? [errors.validFrom] : undefined}
                />
              </Field>
              <Field data-invalid={Boolean(errors.validTo) || undefined}>
                <FieldLabel htmlFor={toId} className="text-base text-[var(--color-fg-base)]">
                  Gyldig til
                </FieldLabel>
                <InputGroup className={enrollInputGroupClass}>
                  <InputGroupInput
                    id={toId}
                    type="datetime-local"
                    {...register("validTo")}
                    aria-invalid={Boolean(errors.validTo)}
                    className={enrollControlClass}
                  />
                </InputGroup>
                <FieldDescription className="text-[var(--color-fg-base)]/60">
                  Standard er helgen (fredag–søndag).
                </FieldDescription>
                <FieldError
                  className="text-[var(--color-bg-danger)]"
                  errors={errors.validTo ? [errors.validTo] : undefined}
                />
              </Field>
            </div>

            {save.isError ? (
              <p className="text-[var(--color-bg-danger)]">Klarte ikke å opprette stasjonen.</p>
            ) : null}
            <Button type="submit" size="lg" disabled={save.isPending || printers.length === 0}>
              Opprett stasjon
            </Button>
          </FieldGroup>

          <div className="flex flex-col items-center gap-3">
            <StickerIllustration />
            <p className="text-center text-sm opacity-60">
              {name || "Navn"} · innlogging
            </p>
          </div>
        </form>
      )}
    </main>
  )
}
