"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Package } from "lucide-react"
import { useLayoutEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { FileDropzone } from "@/components/admin/file-dropzone"
import { RemoveSmoothPrintApkButton } from "@/components/admin/remove-smooth-print-apk"
import { Button } from "@/components/ui/button"
import { smoothPrintApkUploadSchema, type SmoothPrintApk } from "@/lib/db/schema"
import { DEFAULT_SMOOTH_PRINT_ANDROID_URL } from "@/lib/smooth-print-apks"
import {
  fetchSmoothPrintApks,
  setSmoothPrintApkActive,
  smoothPrintApksQueryKey,
  uploadSmoothPrintApk,
} from "@/lib/smooth-print-apk-queries"
import { formatBytes } from "@/lib/utils"

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
  const [cacheReady, setCacheReady] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [uploadingName, setUploadingName] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ loaded: number; total: number; percent: number } | null>(
    null,
  )

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

  const form = useForm({
    resolver: zodResolver(smoothPrintApkUploadSchema),
    defaultValues: { versionLabel: "" },
  })

  const upload = useMutation({
    mutationFn: ({ file, versionLabel }: { file: File; versionLabel: string }) =>
      uploadSmoothPrintApk({
        file,
        versionLabel,
        onProgress: setProgress,
      }),
    onSuccess: (apk) => {
      queryClient.setQueryData<SmoothPrintApk[]>(smoothPrintApksQueryKey, (current) => {
        const list = current ?? []
        if (list.some((item) => item.id === apk.id)) return list
        return [apk, ...list]
      })
      form.reset({ versionLabel: "" })
      setFileError(null)
    },
    onSettled: () => {
      setUploadingName(null)
      setProgress(null)
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

  function takeFile(next: File) {
    if (upload.isPending) return
    const lower = next.name.toLowerCase()
    if (!lower.endsWith(".apk") && !lower.endsWith(".zip")) {
      setFileError("Velg en .apk- eller .zip-fil.")
      return
    }
    setFileError(null)
    setUploadingName(next.name)
    setProgress({ loaded: 0, total: next.size, percent: 0 })
    const versionLabel = smoothPrintApkUploadSchema.parse({
      versionLabel: form.getValues("versionLabel"),
    }).versionLabel
    upload.mutate({ file: next, versionLabel })
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="pt-2">
        <h1 className="text-4xl">Smooth Print</h1>
        <p className="mt-2 max-w-xl text-base opacity-70">
          Last opp Android-APK (eller zip med én APK — pakkes ut på serveren). Én versjon kan være aktiv —
          da bruker /oppsett den i stedet for Brothers nedlastingsside.{" "}
          <a
            href={DEFAULT_SMOOTH_PRINT_ANDROID_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-100"
          >
            Hent APK fra Brother
          </a>
          .
        </p>
        <p className="mt-2 text-sm opacity-60">
          {hasActive ? "Aktiv APK er i bruk på /oppsett." : "Ingen aktiv APK — /oppsett bruker Brothers URL."}
        </p>
      </header>

      <div className="flex flex-col gap-4 rounded-2xl bg-[var(--color-bg-surface)] p-4">
        <label className="flex flex-col gap-2">
          Versjon (valgfritt)
          <input
            {...form.register("versionLabel")}
            placeholder="1.9.0"
            disabled={upload.isPending}
            className="h-14 rounded-xl bg-black/30 px-4 text-lg"
          />
        </label>
        <FileDropzone
          accept=".apk,.zip,application/vnd.android.package-archive,application/zip"
          emptyLabel="Slipp APK eller zip her"
          icon={<Package className="size-7" strokeWidth={1.75} />}
          onFile={takeFile}
          busy={upload.isPending}
          className="bg-black/20"
          busyContent={
            <div className="flex w-full max-w-sm flex-col items-center gap-3">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-black/30 text-[var(--color-fg-brand)]">
                <Package className="size-7" strokeWidth={1.75} />
              </span>
              <span className="max-w-full truncate text-lg font-medium">{uploadingName ?? "APK"}</span>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-black/40"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress?.percent ?? 0}
                aria-label="Opplastingsfremdrift"
              >
                <div
                  className="h-full rounded-full bg-[var(--color-fg-brand)] transition-[width] duration-150"
                  style={{ width: `${progress?.percent ?? 0}%` }}
                />
              </div>
              <span className="text-sm opacity-70">
                {progress && progress.percent < 100
                  ? `${progress.percent}% · ${formatBytes(progress.loaded)} av ${formatBytes(progress.total)}`
                  : progress?.percent === 100
                    ? "Pakker ut og lagrer…"
                    : "Starter…"}
              </span>
            </div>
          }
        />
        {fileError ? <p className="text-[var(--color-bg-danger)]">{fileError}</p> : null}
        {upload.isError ? (
          <p className="text-[var(--color-bg-danger)]">
            {upload.error instanceof Error ? upload.error.message : "Opplasting feilet"}
          </p>
        ) : null}
      </div>

      {apks.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {apks.map((apk) => {
            const label = apk.versionLabel || apk.originalName
            const busy = toggleActive.isPending && toggleActive.variables?.id === apk.id
            return (
              <li
                key={apk.id}
                className="flex flex-col gap-3 rounded-2xl bg-[var(--color-bg-surface)] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-xl">{label}</h2>
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
                  <RemoveSmoothPrintApkButton id={apk.id} label={label} active={apk.active} />
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </main>
  )
}
