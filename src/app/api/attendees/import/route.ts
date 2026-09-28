import { NextRequest, NextResponse } from "next/server"
import { attendeeRepository } from "@/lib/attendees"
import { isSession, requireAdminApiSession } from "@/lib/auth-api"
import { parseCheckinCsv } from "@/lib/checkin-csv"

export async function POST(request: NextRequest) {
  const session = await requireAdminApiSession()
  if (!isSession(session)) return session

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
