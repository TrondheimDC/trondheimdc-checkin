import type { Metadata } from "next"
import { Auth } from "@/components/auth/auth"

export const metadata: Metadata = { title: "Logg ut" }

export default function AdminSignOutPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[var(--color-bg-base)] p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <Auth path="sign-out" />
    </main>
  )
}
