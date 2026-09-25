"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Ban, FileUp, UserMinus, UserPlus, Users, UserRoundCheck } from "lucide-react"
import { useEffect, useId, useState, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import type { ImportSyncResult } from "@/lib/attendees"
import { apiPath, cn } from "@/lib/utils"

type ImportResult = ImportSyncResult & { ignored: number; warnings: string[] }

const importFormSchema = z.object({
  file: z
    .custom<File>((value) => value instanceof File, { message: "Velg en CSV-fil." })
    .refine(
      (file) => file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv",
      { message: "Velg en CSV-fil." },
    ),
})

type ImportFormValues = z.infer<typeof importFormSchema>

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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
        <p className="text-xs tracking-[0.35em] uppercase text-[var(--color-fg-brand)]">Synk ferdig</p>
        <p className="mt-3 font-display text-5xl tabular-nums leading-none">{total}</p>
        <p className="mt-2 text-base opacity-70">aktive deltakere i lista</p>
      </div>

      <div className="attendee-stagger relative mt-4 flex flex-col gap-2">
        <SyncStat label="Nye" value={result.added} icon={<UserPlus className="size-5" />} delayMs={80} />
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

export function ImportAttendees() {
  const inputId = useId()
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const {
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<ImportFormValues>({
    resolver: zodResolver(importFormSchema),
  })

  const file = watch("file")

  function takeFile(next: File | null | undefined) {
    if (!next) return
    setValue("file", next, { shouldValidate: true })
    clearErrors("root")
    setResult(null)
  }

  async function onSubmit(values: ImportFormValues) {
    setBusy(true)
    clearErrors("root")
    setResult(null)
    try {
      const body = new FormData()
      body.set("file", values.file)
      const response = await fetch(apiPath("/api/attendees/import"), { method: "POST", body })
      const json = (await response.json()) as Partial<ImportResult> & { error?: string }
      if (!response.ok) throw new Error(json.error || "Opplasting feilet")
      setResult({
        added: json.added ?? 0,
        updated: json.updated ?? 0,
        restored: json.restored ?? 0,
        softDeleted: json.softDeleted ?? 0,
        ignored: json.ignored ?? 0,
        warnings: json.warnings ?? [],
        total: json.total ?? 0,
      })
    } catch (err) {
      setError("root", {
        message: err instanceof Error ? err.message : "Opplasting feilet",
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4">
      <header className="pt-2">
        <h1 className="text-4xl">Deltakere</h1>
        <p className="mt-2 text-base opacity-70">
          Last opp Checkin-totalrapport som CSV UTF-8. Listen synces på barcode — innsjekk beholdes.
          Avmeldte, venteliste og refunderte soft-slettes.
        </p>
      </header>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => void onSubmit(values))}>
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv"
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
            "relative flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed border-white/20 bg-[var(--color-bg-surface)] px-6 py-8 text-center transition-[border-color,background-color]",
            dragging && "border-[var(--color-fg-brand)] bg-[color-mix(in_srgb,var(--color-fg-brand)_10%,var(--color-bg-surface))]",
            file && !dragging && "border-white/30",
            busy && "pointer-events-none border-[var(--color-fg-brand)]/50",
          )}
        >
          {busy ? (
            <>
              <div className="attendee-loader-sweep" aria-hidden />
              <span className="relative flex size-14 items-center justify-center rounded-2xl border border-[var(--color-fg-brand)]/40 bg-black/30 text-[var(--color-fg-brand)]">
                <FileUp className="size-7" strokeWidth={1.75} />
              </span>
              <span className="attendee-loader-label relative text-sm uppercase text-[var(--color-fg-brand)]">
                Synker…
              </span>
            </>
          ) : (
            <>
              <span
                className={cn(
                  "flex size-14 items-center justify-center rounded-2xl bg-black/30 text-[var(--color-fg-brand)]",
                  dragging && "bg-[color-mix(in_srgb,var(--color-fg-brand)_18%,transparent)]",
                )}
              >
                <FileUp className="size-7" strokeWidth={1.75} />
              </span>
              {file ? (
                <>
                  <span className="max-w-full truncate text-lg font-medium">{file.name}</span>
                  <span className="text-sm opacity-60">{formatBytes(file.size)} · Trykk eller slipp for å bytte</span>
                </>
              ) : (
                <>
                  <span className="text-lg font-medium">{dragging ? "Slipp filen her" : "Slipp CSV her"}</span>
                  <span className="text-sm opacity-60">eller trykk for å velge fil</span>
                </>
              )}
            </>
          )}
        </label>
        {errors.file ? <p className="text-[var(--color-bg-danger)]">{errors.file.message}</p> : null}
        {errors.root ? <p className="text-[var(--color-bg-danger)]">{errors.root.message}</p> : null}
        <Button type="submit" size="lg" disabled={busy || !file}>
          {busy ? "Synker…" : "Last opp"}
        </Button>
      </form>
      {result ? <ImportResultPanel result={result} /> : null}
    </main>
  )
}
