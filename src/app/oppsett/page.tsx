import { headers } from "next/headers"
import { SetupFlow } from "./setup-flow"
import { platformFromUserAgent } from "@/lib/platform"

const DEFAULT_ANDROID_URL = "https://support.brother.com/g/b/agreement.aspx?dlid=dlfp101087_000"

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
