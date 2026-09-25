"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Package } from "lucide-react"
import { useId, useLayoutEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import type { SmoothPrintApk } from "@/lib/db/schema"
import {
  deleteSmoothPrintApk,
  fetchSmoothPrintApks,
  setSmoothPrintApkActive,
  smoothPrintApksQueryKey,
  uploadSmoothPrintApk,
} from "@/lib/smooth-print-apk-queries"
import { cn } from "@/lib/utils"

const uploadFormSchema = z.object({
  versionLabel: z.string().trim().max(80),
  file: z.custom<File>((value) => value instanceof File, { message: "Velg en APK-fil" }),
})

type UploadFormValues = z.infer<typeof uploadFormSchema>

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function SmoothPrintInventory({ apks: serverApks }: { apks: SmoothPrintApk[] }) {
  const queryClient = useQueryClient()
  const inputId = useId()
  const [cacheReady, setCacheReady] = useState(false)
  const [dragging, setDragging] = useState(false)

  useLayoutEffect(() => {
    queryClient.setQueryData(smoothPrintApksQueryKey, serverApks)
    setCacheReady(true)
  }, [queryClient, serverApks])

  const { data } = useQuery({
    queryKey: smoothPrintApksQueryKey,
    queryFn: fetchSmoothPrintApks,
    staleTime: 30_000,
  })

  const apks = cacheReady ? (data ?? serverApks) : serverApks
  const hasActive = apks.some((apk) => apk.active)

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: { versionLabel: "", file: undefined },
  })
  const selectedFile = form.watch("file")

  const upload = useMutation({
    mutationFn: uploadSmoothPrintApk,
    onSuccess: (apk) => {
      queryClient.setQueryData<SmoothPrintApk[]>(smoothPrintApksQueryKey, (current) => {
        const list = current ?? []
        if (list.some((item) => item.id === apk.id)) return list
        return [apk, ...list]
      })
      form.reset({ versionLabel: "", file: undefined })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: smoothPrintApksQueryKey })
    },
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      setSmoothPrintApkActive(id, active),
    onMutate: async ({ id, active }) => {
      await queryClient.cancelQueries({ queryKey: smoothPrintApksQueryKey })
      const previous = queryClient.getQueryData<SmoothPrintApk[]>(smoothPrintApksQueryKey)
      queryClient.setQueryData<SmoothPrintApk[]>(smoothPrintApksQueryKey, (current) =>
        current?.map((apk) => ({
          ...apk,
          active: active ? apk.id === id : apk.id === id ? false : apk.active,
        })),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(smoothPrintApksQueryKey, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: smoothPrintApksQueryKey })
    },
  })

  const remove = useMutation({
    mutationFn: deleteSmoothPrintApk,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: smoothPrintApksQueryKey })
      const previous = queryClient.getQueryData<SmoothPrintApk[]>(smoothPrintApksQueryKey)
      queryClient.setQueryData<SmoothPrintApk[]>(smoothPrintApksQueryKey, (current) =>
        current?.filter((apk) => apk.id !== id),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(smoothPrintApksQueryKey, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: smoothPrintApksQueryKey })
    },
  })

  function takeFile(next: File | null | undefined) {
    if (!next) return
    if (!next.name.toLowerCase().endsWith(".apk")) {
      form.setError("file", { message: "Velg en .apk-fil." })
      return
    }
    form.setValue("file", next, { shouldValidate: true, shouldDirty: true })
    form.clearErrors("file")
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="pt-2">
        <h1 className="text-4xl">Smooth Print</h1>
        <p className="mt-2 max-w-xl text-base opacity-70">
          Last opp Android-APK. Én versjon kan være aktiv — da bruker /oppsett den i stedet for Brothers
          nedlastingsside.
        </p>
        <p className="mt-2 text-sm opacity-60">
          {hasActive ? "Aktiv APK er i bruk på /oppsett." : "Ingen aktiv APK — /oppsett bruker Brothers URL."}
        </p>
      </header>

      <form
        className="flex flex-col gap-4 rounded-2xl bg-[var(--color-bg-surface)] p-4"
        onSubmit={form.handleSubmit((values) => {
          upload.mutate({ file: values.file, versionLabel: values.versionLabel })
        })}
      >
        <input
          id={inputId}
          type="file"
          accept=".apk,application/vnd.android.package-archive"
          className="sr-only"
          onChange={(event) => {
            takeFile(event.target.files?.[0])
            event.target.value = ""
          }}
        />
        <label
          htmlFor={inputId}
          onDragEnter={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            if (event.currentTarget.contains(event.relatedTarget as Node)) return
            setDragging(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            takeFile(event.dataTransfer.files?.[0])
          }}
          className={cn(
            "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/20 bg-black/20 px-6 py-8 text-center transition-[border-color,background-color]",
            dragging &&
              "border-[var(--color-fg-brand)] bg-[color-mix(in_srgb,var(--color-fg-brand)_10%,transparent)]",
            selectedFile && !dragging && "border-white/30",
          )}
        >
          <span
            className={cn(
              "flex size-14 items-center justify-center rounded-2xl bg-black/30 text-[var(--color-fg-brand)]",
              dragging && "bg-[color-mix(in_srgb,var(--color-fg-brand)_18%,transparent)]",
            )}
          >
            <Package className="size-7" strokeWidth={1.75} />
          </span>
          {selectedFile ? (
            <>
              <span className="max-w-full truncate text-lg font-medium">{selectedFile.name}</span>
              <span className="text-sm opacity-60">
                {formatBytes(selectedFile.size)} · Trykk eller slipp for å bytte
              </span>
            </>
          ) : (
            <>
              <span className="text-lg font-medium">{dragging ? "Slipp filen her" : "Slipp APK her"}</span>
              <span className="text-sm opacity-60">eller trykk for å velge fil</span>
            </>
          )}
        </label>
        {form.formState.errors.file ? (
          <p className="text-[var(--color-bg-danger)]">{form.formState.errors.file.message}</p>
        ) : null}
        <label className="flex flex-col gap-2">
          Versjon (valgfritt)
          <input
            {...form.register("versionLabel")}
            placeholder="1.9.0"
            className="h-14 rounded-xl bg-black/30 px-4 text-lg"
          />
        </label>
        {upload.isError ? (
          <p className="text-[var(--color-bg-danger)]">
            {upload.error instanceof Error ? upload.error.message : "Opplasting feilet"}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={upload.isPending || !selectedFile}>
          {upload.isPending ? "Laster opp…" : "Last opp"}
        </Button>
      </form>

      {apks.length === 0 ? (
        <section className="flex flex-col items-center gap-4 rounded-2xl bg-[var(--color-bg-surface)] px-6 py-10 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-black/30 text-[var(--color-fg-brand)]">
            <Package className="size-8" strokeWidth={1.5} />
          </span>
          <h2 className="text-2xl">Ingen APK-filer</h2>
          <p className="max-w-sm text-base opacity-70">
            Last opp Smooth Print for Android, og aktiver den for nedlasting i oppsettet.
          </p>
          <Button type="button" onClick={() => document.getElementById(inputId)?.click()}>
            Velg APK
          </Button>
        </section>
      ) : (
        <ul className="flex flex-col gap-3">
          {apks.map((apk) => {
            const busy =
              (toggleActive.isPending && toggleActive.variables?.id === apk.id) ||
              (remove.isPending && remove.variables === apk.id)
            return (
              <li
                key={apk.id}
                className="flex flex-col gap-3 rounded-2xl bg-[var(--color-bg-surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl">{apk.versionLabel || apk.originalName}</h2>
                    {apk.active ? (
                      <span className="rounded-md bg-[color-mix(in_srgb,var(--color-fg-brand)_22%,transparent)] px-2 py-0.5 text-sm text-[var(--color-fg-brand)]">
                        Aktiv
                      </span>
                    ) : null}
                  </div>
                  {apk.versionLabel ? (
                    <p className="mt-1 truncate font-mono text-sm opacity-70">{apk.originalName}</p>
                  ) : null}
                  <p className="mt-1 text-sm opacity-60">
                    {formatBytes(apk.byteSize)} · {formatDate(apk.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:w-44">
                  {apk.active ? (
                    <Button
                      variant="surface"
                      disabled={busy}
                      onClick={() => toggleActive.mutate({ id: apk.id, active: false })}
                    >
                      Deaktiver
                    </Button>
                  ) : (
                    <Button
                      disabled={busy}
                      onClick={() => toggleActive.mutate({ id: apk.id, active: true })}
                    >
                      Aktiver
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => remove.mutate(apk.id)}
                  >
                    Slett
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
