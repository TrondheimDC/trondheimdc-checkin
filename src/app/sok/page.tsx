"use client"

import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useDeferredValue, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
} from "@/components/ui/command"
import { labelLine } from "@/lib/label-line"
import { apiPath } from "@/lib/utils"
import { attendeesSearchResponseSchema, attendeeStatsSchema } from "@/lib/db/schema"

const INCLUDE_CHECKED_IN_KEY = "tdc-sok-include-checked-in"

export default function SearchPage() {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [includeCheckedIn, setIncludeCheckedIn] = useState(false)
  const deferredQ = useDeferredValue(q.trim())

  useEffect(() => {
    setIncludeCheckedIn(localStorage.getItem(INCLUDE_CHECKED_IN_KEY) === "1")
  }, [])

  const stats = useQuery({
    queryKey: ["attendee-stats"],
    queryFn: async () => {
      const response = await fetch(apiPath("/api/attendees/stats"))
      if (!response.ok) throw new Error("stats failed")
      return attendeeStatsSchema.parse(await response.json())
    },
  })

  const query = useQuery({
    queryKey: ["search", deferredQ, includeCheckedIn],
    enabled: deferredQ.length > 0,
    queryFn: async () => {
      const params = new URLSearchParams({ q: deferredQ })
      if (includeCheckedIn) params.set("includeCheckedIn", "1")
      const response = await fetch(apiPath(`/api/attendees?${params}`))
      if (!response.ok) throw new Error("search failed")
      const body = attendeesSearchResponseSchema.parse(await response.json())
      return body.attendees
    },
  })

  const searching = deferredQ.length > 0
  const pending = searching && (query.isPending || q.trim() !== deferredQ)
  const results = query.data ?? []

  return (
    <main className="attendee-reveal flex h-dvh flex-col gap-5 overflow-hidden p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="shrink-0 pt-2">
        <p className="text-sm tracking-wide text-[var(--color-fg-brand)]">Manuell innsjekk</p>
        <h1 className="mt-2 text-4xl">Søk etter navn</h1>
        <p className="mt-2 text-base opacity-70">
          {stats.data ? `${stats.data.checkedIn} av ${stats.data.total} innsjekket` : "Henter oppmøte…"}
        </p>
      </header>

      <Command
        shouldFilter={false}
        loop
        label="Søk etter deltaker"
        className="flex min-h-0 flex-1 flex-col gap-5"
      >
        <CommandInput
          autoFocus
          value={q}
          onValueChange={setQ}
          placeholder="Skriv navn…"
          aria-label="Navn"
          onKeyDown={(event) => {
            if (event.key === "Escape" && q.length > 0) {
              event.preventDefault()
              setQ("")
            }
          }}
        />

        <label className="flex shrink-0 items-center gap-3 text-base">
          <input
            type="checkbox"
            className="size-6 accent-[var(--color-fg-brand)]"
            checked={includeCheckedIn}
            onChange={(event) => {
              const next = event.target.checked
              setIncludeCheckedIn(next)
              localStorage.setItem(INCLUDE_CHECKED_IN_KEY, next ? "1" : "0")
            }}
          />
          Vis innsjekkede
        </label>

        <CommandList className="min-h-0 flex-1">
          {!searching ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 pb-8 text-center">
              <div className="search-idle-mark flex size-16 items-center justify-center rounded-full border border-[var(--color-fg-brand)]/40 text-[var(--color-fg-brand)]">
                <Search className="size-7" />
              </div>
              <p className="max-w-[16rem] text-lg leading-snug opacity-60">
                Begynn å skrive for å finne deltakeren
              </p>
            </div>
          ) : null}

          {pending ? (
            <CommandLoading>
              <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Søker">
                {[0, 1, 2].map((i) => (
                  <li
                    key={i}
                    className="search-item-in rounded-xl bg-[var(--color-bg-surface)] px-4 py-4"
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <div
                      className="attendee-loader-bar h-7 w-[70%]"
                      style={{ animationDelay: `${i * 80}ms` }}
                    />
                    <div
                      className="attendee-loader-bar mt-3 h-4 w-[42%]"
                      style={{ animationDelay: `${i * 80 + 100}ms` }}
                    />
                  </li>
                ))}
              </ul>
            </CommandLoading>
          ) : null}

          {!pending && searching && query.isError ? (
            <p className="search-item-in text-lg text-[var(--color-bg-danger)]">
              Søket feilet. Prøv igjen.
            </p>
          ) : null}

          {!pending && searching && query.isSuccess && results.length === 0 ? (
            <CommandEmpty className="search-item-in flex flex-1 flex-col items-center justify-center gap-2 pb-8">
              <p className="text-2xl">Ingen treff</p>
              <p className="max-w-[16rem] text-base opacity-60">
                Fant ingen med «{deferredQ}». Prøv et annet navn.
              </p>
              {!includeCheckedIn ? (
                <p className="max-w-[18rem] text-base opacity-60">
                  Innsjekkede er skjult. Kryss av for å ta dem med.
                </p>
              ) : null}
            </CommandEmpty>
          ) : null}

          {!pending && results.length > 0 ? (
            <CommandGroup key={deferredQ}>
              {results.map((attendee, index) => {
                const line2 = labelLine(attendee.company, attendee.role)
                return (
                  <CommandItem
                    key={attendee.id}
                    value={attendee.id}
                    keywords={[attendee.name, attendee.company ?? "", attendee.role ?? ""]}
                    onSelect={() => {
                      router.push(`/deltaker/${encodeURIComponent(attendee.id)}`)
                    }}
                    style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
                  >
                    <span className="block font-display text-2xl leading-tight">{attendee.name}</span>
                    {line2 ? (
                      <span className="mt-1 block text-base opacity-70 group-data-[selected=true]:opacity-80">
                        {line2}
                      </span>
                    ) : null}
                    {attendee.checkedInAt ? (
                      <span className="mt-2 block text-sm tracking-wide">Innsjekket</span>
                    ) : null}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>

      <div className="shrink-0 pt-1">
        <Button asChild variant="surface" size="lg">
          <Link href="/">Tilbake</Link>
        </Button>
      </div>
    </main>
  )
}
