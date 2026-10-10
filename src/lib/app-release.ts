import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import {
  ANDROID_APP_PACKAGE,
  APP_DOWNLOAD_PATH,
  APP_UPDATE_LATER_COOKIE,
  appVersionFromUserAgent,
} from "@/lib/android-app"
import { type ApkManifest, readApkManifest } from "@/lib/apk-manifest"
import { DOOR_PATH_HEADER, safeNextPath } from "@/lib/login-next"
import { apkFilePath, smoothPrintApkRepository } from "@/lib/smooth-print-apks"
import { apiPath } from "@/lib/utils"

export type AppRelease = { versionCode: number; versionName: string | null }

/** Parsed manifests by stored file name; an upload never changes once stored. */
const manifests = new Map<string, Promise<ApkManifest | null>>()

/** The active upload under Admin → Android-app, when it is our app (not Smooth Print). */
export async function latestAppRelease(): Promise<AppRelease | null> {
  const active = await smoothPrintApkRepository.getActive()
  if (!active) return null
  let manifest = manifests.get(active.storedName)
  if (!manifest) {
    manifest = readApkManifest(apkFilePath(active.storedName))
    manifests.set(active.storedName, manifest)
  }
  const parsed = await manifest
  if (parsed?.packageName !== ANDROID_APP_PACKAGE || parsed.versionCode == null) return null
  return { versionCode: parsed.versionCode, versionName: parsed.versionName }
}

export type AppUpdate = { installed: number; latest: AppRelease }

/** In the app, with a newer release uploaded: what to offer. Null otherwise. */
export async function pendingAppUpdate(): Promise<AppUpdate | null> {
  const installed = appVersionFromUserAgent((await headers()).get("user-agent") ?? "")
  if (installed == null) return null
  const latest = await latestAppRelease()
  if (!latest || latest.versionCode <= installed) return null
  return { installed, latest }
}

/**
 * Door pages in an outdated app go to the update page first, unless staff chose
 * «Ikke nå» for this release. The update page itself is exempt.
 */
export async function redirectOutdatedApp() {
  const update = await pendingAppUpdate()
  if (!update) return
  const later = (await cookies()).get(APP_UPDATE_LATER_COOKIE)?.value
  if (later === String(update.latest.versionCode)) return
  const path = (await headers()).get(DOOR_PATH_HEADER)
  if (path?.startsWith(APP_DOWNLOAD_PATH)) return
  const next = safeNextPath(path)
  redirect(
    apiPath(
      next && next !== "/"
        ? `${APP_DOWNLOAD_PATH}?${new URLSearchParams({ next })}`
        : APP_DOWNLOAD_PATH,
    ),
  )
}
