import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { redirectAndroidBrowserToApp, redirectOutdatedApp } from "@/lib/app-release"
import { auth, canAccessAdmin, canAccessDoor, type Session } from "@/lib/auth"
import { gateSession } from "@/lib/auth-session-gate"
import { DOOR_PATH_HEADER, doorLoginPath } from "@/lib/login-next"
import { apiPath } from "@/lib/utils"

export async function getSession(): Promise<Session | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return gateSession(session)
}

export async function requireDoorSession(): Promise<Session> {
  const session = await getSession()
  if (!session || !canAccessDoor(session.user.role)) {
    redirect(apiPath(doorLoginPath((await headers()).get(DOOR_PATH_HEADER))))
  }
  // On Android, check-in runs in the app when it is the active APK, and only on the latest
  // release (or after «Ikke nå»).
  await redirectAndroidBrowserToApp()
  await redirectOutdatedApp()
  return session
}

export async function requireAdminSession(): Promise<Session> {
  const session = await getSession()
  if (!session || !canAccessAdmin(session.user.role)) {
    redirect(apiPath("/auth/sign-in"))
  }
  return session
}
