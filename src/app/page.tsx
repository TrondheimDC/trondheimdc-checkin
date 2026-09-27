import { Scanner } from "@/components/scanner"
import { requireDoorSession } from "@/lib/auth-session"

export default async function HomePage() {
  const session = await requireDoorSession()
  return <Scanner stasjonName={session.user.name} />
}
