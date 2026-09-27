import { attendeeRepository } from "@/lib/attendees"
import { isSession, requireDoorApiSession } from "@/lib/auth-api"
import { attendeesSearchQuerySchema, attendeesSearchResponseSchema } from "@/lib/db/schema"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const session = await requireDoorApiSession()
  if (!isSession(session)) return session

  const parsed = attendeesSearchQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
    includeCheckedIn: request.nextUrl.searchParams.get("includeCheckedIn") === "1",
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 })
  }

  const attendees = await attendeeRepository.search(parsed.data.q, {
    includeCheckedIn: parsed.data.includeCheckedIn,
  })
  return NextResponse.json(attendeesSearchResponseSchema.parse({ attendees }))
}
