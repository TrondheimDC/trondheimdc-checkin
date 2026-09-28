import { Admin } from "@/components/auth/admin/admin"

export default function AdminBrukerePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="pt-2">
        <h1 className="text-4xl">Brukere</h1>
        <p className="mt-2 max-w-xl text-base opacity-70">
          Administratorer for innsjekk. Dør-innlogging opprettes sammen med printeren under
          Printere.
        </p>
      </header>
      <Admin path="brukere" hideNav />
    </main>
  )
}
