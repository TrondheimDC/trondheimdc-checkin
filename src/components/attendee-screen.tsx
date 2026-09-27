"use client"

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { Search, ScanLine } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { CheckInButton } from "@/components/check-in-button"
import { PrintButton } from "@/components/print-button"
import { TdcLogo } from "@/components/tdc-logo"
import { Button } from "@/components/ui/button"
import { labelLine } from "@/lib/label-line"
import { platformFromNavigator, type PhonePlatform } from "@/lib/platform"
import { apiPath } from "@/lib/utils"
import { attendeeResponseSchema, type Attendee } from "@/lib/db/schema"

type AttendeeStats = { total: number; checkedIn: number }

function applyCheckedInToSearchCaches(
  queryClient: QueryClient,
  attendeeId: string,
  checkedInAt: string | null,
) {
  for (const [queryKey, data] of queryClient.getQueriesData<Attendee[]>({ queryKey: ["search"] })) {
    if (!data) continue
    const includeCheckedIn = queryKey[2] === true
    queryClient.setQueryData(
      queryKey,
      data
        .map((attendee) => (attendee.id === attendeeId ? { ...attendee, checkedInAt } : attendee))
        .filter((attendee) => includeCheckedIn || attendee.checkedInAt == null),
    )
  }
}

export function AttendeeScreen({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const [platform, setPlatform] = useState<PhonePlatform>("other")

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

  const setCheckedIn = useMutation({
    mutationFn: async (checkedIn: boolean) => {
      const response = await fetch(apiPath(`/api/attendees/${encodeURIComponent(id)}`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ checkedIn }),
      })
      if (!response.ok) throw new Error("check-in failed")
      const body = attendeeResponseSchema.parse(await response.json())
      return body.attendee
    },
    onMutate: async (checkedIn) => {
      await queryClient.cancelQueries({ queryKey: ["attendee", id] })
      await queryClient.cancelQueries({ queryKey: ["search"] })
      await queryClient.cancelQueries({ queryKey: ["attendee-stats"] })

      const previousAttendee = queryClient.getQueryData<Attendee | null>(["attendee", id])
      const previousSearches = queryClient.getQueriesData<Attendee[]>({ queryKey: ["search"] })
      const previousStats = queryClient.getQueryData<AttendeeStats>(["attendee-stats"])
      const checkedInAt = checkedIn ? new Date().toISOString() : null

      if (previousAttendee) {
        queryClient.setQueryData<Attendee>(["attendee", id], {
          ...previousAttendee,
          checkedInAt,
        })
      }

      applyCheckedInToSearchCaches(queryClient, id, checkedInAt)

      if (previousAttendee && previousStats) {
        const wasCheckedIn = previousAttendee.checkedInAt != null
        if (wasCheckedIn !== checkedIn) {
          queryClient.setQueryData<AttendeeStats>(["attendee-stats"], {
            ...previousStats,
            checkedIn: previousStats.checkedIn + (checkedIn ? 1 : -1),
          })
        }
      }

      return { previousAttendee, previousSearches, previousStats }
    },
    onError: (_error, _checkedIn, context) => {
      if (!context) return
      if (context.previousAttendee !== undefined) {
        queryClient.setQueryData(["attendee", id], context.previousAttendee)
      }
      for (const [queryKey, data] of context.previousSearches) {
        queryClient.setQueryData(queryKey, data)
      }
      if (context.previousStats !== undefined) {
        queryClient.setQueryData(["attendee-stats"], context.previousStats)
      }
    },
    onSuccess: (attendee) => {
      queryClient.setQueryData(["attendee", id], attendee)
      applyCheckedInToSearchCaches(queryClient, id, attendee.checkedInAt)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["attendee-stats"] })
      void queryClient.invalidateQueries({ queryKey: ["search"] })
    },
  })

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
              <div className="attendee-loader-bar h-4 w-[46%]" style={{ animationDelay: "0.15s" }} />
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
          <p className="max-w-[18rem] text-base opacity-60">Sjekk nettverket og prøv å skanne på nytt.</p>
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

  return (
    <main className="relative flex min-h-dvh flex-col justify-between overflow-hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="attendee-badge-glow" aria-hidden />

      <div className="relative pt-4">
        <TdcLogo className="search-item-in" />

        <div className="attendee-badge mt-6 flex min-h-[9.5rem] flex-col justify-center rounded-2xl bg-[var(--color-black-3)] px-6 py-7">
          <h1 className="text-4xl leading-tight sm:text-5xl">{attendee.name}</h1>
          {line2 ? <p className="mt-3 text-xl opacity-80">{line2}</p> : null}
          <p className="mt-5 font-mono text-xs tracking-wide break-all opacity-45">{attendee.id}</p>
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
          onCheckIn={() => setCheckedIn.mutateAsync(true)}
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
