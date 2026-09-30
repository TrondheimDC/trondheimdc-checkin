import { Auth } from "@/components/auth/auth"

export default function AdminSignOutPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[var(--color-bg-base)] p-6">
      <Auth path="sign-out" />
    </main>
  )
}
