import { attendeeRepository } from "@/lib/attendees"
import { attendeeStatsSchema } from "@/lib/db/schema"
import { NextResponse } from "next/server"

export async function GET() {
  const stats = await attendeeRepository.stats()
  return NextResponse.json(attendeeStatsSchema.parse(stats))
}
