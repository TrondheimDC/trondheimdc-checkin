"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { apiPath } from "@/lib/utils"
import type { Attendee } from "@/lib/db/schema"
import { labelLine } from "@/lib/label-line"

export default function SearchPage() {
  const [q, setQ] = useState("")
  const query = useQuery({
    queryKey: ["search", q],
    enabled: q.trim().length > 0,
    queryFn: async () => {
      const response = await fetch(apiPath(`/api/attendees?q=${encodeURIComponent(q.trim())}`))
      if (!response.ok) throw new Error("search failed")
      const body = (await response.json()) as { attendees: Attendee[] }
      return body.attendees
    },
  })

  return (
    <main className="flex min-h-dvh flex-col gap-4 p-4">
      <h1 className="text-4xl">Søk etter navn</h1>
      <input
        autoFocus
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Navn"
        className="h-14 rounded-xl bg-[var(--color-bg-surface)] px-4 text-xl outline-none"
      />
      <ul className="flex flex-col gap-3">
        {query.data?.map((attendee) => (
          <li key={attendee.id}>
            <Link
              href={`/deltaker/${encodeURIComponent(attendee.id)}`}
              className="block rounded-xl bg-[var(--color-bg-surface)] px-4 py-4"
            >
              <span className="block text-2xl">{attendee.name}</span>
              <span className="mt-1 block text-base opacity-80">{labelLine(attendee.company, attendee.role)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {q.trim() && query.data && query.data.length === 0 ? <p className="text-lg">Fant ingen med det navnet</p> : null}
      <div className="mt-auto">
        <Button asChild variant="surface" size="lg">
          <Link href="/">Tilbake</Link>
        </Button>
      </div>
    </main>
  )
}
