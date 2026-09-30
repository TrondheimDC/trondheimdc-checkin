import { DoorUsbPrinter } from "@/components/door-usb-printer"
import { Scanner } from "@/components/scanner"
import { requireDoorSession } from "@/lib/auth-session"

export default async function HomePage() {
  const session = await requireDoorSession()
  return (
    <>
      <DoorUsbPrinter session={session} />
      <Scanner printerName={session.user.name} />
    </>
  )
}
