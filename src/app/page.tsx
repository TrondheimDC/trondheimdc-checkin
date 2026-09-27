import { Scanner } from "@/components/scanner"
import { requireDoorSession } from "@/lib/auth-session"

export default async function HomePage() {
  await requireDoorSession()
  return <Scanner />
}
