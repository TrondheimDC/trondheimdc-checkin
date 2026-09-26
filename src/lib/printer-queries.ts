import {
  type Printer,
  printerCreateResponseSchema,
  printerPatchResponseSchema,
  printerSecretsSchema,
  printersResponseSchema,
} from "@/lib/db/schema"
import { apiPath } from "@/lib/utils"

export const printersQueryKey = ["printers"] as const

export async function fetchPrinters(): Promise<Printer[]> {
  const response = await fetch(apiPath("/api/printers"))
  if (!response.ok) throw new Error("Klarte ikke å hente printere")
  return printersResponseSchema.parse(await response.json()).printers
}

export async function createPrinter(body: unknown) {
  const response = await fetch(apiPath("/api/printers"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(error?.error ?? "Klarte ikke å lagre printeren")
  }
  return printerCreateResponseSchema.parse(await response.json())
}

export async function patchPrinter(id: string, body: unknown) {
  const response = await fetch(apiPath(`/api/printers/${id}`), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(error?.error ?? "Klarte ikke å oppdatere printeren")
  }
  return printerPatchResponseSchema.parse(await response.json())
}

export async function fetchPrinterSecrets(id: string): Promise<{ pin: string; token: string }> {
  const response = await fetch(apiPath(`/api/printers/${id}/secrets`))
  if (!response.ok) throw new Error("Klarte ikke å hente PIN og lenke")
  return printerSecretsSchema.parse(await response.json())
}
