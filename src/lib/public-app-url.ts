import { apiPath } from "@/lib/utils"

/** Canonical production origin for QR stickers. */
export const DEFAULT_PUBLIC_APP_URL = "https://innsjekk.trondheimdc.no"

/**
 * Origin encoded on printed stickers.
 * Prefer `PUBLIC_URL`, otherwise the production default — including on localhost
 * and preview hosts — so stickers always match the real door URLs.
 */
export function stickerOrigin(): string {
  const configured = process.env.PUBLIC_URL?.trim().replace(/\/$/, "")
  return configured || DEFAULT_PUBLIC_APP_URL
}

export function printerLoginPath(token: string): string {
  return `/logg-inn?token=${encodeURIComponent(token)}`
}

export function printerLoginUrl(origin: string, token: string): string {
  return `${origin}${apiPath(printerLoginPath(token))}`
}
