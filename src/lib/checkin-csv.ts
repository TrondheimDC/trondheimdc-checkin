import Papa from "papaparse"
import { z } from "zod"
import type { ImportedAttendee } from "./db/schema"
import { type NonEmptyString, nonEmptyString, optionalText } from "./non-empty-string"

/** Rows we cannot act on (not soft-deleted, not upserted). */
export type ImportIgnoreReason = "no-barcode" | "duplicate"

export type ImportIgnore = {
  line: number
  reason: ImportIgnoreReason
}

export type ParsedCheckinCsv = {
  attendees: ImportedAttendee[]
  /** Barcodes marked cancelled / waitlist / refunded — soft-delete if present. */
  deactivateIds: string[]
  ignored: ImportIgnore[]
  /** e.g. missing Company/Firmanavn column. */
  warnings: string[]
}

/**
 * Checkin totalrapport headers follow the account language.
 * Only real EN/NO column names from Checkin (plus the custom Bedrift field).
 * Not position-based — custom columns are appended and would shift indices.
 */
const HEADER_ALIASES: Record<string, string> = {
  // EN / NO
  barcode: "barcode",
  strekkode: "barcode",
  name: "name",
  navn: "name",
  "first name": "firstName",
  fornavn: "firstName",
  "last name": "lastName",
  etternavn: "lastName",
  company: "company",
  firmanavn: "company",
  "job title": "role",
  stillingstittel: "role",
  ticket: "ticket",
  billettype: "ticket",
  cancelled: "cancelled",
  avmeldt: "cancelled",
  "on waiting list": "waiting",
  "på venteliste": "waiting",
  // Custom field on the TDC totalrapport (not the standard Company/Firmanavn column)
  bedrift: "companyAlt",
}

const cell = optionalText()

const checkinRowSchema = z.object({
  barcode: cell,
  name: cell,
  firstName: cell,
  lastName: cell,
  company: cell,
  companyAlt: cell,
  role: cell,
  ticket: cell,
  cancelled: cell,
  waiting: cell,
})

function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function mapHeader(header: string): string {
  const key = normalizeHeader(header)
  return HEADER_ALIASES[key] ?? key
}

function isYes(value: string | null): boolean {
  return value != null && /^(ja|yes|true|1)$/i.test(value)
}

/** Ticket types that are not useful as badge "stilling". */
function roleFromTicket(ticket: NonEmptyString | null): NonEmptyString | null {
  if (ticket == null) return null
  if (/^(deltakerbillett|participant(\s*ticket)?|ticket)$/i.test(ticket)) return null
  return ticket
}

/** Name, else First name + Last name. */
function fullName(row: z.infer<typeof checkinRowSchema>): NonEmptyString | null {
  if (row.name) return row.name
  const joined = [row.firstName, row.lastName].filter(Boolean).join(" ")
  return joined ? nonEmptyString().parse(joined) : null
}

export function parseCheckinCsv(text: string): ParsedCheckinCsv {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";"],
    transformHeader: mapHeader,
  })

  const fatal = parsed.errors.filter(
    (error) => error.code !== "TooFewFields" && error.code !== "TooManyFields",
  )
  if (fatal.length > 0) {
    const first = fatal[0]
    throw new Error(`CSV-feil på rad ${first?.row ?? "?"}: ${first?.message ?? "ukjent"}`)
  }

  const fields = parsed.meta.fields ?? []
  if (!fields.includes("barcode")) {
    throw new Error(
      "Fant ikke kolonnen Barcode/Strekkode. Last ned totalrapport, ikke deltaker-Excel.",
    )
  }

  const warnings: string[] = []
  if (!fields.includes("company") && !fields.includes("companyAlt")) {
    warnings.push("Fant ikke Firmanavn/Company.")
  }
  if (!fields.includes("role") && !fields.includes("ticket")) {
    warnings.push("Fant ikke Stillingstittel/Job title/Billettype.")
  }

  const attendees: ImportedAttendee[] = []
  const deactivateIds: string[] = []
  const deactivateSeen = new Set<string>()
  const ignored: ImportIgnore[] = []
  const seen = new Map<string, number>()

  function deactivate(barcode: string) {
    if (deactivateSeen.has(barcode)) return
    deactivateSeen.add(barcode)
    deactivateIds.push(barcode)
  }

  parsed.data.forEach((raw, index) => {
    const line = index + 2
    const row = checkinRowSchema.parse(raw)
    const inactive = isYes(row.cancelled) || isYes(row.waiting)

    if (inactive) {
      if (!row.barcode) {
        ignored.push({ line, reason: "no-barcode" })
        return
      }
      deactivate(row.barcode)
      const at = attendees.findIndex((attendee) => attendee.id === row.barcode)
      if (at >= 0) attendees.splice(at, 1)
      seen.delete(row.barcode)
      return
    }

    if (!row.barcode) {
      ignored.push({ line, reason: "no-barcode" })
      return
    }

    if (deactivateSeen.has(row.barcode)) return

    // Checkin fills Name / First name / Last name (and Bedrift) from the buyer until
    // the ticket is filled out, so only Firmanavn + Stillingstittel tell them apart.
    // A ticket nobody filled out keeps none of the buyer's details; the door asks,
    // with Bedrift offered as a suggestion for the company.
    const filledOut = row.company != null || row.role != null
    const name = filledOut ? fullName(row) : null
    const company = filledOut ? (row.company ?? row.companyAlt) : null
    const companySuggestion = filledOut ? null : row.companyAlt

    const previous = seen.get(row.barcode)
    if (previous !== undefined) {
      ignored.push({ line: previous, reason: "duplicate" })
      const at = attendees.findIndex((attendee) => attendee.id === row.barcode)
      if (at >= 0) attendees.splice(at, 1)
    }
    seen.set(row.barcode, line)
    attendees.push({
      id: row.barcode,
      name,
      company,
      companySuggestion,
      role: row.role ?? roleFromTicket(row.ticket),
      checkedInAt: null,
      deletedAt: null,
    })
  })

  return { attendees, deactivateIds, ignored, warnings }
}
