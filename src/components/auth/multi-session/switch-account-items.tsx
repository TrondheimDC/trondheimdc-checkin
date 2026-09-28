"use client"

import type { MultiSessionAuthClient } from "@better-auth-ui/core/plugins/multi-session"
import { useAuth, useSession } from "@better-auth-ui/react"
import {
  useListDeviceSessions,
  useSetActiveSession,
} from "@better-auth-ui/react/plugins/multi-session"
import { UserRoundCheck } from "lucide-react"

import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { adminLabel } from "@/lib/admin-identity"

export type SwitchAccountItemsProps = {
  className?: string
}

/**
 * Lists other accounts already signed in on this device (e.g. an
 * innsjekkstasjon session kept alive in the background) so staff can switch
 * without signing out first.
 */
export function SwitchAccountItems({ className }: SwitchAccountItemsProps) {
  const { authClient } = useAuth<MultiSessionAuthClient>()
  const { data: session } = useSession(authClient)
  const { data: deviceSessions } = useListDeviceSessions(authClient)
  const setActiveSession = useSetActiveSession(authClient)

  const otherSessions = (deviceSessions ?? []).filter(
    (device) => device.user.id !== session?.user.id,
  )

  if (!otherSessions.length) return null

  return (
    <>
      <DropdownMenuSeparator />
      {otherSessions.map((device) => (
        <DropdownMenuItem
          key={device.session.token}
          className={className}
          disabled={setActiveSession.isPending}
          onClick={() =>
            setActiveSession.mutate({ sessionToken: device.session.token })
          }
        >
          {setActiveSession.isPending ? (
            <Spinner />
          ) : (
            <UserRoundCheck className="text-muted-foreground" />
          )}
          Bytt til{" "}
          {adminLabel({
            username:
              (device.user as { username?: string | null }).username ??
              (device.user as { displayUsername?: string | null }).displayUsername,
            name: device.user.name
          }) || device.user.email}
        </DropdownMenuItem>
      ))}
    </>
  )
}
