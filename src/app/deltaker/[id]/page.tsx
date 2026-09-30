import { AttendeeScreen } from "@/components/attendee-screen"
import { DoorUsbPrinter } from "@/components/door-usb-printer"
import { requireDoorSession } from "@/lib/auth-session"

export default async function AttendeePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireDoorSession()
  const { id } = await params
  return (
    <>
      <DoorUsbPrinter session={session} />
      <AttendeeScreen id={decodeURIComponent(id)} />
    </>
  )
}
