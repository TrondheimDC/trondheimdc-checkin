import { printersResponseSchema, type Printer } from "@/lib/db/schema"
import { apiPath } from "@/lib/utils"

export const printersQueryKey = ["printers"] as const

export async function fetchPrinters(): Promise<Printer[]> {
  const response = await fetch(apiPath("/api/printers"))
  if (!response.ok) throw new Error("Klarte ikke å hente printere")
  return printersResponseSchema.parse(await response.json()).printers
}
