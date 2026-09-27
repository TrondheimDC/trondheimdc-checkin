/** Validity window helpers — kept separate to avoid circular imports with auth.ts. */

export function isWithinValidityWindow(
  validFrom: string | null | undefined,
  validTo: string | null | undefined,
  now = new Date(),
): boolean {
  if (validFrom) {
    const from = new Date(validFrom)
    if (!Number.isNaN(from.getTime()) && now < from) return false
  }
  if (validTo) {
    const to = new Date(validTo)
    if (!Number.isNaN(to.getTime()) && now > to) return false
  }
  return true
}

export function isAdminRole(role: string | string[] | null | undefined): boolean {
  if (!role) return false
  const roles = Array.isArray(role) ? role : role.split(",")
  return roles.map((r) => r.trim()).includes("admin")
}

export function isStasjonRole(role: string | string[] | null | undefined): boolean {
  if (!role) return false
  const roles = Array.isArray(role) ? role : role.split(",")
  return roles.map((r) => r.trim()).includes("stasjon")
}

export function canAccessDoor(role: string | string[] | null | undefined): boolean {
  return isAdminRole(role) || isStasjonRole(role)
}

export function canAccessAdmin(role: string | string[] | null | undefined): boolean {
  return isAdminRole(role)
}
