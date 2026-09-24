import { attendeeRepository } from "@/lib/attendees"
import { attendeeResponseSchema } from "@/lib/db/schema"
import { NextResponse } from "next/server"
import { z } from "zod"

const idParamSchema = z.string().min(1).max(200)

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params
  const id = idParamSchema.safeParse(decodeURIComponent(rawId))
  if (!id.success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  const attendee = await attendeeRepository.getById(id.data)
  if (!attendee) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json(attendeeResponseSchema.parse({ attendee }))
}
