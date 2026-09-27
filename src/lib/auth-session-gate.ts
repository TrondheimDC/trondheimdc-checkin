import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { session as sessionTable } from "@/lib/db/schema"
import { isWithinValidityWindow } from "@/lib/auth-validity"
import type { Session } from "@/lib/auth"

/** Cheap gate using fields already on the session user (no extra query). */
export function sessionUserStillAllowed(user: {
  banned?: boolean | null
  validFrom?: string | null
  validTo?: string | null
}): boolean {
  if (user.banned) return false
  return isWithinValidityWindow(user.validFrom, user.validTo)
}

/** Drop all DB sessions for a user — next getSession fails immediately. */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await db.delete(sessionTable).where(eq(sessionTable.userId, userId))
}

/**
 * If the user is banned or outside validFrom/validTo, revoke their sessions
 * and return null. Uses session.user fields already loaded by getSession.
 */
export async function gateSession(session: Session | null): Promise<Session | null> {
  if (!session) return null
  if (sessionUserStillAllowed(session.user)) return session
  await revokeAllSessionsForUser(session.user.id)
  return null
}
