import { attendeeRepository } from "@/lib/attendees"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? ""
  const attendees = await attendeeRepository.searchByName(q)
  return NextResponse.json({ attendees })
}
