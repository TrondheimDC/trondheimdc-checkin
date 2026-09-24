import { headers } from "next/headers"
import { SetupFlow, type PhonePlatform } from "./setup-flow"

const DEFAULT_ANDROID_URL = "https://support.brother.com/g/b/agreement.aspx?dlid=dlfp101087_000"

function platformFromUserAgent(ua: string): PhonePlatform {
  if (/android/i.test(ua)) return "android"
  if (/iPad|iPhone|iPod/i.test(ua)) return "ios"
  return "other"
}

export default async function SetupPage() {
  const ua = (await headers()).get("user-agent") ?? ""
  return (
    <>
      <link rel="preload" as="image" href="/oppsett/smooth-print.jpg" />
      <link rel="preload" as="image" href="/oppsett/oppsett-bluetooth.png" />
      <link rel="preload" as="image" href="/oppsett/oppsett-paring.png" />
      <link rel="preload" as="image" href="/oppsett/oppsett-bekreft.png" />
      <SetupFlow
        platform={platformFromUserAgent(ua)}
        androidUrl={process.env.SMOOTH_PRINT_ANDROID_URL || DEFAULT_ANDROID_URL}
      />
    </>
  )
}
