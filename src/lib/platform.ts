export type PhonePlatform = "ios" | "android" | "other"

export function platformFromUserAgent(ua: string): PhonePlatform {
  if (/android/i.test(ua)) return "android"
  if (/iPad|iPhone|iPod/i.test(ua)) return "ios"
  return "other"
}
