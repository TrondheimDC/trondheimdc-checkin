"use client"

import { ExternalLink, LoaderCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { APP_DOWNLOAD_PATH, APP_LOGIN_PATH, appIntentUrl } from "@/lib/android-app"
import { apiPath } from "@/lib/utils"

/**
 * Opens the app on `next`, logged in as this browser: a one-time code minted on tap (not
 * on page load, so installing first does not let it expire) is redeemed at /app-login.
 * Without a code the app still opens, and asks for the login itself.
 *
 * `handoff={false}` opens the app without the login (this browser has none); `auto` opens it on
 * load too, where Chrome allows that without a tap.
 */
export function OpenAppButton({
  next,
  handoff = true,
  auto = false,
}: {
  next: string
  handoff?: boolean
  auto?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const opened = useRef(false)

  async function open() {
    setBusy(true)
    const fallback = `${window.location.origin}${apiPath(APP_DOWNLOAD_PATH)}`
    let path = apiPath(next)
    if (handoff) {
      try {
        const response = await fetch(apiPath("/api/app/handoff"), { method: "POST" })
        if (response.ok) {
          const { token } = (await response.json()) as { token: string }
          path = apiPath(`${APP_LOGIN_PATH}?${new URLSearchParams({ token, next })}`)
        }
      } catch {
        // Offline or logged out: open the app without handing over the login.
      }
    }
    window.location.href = appIntentUrl(path, fallback)
    setBusy(false)
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: once, on the first paint.
  useEffect(() => {
    if (!auto || opened.current) return
    opened.current = true
    void open()
  }, [auto])

  return (
    <Button
      variant="surface"
      className="h-12 w-full text-base"
      disabled={busy}
      onClick={() => void open()}
    >
      {busy ? (
        <LoaderCircle className="size-5 animate-spin" aria-hidden />
      ) : (
        <ExternalLink className="size-5" aria-hidden />
      )}
      Åpne appen
    </Button>
  )
}
