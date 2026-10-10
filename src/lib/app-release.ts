import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"
import {
  APP_DOWNLOAD_PATH,
  APP_UPDATE_LATER_COOKIE,
  appVersionFromUserAgent,
} from "@/lib/android-app"
import { DOOR_PATH_HEADER, safeNextPath } from "@/lib/login-next"
import { isAppUserAgent, platformFromNavigator } from "@/lib/platform"
import { smoothPrintApkRepository, storedApkManifest } from "@/lib/smooth-print-apks"
import { apiPath } from "@/lib/utils"

export type AppRelease = { versionCode: number; versionName: string | null }

/**
 * The active upload under Admin → Android-app, when it is our app (not Smooth Print).
 * Null means Android phones use Smooth Print in the browser: activating a Smooth Print
 * APK, or deactivating ours, is the rollback.
 */
export async function latestAppRelease(): Promise<AppRelease | null> {
  const active = await smoothPrintApkRepository.getActive()
  if (!active?.app) return null
  const manifest = await storedApkManifest(active.storedName)
  if (manifest?.versionCode == null) return null
  return { versionCode: manifest.versionCode, versionName: manifest.versionName }
}

/** /last-ned, carrying the page that was asked for (e.g. a printer sticker) as `next`. */
function downloadPagePath(path: string | null): string {
  const next = safeNextPath(path)
  return next && next !== "/"
    ? `${APP_DOWNLOAD_PATH}?${new URLSearchParams({ next })}`
    : APP_DOWNLOAD_PATH
}

/**
 * With our app active, a logged-in Android browser is sent from the door pages to /last-ned:
 * check-in runs in the app. The download page and the install help stay reachable.
 */
export async function redirectAndroidBrowserToApp() {
  const requestHeaders = await headers()
  const ua = requestHeaders.get("user-agent") ?? ""
  if (isAppUserAgent(ua) || platformFromNavigator(ua, 0) !== "android") return
  const path = requestHeaders.get(DOOR_PATH_HEADER)
  if (!path || path.startsWith(APP_DOWNLOAD_PATH) || path.startsWith("/oppsett/android")) return
  if (!(await latestAppRelease())) return
  redirect(apiPath(downloadPagePath(path)))
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
  redirect(apiPath(downloadPagePath(path)))
}
