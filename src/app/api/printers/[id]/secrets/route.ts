import { isSession, requireAdminApiSession } from "@/lib/auth-api"
import { printerSecretsSchema } from "@/lib/db/schema"
import { printerRepository } from "@/lib/printers"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminApiSession()
  if (!isSession(session)) return session

  const { id } = await context.params
  const secrets = await printerRepository.getSecrets(id)
  if (!secrets) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json(printerSecretsSchema.parse(secrets))
}
