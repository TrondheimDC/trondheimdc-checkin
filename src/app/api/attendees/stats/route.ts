import { attendeeRepository } from "@/lib/attendees"
import { isSession, requireDoorApiSession } from "@/lib/auth-api"
import { attendeeStatsSchema } from "@/lib/db/schema"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await requireDoorApiSession()
  if (!isSession(session)) return session

  const stats = await attendeeRepository.stats()
  return NextResponse.json(attendeeStatsSchema.parse(stats))
}
