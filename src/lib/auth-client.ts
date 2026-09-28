import {
  adminClient,
  inferAdditionalFields,
  multiSessionClient,
  usernameClient,
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import type { auth } from "@/lib/auth"

const base = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || ""

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? `${window.location.origin}${base}`
      : process.env.BETTER_AUTH_URL || "http://localhost:3000",
  plugins: [
    adminClient(),
    usernameClient(),
    multiSessionClient(),
    inferAdditionalFields<typeof auth>(),
  ],
})
