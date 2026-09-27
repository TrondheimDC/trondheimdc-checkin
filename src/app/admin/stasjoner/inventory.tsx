"use client"

import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useId, useLayoutEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Copy, Eye, EyeOff, Link2, Pencil, QrCode, RefreshCw } from "lucide-react"
import type { z } from "zod"
import { StickerIllustration } from "@/components/admin/enroll-illustrations"
import { PrintStickerButton, StickerPreview } from "@/components/admin/sticker"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { isWithinValidityWindow } from "@/lib/auth-validity"
import { stasjonRenameBodySchema, type Stasjon } from "@/lib/db/schema"
import {
  fetchStasjonSecrets,
  fetchStasjoner,
  patchStasjon,
  stasjonerQueryKey,
} from "@/lib/stasjon-queries"
import { stasjonLoginUrl } from "@/lib/stasjon-client"

function formatValidity(from: string | null, to: string | null) {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("nb-NO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
  if (!from && !to) return "Ingen begrensning"
  if (from && to) return `${fmt(from)} – ${fmt(to)}`
  if (from) return `Fra ${fmt(from)}`
  return `Til ${fmt(to!)}`
}

function statusLabel(stasjon: Stasjon): { label: string; tone: "ok" | "warn" | "off" } {
  if (stasjon.banned) return { label: "Deaktivert", tone: "off" }
  if (!isWithinValidityWindow(stasjon.validFrom, stasjon.validTo)) {
    return { label: "Utenfor periode", tone: "warn" }
  }
  return { label: "Aktiv", tone: "ok" }
}

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      type="button"
      variant="surface"
      disabled={!url}
      onClick={async () => {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }}
    >
      <Link2 className="size-5" aria-hidden />
      {copied ? "Kopiert" : "Kopier lenke"}
    </Button>
  )
}

function CopyTokenButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <Button
      type="button"
      variant="surface"
      disabled={!token}
      onClick={async () => {
        await navigator.clipboard.writeText(token)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }}
    >
      <Copy className="size-5" aria-hidden />
      {copied ? "Kode kopiert" : "Kopier kode til Slack"}
    </Button>
  )
}

function RevealPin({ pin }: { pin: string }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="font-mono text-3xl tracking-[0.35em] tabular-nums">
        {visible ? pin : "••••••"}
      </p>
      <Button type="button" variant="surface" onClick={() => setVisible((v) => !v)}>
        {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        {visible ? "Skjul PIN" : "Vis PIN"}
      </Button>
    </div>
  )
}

