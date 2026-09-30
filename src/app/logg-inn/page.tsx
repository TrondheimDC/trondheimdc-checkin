import type { Metadata } from "next"
import { Suspense } from "react"
import { DoorLoginForm } from "./door-login-form"

export const metadata: Metadata = { title: "Logg inn" }

export default function DoorLoginPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Suspense>
        <DoorLoginForm />
      </Suspense>
    </main>
  )
}
