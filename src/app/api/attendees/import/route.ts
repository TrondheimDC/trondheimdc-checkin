import { attendeeRepository } from "@/lib/attendees"
import { parseCheckinCsv, type ImportSkipReason } from "@/lib/checkin-csv"
import { NextRequest, NextResponse } from "next/server"

const labels: Record<ImportSkipReason, string> = {
  cancelled: "avmeldt",
  waiting: "venteliste",
  "no-barcode": "uten barcode",
  "no-name": "uten navn",
  duplicate: "duplikat barcode (beholdt siste)",
}

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 })
  }

  try {
    const parsed = parseCheckinCsv(await file.text())
    await attendeeRepository.replaceAll(parsed.attendees)
    const skipped = Object.entries(labels).flatMap(([reason, label]) => {
      const count = parsed.skipped.filter((skip) => skip.reason === reason).length
      return count > 0 ? [{ reason, label, count }] : []
    })
    return NextResponse.json({ imported: parsed.attendees.length, skipped })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import feilet"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
