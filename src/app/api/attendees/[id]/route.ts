import { attendeeRepository } from "@/lib/attendees"
import { attendeeResponseSchema, setCheckedInBodySchema } from "@/lib/db/schema"
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

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await context.params
  const id = idParamSchema.safeParse(decodeURIComponent(rawId))
  if (!id.success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  const body = setCheckedInBodySchema.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const attendee = await attendeeRepository.setCheckedIn(id.data, body.data.checkedIn)
  if (!attendee) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json(attendeeResponseSchema.parse({ attendee }))
}
