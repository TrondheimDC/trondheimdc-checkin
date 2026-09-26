import { unzipSync } from "fflate"

/** Refuse absurd zip bombs; Smooth Print APK is ~200 MB. */
const MAX_UNCOMPRESSED_BYTES = 400 * 1024 * 1024

export type ResolvedApkUpload =
  | { ok: true; originalName: string; bytes: Buffer }
  | {
      ok: false
      error:
        | "empty_file"
        | "not_apk"
        | "no_apk_in_zip"
        | "many_apks_in_zip"
        | "zip_too_large"
        | "bad_zip"
    }

function isApkEntryName(path: string) {
  const base = path.split(/[/\\]/).pop() ?? ""
  if (!base || base.startsWith(".")) return false
  if (path.includes("__MACOSX")) return false
  return base.toLowerCase().endsWith(".apk")
}

export function resolveApkUpload(fileName: string, input: Buffer): ResolvedApkUpload {
  if (input.byteLength === 0) return { ok: false, error: "empty_file" }

  const lower = fileName.toLowerCase()
  if (lower.endsWith(".apk")) {
    return { ok: true, originalName: fileName, bytes: input }
  }

  if (!lower.endsWith(".zip")) {
    return { ok: false, error: "not_apk" }
  }

  let oversizedApk = false
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(new Uint8Array(input), {
      filter: (file) => {
        if (!isApkEntryName(file.name)) return false
        if (file.originalSize > MAX_UNCOMPRESSED_BYTES) {
          oversizedApk = true
          return false
        }
        return true
      },
    })
  } catch {
    return { ok: false, error: "bad_zip" }
  }

  const apkEntries = Object.entries(entries).filter(
    ([name, data]) => isApkEntryName(name) && data.byteLength > 0,
  )

  if (apkEntries.length === 0) {
    if (oversizedApk) return { ok: false, error: "zip_too_large" }
    return { ok: false, error: "no_apk_in_zip" }
  }

  if (apkEntries.length > 1) return { ok: false, error: "many_apks_in_zip" }

  const [path, data] = apkEntries[0]!
  const originalName = path.split(/[/\\]/).pop() || "smooth-print.apk"
  return { ok: true, originalName, bytes: Buffer.from(data) }
}

export function apkUploadErrorMessage(
  error: Exclude<ResolvedApkUpload, { ok: true }>["error"],
): string {
  switch (error) {
    case "empty_file":
      return "Filen er tom."
    case "not_apk":
      return "Velg en .apk- eller .zip-fil."
    case "no_apk_in_zip":
      return "Zip-filen inneholder ingen .apk."
    case "many_apks_in_zip":
      return "Zip-filen inneholder flere .apk-filer. Pakk inn bare én."
    case "zip_too_large":
      return "APK-en i zip-filen er for stor."
    case "bad_zip":
      return "Klarte ikke å åpne zip-filen."
  }
}
