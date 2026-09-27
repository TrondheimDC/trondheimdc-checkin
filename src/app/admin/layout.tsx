import { ensureSessionServer } from "@better-auth-ui/core/server"
import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { headers } from "next/headers"
import { AdminShell } from "@/components/admin/admin-shell"
import { auth } from "@/lib/auth"
import { requireAdminSession } from "@/lib/auth-session"
import { getQueryClient } from "@/lib/query-client"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSession()

  const queryClient = getQueryClient()
  await ensureSessionServer(queryClient, auth, {
    headers: await headers(),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminShell>{children}</AdminShell>
    </HydrationBoundary>
  )
}
