import { apiPath } from "@/lib/utils"

/** Client-safe stasjon helpers (no DB / Node builtins). */

/** Friday 00:00 → Sunday 23:59:59 of the current or upcoming conference weekend. */
export function defaultWeekendValidity(now = new Date()): { validFrom: string; validTo: string } {
  const day = now.getDay() // Sun=0 … Sat=6
  const friday = new Date(now)
  friday.setHours(0, 0, 0, 0)
  if (day === 0) friday.setDate(friday.getDate() - 2)
  else if (day === 6) friday.setDate(friday.getDate() - 1)
  else if (day === 5) {
    /* today is Friday */
  } else friday.setDate(friday.getDate() + (5 - day))

  const sunday = new Date(friday)
  sunday.setDate(sunday.getDate() + 2)
  sunday.setHours(23, 59, 59, 999)

  return { validFrom: friday.toISOString(), validTo: sunday.toISOString() }
}

export function stasjonLoginPath(token: string): string {
  return `/logg-inn?token=${encodeURIComponent(token)}`
}

export function stasjonLoginUrl(origin: string, token: string): string {
  return `${origin}${apiPath(stasjonLoginPath(token))}`
}

function datetimeLocalValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function defaultWeekendValidityLocal(): { validFrom: string; validTo: string } {
  const { validFrom, validTo } = defaultWeekendValidity()
  return {
    validFrom: datetimeLocalValue(validFrom),
    validTo: datetimeLocalValue(validTo),
  }
}

/** Convert datetime-local wall time to ISO for the API. */
export function localDatetimeToIso(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString()
}
