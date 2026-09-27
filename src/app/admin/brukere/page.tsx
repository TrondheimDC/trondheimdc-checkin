import { Admin } from "@/components/auth/admin/admin"

export default function AdminBrukerePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Brukere</h1>
        <p className="text-sm text-[var(--color-fg-base)]/70">
          Administratorer for innsjekk. Innsjekkstasjoner opprettes under
          Innsjekkstasjoner.
        </p>
      </div>
      <Admin path="brukere" hideNav />
    </div>
  )
}
