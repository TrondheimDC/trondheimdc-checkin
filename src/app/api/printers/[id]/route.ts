import { isSession, requireAdminApiSession } from "@/lib/auth-api"
import { printerRepository } from "@/lib/printers"
import { NextResponse } from "next/server"

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminApiSession()
  if (!isSession(session)) return session

  const { id } = await context.params
  const removed = await printerRepository.remove(id)
  if (!removed) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