function StasjonSecretsButton({
  id,
  name,
  origin,
  secrets,
  onLoaded,
}: {
  id: string
  name: string
  origin: string
  secrets?: { pin?: string; token?: string }
  onLoaded: (result: { pin: string; token: string }) => void
}) {
  const [open, setOpen] = useState(false)

  const load = useMutation({
    mutationFn: () => fetchStasjonSecrets(id),
    onSuccess: (result) => {
      onLoaded(result)
      setOpen(true)
    },
  })

  const loginUrl = secrets?.token && origin ? stasjonLoginUrl(origin, secrets.token) : ""

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="surface"
        disabled={load.isPending}
        onClick={() => (secrets?.token ? setOpen(true) : load.mutate())}
      >
        <QrCode className="size-5" aria-hidden />
        Vis PIN og QR
      </Button>
      {load.isError ? (
        <p className="text-sm text-[var(--color-bg-danger)]">Klarte ikke å hente PIN og QR.</p>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{name}</DialogTitle>
          <div className="mt-4 flex flex-col items-center gap-3">
            {secrets?.pin ? <RevealPin pin={secrets.pin} /> : null}
            {loginUrl ? (
              <>
                <StickerPreview name={name} url={loginUrl} />
                <PrintStickerButton
                  name={name}
                  url={loginUrl}
                  fallbackPath="/admin/stasjoner"
                  templateFile="stasjon.lbx"
                />
                {secrets?.token ? <CopyTokenButton token={secrets.token} /> : null}
                <CopyLinkButton url={loginUrl} />
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EditNameButton({
  id,
  name,
  onRenamed,
}: {
  id: string
  name: string
  onRenamed: (stasjon: Stasjon) => void
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const nameId = useId()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<
    z.input<typeof stasjonRenameBodySchema>,
    unknown,
    z.output<typeof stasjonRenameBodySchema>
  >({
    resolver: zodResolver(stasjonRenameBodySchema),
    defaultValues: { name },
  })

  const rename = useMutation({
    mutationFn: (body: { name: string }) => patchStasjon(id, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: stasjonerQueryKey })
      const previous = queryClient.getQueryData<Stasjon[]>(stasjonerQueryKey)
      queryClient.setQueryData<Stasjon[]>(stasjonerQueryKey, (current) =>
        current?.map((item) => (item.id === id ? { ...item, name: body.name } : item)),
      )
      return { previous }
    },
    onSuccess: (result) => {
      onRenamed(result.stasjon)
      setOpen(false)
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(stasjonerQueryKey, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: stasjonerQueryKey })
    },
  })

  return (
    <>
      <Button
        type="button"
        variant="surface"
        onClick={() => {
          reset({ name })
          setOpen(true)
        }}
      >
        <Pencil className="size-5" aria-hidden />
        Endre navn
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Endre navn</DialogTitle>
          <form className="mt-4" onSubmit={handleSubmit((data) => rename.mutate(data))}>
            <FieldGroup className="gap-4">
              <Field data-invalid={Boolean(errors.name) || undefined}>
                <FieldLabel htmlFor={nameId}>Navn</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id={nameId}
                    {...register("name")}
                    placeholder="Inngang A"
                    aria-invalid={Boolean(errors.name)}
                  />
                </InputGroup>
                <FieldError
                  className="text-[var(--color-bg-danger)]"
                  errors={errors.name ? [errors.name] : undefined}
                />
              </Field>
              {rename.isError ? (
                <p className="text-[var(--color-bg-danger)]">Klarte ikke å oppdatere navnet.</p>
              ) : null}
              <div className="flex flex-col gap-3">
                <Button type="submit" size="lg" disabled={rename.isPending}>
                  Lagre
                </Button>
                <DialogClose asChild>
                  <Button variant="surface" size="lg">
                    Avbryt
                  </Button>
                </DialogClose>
              </div>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function RotateCredentialsButton({
  id,
  name,
  onRotated,
}: {
  id: string
  name: string
  onRotated: (result: { pin?: string; token?: string }) => void
}) {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const rotate = useMutation({
    mutationFn: () => patchStasjon(id, { rotatePin: true, rotateToken: true }),
    onMutate: () => {
      setConfirmOpen(false)
    },
    onSuccess: (result) => {
      queryClient.setQueryData<Stasjon[]>(stasjonerQueryKey, (current) =>
        current?.map((item) => (item.id === id ? result.stasjon : item)),
      )
      onRotated({ pin: result.pin, token: result.token })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: stasjonerQueryKey })
    },
  })

  return (
    <>
      <Button
        type="button"
        variant="surface"
        disabled={rotate.isPending}
        onClick={() => setConfirmOpen(true)}
      >
        <RefreshCw className="size-5" aria-hidden />
        Roter PIN og lenke
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogTitle>Rotere PIN og lenke?</DialogTitle>
          <DialogDescription>
            Den gamle PIN-en og innloggingslenken for {name} slutter å virke. Del ny PIN på Slack
            og lim ny QR under printeren.
          </DialogDescription>
          <div className="mt-6 flex flex-col gap-3">
            <Button
              size="lg"
              disabled={rotate.isPending}
              onClick={() => rotate.mutate()}
            >
              Roter
            </Button>
            <DialogClose asChild>
              <Button variant="surface" size="lg">
                Avbryt
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function DeactivateStasjonButton({ id, name, banned }: { id: string; name: string; banned: boolean }) {
  const queryClient = useQueryClient()

  const toggle = useMutation({
    mutationFn: (nextBanned: boolean) => patchStasjon(id, { banned: nextBanned }),
    onMutate: async (nextBanned) => {
      await queryClient.cancelQueries({ queryKey: stasjonerQueryKey })
      const previous = queryClient.getQueryData<Stasjon[]>(stasjonerQueryKey)
      queryClient.setQueryData<Stasjon[]>(stasjonerQueryKey, (current) =>
        current?.map((item) => (item.id === id ? { ...item, banned: nextBanned } : item)),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(stasjonerQueryKey, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: stasjonerQueryKey })
    },
  })

  if (banned) {
    return (
      <Button
        type="button"
        variant="surface"
        disabled={toggle.isPending}
        onClick={() => toggle.mutate(false)}
      >
        Aktiver
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="text-[var(--color-bg-danger)] hover:bg-[color-mix(in_srgb,var(--color-bg-danger)_16%,transparent)] hover:text-[var(--color-bg-danger)]"
      disabled={toggle.isPending}
      onClick={() => toggle.mutate(true)}
    >
      Deaktiver {name}
    </Button>
  )
}

export function StasjonInventory({
  origin,
  stasjoner: serverStasjoner,
}: {
  origin: string
  stasjoner: Stasjon[]
}) {
  const queryClient = useQueryClient()
  const [cacheReady, setCacheReady] = useState(false)
  const [secretsById, setSecretsById] = useState<
    Record<string, { pin?: string; token?: string }>
  >({})

  useLayoutEffect(() => {
    queryClient.setQueryData(stasjonerQueryKey, serverStasjoner)
    setCacheReady(true)
  }, [queryClient, serverStasjoner])

  const { data } = useQuery({
    queryKey: stasjonerQueryKey,
    queryFn: fetchStasjoner,
    staleTime: 30_000,
  })

  const stasjoner = cacheReady ? (data ?? serverStasjoner) : serverStasjoner

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="flex flex-wrap items-end justify-between gap-3 pt-2">
        <div>
          <h1 className="text-4xl">Innsjekkstasjoner</h1>
          <p className="mt-2 max-w-xl text-base opacity-70">
            Én stasjon per dør: printer, QR under printeren, PIN på Slack.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/stasjoner/ny">Ny innsjekkstasjon</Link>
        </Button>
      </header>

      {stasjoner.length === 0 ? (
        <section className="flex flex-col items-center gap-4 rounded-2xl bg-[var(--color-bg-surface)] px-6 py-10 text-center">
          <div className="w-full max-w-xs">
            <StickerIllustration />
          </div>
          <h2 className="text-2xl">Ingen innsjekkstasjoner</h2>
          <p className="max-w-sm text-base opacity-70">
            Opprett en stasjon, lim innloggings-QR under printeren.
          </p>
          <Button asChild>
            <Link href="/admin/stasjoner/ny">Ny innsjekkstasjon</Link>
          </Button>
        </section>
      ) : (
        <ul className="flex flex-col gap-4">
          {stasjoner.map((stasjon) => {
            const status = statusLabel(stasjon)
            const secrets = secretsById[stasjon.id]

            return (
              <li
                key={stasjon.id}
                className="flex flex-col gap-4 rounded-2xl bg-[var(--color-bg-surface)] p-4"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl">{stasjon.name}</h2>
                    <span
                      className={
                        status.tone === "ok"
                          ? "rounded-lg bg-[color-mix(in_srgb,var(--color-fg-brand)_22%,transparent)] px-2 py-0.5 text-sm"
                          : status.tone === "warn"
                            ? "rounded-lg bg-white/10 px-2 py-0.5 text-sm opacity-80"
                            : "rounded-lg bg-[color-mix(in_srgb,var(--color-bg-danger)_22%,transparent)] px-2 py-0.5 text-sm"
                      }
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="text-base opacity-70">
                    Printer: {stasjon.printerName ?? "Ikke valgt"}
                  </p>
                  <p className="text-sm opacity-70">
                    {formatValidity(stasjon.validFrom, stasjon.validTo)}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <StasjonSecretsButton
                    id={stasjon.id}
                    name={stasjon.name}
                    origin={origin}
                    secrets={secrets}
                    onLoaded={(result) =>
                      setSecretsById((current) => ({ ...current, [stasjon.id]: result }))
                    }
                  />
                  <EditNameButton
                    id={stasjon.id}
                    name={stasjon.name}
                    onRenamed={(updated) =>
                      queryClient.setQueryData<Stasjon[]>(stasjonerQueryKey, (current) =>
                        current?.map((item) => (item.id === updated.id ? updated : item)),
                      )
                    }
                  />
                  <RotateCredentialsButton
                    id={stasjon.id}
                    name={stasjon.name}
                    onRotated={(result) =>
                      setSecretsById((current) => ({ ...current, [stasjon.id]: result }))
                    }
                  />
                  <DeactivateStasjonButton
                    id={stasjon.id}
                    name={stasjon.name}
                    banned={Boolean(stasjon.banned)}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
