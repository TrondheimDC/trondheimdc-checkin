export function labelLine(
  company: string | null | undefined,
  role: string | null | undefined,
): string {
  return [company?.trim(), role?.trim()].filter(Boolean).join(" / ")
}
