import { isSession, requireAdminApiSession } from "@/lib/auth-api"
import {
  stasjonPatchResponseSchema,
  stasjonResponseSchema,
  stasjonUpdateBodySchema,
} from "@/lib/db/schema"
import { stasjonRepository } from "@/lib/stasjoner"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminApiSession()
  if (!isSession(session)) return session

  const { id } = await context.params
  const stasjon = await stasjonRepository.getById(id)
  if (!stasjon) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json(stasjonResponseSchema.parse({ stasjon }))
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminApiSession()
  if (!isSession(session)) return session

  const { id } = await context.params
  const json: unknown = await request.json().catch(() => null)
  const parsed = stasjonUpdateBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  try {
    const updated = await stasjonRepository.update(id, parsed.data)
    if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 })
    return NextResponse.json(stasjonPatchResponseSchema.parse(updated))
  } catch (error) {
    if (error instanceof Error && error.message === "printer_not_found") {
      return NextResponse.json({ error: "printer_not_found" }, { status: 400 })
    }
    throw error
  }
}
