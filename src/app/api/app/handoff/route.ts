import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isSession, requireDoorApiSession } from "@/lib/auth-api"

/** One-time code for «Åpne appen»: the app redeems it at /app-login and shares this login. */
export async function POST() {
  const session = await requireDoorApiSession()
  if (!isSession(session)) return session
  const { token } = await auth.api.generateOneTimeToken({ headers: await headers() })
  return NextResponse.json({ token })
}
