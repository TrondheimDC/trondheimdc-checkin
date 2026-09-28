"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AppLoading } from "@/components/app-loading"
import { AuthProvider } from "@/components/auth/auth-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { adminPlugin } from "@/lib/auth/admin-plugin"
import { multiSessionPlugin } from "@/lib/auth/multi-session-plugin"
import { usernamePlugin } from "@/lib/auth/username-plugin"
import { authClient } from "@/lib/auth-client"
import { adminUiLocalization, authUiLocalization } from "@/lib/auth-ui-localization"
import { getQueryClient } from "@/lib/query-client"
import { apiPath } from "@/lib/utils"

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const queryClient = getQueryClient()
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    setBooted(true)
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider
          authClient={authClient}
          queryClient={queryClient}
          redirectTo={apiPath("/admin")}
          socialProviders={[]}
          emailAndPassword={{
            enabled: true,
            forgotPassword: false,
            requireEmailVerification: false,
            rememberMe: false,
          }}
          basePaths={{
            auth: apiPath("/auth"),
            admin: apiPath("/admin"),
            settings: apiPath("/settings"),
            organization: apiPath("/organization"),
          }}
          viewPaths={{
            admin: { users: "brukere" },
          }}
          localization={authUiLocalization}
          navigate={({ to, replace }) => (replace ? router.replace(to) : router.push(to))}
          Link={Link}
          avatar={{ enabled: false }}
          plugins={[
            usernamePlugin({
              localization: {
                username: "Brukernavn",
                usernamePlaceholder: "brukernavn",
                usernameOrEmailPlaceholder: "brukernavn",
                usernameAvailable: "Brukernavnet er ledig",
                usernameTaken: "Brukernavnet er opptatt",
                displayUsername: "Visningsnavn",
                displayUsernamePlaceholder: "Visningsnavn",
              },
            }),
            adminPlugin({
              roles: ["admin"],
              defaultRole: "admin",
              allowMultipleRoles: false,
              adminRoles: ["admin"],
              localization: adminUiLocalization,
            }),
            multiSessionPlugin({
              localization: {
                switchAccount: "Bytt konto",
                addAccount: "Legg til konto",
                manageAccounts: "Administrer kontoer",
                manageAccountsDescription: "Bytt mellom kontoer på denne enheten.",
              },
            }),
          ]}
        >
          {booted ? children : <AppLoading />}
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
