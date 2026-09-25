/** DK-11208 (38 × 90 mm). Matches Brother QL LabelSize DieCutW38H90. */
export const DEFAULT_PAPER_SIZE_ID = "DieCutW38H90"

/** Android applicationId from Smooth Print 1.9.0 APK. */
export const SMOOTH_PRINT_ANDROID_PACKAGE = "com.brother.ptouch.smoothprint"

export const IOS_APP_STORE =
  "https://apps.apple.com/us/app/smooth-print/id1629559918"

export function buildPrintQuery(input: {
  fileBase64: string
  paperSizeId: string
  name: string
  line2: string
}): string {
  const size = input.paperSizeId || DEFAULT_PAPER_SIZE_ID
  // filename is the name Smooth Print stores for the attached bytes.
  // fileattach embeds the template so Smooth Print does not HTTP-fetch it.
  // formatarchiveupdate=1: overwrite a cached template with the same name
  // (default is 0 — Smooth Print keeps the first badge.lbx forever).
  // Content stamp in the name is a second bust if an old install ignores the flag.
  // Do not use a base64 prefix — every .lbx zip starts with the same "UEsD…".
  const stamp = templateStamp(input.fileBase64)
  // Do not pass printMode=original: Brother's SDK returns SetMarginError for
  // this die-cut. Do not pass orientation either; the LBX already says portrait.
  // The template page is 38×90 pt-for-mm, so the default fit_to_page scale is 1.
  return [
    ["filename", `badge-${stamp}.lbx`],
    ["fileattach", input.fileBase64],
    ["formatarchiveupdate", "1"],
    ["size", size],
    ["copies", "1"],
    ["text_NAME", input.name],
    ["text_LINE2", input.line2],
  ]
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&")
}

/** Short content-dependent id so Smooth Print does not reuse a stale cached .lbx. */
function templateStamp(fileBase64: string): string {
  let hash = 2166136261
  for (let i = 0; i < fileBase64.length; i++) {
    hash ^= fileBase64.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function buildPrintUrl(input: {
  fileBase64: string
  paperSizeId: string
  name: string
  line2: string
}): string {
  return `brotherwebprint://print?${buildPrintQuery(input)}`
}

/**
 * Chrome/Android intent URL: opens Smooth Print if installed, otherwise the fallback
 * (typically /oppsett). Package id from the official APK.
 */
export function buildAndroidPrintIntent(input: {
  fileBase64: string
  paperSizeId: string
  name: string
  line2: string
  fallbackUrl: string
}): string {
  const query = buildPrintQuery(input)
  const fallback = encodeURIComponent(input.fallbackUrl)
  return (
    `intent://print?${query}#Intent;` +
    `scheme=brotherwebprint;` +
    `package=${SMOOTH_PRINT_ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${fallback};` +
    `end`
  )
}

export const DEFAULT_PRINTER_MODEL = "QL-820NWBc"

export type ConnectType = "BT" | "WiFi"

/** Brother connect scheme. iOS QL over Bluetooth also needs serialnum. */
export function buildConnectQuery(input: {
  connectType: ConnectType
  address: string
  serial: string
  model: string
  callbackUrl: string
}): string {
  const pairs: [string, string][] = [
    ["connecttype", input.connectType],
    ["connectaddress", input.address.trim()],
    ["model", input.model.trim() || DEFAULT_PRINTER_MODEL],
  ]
  const serial = input.serial.trim()
  if (serial) pairs.push(["serialnum", serial])
  pairs.push(["connectcallback", input.callbackUrl])
  return pairs.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")
}

export function buildConnectUrl(input: {
  connectType: ConnectType
  address: string
  serial: string
  model: string
  callbackUrl: string
}): string {
  return `brotherwebprint://connect?${buildConnectQuery(input)}`
}

export function buildAndroidConnectIntent(input: {
  connectType: ConnectType
  address: string
  serial: string
  model: string
  callbackUrl: string
  fallbackUrl: string
}): string {
  const query = buildConnectQuery(input)
  return (
    `intent://connect?${query}#Intent;` +
    `scheme=brotherwebprint;` +
    `package=${SMOOTH_PRINT_ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(input.fallbackUrl)};` +
    `end`
  )
}

export function templateUrl(file = "badge.lbx"): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || ""
  return `${window.location.origin}${base}/templates/${file}`
}

export function buildStickerPrintQuery(input: {
  fileBase64: string
  paperSizeId: string
  name: string
  qr: string
}): string {
  const size = input.paperSizeId || DEFAULT_PAPER_SIZE_ID
  const stamp = templateStamp(input.fileBase64)
  return [
    ["filename", `printer-${stamp}.lbx`],
    ["fileattach", input.fileBase64],
    ["formatarchiveupdate", "1"],
    ["size", size],
    ["copies", "1"],
    ["text_NAME", input.name],
    ["barcode_QR", input.qr],
  ]
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&")
}

export function buildStickerPrintUrl(input: {
  fileBase64: string
  paperSizeId: string
  name: string
  qr: string
}): string {
  return `brotherwebprint://print?${buildStickerPrintQuery(input)}`
}

export function buildAndroidStickerIntent(input: {
  fileBase64: string
  paperSizeId: string
  name: string
  qr: string
  fallbackUrl: string
}): string {
  const query = buildStickerPrintQuery(input)
  return (
    `intent://print?${query}#Intent;` +
    `scheme=brotherwebprint;` +
    `package=${SMOOTH_PRINT_ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(input.fallbackUrl)};` +
    `end`
  )
}

/** Fetch the hosted .lbx and return standard base64 (for fileattach). */
export async function loadTemplateBase64(file = "badge.lbx"): Promise<string> {
  const response = await fetch(templateUrl(file), { cache: "no-store" })
  if (!response.ok) throw new Error("template fetch failed")
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}
