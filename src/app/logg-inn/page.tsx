import type { Metadata } from "next"
import { headers } from "next/headers"
import { Suspense } from "react"
import { isAppUserAgent } from "@/lib/platform"
import { DoorLoginForm } from "./door-login-form"

export const metadata: Metadata = { title: "Logg inn" }

export default async function DoorLoginPage() {
  const inApp = isAppUserAgent((await headers()).get("user-agent") ?? "")
  return (
    <main className="flex min-h-svh items-center justify-center p-6 pt-[max(1.5rem,calc(env(safe-area-inset-top)+var(--printer-status-bar,0px)))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <Suspense>
        <DoorLoginForm inApp={inApp} />
      </Suspense>
    </main>
  )
}
