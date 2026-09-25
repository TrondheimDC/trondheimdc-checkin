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

export type UploadProgress = {
  loaded: number
  total: number
  percent: number
}

export async function uploadSmoothPrintApk(input: {
  file: File
  versionLabel: string
  onProgress?: (progress: UploadProgress) => void
}): Promise<SmoothPrintApk> {
  const body = new FormData()
  body.set("file", input.file)
  body.set("versionLabel", input.versionLabel)

  // XHR (not fetch) so we get upload progress for large APKs.
  const json = await new Promise<unknown>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", apiPath("/api/smooth-print/apks"))
    xhr.responseType = "json"
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !input.onProgress) return
      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100))
      input.onProgress({ loaded: event.loaded, total: event.total, percent })
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response)
        return
      }
      const message =
        xhr.response &&
        typeof xhr.response === "object" &&
        "message" in xhr.response &&
        typeof xhr.response.message === "string"
          ? xhr.response.message
          : "Klarte ikke å laste opp APK"
      reject(new Error(message))
    }
    xhr.onerror = () => reject(new Error("Klarte ikke å laste opp APK"))
    xhr.onabort = () => reject(new Error("Opplasting avbrutt"))
    xhr.send(body)
  })

  return smoothPrintApkResponseSchema.parse(json).apk
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
