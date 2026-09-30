import type { Metadata } from "next"
import { Auth } from "@/components/auth/auth"
import { TdcLogo } from "@/components/tdc-logo"

export const metadata: Metadata = { title: "Logg inn som admin" }

export default function AdminSignInPage() {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[var(--color-bg-base)] p-6">
      <div aria-hidden className="auth-glow-a" />
      <div aria-hidden className="auth-glow-b" />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8">
        <div className="auth-mark flex flex-col items-center gap-3 text-center">
          <TdcLogo className="h-9" />
          <div>
            <p className="text-xs font-medium tracking-[0.2em] text-[var(--color-fg-base)]/50 uppercase">
              TDC Innsjekk
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-[var(--color-fg-base)]/90">
              Administrasjon
            </h1>
          </div>
        </div>

        <Auth path="sign-in" className="auth-card rounded-2xl border-0" />
      </div>
    </main>
  )
}
