"use client"

import { Pencil, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { CorrectAttendeeDialog } from "@/components/correct-attendee-button"
import { Button } from "@/components/ui/button"
import type { Attendee } from "@/lib/db/schema"

export const MISSING_NAME_LABEL = "Mangler navn"

/**
 * Takes the print button's place while a ticket has no name: a blank badge is
 * useless, so staff type the name in or send the attendee to the help desk.
 */
export function MissingNameNotice({
  attendee,
  onCorrected,
}: {
  attendee: Attendee
  onCorrected?: (attendee: Attendee) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      <div
        role="alert"
        className="flex gap-3 rounded-xl bg-[color-mix(in_srgb,var(--color-bg-danger)_14%,transparent)] p-4 ring-1 ring-[var(--color-bg-danger)]/40"
      >
        <TriangleAlert
          className="mt-0.5 size-5 shrink-0 text-[var(--color-bg-danger)]"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="font-medium">Billetten mangler navn</p>
          <p className="mt-1 text-sm opacity-75">
            Skriv inn navnet, eller send deltakeren til infodisken.
          </p>
        </div>
      </div>
      <Button size="lg" onClick={() => setOpen(true)}>
        <Pencil className="size-5" aria-hidden />
        Skriv inn navn
      </Button>
      <CorrectAttendeeDialog
        attendee={attendee}
        open={open}
        onOpenChange={setOpen}
        onCorrected={onCorrected}
      />
    </div>
  )
}
