import type { Metadata } from "next"
import { APP_DOWNLOAD_PATH } from "@/lib/android-app"
import { latestAppRelease } from "@/lib/app-release"
import { AndroidInstallFlow } from "./android-install-flow"

export const metadata: Metadata = { title: "Installer appen" }

export default async function AndroidInstallPage() {
  // Installing our app comes from /last-ned; Smooth Print (the rollback) from the setup wizard.
  const backHref = (await latestAppRelease()) ? APP_DOWNLOAD_PATH : "/oppsett?step=install&primed=1"
  return (
    <>
      <link rel="preload" as="image" href="/oppsett/android-innstillinger.png" />
      <link rel="preload" as="image" href="/oppsett/android-apper.png" />
      <link rel="preload" as="image" href="/oppsett/android-spesiell-apptilgang.png" />
      <link rel="preload" as="image" href="/oppsett/android-ukjente-apper.png" />
      <link rel="preload" as="image" href="/oppsett/android-velg-chrome.png" />
      <link rel="preload" as="image" href="/oppsett/android-tillat-kilde.png" />
      <link rel="preload" as="image" href="/oppsett/android-apne-fil.png" />
      <AndroidInstallFlow backHref={backHref} />
    </>
  )
}
