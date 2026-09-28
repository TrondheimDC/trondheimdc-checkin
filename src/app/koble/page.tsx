import { redirect } from "next/navigation"
import { type ConnectType, DEFAULT_PRINTER_MODEL } from "@/lib/print-url"
import { printerSetupPath } from "@/lib/printer-setup"

/** Sticker QRs historically pointed here — fold into /oppsett. */
export default async function KoblePage({
  searchParams,
}: {
  searchParams: Promise<{
    address?: string
    mac?: string
    serial?: string
    model?: string
    type?: string
  }>
}) {
  const query = await searchParams
  const address = query.address || query.mac || ""
  const connectType: ConnectType = query.type === "WiFi" ? "WiFi" : "BT"
  if (!address) {
    redirect("/oppsett")
  }
  redirect(
    printerSetupPath({
      address,
      serial: query.serial || "",
      model: query.model || DEFAULT_PRINTER_MODEL,
      connectType,
    }),
  )
}
