export type PhonePlatform = "ios" | "android" | "other"

/** Map Next.js `userAgent().os.name` (ua-parser) to our print/setup platforms. */
export function platformFromOsName(osName: string | undefined): PhonePlatform {
  switch (osName) {
    case "Android":
      return "android"
    case "iOS":
      return "ios"
    default:
      return "other"
  }
}

/** Client-side refinement: iPadOS 13+ reports as Macintosh in the UA. */
export function refinePlatform(platform: PhonePlatform): PhonePlatform {
  if (platform !== "other" || typeof navigator === "undefined") return platform
  if (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1) return "ios"
  return platform
}

/**
 * Chrome Intent URLs (`intent://…`) work in Chromium Android browsers.
 * Firefox (and some others) need the plain `brotherwebprint://` scheme instead.
 */
export function supportsAndroidIntent(
  ua: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
): boolean {
  if (!/android/i.test(ua) || /firefox|fxios/i.test(ua)) return false
  return /chrome|edga|edg\/|samsungbrowser|opr\//i.test(ua)
}
