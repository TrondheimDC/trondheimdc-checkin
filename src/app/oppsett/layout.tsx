import { DoorUsbPrinter } from "@/components/door-usb-printer"
import { requireDoorSession } from "@/lib/auth-session"

export default async function OppsettLayout({ children }: { children: React.ReactNode }) {
  const session = await requireDoorSession()
  return (
    <>
      <DoorUsbPrinter session={session} />
      {children}
    </>
  )
}
