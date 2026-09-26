import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth, canAccessAdmin, canAccessDoor, type Session } from "@/lib/auth"
import { gateSession } from "@/lib/auth-session-gate"
import { apiPath } from "@/lib/utils"

export async function getSession(): Promise<Session | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return gateSession(session)
}

export async function requireDoorSession(): Promise<Session> {
  const session = await getSession()
  if (!session || !canAccessDoor(session.user.role)) {
    redirect(apiPath("/logg-inn"))
  }
  return session
}

export async function requireAdminSession(): Promise<Session> {
  const session = await getSession()
  if (!session || !canAccessAdmin(session.user.role)) {
    redirect(apiPath("/auth/sign-in"))
  }
  return session
}
