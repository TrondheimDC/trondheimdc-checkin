import { NextRequest, NextResponse } from "next/server"
import { isSession, requireAdminApiSession } from "@/lib/auth-api"
import { smoothPrintApkPatchSchema, smoothPrintApkResponseSchema } from "@/lib/db/schema"
import { smoothPrintApkRepository } from "@/lib/smooth-print-apks"

export const runtime = "nodejs"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdminApiSession()
  if (!isSession(session)) return session

  const { id } = await context.params
  const json: unknown = await request.json().catch(() => null)
  const parsed = smoothPrintApkPatchSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 })
  }

  const apk = await smoothPrintApkRepository.setActive(id, parsed.data.active)
  if (!apk) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json(smoothPrintApkResponseSchema.parse({ apk }))
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdminApiSession()
  if (!isSession(session)) return session

  const { id } = await context.params
  const removed = await smoothPrintApkRepository.remove(id)
  if (!removed) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
