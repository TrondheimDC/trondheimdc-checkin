import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { doorLoginPath, safeNextPath } from "@/lib/login-next"
import { apiPath } from "@/lib/utils"

/**
 * The app arrives here from «Åpne appen» in a logged-in browser with a one-time code.
 * Redeeming it sets the browser's session cookie in the app's WebView (nextCookies), so
 * staff do not log in twice. A spent or expired code falls back to the normal login.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  const next = safeNextPath(request.nextUrl.searchParams.get("next")) ?? "/"
  let redeemed = false
  if (token) {
    try {
      await auth.api.verifyOneTimeToken({ body: { token }, headers: await headers() })
      redeemed = true
    } catch {
      // Spent, expired or unknown.
    }
  }
  redirect(apiPath(redeemed ? next : doorLoginPath(next)))
}
