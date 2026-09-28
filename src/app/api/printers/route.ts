import { isSession, requireAdminApiSession } from "@/lib/auth-api"
import {
  printerBodySchema,
  printerCreateResponseSchema,
  printersResponseSchema,
} from "@/lib/db/schema"
import { printerRepository } from "@/lib/printers"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  const session = await requireAdminApiSession()
  if (!isSession(session)) return session

  const printers = await printerRepository.list()
  return NextResponse.json(printersResponseSchema.parse({ printers }))
}

export async function POST(request: NextRequest) {
  const session = await requireAdminApiSession()
  if (!isSession(session)) return session

  const json: unknown = await request.json().catch(() => null)
  const parsed = printerBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const created = await printerRepository.create(parsed.data)
  return NextResponse.json(printerCreateResponseSchema.parse(created), { status: 201 })
}
