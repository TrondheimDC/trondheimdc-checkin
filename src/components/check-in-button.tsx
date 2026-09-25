"use client"

import { LoaderCircle, LogIn, LogOut } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function CheckInButton({
  checkedIn,
  onToggle,
}: {
  checkedIn: boolean
  onToggle: () => Promise<void>
}) {
  const [pending, setPending] = useState(false)
  const [displayCheckedIn, setDisplayCheckedIn] = useState(checkedIn)

  useEffect(() => {
    if (pending) return
    setDisplayCheckedIn(checkedIn)
  }, [checkedIn, pending])

  return (
    <Button
      variant="surface"
      size="lg"
      disabled={pending}
      aria-busy={pending}
      className={cn("checkin-btn", displayCheckedIn && !pending && "checkin-btn--checked")}
      onClick={() => {
        const next = !displayCheckedIn
        setPending(true)
        void onToggle()
          .then(() => setDisplayCheckedIn(next))
          .catch(() => {})
          .finally(() => setPending(false))
      }}
    >
      {pending ? (
        <>
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
          {displayCheckedIn ? "Sjekker ut…" : "Sjekker inn…"}
        </>
      ) : (
        <>
          {displayCheckedIn ? (
            <LogOut className="size-5" aria-hidden />
          ) : (
            <LogIn className="size-5" aria-hidden />
          )}
          {displayCheckedIn ? "Sjekk ut" : "Sjekk inn"}
        </>
      )}
    </Button>
  )
}
