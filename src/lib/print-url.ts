/** DK-11208 (38 × 90 mm). Matches Brother QL LabelSize DieCutW38H90. */
export const DEFAULT_PAPER_SIZE_ID = "DieCutW38H90"

export function buildPrintUrl(input: {
  /** Base64 of the .lbx bytes (not URL-safe; we encodeURIComponent the query value). */
  fileBase64: string
  paperSizeId: string
  name: string
  line2: string
}): string {
  const size = input.paperSizeId || DEFAULT_PAPER_SIZE_ID
  // filename is the name Smooth Print stores for the attached bytes.
  // fileattach embeds the template so Smooth Print does not HTTP-fetch it.
  const query = [
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

  return `brotherwebprint://print?${query}`
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
