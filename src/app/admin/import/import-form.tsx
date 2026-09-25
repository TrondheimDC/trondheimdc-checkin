"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { FileUp } from "lucide-react"
import { useId, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { apiPath, cn } from "@/lib/utils"

type Skip = { reason: string; label: string; count: number }

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

export function ImportAttendees() {
  const inputId = useId()
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: Skip[] } | null>(null)

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
      const json = (await response.json()) as { imported?: number; skipped?: Skip[]; error?: string }
      if (!response.ok) throw new Error(json.error || "Opplasting feilet")
      setResult({ imported: json.imported ?? 0, skipped: json.skipped ?? [] })
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
          Last opp Checkin-totalrapport som CSV UTF-8. Hele deltakerlisten erstattes. Avmeldte og venteliste hoppes over.
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
            "flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/20 bg-[var(--color-bg-surface)] px-6 py-8 text-center transition-[border-color,background-color]",
            dragging && "border-[var(--color-fg-brand)] bg-[color-mix(in_srgb,var(--color-fg-brand)_10%,var(--color-bg-surface))]",
            file && !dragging && "border-white/30",
          )}
        >
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
        </label>
        {errors.file ? <p className="text-[var(--color-bg-danger)]">{errors.file.message}</p> : null}
        {errors.root ? <p className="text-[var(--color-bg-danger)]">{errors.root.message}</p> : null}
        <Button type="submit" size="lg" disabled={busy || !file}>
          {busy ? "Laster opp…" : "Last opp"}
        </Button>
      </form>
      {result ? (
        <section className="rounded-2xl bg-[var(--color-bg-surface)] p-4">
          <p className="text-2xl">{result.imported} importert</p>
          {result.skipped.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1 text-base opacity-80">
              {result.skipped.map((skip) => (
                <li key={skip.reason}>
                  {skip.count} {skip.label}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 opacity-70">Ingen rader hoppet over.</p>
          )}
        </section>
      ) : null}
    </main>
  )
}
