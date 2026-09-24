export function buildPrintUrl(input: {
  templateUrl: string
  paperSizeId: string
  name: string
  line2: string
}): string {
  const query = [
    ["filename", input.templateUrl],
    ...(input.paperSizeId ? [["size", input.paperSizeId]] : []),
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
