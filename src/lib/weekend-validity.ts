import {
  addDays,
  endOfDay,
  isFriday,
  isSaturday,
  isSunday,
  nextFriday,
  previousFriday,
  startOfDay,
} from "date-fns"

/**
 * Friday 00:00 → Sunday 23:59:59.999 of the current or upcoming conference weekend.
 * Mon–Thu → next Friday; Fri–Sun → this weekend's Friday.
 */
export function defaultWeekendValidity(now = new Date()): {
  validFrom: string
  validTo: string
} {
  const friday = startOfDay(
    isFriday(now)
      ? now
      : isSaturday(now) || isSunday(now)
        ? previousFriday(now)
        : nextFriday(now),
  )
  return {
    validFrom: friday.toISOString(),
    validTo: endOfDay(addDays(friday, 2)).toISOString(),
  }
}

/** `datetime-local` value in the browser's local zone (no timezone suffix). */
export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
