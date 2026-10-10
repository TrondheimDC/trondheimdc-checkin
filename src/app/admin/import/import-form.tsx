"use client"

import { useMutation } from "@tanstack/react-query"
import { Ban, FileUp, UserMinus, UserPlus, UserRoundCheck, UserRoundX, Users } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"
import { z } from "zod"
import { FileDropzone } from "@/components/admin/file-dropzone"
import type { ImportSyncResult } from "@/lib/attendees"
import { apiPath } from "@/lib/utils"

type ImportResult = ImportSyncResult & { ignored: number; warnings: string[] }

const csvFileSchema = z
  .custom<File>((value) => value instanceof File, { message: "Velg en CSV-fil." })
  .refine((file) => file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv", {
    message: "Velg en CSV-fil.",
  })

function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (target <= 0) {
      setValue(0)
      return
    }
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - (1 - t) ** 3
      setValue(Math.round(target * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])

  return value
}

function SyncStat({
  label,
  value,
  icon,
  delayMs,
  hideWhenZero,
}: {
  label: string
  value: number
  icon: ReactNode
  delayMs: number
  hideWhenZero?: boolean
}) {
  const shown = useCountUp(value)
  if (hideWhenZero && value === 0) return null
  return (
    <div
      className="search-item-in flex items-center gap-4 rounded-2xl bg-[var(--color-bg-surface)] px-4 py-4"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--color-fg-brand)_16%,transparent)] text-[var(--color-fg-brand)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm tracking-wide opacity-55">{label}</p>
        <p className="font-display text-3xl tabular-nums leading-none">{shown}</p>
      </div>
    </div>
  )
}

function ImportResultPanel({ result }: { result: ImportResult }) {
  const total = useCountUp(result.total, 1100)

  return (
    <section className="attendee-reveal relative overflow-hidden rounded-3xl border border-white/10 bg-[var(--color-black-3)] p-5">
      <div className="attendee-badge-glow" aria-hidden />

      <div className="attendee-badge relative overflow-hidden rounded-2xl bg-black/35 px-5 py-6">
        <p className="text-xs tracking-[0.35em] uppercase text-[var(--color-fg-brand)]">
          Synk ferdig
        </p>
        <p className="mt-3 font-display text-5xl tabular-nums leading-none">{total}</p>
        <p className="mt-2 text-base opacity-70">aktive deltakere i lista</p>
      </div>

      <div className="attendee-stagger relative mt-4 flex flex-col gap-2">
        <SyncStat
          label="Nye"
          value={result.added}
          icon={<UserPlus className="size-5" />}
          delayMs={80}
        />
        <SyncStat
          label="Oppdatert"
          value={result.updated}
          icon={<Users className="size-5" />}
          delayMs={160}
        />
        <SyncStat
          label="Gjenåpnet"
          value={result.restored}
          icon={<UserRoundCheck className="size-5" />}
          delayMs={240}
          hideWhenZero
        />
        <SyncStat
          label="Soft-slettet"
          value={result.softDeleted}
          icon={<UserMinus className="size-5" />}
          delayMs={320}
          hideWhenZero
        />
        <SyncStat
          label="Mangler navn"
          value={result.missingName}
          icon={<UserRoundX className="size-5" />}
          delayMs={360}
          hideWhenZero
        />
        <SyncStat
          label="Ignorert"
          value={result.ignored}
          icon={<Ban className="size-5" />}
          delayMs={400}
        />
      </div>

      {result.warnings.length > 0 ? (
        <ul
          className="search-item-in relative mt-4 flex flex-col gap-1 border-t border-white/10 pt-4 text-sm text-[var(--color-fg-brand)]"
          style={{ animationDelay: "480ms" }}
        >
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

async function importAttendeesCsv(file: File): Promise<ImportResult> {
  const body = new FormData()
  body.set("file", file)
  const response = await fetch(apiPath("/api/attendees/import"), { method: "POST", body })
  const json = (await response.json()) as Partial<ImportResult> & { error?: string }
  if (!response.ok) throw new Error(json.error || "Opplasting feilet")
  return {
    added: json.added ?? 0,
    updated: json.updated ?? 0,
    restored: json.restored ?? 0,
    softDeleted: json.softDeleted ?? 0,
    ignored: json.ignored ?? 0,
    missingName: json.missingName ?? 0,
    warnings: json.warnings ?? [],
    total: json.total ?? 0,
  }
}

export function ImportAttendees() {
  const [fileError, setFileError] = useState<string | null>(null)
  const [uploadingName, setUploadingName] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const importMutation = useMutation({
    mutationFn: importAttendeesCsv,
    onSuccess: (next) => {
      setResult(next)
      setFileError(null)
    },
    onSettled: () => {
      setUploadingName(null)
    },
  })

  function takeFile(next: File) {
    if (importMutation.isPending) return
    const parsed = csvFileSchema.safeParse(next)
    if (!parsed.success) {
      setFileError(parsed.error.issues[0]?.message ?? "Velg en CSV-fil.")
      return
    }
    setFileError(null)
    setResult(null)
    setUploadingName(parsed.data.name)
    importMutation.mutate(parsed.data)
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="pt-2">
        <h1 className="text-4xl">Deltakere</h1>
        <p className="mt-2 text-base opacity-70">
          Last opp Checkin-totalrapport som CSV UTF-8. Listen synces på barcode — innsjekk beholdes.
          Avmeldte, venteliste og refunderte soft-slettes.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <FileDropzone
          accept=".csv,text/csv"
          emptyLabel="Slipp CSV her"
          icon={<FileUp className="size-7" strokeWidth={1.75} />}
          onFile={takeFile}
          busy={importMutation.isPending}
          className="min-h-48 bg-[var(--color-bg-surface)]"
          busyContent={
            <>
              <div className="attendee-loader-sweep" aria-hidden />
              <span className="relative flex size-14 items-center justify-center rounded-2xl border border-[var(--color-fg-brand)]/40 bg-black/30 text-[var(--color-fg-brand)]">
                <FileUp className="size-7" strokeWidth={1.75} />
              </span>
              <span className="attendee-loader-label relative text-sm uppercase text-[var(--color-fg-brand)]">
                Synker…
              </span>
              {uploadingName ? (
                <span className="relative max-w-full truncate text-sm opacity-60">
                  {uploadingName}
                </span>
              ) : null}
            </>
          }
        />
        {fileError ? <p className="text-[var(--color-bg-danger)]">{fileError}</p> : null}
        {importMutation.isError ? (
          <p className="text-[var(--color-bg-danger)]">
            {importMutation.error instanceof Error
              ? importMutation.error.message
              : "Opplasting feilet"}
          </p>
        ) : null}
      </div>

      {result ? <ImportResultPanel result={result} /> : null}
    </main>
  )
}
