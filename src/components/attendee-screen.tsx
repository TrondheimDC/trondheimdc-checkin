"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { PrintButton } from "@/components/print-button"
import { Button } from "@/components/ui/button"
import { labelLine } from "@/lib/label-line"
import { apiPath } from "@/lib/utils"
import type { Attendee } from "@/lib/db/schema"

export function AttendeeScreen({ id, paperSizeId }: { id: string; paperSizeId: string }) {
  const query = useQuery({
    queryKey: ["attendee", id],
    queryFn: async () => {
      const response = await fetch(apiPath(`/api/attendees/${encodeURIComponent(id)}`))
      if (response.status === 404) return null
      if (!response.ok) throw new Error("lookup failed")
      const body = (await response.json()) as { attendee: Attendee }
      return body.attendee
    },
  })

  if (query.isPending) {
    return (
      <main className="flex min-h-dvh items-center p-4">
        <p className="text-2xl">Henter…</p>
      </main>
    )
  }

  if (query.isError) {
    return (
      <main className="flex min-h-dvh flex-col justify-end gap-4 p-4">
        <h1 className="text-4xl">Kunne ikke hente deltakeren</h1>
        <Button asChild size="lg">
          <Link href="/">Skann neste</Link>
        </Button>
      </main>
    )
  }

  if (!query.data) {
    return (
      <main className="flex min-h-dvh flex-col justify-end gap-4 p-4">
        <h1 className="text-4xl">Fant ikke deltakeren</h1>
        <p className="font-mono text-lg break-all">{id}</p>
        <Button asChild size="lg">
          <Link href="/sok">Søk etter navn</Link>
        </Button>
        <Button asChild variant="surface" size="lg">
          <Link href="/">Skann neste</Link>
        </Button>
      </main>
    )
  }

  const attendee = query.data
  const line2 = labelLine(attendee.company, attendee.role)

  return (
    <main className="flex min-h-dvh flex-col justify-between p-4">
      <div className="pt-8">
        <p className="text-sm tracking-wide text-[var(--color-fg-brand)]">Bekreft før utskrift</p>
        <h1 className="mt-3 text-5xl">{attendee.name}</h1>
        {line2 ? <p className="mt-4 text-2xl">{line2}</p> : null}
        <p className="mt-6 font-mono text-sm break-all opacity-70">{attendee.id}</p>
      </div>
      <div className="flex flex-col gap-3 pb-4">
        <PrintButton name={attendee.name} line2={line2} paperSizeId={paperSizeId} />
        <Button asChild variant="surface" size="lg">
          <Link href="/">Skann neste</Link>
        </Button>
      </div>
    </main>
  )
}
