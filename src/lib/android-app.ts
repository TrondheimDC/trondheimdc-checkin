/** Android app (Capacitor, `capacitor/android`). */
export const ANDROID_APP_PACKAGE = "no.trondheimdc.innsjekk"

/** Host in the app's App Link intent filter (`AndroidManifest.xml`). */
export const ANDROID_APP_LINK_HOST = "innsjekk.trondheimdc.no"

/**
 * SHA-256 fingerprints of the release signing key, for App Links. Android only opens
 * https://innsjekk.trondheimdc.no links in the app when the installed APK is signed with one
 * of these. Get it with `keytool -list -v -keystore innsjekk-release.jks` (docs/android-app.md).
 */
export const ANDROID_APP_CERT_SHA256: string[] = []

/** Signed release APKs, built by .github/workflows/android.yml. */
export const APP_RELEASES_URL = "https://github.com/TrondheimDC/trondheimdc-checkin/releases"

/** Redeems a one-time login code in the app (`/app-login?token=…&next=…`). */
export const APP_LOGIN_PATH = "/app-login"

/**
 * Chrome `intent://` link that opens the app on `path` when it is installed, else `fallback`.
 * The App Link host is fixed; the app moves the path onto its own server.
 */
export function appIntentUrl(path: string, fallback: string): string {
  return (
    `intent://${ANDROID_APP_LINK_HOST}${path}#Intent;scheme=https;` +
    `package=${ANDROID_APP_PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallback)};end`
  )
}

/** Where Android browsers go instead of the door screens: the app does check-in there. */
export const APP_DOWNLOAD_PATH = "/last-ned"

/**
 * User-agent marker the app appends (`capacitor.config.ts`). Release builds add the
 * version: `TDCInnsjekkApp/<versionCode> (<versionName>)`.
 */
export const APP_UA_MARKER = "TDCInnsjekkApp"

export type AppBuild = { versionCode: number; versionName: string | null }

/** Installed app's version from its user agent. Null outside the app and for local builds. */
export function appBuildFromUserAgent(ua: string): AppBuild | null {
  const match = ua.match(new RegExp(`${APP_UA_MARKER}/(\\d+)(?: \\(([^)]+)\\))?`))
  if (!match) return null
  return { versionCode: Number(match[1]), versionName: match[2] ?? null }
}

/** Installed app's versionCode from its user agent. Null outside the app and for local builds. */
export function appVersionFromUserAgent(ua: string): number | null {
  return appBuildFromUserAgent(ua)?.versionCode ?? null
}

/** «Ikke nå» on the update page: the versionCode the prompt was dismissed for. */
export const APP_UPDATE_LATER_COOKIE = "tdc-app-update-later"
