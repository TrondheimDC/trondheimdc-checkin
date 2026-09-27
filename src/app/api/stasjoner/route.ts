import { isSession, requireAdminApiSession } from "@/lib/auth-api"
import {
  stasjonCreateBodySchema,
  stasjonCreateResponseSchema,
  stasjonerResponseSchema,
} from "@/lib/db/schema"
import { stasjonRepository } from "@/lib/stasjoner"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  const session = await requireAdminApiSession()
  if (!isSession(session)) return session

  const stasjoner = await stasjonRepository.list()
  return NextResponse.json(stasjonerResponseSchema.parse({ stasjoner }))
}

export async function POST(request: NextRequest) {
  const session = await requireAdminApiSession()
  if (!isSession(session)) return session

  const json: unknown = await request.json().catch(() => null)
  const parsed = stasjonCreateBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  try {
    const created = await stasjonRepository.create(parsed.data)
    return NextResponse.json(stasjonCreateResponseSchema.parse(created), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "printer_not_found") {
      return NextResponse.json({ error: "printer_not_found" }, { status: 400 })
    }
    throw error
  }
}
