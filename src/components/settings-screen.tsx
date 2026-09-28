"use client"

import { useMutation } from "@tanstack/react-query"
import { LogOut, MapPin, Printer, ScanLine, Zap } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { TdcLogo } from "@/components/tdc-logo"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import {
  SCAN_AUTO_PRINT_DEFAULT,
  SCAN_AUTO_PRINT_KEY,
  SCAN_INLINE_DEFAULT,
  SCAN_INLINE_KEY,
} from "@/lib/scan-settings"
import { setLocalFlag, useLocalFlag } from "@/lib/use-local-flag"

function SettingToggle({
  pressed,
  onToggle,
  disabled,
  icon,
  title,
  description,
}: {
  pressed: boolean
  onToggle: () => void
  disabled?: boolean
  icon: ReactNode
  title: string
  description: string
}) {
  return (
    <Button
      type="button"
      variant={pressed ? "default" : "surface"}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onToggle}
      className="flex h-auto w-full shrink-0 items-start justify-start gap-3 px-4 py-3.5 text-left text-base leading-snug whitespace-normal"
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 font-normal">
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm opacity-70">{description}</span>
      </span>
    </Button>
  )
}

export function SettingsScreen({ printerName }: { printerName: string }) {
  const router = useRouter()
  const scanInline = useLocalFlag(SCAN_INLINE_KEY, SCAN_INLINE_DEFAULT)
  const autoPrint = useLocalFlag(SCAN_AUTO_PRINT_KEY, SCAN_AUTO_PRINT_DEFAULT)
  const flagsReady = scanInline !== null && autoPrint !== null

  const signOut = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.signOut()
      if (error) throw new Error(error.message ?? "sign_out_failed")
    },
    onSuccess: () => {
      router.push("/logg-inn")
    },
  })

  function toggleScanInline() {
    setLocalFlag(SCAN_INLINE_KEY, scanInline !== true)
  }

  function toggleAutoPrint() {
    setLocalFlag(SCAN_AUTO_PRINT_KEY, autoPrint !== true)
  }

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
          <p className="font-display truncate text-xl">{printerName}</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        <p className="text-sm tracking-wide text-[var(--color-fg-brand)]">Innsjekk</p>

        <SettingToggle
          pressed={flagsReady ? scanInline === true : false}
          onToggle={toggleScanInline}
          disabled={!flagsReady}
          icon={<ScanLine className="size-5" aria-hidden />}
          title="Vis resultat på skann"
          description="Vis deltakeren over kameraet, ikke på en egen side."
        />

        <SettingToggle
          pressed={flagsReady ? autoPrint === true : false}
          onToggle={toggleAutoPrint}
          disabled={!flagsReady}
          icon={<Zap className="size-5" aria-hidden />}
          title="Skriv ut med en gang"
          description="Skriv ut automatisk for nye innsjekker."
        />

        <Button
          asChild
          variant="surface"
          className="flex h-auto w-full shrink-0 items-center justify-start gap-3 px-4 py-3.5 text-left text-base whitespace-normal"
        >
          <Link href="/oppsett">
            <Printer className="size-5 shrink-0" aria-hidden />
            Oppsett av printer
          </Link>
        </Button>

        <Button
          variant="ghost"
          className="flex h-auto w-full shrink-0 items-center justify-start gap-3 px-4 py-3.5 text-left text-base whitespace-normal text-[var(--color-bg-danger)] hover:bg-[color-mix(in_srgb,var(--color-bg-danger)_16%,transparent)] hover:text-[var(--color-bg-danger)]"
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
