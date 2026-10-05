import { readFileSync } from "fs"
import { attendeeRepository } from "../src/lib/attendees"
import { type ImportIgnoreReason, parseCheckinCsv } from "../src/lib/checkin-csv"
import { initDatabase } from "../src/lib/db"

const file = process.argv[2]
if (!file) {
  console.error("Bruk: pnpm import:attendees <totalrapport.csv>")
  process.exit(1)
}

const labels: Record<ImportIgnoreReason, string> = {
  "no-barcode": "uten barcode",
  duplicate: "duplikat barcode (beholdt siste)",
}

async function main() {
  const parsed = parseCheckinCsv(readFileSync(file, "utf8"))
  await initDatabase()
  const sync = await attendeeRepository.replaceAll(parsed.attendees, parsed.deactivateIds)

  const counts = new Map<ImportIgnoreReason, number>()
  for (const skip of parsed.ignored) counts.set(skip.reason, (counts.get(skip.reason) ?? 0) + 1)

  console.log(`Synket ${sync.total} deltakere fra ${file}`)
  console.log(
    `  ${sync.added} nye · ${sync.updated} oppdatert · ${sync.restored} gjenåpnet · ${sync.softDeleted} soft-slettet · ${parsed.ignored.length} ignorert`,
  )
  console.log(
    `  ${parsed.deactivateIds.length} ugyldige barcode i CSV (avmeldt/venteliste/refundert)`,
  )
  if (sync.missingName > 0)
    console.log(`  ${sync.missingName} uten navn (spørres om navn ved skanning)`)
  for (const warning of parsed.warnings) console.warn(`  ! ${warning}`)
  for (const [reason, count] of counts) console.log(`  ${count} ${labels[reason]}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
