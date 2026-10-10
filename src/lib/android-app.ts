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

/** Where Android browsers go instead of the door screens: the app does check-in there. */
export const APP_DOWNLOAD_PATH = "/last-ned"
