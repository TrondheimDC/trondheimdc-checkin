import { headers } from "next/headers"
import { userAgent } from "next/server"
import { SetupFlow } from "./setup-flow"
import { platformFromOsName } from "@/lib/platform"

const DEFAULT_ANDROID_URL = "https://support.brother.com/g/b/agreement.aspx?dlid=dlfp101087_000"

export default async function SetupPage() {
  const { os } = userAgent({ headers: await headers() })
  return (
    <>
      <link rel="preload" as="image" href="/oppsett/smooth-print.jpg" />
      <link rel="preload" as="image" href="/oppsett/oppsett-bluetooth.png" />
      <link rel="preload" as="image" href="/oppsett/oppsett-paring.png" />
      <link rel="preload" as="image" href="/oppsett/oppsett-bekreft.png" />
      <SetupFlow
        platform={platformFromOsName(os.name)}
        androidUrl={process.env.SMOOTH_PRINT_ANDROID_URL || DEFAULT_ANDROID_URL}
      />
    </>
  )
}
