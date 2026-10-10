import type { Metadata } from "next"
import { AndroidInstallFlow } from "./android-install-flow"

export const metadata: Metadata = { title: "Installer appen" }

export default function AndroidInstallPage() {
  return (
    <>
      <link rel="preload" as="image" href="/oppsett/android-innstillinger.png" />
      <link rel="preload" as="image" href="/oppsett/android-apper.png" />
      <link rel="preload" as="image" href="/oppsett/android-spesiell-apptilgang.png" />
      <link rel="preload" as="image" href="/oppsett/android-ukjente-apper.png" />
      <link rel="preload" as="image" href="/oppsett/android-velg-chrome.png" />
      <link rel="preload" as="image" href="/oppsett/android-tillat-kilde.png" />
      <link rel="preload" as="image" href="/oppsett/android-apne-fil.png" />
      <AndroidInstallFlow />
    </>
  )
}
