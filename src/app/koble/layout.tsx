import { requireDoorSession } from "@/lib/auth-session"

export default async function KobleLayout({ children }: { children: React.ReactNode }) {
  await requireDoorSession()
  return children
}
