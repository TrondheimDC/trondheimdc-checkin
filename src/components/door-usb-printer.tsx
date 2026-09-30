import { ExpectUsbPrinter } from "@/components/expect-usb-printer"
import type { Session } from "@/lib/auth"
import { printerRepository } from "@/lib/printers"

/** Door login → its printer, so a PC/Mac can warn when a different QL is on the USB cable. */
export async function DoorUsbPrinter({ session }: { session: Session }) {
  const printerId = session.user.printerId
  if (!printerId) return null
  const printer = await printerRepository.getById(printerId)
  if (!printer?.serial) return null
  return <ExpectUsbPrinter name={printer.name} serial={printer.serial} />
}
