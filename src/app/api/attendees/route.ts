import { attendeeRepository } from "@/lib/attendees"
import { attendeesSearchQuerySchema, attendeesSearchResponseSchema } from "@/lib/db/schema"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const parsed = attendeesSearchQuerySchema.safeParse({
    q: request.nextUrl.searchParams.get("q") ?? "",
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 })
  }

  const attendees = await attendeeRepository.searchByName(parsed.data.q)
  return NextResponse.json(attendeesSearchResponseSchema.parse({ attendees }))
}
