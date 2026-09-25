import { DEFAULT_PRINTER_MODEL, type ConnectType } from "@/lib/print-url"

export type PrinterSetupParams = {
  address: string
  serial: string
  model: string
  connectType: ConnectType
}

/** Path encoded on printer stickers — lands on /oppsett connect step. */
export function printerSetupPath(input: PrinterSetupParams): string {
  const params = new URLSearchParams({
    path: "qr",
    step: "connect",
    address: input.address.trim().toUpperCase(),
    serial: input.serial.trim().toUpperCase(),
    model: input.model,
    type: input.connectType,
  })
  return `/oppsett?${params}`
}

/** Parse a sticker QR (https /koble or /oppsett?path=qr) or a relative path. */
export function parsePrinterSetupUrl(raw: string): PrinterSetupParams | null {
  const text = raw.trim()
  if (!text) return null

  let url: URL
  try {
    url = new URL(text, "https://local.invalid")
  } catch {
    return null
  }

  const path = url.pathname.replace(/\/+$/, "")
  const isKoble = path === "/koble" || path.endsWith("/koble")
  const isOppsett = path === "/oppsett" || path.endsWith("/oppsett")
  if (!isKoble && !isOppsett) return null

  const address = (url.searchParams.get("address") || url.searchParams.get("mac") || "")
    .trim()
    .toUpperCase()
  if (!address) return null

  const connectType: ConnectType = url.searchParams.get("type") === "WiFi" ? "WiFi" : "BT"
  return {
    address,
    serial: (url.searchParams.get("serial") || "").trim().toUpperCase(),
    model: (url.searchParams.get("model") || DEFAULT_PRINTER_MODEL).trim() || DEFAULT_PRINTER_MODEL,
    connectType,
  }
}
