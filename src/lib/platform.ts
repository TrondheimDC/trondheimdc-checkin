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

/** Client-only. iPadOS 13+ reports as Macintosh, so touch points count as iOS. */
export function platformFromNavigator(
  ua: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
  touchPoints: number = typeof navigator !== "undefined" ? navigator.maxTouchPoints : 0,
): PhonePlatform {
  if (/android/i.test(ua)) return "android"
  if (/iPad|iPhone|iPod/i.test(ua)) return "ios"
  if (/Macintosh/i.test(ua) && touchPoints > 1) return "ios"
  return "other"
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

/** Phones print through Smooth Print; PC/Mac print over USB (WebUSB). */
export type PrintMethod = "smooth-print" | "usb"

export function printMethodFor(platform: PhonePlatform): PrintMethod {
  return platform === "other" ? "usb" : "smooth-print"
}

/** Which USB driver step a desktop needs: Windows (Zadig), Linux (udev), Mac (none). */
export type DesktopOs = "windows" | "mac" | "linux" | "other"

/** Map Next.js `userAgent().os.name` (ua-parser) to a desktop OS. */
export function desktopOsFromName(osName: string | undefined): DesktopOs {
  if (osName === "Windows") return "windows"
  if (osName === "macOS" || osName === "Mac OS") return "mac"
  if (osName && /linux|ubuntu|debian|fedora|mint|arch|chromium os/i.test(osName)) return "linux"
  return "other"
}

/** Client-only counterpart of `desktopOsFromName`. */
export function desktopOsFromNavigator(
  ua: string = typeof navigator !== "undefined" ? navigator.userAgent : "",
): DesktopOs {
  if (/Windows/i.test(ua)) return "windows"
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac"
  if (/Linux|X11|CrOS/i.test(ua) && !/android/i.test(ua)) return "linux"
  return "other"
}
