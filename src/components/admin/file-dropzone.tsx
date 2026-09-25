"use client"

import { useId, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

type FileDropzoneProps = {
  accept: string
  emptyLabel: string
  icon: ReactNode
  onFile: (file: File) => void
  busy?: boolean
  busyContent?: ReactNode
  className?: string
  disabled?: boolean
  dropLabel?: string
  hint?: string
}

export function FileDropzone({
  accept,
  emptyLabel,
  icon,
  onFile,
  busy = false,
  busyContent,
  className,
  disabled = false,
  dropLabel = "Slipp filen her",
  hint = "eller trykk for å velge fil",
}: FileDropzoneProps) {
  const inputId = useId()
  const [dragging, setDragging] = useState(false)
  const inactive = disabled || busy

  function takeFile(next: File | null | undefined) {
    if (!next || inactive) return
    onFile(next)
  }

  return (
    <>
      <input
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={inactive}
        onChange={(event) => {
          takeFile(event.target.files?.[0])
          event.target.value = ""
        }}
      />
      <label
        htmlFor={inputId}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!inactive) setDragging(true)
        }}
        onDragOver={(event) => {
          event.preventDefault()
          if (!inactive) setDragging(true)
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
          "relative flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed border-white/20 px-6 py-8 text-center transition-[border-color,background-color]",
          dragging &&
            "border-[var(--color-fg-brand)] bg-[color-mix(in_srgb,var(--color-fg-brand)_10%,transparent)]",
          busy && "pointer-events-none",
          className,
        )}
      >
        {busy && busyContent ? (
          busyContent
        ) : (
          <>
            <span
              className={cn(
                "flex size-14 items-center justify-center rounded-2xl bg-black/30 text-[var(--color-fg-brand)]",
                dragging && "bg-[color-mix(in_srgb,var(--color-fg-brand)_18%,transparent)]",
              )}
            >
              {icon}
            </span>
            <span className="text-lg font-medium">{dragging ? dropLabel : emptyLabel}</span>
            <span className="text-sm opacity-60">{hint}</span>
          </>
        )}
      </label>
    </>
  )
}
