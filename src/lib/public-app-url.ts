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
 * Sticker titles. Each says what its QR is for — connect on the front, log in
 * on the one over the model label — so the two cannot be mixed up. The
 * template's text frame shrinks to fit.
 */
export function setupStickerText(printerName: string): string {
  return `Koble til · ${printerName}`
}

export function loginStickerText(printerName: string): string {
  return `Logg inn · ${printerName}`
}
