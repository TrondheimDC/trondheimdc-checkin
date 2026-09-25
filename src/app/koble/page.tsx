import { redirect } from "next/navigation"
import { printerSetupPath } from "@/lib/printer-setup"
import { DEFAULT_PRINTER_MODEL, type ConnectType } from "@/lib/print-url"

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
    redirect("/oppsett?path=qr")
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
