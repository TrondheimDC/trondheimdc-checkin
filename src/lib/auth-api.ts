import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { auth, canAccessAdmin, canAccessDoor, type Session } from "@/lib/auth"
import { gateSession } from "@/lib/auth-session-gate"

export async function getApiSession(): Promise<Session | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return gateSession(session)
}

export async function requireDoorApiSession(): Promise<Session | NextResponse> {
  const session = await getApiSession()
  if (!session || !canAccessDoor(session.user.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  return session
}

export async function requireAdminApiSession(): Promise<Session | NextResponse> {
  const session = await getApiSession()
  if (!session || !canAccessAdmin(session.user.role)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  return session
}

export function isSession(value: Session | NextResponse): value is Session {
  return !(value instanceof NextResponse)
}
