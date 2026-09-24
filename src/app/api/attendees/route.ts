import { attendeeRepository } from "@/lib/attendees"
import { attendeesSearchQuerySchema, attendeesSearchResponseSchema } from "@/lib/db/schema"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const parsed = attendeesSearchQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
    includeCheckedIn: request.nextUrl.searchParams.get("includeCheckedIn") === "1",
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 })
  }

  const attendees = await attendeeRepository.searchByName(parsed.data.q, {
    includeCheckedIn: parsed.data.includeCheckedIn,
  })
  return NextResponse.json(attendeesSearchResponseSchema.parse({ attendees }))
}
