import { readFileSync } from "fs"
import { attendeeRepository } from "../src/lib/attendees"
import { initDatabase } from "../src/lib/db"
import { parseCheckinCsv, type ImportSkipReason } from "../src/lib/checkin-csv"

const file = process.argv[2]
if (!file) {
  console.error("Bruk: pnpm import:attendees <totalrapport.csv>")
  process.exit(1)
}

const labels: Record<ImportSkipReason, string> = {
  cancelled: "avmeldt",
  waiting: "venteliste",
  "no-barcode": "uten barcode",
  "no-name": "uten navn",
  duplicate: "duplikat barcode (beholdt siste)",
}

async function main() {
  const parsed = parseCheckinCsv(readFileSync(file, "utf8"))
  await initDatabase()
  await attendeeRepository.replaceAll(parsed.attendees)

  const counts = new Map<ImportSkipReason, number>()
  for (const skip of parsed.skipped) counts.set(skip.reason, (counts.get(skip.reason) ?? 0) + 1)

  console.log(`Importerte ${parsed.attendees.length} deltakere fra ${file}`)
  for (const [reason, count] of counts) console.log(`  ${count} ${labels[reason]}`)
  console.log("Deltakerlisten er erstattet. E-post, telefon og adresse ble ikke lagret.")
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
