import Papa from "papaparse"
import { z } from "zod"
import type { Attendee } from "./db/schema"

export type ImportSkipReason = "cancelled" | "waiting" | "no-barcode" | "no-name" | "duplicate"

export type ImportSkip = {
  line: number
  reason: ImportSkipReason
}

export type ParsedCheckinCsv = {
  attendees: Attendee[]
  skipped: ImportSkip[]
}

const HEADER_ALIASES: Record<string, string> = {
  barcode: "barcode",
  strekkode: "barcode",
  name: "name",
  navn: "name",
  "first name": "firstName",
  fornavn: "firstName",
  "last name": "lastName",
  etternavn: "lastName",
  company: "company",
  firma: "company",
  "job title": "role",
  stilling: "role",
  tittel: "role",
  cancelled: "cancelled",
  kansellert: "cancelled",
  avmeldt: "cancelled",
  "on waiting list": "waiting",
  venteliste: "waiting",
}

const blank = z
  .string()
  .optional()
  .transform((value) => value?.trim() ?? "")

const checkinRowSchema = z.object({
  barcode: blank,
  name: blank,
  firstName: blank,
  lastName: blank,
  company: blank,
  role: blank,
  cancelled: blank,
  waiting: blank,
})

function isYes(value: string): boolean {
  return /^(ja|yes|true|1)$/i.test(value)
}

export function parseCheckinCsv(text: string): ParsedCheckinCsv {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";"],
    transformHeader(header) {
      const key = header.trim().toLowerCase().replace(/\s+/g, " ")
      return HEADER_ALIASES[key] ?? key
    },
  })

  const fatal = parsed.errors.filter((error) => error.code !== "TooFewFields" && error.code !== "TooManyFields")
  if (fatal.length > 0) {
    const first = fatal[0]
    throw new Error(`CSV-feil på rad ${first?.row ?? "?"}: ${first?.message ?? "ukjent"}`)
  }

  const fields = parsed.meta.fields ?? []
  if (!fields.includes("barcode")) {
    throw new Error("Fant ikke kolonnen Barcode. Last ned totalrapport, ikke deltaker-Excel.")
  }

  const attendees: Attendee[] = []
  const skipped: ImportSkip[] = []
  const seen = new Map<string, number>()

  parsed.data.forEach((raw, index) => {
    const line = index + 2
    const row = checkinRowSchema.parse(raw)

    if (isYes(row.cancelled)) {
      skipped.push({ line, reason: "cancelled" })
      return
    }
    if (isYes(row.waiting)) {
      skipped.push({ line, reason: "waiting" })
      return
    }
    if (!row.barcode) {
      skipped.push({ line, reason: "no-barcode" })
      return
    }

    const name = row.name || [row.firstName, row.lastName].filter(Boolean).join(" ")
    if (!name) {
      skipped.push({ line, reason: "no-name" })
      return
    }

    const previous = seen.get(row.barcode)
    if (previous !== undefined) {
      skipped.push({ line: previous, reason: "duplicate" })
      const at = attendees.findIndex((attendee) => attendee.id === row.barcode)
      if (at >= 0) attendees.splice(at, 1)
    }
    seen.set(row.barcode, line)
    attendees.push({
      id: row.barcode,
      name,
      company: row.company,
      role: row.role,
    })
  })

  return { attendees, skipped }
}
