"use client"

import { X } from "lucide-react"
import { useEffect, useState } from "react"
import { CheckInButton } from "@/components/check-in-button"
import { CorrectAttendeeButton } from "@/components/correct-attendee-button"
import { PrintButton } from "@/components/print-button"
import { Button } from "@/components/ui/button"
import { useSetCheckedIn } from "@/hooks/use-set-checked-in"
import type { Attendee } from "@/lib/db/schema"
import { labelLine } from "@/lib/label-line"
import { type PhonePlatform, platformFromNavigator } from "@/lib/platform"

/**
 * Non-modal card centred over a live camera — next scan replaces the current
 * attendee without tearing down the stream.
 */
export function ScanResultSheet({
  attendee,
  autoPrint,
  onDismiss,
  onPrinted,
}: {
  attendee: Attendee | null
  autoPrint: boolean
  onDismiss: () => void
  onPrinted?: () => void
}) {
  const [platform, setPlatform] = useState<PhonePlatform>("other")
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const [local, setLocal] = useState<Attendee | null>(attendee)
  const current = local ?? attendee
  const id = current?.id ?? ""
  const setCheckedIn = useSetCheckedIn(id)

  useEffect(() => {
    setPlatform(platformFromNavigator())
  }, [])

  useEffect(() => {
    setLocal(attendee)
    setOverrideError(null)
  }, [attendee])

  if (!current) return null

  const line2 = labelLine(current.company, current.role)
  const checkedIn = current.checkedInAt != null
  const shouldAutoPrint = autoPrint === true && !checkedIn

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="status"
      aria-live="polite"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
    >
      <div className="attendee-reveal max-h-full w-full max-w-sm overflow-y-auto rounded-2xl bg-[var(--color-black-3)]/95 p-5 shadow-lg ring-1 ring-white/10 backdrop-blur-md">
        <div className="relative -m-2 rounded-xl p-2">
          <p className="text-sm tracking-wide text-[var(--color-fg-brand)]">
            {checkedIn ? "Allerede innsjekket" : "Ny innsjekk"}
          </p>
          <h2 className="font-display mt-0.5 truncate pr-6 text-2xl leading-tight">
            {current.name}
          </h2>
          {line2 ? <p className="mt-1 truncate pr-6 text-base opacity-75">{line2}</p> : null}
          <CorrectAttendeeButton attendee={current} onCorrected={setLocal} />
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {overrideError ? (
            <p className="text-sm text-[var(--color-bg-danger)]">{overrideError}</p>
          ) : null}
          <PrintButton
            key={current.id}
            name={current.name}
            line2={line2}
            platform={platform}
            checkedIn={checkedIn}
            autoPrint={shouldAutoPrint}
            onPrinted={onPrinted}
            onCheckIn={async () => {
              const next = await setCheckedIn.mutateAsync(true)
              setLocal(next)
            }}
          />
          {!shouldAutoPrint ? (
            <CheckInButton
              checkedIn={checkedIn}
              onToggle={async () => {
                setOverrideError(null)
                try {
                  const next = await setCheckedIn.mutateAsync(!checkedIn)
                  setLocal(next)
                } catch {
                  setOverrideError("Klarte ikke å oppdatere innsjekk. Prøv igjen.")
                  throw new Error("check-in failed")
                }
              }}
            />
          ) : null}
          <Button type="button" variant="surface" size="lg" onClick={onDismiss}>
            <X className="size-5" aria-hidden />
            Lukk
          </Button>
        </div>
      </div>
    </div>
  )
}
