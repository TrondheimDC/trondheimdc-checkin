import type { Metadata } from "next"
import { cookies } from "next/headers"
import { OpenAppButton } from "@/app/last-ned/open-app-button"
import { TdcPrintLogo } from "@/components/tdc-print-logo"
import { APP_NEXT_COOKIE } from "@/lib/android-app"
import { canAccessDoor } from "@/lib/auth"
import { getSession } from "@/lib/auth-session"
import { safeNextPath } from "@/lib/login-next"

export const metadata: Metadata = { title: "Tilbake til appen" }

/**
 * In the browser, from «Hent innlogging fra nettleseren» in the app: sends this browser's
 * login back to the app. Without `next` from the app, it picks up the page /last-ned was
 * going to open (APP_NEXT_COOKIE), so a printer sticker scanned before installing still wins.
 */
export default async function BrowserLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const session = await getSession()
  const loggedIn = Boolean(session && canAccessDoor(session.user.role))
  const fromApp = safeNextPath((await searchParams).next)
  const remembered = safeNextPath((await cookies()).get(APP_NEXT_COOKIE)?.value)
  const next = fromApp && fromApp !== "/" ? fromApp : (remembered ?? "/")

  return (
    <main className="mx-auto flex h-svh max-w-md flex-col overflow-hidden px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <TdcPrintLogo className="size-28 text-[var(--color-fg-brand)]" />
      </div>
      <h1 className="mt-1 shrink-0 text-3xl">
        {loggedIn ? "Tilbake til appen" : "Ikke logget inn her"}
      </h1>
      <p className="mt-2 shrink-0 text-base leading-snug">
        {loggedIn
          ? "Appen åpnes og bruker innloggingen herfra."
          : "Nettleseren er ikke logget inn. Logg inn i appen i stedet."}
      </p>

      <div className="mt-auto flex shrink-0 flex-col gap-2 pt-3">
        <OpenAppButton next={next} handoff={loggedIn} auto={loggedIn} />
      </div>
    </main>
  )
}
