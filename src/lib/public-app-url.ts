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

/**
 * Text above the QR on the under-printer login sticker. The setup sticker on
 * the front carries the bare printer name; this one says what it is for, so the
 * two cannot be mixed up. The template's text frame shrinks to fit.
 */
export function loginStickerText(printerName: string): string {
  return `Logg inn · ${printerName}`
}
