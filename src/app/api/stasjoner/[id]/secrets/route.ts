import { isSession, requireAdminApiSession } from "@/lib/auth-api"
import { stasjonSecretsSchema } from "@/lib/db/schema"
import { stasjonRepository } from "@/lib/stasjoner"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminApiSession()
  if (!isSession(session)) return session

  const { id } = await context.params
  const secrets = await stasjonRepository.getSecrets(id)
  if (!secrets) return NextResponse.json({ error: "not_found" }, { status: 404 })
  return NextResponse.json(stasjonSecretsSchema.parse(secrets))
}
