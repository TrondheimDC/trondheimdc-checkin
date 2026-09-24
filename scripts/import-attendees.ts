import { readFileSync } from "fs"
import { db, initDatabase } from "../src/lib/db"
import { attendees } from "../src/lib/db/schema"
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
  await db.transaction(async (tx) => {
    await tx.delete(attendees)
    const size = 100
    for (let i = 0; i < parsed.attendees.length; i += size) {
      await tx.insert(attendees).values(parsed.attendees.slice(i, i + size))
    }
  })

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
