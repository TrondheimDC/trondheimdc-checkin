import { attendeeRepository } from "@/lib/attendees"
import { NextResponse } from "next/server"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const attendee = await attendeeRepository.getById(decodeURIComponent(id))
  if (!attendee) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json({ attendee })
}
