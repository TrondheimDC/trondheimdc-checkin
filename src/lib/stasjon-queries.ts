import {
  stasjonCreateResponseSchema,
  stasjonPatchResponseSchema,
  stasjonerResponseSchema,
  stasjonResponseSchema,
  stasjonSecretsSchema,
  type Stasjon,
} from "@/lib/db/schema"
import { apiPath } from "@/lib/utils"

export const stasjonerQueryKey = ["stasjoner"] as const

export async function fetchStasjoner(): Promise<Stasjon[]> {
  const response = await fetch(apiPath("/api/stasjoner"))
  if (!response.ok) throw new Error("Klarte ikke å hente innsjekkstasjoner")
  return stasjonerResponseSchema.parse(await response.json()).stasjoner
}

export async function createStasjon(body: unknown) {
  const response = await fetch(apiPath("/api/stasjoner"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(error?.error ?? "Klarte ikke å opprette stasjonen")
  }
  return stasjonCreateResponseSchema.parse(await response.json())
}

export async function patchStasjon(id: string, body: unknown) {
  const response = await fetch(apiPath(`/api/stasjoner/${id}`), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(error?.error ?? "Klarte ikke å oppdatere stasjonen")
  }
  return stasjonPatchResponseSchema.parse(await response.json())
}

export async function fetchStasjon(id: string): Promise<Stasjon> {
  const response = await fetch(apiPath(`/api/stasjoner/${id}`))
  if (!response.ok) throw new Error("Klarte ikke å hente stasjonen")
  return stasjonResponseSchema.parse(await response.json()).stasjon
}

export async function fetchStasjonSecrets(id: string): Promise<{ pin: string; token: string }> {
  const response = await fetch(apiPath(`/api/stasjoner/${id}/secrets`))
  if (!response.ok) throw new Error("Klarte ikke å hente PIN og lenke")
  return stasjonSecretsSchema.parse(await response.json())
}
