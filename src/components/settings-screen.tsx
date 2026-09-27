"use client"

import { useMutation } from "@tanstack/react-query"
import { LogOut, MapPin, Printer } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { TdcLogo } from "@/components/tdc-logo"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

export function SettingsScreen({ stasjonName }: { stasjonName: string }) {
  const router = useRouter()

  const signOut = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signOut()
      if (error) throw new Error(error.message ?? "sign_out_failed")
    },
    onSuccess: () => {
      router.push("/logg-inn")
    },
  })

  return (
    <main className="attendee-reveal flex h-dvh flex-col gap-6 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="shrink-0 pt-2">
        <TdcLogo />
        <h1 className="mt-2 text-4xl">Innstillinger</h1>
      </header>

      <div className="flex shrink-0 items-center gap-3 rounded-xl bg-[var(--color-bg-surface)] px-4 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-fg-brand)]/15 text-[var(--color-fg-brand)]">
          <MapPin className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm opacity-60">Innlogget som</p>
          <p className="font-display truncate text-xl">{stasjonName}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <Button
          asChild
          variant="surface"
          size="lg"
          className="h-auto items-center justify-start gap-3 py-4 text-left"
        >
          <Link href="/oppsett">
            <Printer className="size-5" aria-hidden />
            Oppsett av printer
          </Link>
        </Button>

        <Button
          variant="ghost"
          size="lg"
          className="h-auto items-center justify-start gap-3 py-4 text-left text-[var(--color-bg-danger)] hover:bg-[color-mix(in_srgb,var(--color-bg-danger)_16%,transparent)] hover:text-[var(--color-bg-danger)]"
          disabled={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          <LogOut className="size-5" aria-hidden />
          Logg ut
        </Button>

        {signOut.isError ? (
          <p className="text-sm text-[var(--color-bg-danger)]">
            Klarte ikke å logge ut. Prøv igjen.
          </p>
        ) : null}
      </div>

      <div className="shrink-0 pt-1">
        <Button asChild variant="surface" size="lg">
          <Link href="/">Tilbake</Link>
        </Button>
      </div>
    </main>
  )
}
