export function labelLine(company: string, role: string): string {
  const parts = [company.trim(), role.trim()].filter(Boolean)
  return parts.join(" / ")
}
