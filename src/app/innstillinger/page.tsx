import { SettingsScreen } from "@/components/settings-screen"
import { requireDoorSession } from "@/lib/auth-session"

export default async function InnstillingerPage() {
  const session = await requireDoorSession()
  return <SettingsScreen printerName={session.user.name} />
}
