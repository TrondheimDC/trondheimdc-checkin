import { attendeeRepository } from "@/lib/attendees"
import { parseCheckinCsv } from "@/lib/checkin-csv"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 })
  }

  try {
    const parsed = parseCheckinCsv(await file.text())
    const sync = await attendeeRepository.replaceAll(parsed.attendees, parsed.deactivateIds)
    return NextResponse.json({
      ...sync,
      ignored: parsed.ignored.length,
      warnings: parsed.warnings,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import feilet"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
