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
  return [
    ["filename", "badge.lbx"],
    ["fileattach", input.fileBase64],
    ["size", size],
    ["orientation", "landscape"],
    ["copies", "1"],
    ["text_NAME", input.name],
    ["text_LINE2", input.line2],
  ]
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&")
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

export function templateUrl(): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || ""
  return `${window.location.origin}${base}/templates/badge.lbx`
}

/** Fetch the hosted .lbx and return standard base64 (for fileattach). */
export async function loadTemplateBase64(): Promise<string> {
  const response = await fetch(templateUrl())
  if (!response.ok) throw new Error("template fetch failed")
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}
