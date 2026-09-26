import { NextResponse } from "next/server"
import { z } from "zod"
import { attendeeRepository } from "@/lib/attendees"
import { isSession, requireDoorApiSession } from "@/lib/auth-api"
import { attendeeResponseSchema, setCheckedInBodySchema } from "@/lib/db/schema"

const idParamSchema = z.string().min(1).max(200)

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireDoorApiSession()
  if (!isSession(session)) return session

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
  const session = await requireDoorApiSession()
  if (!isSession(session)) return session

  const { id: rawId } = await context.params
  const id = idParamSchema.safeParse(decodeURIComponent(rawId))
  if (!id.success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 })
  }

  const body = setCheckedInBodySchema.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const attendee = await attendeeRepository.setCheckedIn(id.data, body.data.checkedIn, {
    userId: session.user.id,
    name: session.user.name,
  })
  if (!attendee) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json(attendeeResponseSchema.parse({ attendee }))
}
