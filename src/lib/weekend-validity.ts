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
