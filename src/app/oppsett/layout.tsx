import { requireDoorSession } from "@/lib/auth-session"

export default async function OppsettLayout({ children }: { children: React.ReactNode }) {
  await requireDoorSession()
  return children
}
