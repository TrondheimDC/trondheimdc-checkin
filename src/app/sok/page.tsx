"use client"

import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import Link from "next/link"
import { useDeferredValue, useState } from "react"
import { Button } from "@/components/ui/button"
import { labelLine } from "@/lib/label-line"
import { apiPath } from "@/lib/utils"
import type { Attendee } from "@/lib/db/schema"

export default function SearchPage() {
  const [q, setQ] = useState("")
  const deferredQ = useDeferredValue(q.trim())
  const query = useQuery({
    queryKey: ["search", deferredQ],
    enabled: deferredQ.length > 0,
    queryFn: async () => {
      const response = await fetch(apiPath(`/api/attendees?q=${encodeURIComponent(deferredQ)}`))
      if (!response.ok) throw new Error("search failed")
      const body = (await response.json()) as { attendees: Attendee[] }
      return body.attendees
    },
  })

  const searching = deferredQ.length > 0
  const pending = searching && (query.isPending || q.trim() !== deferredQ)
  const results = query.data ?? []

  return (
    <main className="attendee-reveal flex min-h-dvh flex-col gap-5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="pt-2">
        <p className="text-sm tracking-wide text-[var(--color-fg-brand)]">Manuell innsjekk</p>
        <h1 className="mt-2 text-4xl">Søk etter navn</h1>
      </header>

      <label className="relative block">
        <span className="sr-only">Navn</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[var(--color-fg-brand)]"
          aria-hidden
        />
        <input
          autoFocus
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Skriv navn…"
          className="h-14 w-full rounded-xl bg-[var(--color-bg-surface)] pr-4 pl-12 text-xl outline-none transition-[box-shadow,background-color] placeholder:opacity-40 focus:bg-[var(--color-black-3)] focus:shadow-[0_0_0_2px_var(--color-fg-brand)]"
        />
      </label>

      <div className="flex min-h-0 flex-1 flex-col">
        {!searching ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-16 text-center">
            <div className="search-idle-mark flex size-16 items-center justify-center rounded-full border border-[var(--color-fg-brand)]/40 text-[var(--color-fg-brand)]">
              <Search className="size-7" />
            </div>
            <p className="max-w-[16rem] text-lg leading-snug opacity-60">
              Begynn å skrive for å finne deltakeren
            </p>
          </div>
        ) : null}

        {pending ? (
          <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Søker">
            {[0, 1, 2].map((i) => (
              <li
                key={i}
                className="search-item-in rounded-xl bg-[var(--color-bg-surface)] px-4 py-4"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="attendee-loader-bar h-7 w-[70%]" style={{ animationDelay: `${i * 80}ms` }} />
                <div
                  className="attendee-loader-bar mt-3 h-4 w-[42%]"
                  style={{ animationDelay: `${i * 80 + 100}ms` }}
                />
              </li>
            ))}
          </ul>
        ) : null}

        {!pending && searching && query.isError ? (
          <p className="search-item-in text-lg text-[var(--color-bg-danger)]">Søket feilet. Prøv igjen.</p>
        ) : null}

        {!pending && searching && query.isSuccess && results.length === 0 ? (
          <div className="search-item-in flex flex-1 flex-col items-center justify-center gap-2 pb-16 text-center">
            <p className="text-2xl">Ingen treff</p>
            <p className="max-w-[16rem] text-base opacity-60">
              Fant ingen med «{deferredQ}». Prøv et annet navn.
            </p>
          </div>
        ) : null}

        {!pending && results.length > 0 ? (
          <ul className="flex flex-col gap-3" key={deferredQ}>
            {results.map((attendee, index) => {
              const line2 = labelLine(attendee.company, attendee.role)
              return (
                <li
                  key={attendee.id}
                  className="search-item-in"
                  style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
                >
                  <Link
                    href={`/deltaker/${encodeURIComponent(attendee.id)}`}
                    className="block rounded-xl bg-[var(--color-bg-surface)] px-4 py-4 transition-[transform,background-color] active:scale-[0.98] active:bg-[var(--color-black-3)]"
                  >
                    <span className="block font-display text-2xl leading-tight">{attendee.name}</span>
                    {line2 ? (
                      <span className="mt-1 block text-base opacity-70">{line2}</span>
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>

      <div className="mt-auto pt-2">
        <Button asChild variant="surface" size="lg">
          <Link href="/">Tilbake</Link>
        </Button>
      </div>
    </main>
  )
}
