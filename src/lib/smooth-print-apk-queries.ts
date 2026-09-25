import {
  smoothPrintApkResponseSchema,
  smoothPrintApksResponseSchema,
  type SmoothPrintApk,
} from "@/lib/db/schema"
import { apiPath } from "@/lib/utils"

export const smoothPrintApksQueryKey = ["smooth-print-apks"] as const

export async function fetchSmoothPrintApks(): Promise<SmoothPrintApk[]> {
  const response = await fetch(apiPath("/api/smooth-print/apks"))
  if (!response.ok) throw new Error("Klarte ikke å hente APK-filer")
  return smoothPrintApksResponseSchema.parse(await response.json()).apks
}

export async function uploadSmoothPrintApk(input: {
  file: File
  versionLabel: string
}): Promise<SmoothPrintApk> {
  const body = new FormData()
  body.set("file", input.file)
  body.set("versionLabel", input.versionLabel)
  const response = await fetch(apiPath("/api/smooth-print/apks"), { method: "POST", body })
  if (!response.ok) throw new Error("Klarte ikke å laste opp APK")
  return smoothPrintApkResponseSchema.parse(await response.json()).apk
}

export async function setSmoothPrintApkActive(id: string, active: boolean): Promise<SmoothPrintApk> {
  const response = await fetch(apiPath(`/api/smooth-print/apks/${id}`), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ active }),
  })
  if (!response.ok) throw new Error(active ? "Klarte ikke å aktivere" : "Klarte ikke å deaktivere")
  return smoothPrintApkResponseSchema.parse(await response.json()).apk
}

export async function deleteSmoothPrintApk(id: string): Promise<void> {
  const response = await fetch(apiPath(`/api/smooth-print/apks/${id}`), { method: "DELETE" })
  if (!response.ok) throw new Error("Klarte ikke å slette APK")
}
