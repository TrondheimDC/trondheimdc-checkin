import type { Metadata } from "next"
import { SettingsScreen } from "@/components/settings-screen"
import { requireDoorSession } from "@/lib/auth-session"

export const metadata: Metadata = { title: "Innstillinger" }

export default async function InnstillingerPage() {
  const session = await requireDoorSession()
  return <SettingsScreen printerName={session.user.name} />
}
