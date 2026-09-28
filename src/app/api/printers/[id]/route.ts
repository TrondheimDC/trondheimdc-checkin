import { isSession, requireAdminApiSession } from "@/lib/auth-api"
import { printerPatchResponseSchema, printerUpdateBodySchema } from "@/lib/db/schema"
import { printerRepository } from "@/lib/printers"
import { NextRequest, NextResponse } from "next/server"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminApiSession()
  if (!isSession(session)) return session

  const { id } = await context.params
  const json: unknown = await request.json().catch(() => null)
  const parsed = printerUpdateBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  try {
    const updated = await printerRepository.update(id, parsed.data)
    if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 })
    return NextResponse.json(printerPatchResponseSchema.parse(updated))
  } catch (error) {
    if (error instanceof Error && error.message === "door_user_missing") {
      return NextResponse.json({ error: "door_user_missing" }, { status: 409 })
    }
    throw error
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminApiSession()
  if (!isSession(session)) return session

  const { id } = await context.params
  const removed = await printerRepository.remove(id)
  if (!removed) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
