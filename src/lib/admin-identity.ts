/** better-auth requires email; admins never mail — placeholder only. */
export const ADMIN_EMAIL_DOMAIN = "innsjekk.local"

export function adminEmailFromUsername(username: string): string {
  return `${username.trim().toLowerCase()}@${ADMIN_EMAIL_DOMAIN}`
}

export function isPlaceholderAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith(`@${ADMIN_EMAIL_DOMAIN}`))
}

export function adminLabel(user: { username?: string | null; name?: string | null }): string {
  return user.username?.trim() || user.name?.trim() || ""
}
