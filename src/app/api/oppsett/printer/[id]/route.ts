import { NextResponse } from "next/server"
import { isSession, requireDoorApiSession } from "@/lib/auth-api"
import { printerSetupResponseSchema } from "@/lib/printer-setup"
import { printerRepository } from "@/lib/printers"

/** Connection fields for an id sticker scanned inside the /oppsett wizard. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireDoorApiSession()
  if (!isSession(session)) return session

  const { id } = await context.params
  const printer = await printerRepository.getById(id)
  if (!printer) return NextResponse.json({ error: "not_found" }, { status: 404 })

  return NextResponse.json(
    printerSetupResponseSchema.parse({
      printer: {
        id: printer.id,
        address: printer.address,
        serial: printer.serial,
        model: printer.model,
        connectType: printer.connectType,
      },
    }),
  )
}
