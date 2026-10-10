import { Download } from "lucide-react"
import type { Metadata } from "next"
import { cookies, headers } from "next/headers"
import Link from "next/link"
import { redirect } from "next/navigation"
import { TdcPrintLogo } from "@/components/tdc-print-logo"
import { Button } from "@/components/ui/button"
import { APP_UPDATE_LATER_COOKIE } from "@/lib/android-app"
import { pendingAppUpdate } from "@/lib/app-release"
import { requireDoorSession } from "@/lib/auth-session"
import { safeNextPath } from "@/lib/login-next"
import { isAppUserAgent } from "@/lib/platform"
import { smoothPrintApkRepository } from "@/lib/smooth-print-apks"
import { apiPath } from "@/lib/utils"
import { OpenAppButton } from "./open-app-button"

export const metadata: Metadata = { title: "Last ned appen" }

/** «Ikke nå»: skip the prompt until a newer release is uploaded, and carry on. */
async function updateLater(formData: FormData) {
  "use server"
  const versionCode = String(formData.get("versionCode") ?? "")
  const next = safeNextPath(String(formData.get("next") ?? "")) ?? "/"
  ;(await cookies()).set(APP_UPDATE_LATER_COOKIE, versionCode, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  })
  redirect(apiPath(next))
}

/**
 * Android browsers land here instead of the door screens (proxy): on Android, check-in
 * and printing run in the app. Behind door login, so only staff can fetch the APK.
 *
 * In the app it is the update page: door pages send an outdated app here
 * (`redirectOutdatedApp`). An up-to-date app goes straight on to `next`.
 */
export default async function DownloadAppPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  await requireDoorSession()
  const next = safeNextPath((await searchParams).next) ?? "/"
  if (isAppUserAgent((await headers()).get("user-agent") ?? "")) {
    const update = await pendingAppUpdate()
    if (!update) redirect(apiPath(next))
    return <AppUpdatePage version={update.latest} next={next} />
  }
  const active = await smoothPrintApkRepository.getActive()

  return (
    <main className="mx-auto flex h-svh max-w-md flex-col overflow-hidden px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <TdcPrintLogo className="size-28 text-[var(--color-fg-brand)]" />
      </div>
      <h1 className="mt-1 shrink-0 text-3xl">
        {active ? "Last ned appen" : "Appen er ikke lagt ut ennå"}
      </h1>
      <p className="mt-2 shrink-0 text-base leading-snug">
        {active
          ? "På Android sjekker du inn i TDC Innsjekk-appen. Installer den, og trykk Åpne appen her — da er du logget inn."
          : "Be en admin laste opp appen under Android-app."}
      </p>

      <div className="mt-auto flex shrink-0 flex-col gap-2 pt-3">
        {active ? (
          <Button asChild className="h-12 w-full text-base">
            <a href={apiPath("/api/smooth-print/apk")} download>
              <Download className="size-5" aria-hidden />
              Last ned appen
            </a>
          </Button>
        ) : null}
        <OpenAppButton next={next} />
        {active ? (
          <Button asChild variant="ghost" className="h-12 w-full text-base">
            <Link href={apiPath("/oppsett/android")}>Slik tillater du installasjon</Link>
          </Button>
        ) : null}
      </div>
    </main>
  )
}

function AppUpdatePage({
  version,
  next,
}: {
  version: { versionCode: number; versionName: string | null }
  next: string
}) {
  return (
    <main className="mx-auto flex h-svh max-w-md flex-col overflow-hidden px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <TdcPrintLogo className="size-28 text-[var(--color-fg-brand)]" />
      </div>
      <h1 className="mt-1 shrink-0 text-3xl">Oppdater appen</h1>
      <p className="mt-2 shrink-0 text-base leading-snug">
        Versjon {version.versionName ?? version.versionCode} er klar. Android spør om å installere
        når nedlastingen er ferdig.
      </p>

      <div className="mt-auto flex shrink-0 flex-col gap-2 pt-3">
        {/* The app downloads APKs itself and opens Android's installer (MainActivity). */}
        <Button asChild className="h-12 w-full text-base">
          <a href={apiPath("/api/smooth-print/apk")} download>
            <Download className="size-5" aria-hidden />
            Oppdater
          </a>
        </Button>
        <form action={updateLater}>
          <input type="hidden" name="versionCode" value={version.versionCode} />
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="ghost" className="h-12 w-full text-base">
            Ikke nå
          </Button>
        </form>
      </div>
    </main>
  )
}
