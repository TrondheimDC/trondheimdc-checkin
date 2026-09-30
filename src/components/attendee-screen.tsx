"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ScanLine, Search } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { CheckInButton } from "@/components/check-in-button"
import { CorrectAttendeeButton } from "@/components/correct-attendee-button"
import { PrintButton } from "@/components/print-button"
import { TdcLogo } from "@/components/tdc-logo"
import { Button } from "@/components/ui/button"
import { useSetCheckedIn } from "@/hooks/use-set-checked-in"
import { attendeeResponseSchema } from "@/lib/db/schema"
import { labelLine } from "@/lib/label-line"
import { type PhonePlatform, platformFromNavigator } from "@/lib/platform"
import { SCAN_AUTO_PRINT_DEFAULT, SCAN_AUTO_PRINT_KEY } from "@/lib/scan-settings"
import { useLocalFlag } from "@/lib/use-local-flag"
import { apiPath } from "@/lib/utils"

export function AttendeeScreen({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const [platform, setPlatform] = useState<PhonePlatform>("other")
  const autoPrintFlag = useLocalFlag(SCAN_AUTO_PRINT_KEY, SCAN_AUTO_PRINT_DEFAULT)

  useEffect(() => {
    setPlatform(platformFromNavigator())
  }, [])
  const [overrideError, setOverrideError] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ["attendee", id],
    queryFn: async () => {
      const response = await fetch(apiPath(`/api/attendees/${encodeURIComponent(id)}`))
      if (response.status === 404) return null
      if (!response.ok) throw new Error("lookup failed")
      const body = attendeeResponseSchema.parse(await response.json())
      return body.attendee
    },
  })

  const setCheckedIn = useSetCheckedIn(id)

  if (query.isPending) {
    return (
      <main
        className="flex min-h-dvh flex-col items-center justify-center px-6"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="w-full max-w-sm">
          <div className="attendee-loader-frame relative aspect-[90/38] overflow-hidden rounded-2xl border-2 bg-[var(--color-black-3)]">
            <div className="attendee-loader-sweep" />
            <div className="relative flex h-full flex-col justify-center gap-3 px-6">
              <div className="attendee-loader-bar h-7 w-[78%]" />
              <div
                className="attendee-loader-bar h-4 w-[46%]"
                style={{ animationDelay: "0.15s" }}
              />
            </div>
          </div>
          <p className="attendee-loader-label mt-8 text-center font-display text-sm uppercase text-[var(--color-fg-brand)]">
            Henter…
          </p>
        </div>
      </main>
    )
  }

  if (query.isError) {
    return (
      <main className="attendee-reveal flex min-h-dvh flex-col justify-between p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm tracking-wide text-[var(--color-bg-danger)]">Noe gikk galt</p>
          <h1 className="text-4xl">Kunne ikke hente deltakeren</h1>
          <p className="max-w-[18rem] text-base opacity-60">
            Sjekk nettverket og prøv å skanne på nytt.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/">Skann neste</Link>
        </Button>
      </main>
    )
  }

  if (!query.data) {
    return (
      <main className="attendee-reveal flex min-h-dvh flex-col justify-between p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="search-idle-mark flex size-16 items-center justify-center rounded-full border border-[var(--color-fg-brand)]/40 text-[var(--color-fg-brand)]">
            <Search className="size-7" />
          </div>
          <h1 className="text-4xl">Fant ikke deltakeren</h1>
          <p className="font-mono text-sm break-all opacity-50">{id}</p>
        </div>
        <div className="flex flex-col gap-3">
          <Button asChild size="lg">
            <Link href="/sok">Søk</Link>
          </Button>
          <Button asChild variant="surface" size="lg">
            <Link href="/">Skann neste</Link>
          </Button>
        </div>
      </main>
    )
  }

  const attendee = query.data
  const line2 = labelLine(attendee.company, attendee.role)
  const checkedIn = attendee.checkedInAt != null
  const autoPrintReady = autoPrintFlag !== null
  const shouldAutoPrint = autoPrintReady && autoPrintFlag === true && !checkedIn

  return (
    <main className="relative flex min-h-dvh flex-col justify-between overflow-hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="attendee-badge-glow" aria-hidden />

      <div className="relative pt-4">
        <TdcLogo className="search-item-in" />

        <div className="attendee-badge relative mt-6 flex min-h-[9.5rem] flex-col justify-center rounded-2xl bg-[var(--color-black-3)] px-6 py-7">
          <h1 className="pr-6 text-4xl leading-tight sm:text-5xl">{attendee.name}</h1>
          {line2 ? <p className="mt-3 text-xl opacity-80">{line2}</p> : null}
          <p className="mt-5 font-mono text-xs tracking-wide break-all opacity-45">{attendee.id}</p>
          <CorrectAttendeeButton attendee={attendee} />
        </div>
      </div>

      <div className="attendee-stagger relative flex flex-col gap-3 pt-8">
        {overrideError ? (
          <p className="text-base text-[var(--color-bg-danger)]">{overrideError}</p>
        ) : null}
        <PrintButton
          name={attendee.name}
          line2={line2}
          platform={platform}
          checkedIn={checkedIn}
          autoPrint={shouldAutoPrint}
          onCheckIn={async () => {
            const next = await setCheckedIn.mutateAsync(true)
            queryClient.setQueryData(["attendee", id], next)
          }}
        />
        <CheckInButton
          checkedIn={checkedIn}
          onToggle={async () => {
            setOverrideError(null)
            try {
              await setCheckedIn.mutateAsync(!checkedIn)
            } catch {
              setOverrideError("Klarte ikke å oppdatere innsjekk. Prøv igjen.")
              throw new Error("check-in failed")
            }
          }}
        />
        <Button asChild variant="surface" size="lg">
          <Link href="/">
            <ScanLine className="size-5" aria-hidden />
            Skann neste
          </Link>
        </Button>
      </div>
    </main>
  )
}
