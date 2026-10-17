import { isPrinterRole } from "@/lib/auth-validity"
import { isPrinterToken, isPrinterTokenBody } from "@/lib/printer-token"

/** better-auth requires email; admins never mail — placeholder only. */
export const ADMIN_EMAIL_DOMAIN = "innsjekk.local"

export function adminEmailFromUsername(username: string): string {
  return `${username.trim().toLowerCase()}@${ADMIN_EMAIL_DOMAIN}`
}

export function isPlaceholderAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith(`@${ADMIN_EMAIL_DOMAIN}`))
}

/** better-auth's admin plugin adds `role` at runtime; the client user type does not declare it. */
export function userRole(user: object | null | undefined): string | null {
  const role = user && "role" in user ? user.role : null
  return typeof role === "string" ? role : null
}

/** Door login token in `username` — not a label staff should see. */
function isDoorLoginUsername(value: string): boolean {
  return isPrinterToken(value) || isPrinterTokenBody(value)
}

/**
 * Human label for a user in admin UI / account menus.
 * Door accounts store the login token in `username` (`lgn_…`); the printer
 * name lives in `name` / `displayUsername`.
 */
export function adminLabel(user: {
  username?: string | null
  displayUsername?: string | null
  name?: string | null
  role?: string | string[] | null
}): string {
  const username = user.username?.trim() || ""
  const display = user.displayUsername?.trim() || ""
  const name = user.name?.trim() || ""

  if (isPrinterRole(user.role) || (username && isDoorLoginUsername(username))) {
    if (name) return name
    if (display && display !== username) return display
    return username
  }

  return display || username || name || ""
}
