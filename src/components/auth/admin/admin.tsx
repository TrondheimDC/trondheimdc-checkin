"use client"

import type { AdminView } from "@better-auth-ui/core"
import { useAuth, useAuthenticate, useAuthPlugin } from "@better-auth-ui/react"
import { ShieldAlertIcon, UsersIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { adminPlugin } from "@/lib/auth/admin-plugin"
import { cn } from "@/lib/utils"

import { AdminUsers } from "./admin-users"

export type AdminProps = {
  className?: string
  hideNav?: boolean
  path?: string
  view?: AdminView | string
}

/** Render a finite, static administration route and plugin-contributed tabs. */
export function Admin({ className, hideNav, path, view }: AdminProps) {
  const { authClient, basePaths, plugins, viewPaths } = useAuth()
  const { localization } = useAuthPlugin(adminPlugin)
  useAuthenticate(authClient)

  if (!view && !path) {
    throw new Error("[Better Auth UI] Either `view` or `path` must be provided")
  }

  const contributedTabs = plugins.flatMap((plugin) => plugin.adminTabs ?? [])
  const currentView =
    view ??
    (viewPaths.admin.users === path ? "users" : undefined) ??
    contributedTabs.find((tab) => tab.path === path)?.id
  const contributedView = contributedTabs.find((tab) => tab.id === currentView)

  return (
    <div className={cn("flex w-full flex-col gap-6", className)}>
      {!hideNav && (
        <nav aria-label={localization.admin} className="flex gap-1 border-b">
          <Button
            aria-current={currentView === "users" ? "page" : undefined}
            asChild
            className="rounded-b-none"
            variant={currentView === "users" ? "secondary" : "ghost"}
          >
            <a href={`${basePaths.admin}/${viewPaths.admin.users}`}>
              <UsersIcon />
              {localization.users}
            </a>
          </Button>

          {contributedTabs.map((tab) => (
            <Button
              key={`${tab.id}-${tab.path}`}
              aria-current={currentView === tab.id ? "page" : undefined}
              asChild
              className="rounded-b-none"
              variant={currentView === tab.id ? "secondary" : "ghost"}
            >
              <a href={`${basePaths.admin}/${tab.path}`}>{tab.label}</a>
            </Button>
          ))}
        </nav>
      )}

      {currentView === "users" ? (
        <AdminUsers />
      ) : contributedView ? (
        <contributedView.component />
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl bg-[var(--color-bg-surface)] px-6 py-10 text-center">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-black/30 text-[var(--color-fg-brand)]">
            <ShieldAlertIcon className="size-8" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl">{localization.unknownView}</h2>
            <p className="max-w-md text-base opacity-70">
              {localization.unknownViewDescription} &quot;{path ?? view}&quot;
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
