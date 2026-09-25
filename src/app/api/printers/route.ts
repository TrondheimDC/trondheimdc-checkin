import { printerRepository } from "@/lib/printers"
import { printerBodySchema, printerResponseSchema, printersResponseSchema } from "@/lib/db/schema"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  const printers = await printerRepository.list()
  return NextResponse.json(printersResponseSchema.parse({ printers }))
}

export async function POST(request: NextRequest) {
  const json: unknown = await request.json().catch(() => null)
  const parsed = printerBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }
  const printer = await printerRepository.create(parsed.data)
  return NextResponse.json(printerResponseSchema.parse({ printer }), { status: 201 })
}
