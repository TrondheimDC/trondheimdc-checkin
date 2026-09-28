"use client"

import {
  DEFAULT_TABLE_SEARCH_DEBOUNCE_MS,
  fieldsWithModelValues,
  getAdditionalFieldDefaultValues,
  getAdditionalFieldSubmitValues,
  getClampedTablePageIndex
} from "@better-auth-ui/core"
import {
  type AdminAuthClient,
  type AdminListUsersParams,
  type AdminUser,
  banAdminUserOptions,
  createAdminUserOptions,
  impersonateAdminUserOptions,
  isAdminTarget,
  removeAdminUserOptions,
  revokeAdminUserSessionOptions,
  revokeAdminUserSessionsOptions,
  setAdminUserPasswordOptions,
  unbanAdminUserOptions,
  updateAdminUserOptions
} from "@better-auth-ui/core/plugins/admin"
import {
  useAuth,
  useAuthPlugin,
  useSession
} from "@better-auth-ui/react"
import {
  useAdminPermission,
  useAdminUser,
  useAdminUserSessions,
  useAdminUsers
} from "@better-auth-ui/react/plugins/admin"
import { useDebouncedValue } from "@tanstack/react-pacer"
import { keepPreviousData, useMutation } from "@tanstack/react-query"
import type { SortingState } from "@tanstack/react-table"
import type { BetterFetchError } from "better-auth/react"
import {
  BanIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisIcon,
  KeyRoundIcon,
  LogInIcon,
  Monitor,
  SearchIcon,
  ShieldAlertIcon,
  Trash2Icon,
  UserPlusIcon,
  UserRound
} from "lucide-react"
import { type FormEvent, useEffect, useMemo, useState } from "react"
import { UserAvatar } from "@/components/auth/user/user-avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupInput
} from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { adminPlugin } from "@/lib/auth/admin-plugin"
import {
  adminEmailFromUsername,
  adminLabel
} from "@/lib/admin-identity"
import { cn } from "@/lib/utils"
import { getAuthAdditionalFieldValidators, useAuthForm } from "../auth-form"
import { useServerTableState } from "../server-table-state"

import { createAdminColumnHelper, useAdminTable } from "./admin-table"

function StatusPill({
  banned,
  activeLabel = "Aktiv",
  bannedLabel = "Utestengt"
}: {
  banned?: boolean | null
  activeLabel?: string
  bannedLabel?: string
}) {
  return (
    <span
      className={
        banned
          ? "rounded-lg bg-[color-mix(in_srgb,var(--color-bg-danger)_22%,transparent)] px-2 py-0.5 text-sm"
          : "rounded-lg bg-[color-mix(in_srgb,var(--color-fg-brand)_22%,transparent)] px-2 py-0.5 text-sm"
      }
    >
      {banned ? bannedLabel : activeLabel}
    </span>
  )
}

type StatusFilter = "all" | "active" | "banned"
type DangerousAction = "ban" | "delete" | "impersonate" | "revokeAll"

type AdminUserWithUsername = AdminUser & { username?: string | null }

function usernameFields<T extends { name: string }>(fields: T[] | null | undefined): T[] {
  return (fields ?? []).filter((field) => field.name === "username")
}

export type AdminUsersProps = {
  className?: string
  onSelectedUserIdChange?: (userId: string | undefined) => void
  selectedUserId?: string
}

const formatDate = (value: Date | string | undefined | null) =>
  value
    ? new Intl.DateTimeFormat("nb-NO", { dateStyle: "medium" }).format(
        new Date(value)
      )
    : "–"

const asAdminRoles = (roles: string[]) => roles as ("user" | "admin")[]

const getBanDurationSeconds = (value: string) => {
  if (!value) return undefined
  const days = Number(value)
  if (!Number.isSafeInteger(days) || days <= 0) return null
  const seconds = days * 86_400
  return Number.isSafeInteger(seconds) ? seconds : null
}

const getAdminErrorMessage = (error: Error | null) => {
  const authError = error as BetterFetchError | null
  return authError?.error?.message ?? authError?.message
}

const adminColumnHelper = createAdminColumnHelper<AdminUser>()
const adminColumns = adminColumnHelper.columns([
  adminColumnHelper.accessor("name", { id: "name" }),
  adminColumnHelper.accessor("role", {
    id: "role",
    enableSorting: false
  }),
  adminColumnHelper.accessor("banned", {
    id: "status",
    enableSorting: false
  }),
  adminColumnHelper.accessor((user) => new Date(user.createdAt).getTime(), {
    id: "createdAt"
  })
])
const EMPTY_USERS: AdminUser[] = []
const INITIAL_ADMIN_SORTING: SortingState = [{ id: "createdAt", desc: true }]

/** Server-paginated user management with optional controlled inspector state. */
export function AdminUsers({
  className,
  onSelectedUserIdChange,
  selectedUserId: controlledSelectedUserId
}: AdminUsersProps) {
  const auth = useAuth<AdminAuthClient>()
  const config = useAuthPlugin(adminPlugin)
  const { localization } = config
  const [localSelectedUserId, setLocalSelectedUserId] = useState<string>()
  const tableState = useServerTableState({
    initialSorting: INITIAL_ADMIN_SORTING,
    pageSize: config.pageSize
  })
  const { columnFilters, globalFilter, pagination, setPagination, sorting } =
    tableState
  const [createOpen, setCreateOpen] = useState(false)
  const [debouncedSearch] = useDebouncedValue(globalFilter.trim(), {
    wait: DEFAULT_TABLE_SEARCH_DEBOUNCE_MS
  })
  const status = String(
    columnFilters.find((filter) => filter.id === "status")?.value ?? "all"
  ) as StatusFilter
  const primarySort = sorting[0]
  // better-auth admin searchField is only email|name — we mirror username into name.
  const sortBy = primarySort?.id === "name" ? "name" : "createdAt"
  const sortDirection = primarySort?.desc ? "desc" : "asc"
  const isSelectionControlled = onSelectedUserIdChange !== undefined
  const selectedUserId = isSelectionControlled
    ? controlledSelectedUserId
    : localSelectedUserId

  const setSelectedUserId = (userId: string | undefined) => {
    if (!isSelectionControlled) setLocalSelectedUserId(userId)
    onSelectedUserIdChange?.(userId)
  }

  const params = useMemo<AdminListUsersParams>(
    () => ({
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
      searchField: "name",
      searchOperator: "contains",
      searchValue: debouncedSearch || undefined,
      sortBy,
      sortDirection,
      // Brukere is admin accounts only — door printer logins live under
      // /admin/printers and must never show up (or be editable) here.
      // The list endpoint only supports one filter slot, so status
      // (active/banned) is applied client-side below instead.
      filterField: "role",
      filterOperator: "eq" as const,
      filterValue: "admin"
    }),
    [
      debouncedSearch,
      pagination.pageIndex,
      pagination.pageSize,
      sortBy,
      sortDirection
    ]
  )
  const permission = useAdminPermission(auth.authClient, { user: ["list"] })
  const users = useAdminUsers(auth.authClient, {
    enabled: permission.data?.success === true,
    params,
    placeholderData: keepPreviousData
  })
  const canCreate = useAdminPermission(auth.authClient, { user: ["create"] })
  const canGet = useAdminPermission(auth.authClient, { user: ["get"] })

  const total = users.data?.total ?? 0
  const visibleUsers = useMemo(() => {
    const all = users.data?.users ?? EMPTY_USERS
    if (status === "all") return all
    return all.filter((user) => Boolean(user.banned) === (status === "banned"))
  }, [users.data, status])

  useEffect(() => {
    if (!users.isSuccess) return
    const pageIndex = getClampedTablePageIndex(
      pagination.pageIndex,
      pagination.pageSize,
      total
    )
    if (pageIndex !== pagination.pageIndex) {
      setPagination((current) => ({ ...current, pageIndex }))
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    setPagination,
    total,
    users.isSuccess
  ])
  const table = useAdminTable(
    {
      atoms: tableState.atoms,
      columns: adminColumns,
      data: visibleUsers,
      getRowId: (user) => user.id,
      manualFiltering: true,
      manualPagination: true,
      manualSorting: true,
      rowCount: total
    },
    () => null
  )
  const from = total ? pagination.pageIndex * pagination.pageSize + 1 : 0
  const to = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize)

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: "all", label: localization.filterAllStatuses },
    { value: "active", label: localization.active },
    { value: "banned", label: localization.banned }
  ]
  const rows = table.getRowModel().rows
  const showPagination = total > pagination.pageSize

  return (
    <section className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Søk etter brukernavn</span>
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 opacity-50"
          />
          <input
            aria-label="Søk etter brukernavn"
            className="h-14 w-full rounded-xl bg-[var(--color-bg-surface)] pr-4 pl-12 text-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-fg-brand)]"
            onChange={(event) => {
              table.setGlobalFilter(event.target.value)
              table.setPageIndex(0)
            }}
            placeholder="Søk etter brukernavn"
            value={globalFilter}
          />
        </label>
        {canCreate.isPending ? (
          <Skeleton className="h-14 w-36 rounded-xl" />
        ) : canCreate.data?.success ? (
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlusIcon className="size-5" aria-hidden />
            {localization.createUser}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={localization.status}>
        {statusFilters.map((filter) => (
          <Button
            key={filter.value}
            type="button"
            size="sm"
            variant={status === filter.value ? "default" : "surface"}
            onClick={() => {
              table
                .getColumn("status")
                ?.setFilterValue(filter.value === "all" ? undefined : filter.value)
              table.setPageIndex(0)
            }}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {permission.isPending ? (
        <UserListSkeleton />
      ) : !permission.data?.success ? (
        <AdminState
          icon={<ShieldAlertIcon />}
          title={localization.accessDenied}
          description={localization.accessDeniedDescription}
        />
      ) : users.isError ? (
        <AdminState
          icon={<ShieldAlertIcon />}
          title={localization.loadUsersError}
          description={localization.loadUsersErrorDescription}
          action={
            <Button variant="surface" onClick={() => users.refetch()}>
              {localization.retry}
            </Button>
          }
        />
      ) : users.isPending ? (
        <UserListSkeleton />
      ) : rows.length === 0 ? (
        <AdminState
          icon={<UserRound />}
          title={localization.noUsers}
          description={localization.noUsersDescription}
          action={
            canCreate.data?.success ? (
              <Button onClick={() => setCreateOpen(true)}>
                <UserPlusIcon className="size-5" aria-hidden />
                {localization.createUser}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const user = row.original as AdminUserWithUsername
            const label = adminLabel(user)
            const canOpen = canGet.data?.success === true
            return (
              <li key={row.id}>
                <Button
                  type="button"
                  variant="surface"
                  disabled={!canOpen}
                  aria-selected={selectedUserId === user.id}
                  className="h-auto w-full items-center justify-start gap-4 px-4 py-4 text-left whitespace-normal"
                  onClick={() => canOpen && setSelectedUserId(user.id)}
                >
                  <UserAvatar
                    className="size-12 shrink-0 bg-black/30 text-base"
                    user={user}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-xl font-semibold">{label}</span>
                      <StatusPill
                        banned={user.banned}
                        activeLabel={localization.active}
                        bannedLabel={localization.banned}
                      />
                    </div>
                    <p className="mt-1 text-sm opacity-60">
                      {localization.created} {formatDate(user.createdAt)}
                    </p>
                  </div>
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {showPagination ? (
        <div className="flex items-center justify-between gap-3 text-sm opacity-70">
          <span>
            {localization.usersPaginationRange
              .replace("{{from}}", String(from))
              .replace("{{to}}", String(to))
              .replace("{{total}}", String(total))}
          </span>
          <div className="flex gap-2">
            <Button
              aria-label={localization.previousPage}
              disabled={!table.getCanPreviousPage() || users.isFetching}
              onClick={() => table.previousPage()}
              size="icon-sm"
              variant="surface"
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              aria-label={localization.nextPage}
              disabled={!table.getCanNextPage() || users.isFetching}
              onClick={() => table.nextPage()}
              size="icon-sm"
              variant="surface"
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      ) : null}

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <UserInspector
        canGetUser={canGet.data?.success === true}
        open={Boolean(selectedUserId) && canGet.data?.success === true}
        onOpenChange={(open) => !open && setSelectedUserId(undefined)}
        userId={selectedUserId}
      />
    </section>
  )
}

function AdminState({
  action,
  description,
  icon,
  title
}: {
  action?: React.ReactNode
  description: string
  icon: React.ReactNode
  title: string
}) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-2xl bg-[var(--color-bg-surface)] px-6 py-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-2xl bg-black/30 text-[var(--color-fg-brand)] [&>svg]:size-8">
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl">{title}</h2>
        <p className="max-w-sm text-base opacity-70">{description}</p>
      </div>
      {action}
    </section>
  )
}

const skeletonRowIds = [
  "admin-row-1",
  "admin-row-2",
  "admin-row-3",
  "admin-row-4"
]

function UserListSkeleton() {
  return (
    <ul className="flex flex-col gap-3" aria-hidden>
      {skeletonRowIds.map((id) => (
        <li
          key={id}
          className="flex items-center gap-4 rounded-2xl bg-[var(--color-bg-surface)] px-4 py-4"
        >
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        </li>
      ))}
    </ul>
  )
}

function CreateUserDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const auth = useAuth<AdminAuthClient>()
  const config = useAuthPlugin(adminPlugin)
  const { data: session } = useSession(auth.authClient)
  const createUser = useMutation(
    createAdminUserOptions(auth.authClient, session?.user.id)
  )
  const fields = usernameFields(auth.additionalFields)
  const form = useAuthForm({
    defaultValues: {
      additionalFields: getAdditionalFieldDefaultValues(fields),
      password: ""
    },
    onSubmit: async ({ value }) => {
      const username = String(value.additionalFields.username ?? "")
        .trim()
        .toLowerCase()
      if (!username) return
      try {
        await createUser.mutateAsync(
          {
            data: {
              ...getAdditionalFieldSubmitValues(fields, {
                ...value.additionalFields,
                username
              }),
              emailVerified: true
            },
            email: adminEmailFromUsername(username),
            name: username,
            password: value.password,
            role: asAdminRoles(["admin"])
          },
          { onSuccess: close }
        )
      } catch {
        // The mutation reports the error through its configured handler.
      }
    }
  })

  const close = () => {
    form.reset()
    createUser.reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => (value ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <form.AppForm>
          <form.AuthFormRoot className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{config.localization.createUser}</DialogTitle>
              <DialogDescription>
                Bare brukernavn og passord.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup>
              {fields.map((configuredField) => (
                <form.AppField
                  key={configuredField.name}
                  name={`additionalFields.${configuredField.name}`}
                  validators={getAuthAdditionalFieldValidators(
                    configuredField,
                    auth.localization.auth.fieldRequired
                  )}
                >
                  {(field) => (
                    <field.AuthFormAdditionalField
                      field={configuredField}
                      isPending={createUser.isPending}
                    />
                  )}
                </form.AppField>
              ))}
              <form.Field name="password">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor="admin-create-password">
                      {config.localization.password}
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        autoComplete="new-password"
                        id="admin-create-password"
                        name={field.name}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        placeholder={auth.localization.auth.passwordPlaceholder}
                        required
                        type="password"
                        value={field.state.value}
                      />
                    </InputGroup>
                  </Field>
                )}
              </form.Field>
            </FieldGroup>
            <FieldError className="text-[var(--color-bg-danger)]">
              {getAdminErrorMessage(createUser.error)}
            </FieldError>
            <DialogFooter className="mt-2 flex-col gap-3 sm:flex-col">
              <form.AuthFormSubmitButton disabled={createUser.isPending} size="lg">
                {config.localization.createUser}
              </form.AuthFormSubmitButton>
              <Button onClick={close} type="button" variant="surface" size="lg">
                {config.localization.cancel}
              </Button>
            </DialogFooter>
          </form.AuthFormRoot>
        </form.AppForm>
      </DialogContent>
    </Dialog>
  )
}

function UserInspector({
  canGetUser,
  open,
  onOpenChange,
  userId
}: {
  canGetUser: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  userId?: string
}) {
  const auth = useAuth<AdminAuthClient>()
  const config = useAuthPlugin(adminPlugin)
  const contributedTabs = auth.plugins.flatMap((plugin) =>
    (plugin.adminUserTabs ?? []).map((tab) => ({
      ...tab,
      value: `${plugin.id}:${tab.id}`
    }))
  )
  const detail = useAdminUser(auth.authClient, userId, {
    enabled: canGetUser
  })
  const user = detail.data
  const sessionsPermission = useAdminPermission(
    auth.authClient,
    {
      session: ["list"]
    },
    { enabled: Boolean(userId) }
  )
  const sessions = useAdminUserSessions(auth.authClient, userId, {
    enabled: sessionsPermission.data?.success === true
  })
  const { data: actor } = useSession(auth.authClient)
  const canUpdate = useAdminPermission(
    auth.authClient,
    { user: ["update"] },
    { enabled: Boolean(userId) }
  )
  const canSetEmail = useAdminPermission(
    auth.authClient,
    { user: ["set-email"] },
    { enabled: Boolean(userId) }
  )
  const canSetPassword = useAdminPermission(
    auth.authClient,
    {
      user: ["set-password"]
    },
    { enabled: Boolean(userId) }
  )
  const canBan = useAdminPermission(
    auth.authClient,
    { user: ["ban"] },
    { enabled: Boolean(userId) }
  )
  const canImpersonate = useAdminPermission(
    auth.authClient,
    {
      user: ["impersonate"]
    },
    { enabled: Boolean(userId) }
  )
  const targetIsAdmin = user
    ? isAdminTarget(user, config.adminRoles, config.adminUserIds)
    : false
  const canImpersonateAdmins = useAdminPermission(
    auth.authClient,
    { user: ["impersonate-admins"] },
    { enabled: Boolean(userId && targetIsAdmin) }
  )
  const canDelete = useAdminPermission(
    auth.authClient,
    { user: ["delete"] },
    { enabled: Boolean(userId) }
  )
  const canRevoke = useAdminPermission(
    auth.authClient,
    {
      session: ["revoke"]
    },
    { enabled: Boolean(userId) }
  )

  const [banReason, setBanReason] = useState("")
  const [banDuration, setBanDuration] = useState("")
  const banDurationSeconds = getBanDurationSeconds(banDuration)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [dangerousAction, setDangerousAction] = useState<DangerousAction>()
  const isSelf = user?.id === actor?.user.id

  const updateUser = useMutation(
    updateAdminUserOptions(auth.authClient, actor?.user.id)
  )

  useEffect(() => {
    if (user?.id) updateUser.reset()
  }, [user?.id, updateUser.reset])

  useEffect(() => {
    if (!open) updateUser.reset()
  }, [open, updateUser.reset])

  const ban = useMutation(banAdminUserOptions(auth.authClient, actor?.user.id))
  const unban = useMutation(
    unbanAdminUserOptions(auth.authClient, actor?.user.id)
  )
  const remove = useMutation(
    removeAdminUserOptions(auth.authClient, actor?.user.id)
  )
  const impersonate = useMutation(
    impersonateAdminUserOptions(auth.authClient, actor?.user.id)
  )
  const revokeSession = useMutation(
    revokeAdminUserSessionOptions(auth.authClient, actor?.user.id, userId)
  )
  const revokeSessions = useMutation(
    revokeAdminUserSessionsOptions(auth.authClient, actor?.user.id, userId)
  )
  const configuredUserFields = useMemo(
    () =>
      usernameFields(
        fieldsWithModelValues(
          auth.additionalFields ?? [],
          user ? (user as unknown as Record<string, unknown>) : {}
        )
      ),
    [auth.additionalFields, user]
  )
  const profileForm = useAuthForm({
    defaultValues: {
      additionalFields: getAdditionalFieldDefaultValues(configuredUserFields)
    },
    onSubmit: async ({ value }) => {
      if (!user) return

      const username = String(value.additionalFields.username ?? "")
        .trim()
        .toLowerCase()
      if (!username) return
      if (!canUpdate.data?.success) return

      try {
        await updateUser.mutateAsync({
          userId: user.id,
          data: {
            ...getAdditionalFieldSubmitValues(configuredUserFields, {
              ...value.additionalFields,
              username
            }),
            name: username,
            ...(canSetEmail.data?.success
              ? {
                  email: adminEmailFromUsername(username),
                  emailVerified: true
                }
              : {})
          }
        })
        onOpenChange(false)
      } catch {
        // Mutation errors are rendered next to the form.
      }
    }
  })

  useEffect(() => {
    profileForm.reset({
      additionalFields: getAdditionalFieldDefaultValues(configuredUserFields)
    })
  }, [configuredUserFields, profileForm.reset, user])

  const confirm = () => {
    if (!user) return
    if (dangerousAction === "ban") {
      if (banDurationSeconds === null) return
      ban.mutate(
        {
          banExpiresIn: banDurationSeconds,
          banReason: banReason.trim() || undefined,
          userId: user.id
        },
        {
          onSuccess: () => {
            setBanDuration("")
            setBanReason("")
            setDangerousAction(undefined)
          }
        }
      )
    }
    if (dangerousAction === "delete")
      remove.mutate(
        { userId: user.id },
        {
          onSuccess: () => {
            setDangerousAction(undefined)
            onOpenChange(false)
          }
        }
      )
    if (dangerousAction === "revokeAll")
      revokeSessions.mutate(
        { userId: user.id },
        { onSuccess: () => setDangerousAction(undefined) }
      )
    if (dangerousAction === "impersonate")
      impersonate.mutate(
        { userId: user.id },
        {
          onSuccess: () => {
            setDangerousAction(undefined)
            if (config.impersonationRedirectTo)
              auth.navigate({ to: config.impersonationRedirectTo })
          }
        }
      )
  }
  const closeDangerousAction = () => {
    ban.reset()
    remove.reset()
    revokeSessions.reset()
    impersonate.reset()
    setBanDuration("")
    setBanReason("")
    setDangerousAction(undefined)
  }
  const dangerousMutation =
    dangerousAction === "ban"
      ? ban
      : dangerousAction === "delete"
        ? remove
        : dangerousAction === "revokeAll"
          ? revokeSessions
          : impersonate
  const dangerousError = getAdminErrorMessage(dangerousMutation.error)
  const dangerLabel =
    dangerousAction === "ban"
      ? config.localization.banUser
      : dangerousAction === "delete"
        ? config.localization.deleteUser
        : dangerousAction === "revokeAll"
          ? config.localization.revokeAllSessions
          : config.localization.impersonateUser

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="h-[min(52rem,calc(100dvh-2rem))] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-white/10 px-6 py-5 pr-14">
            {user ? (
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar
                    className="size-12 bg-black/30 text-base"
                    user={user}
                  />
                  <div className="min-w-0">
                    <DialogTitle className="truncate">
                      {adminLabel(user as AdminUserWithUsername)}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      <StatusPill
                        banned={user.banned}
                        activeLabel={config.localization.active}
                        bannedLabel={config.localization.banned}
                      />
                    </DialogDescription>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      aria-label={config.localization.moreActions}
                      size="icon-sm"
                      variant="surface"
                    >
                      <EllipsisIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        disabled={
                          canImpersonate.isPending ||
                          !canImpersonate.data?.success ||
                          (targetIsAdmin &&
                            (canImpersonateAdmins.isPending ||
                              !canImpersonateAdmins.data?.success)) ||
                          isSelf
                        }
                        onSelect={() => setDangerousAction("impersonate")}
                      >
                        <LogInIcon />
                        {config.localization.impersonateUser}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <>
                <DialogTitle>{config.localization.userDetails}</DialogTitle>
                <DialogDescription>
                  {config.localization.usersDescription}
                </DialogDescription>
              </>
            )}
          </DialogHeader>
          {detail.isPending ? (
            <div className="flex flex-col gap-3 p-6">
              <Skeleton className="size-14 rounded-full" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : user ? (
            <Tabs
              className="min-h-0 gap-0 overflow-hidden"
              defaultValue="overview"
            >
              <TabsList className="mx-6 h-11 shrink-0 bg-transparent" variant="line">
                <TabsTrigger value="overview">
                  <UserRound aria-hidden="true" className="opacity-70" />
                  {config.localization.overview}
                </TabsTrigger>
                <TabsTrigger
                  disabled={
                    sessionsPermission.isPending ||
                    !sessionsPermission.data?.success
                  }
                  value="sessions"
                >
                  <Monitor aria-hidden="true" className="opacity-70" />
                  {config.localization.sessions}
                </TabsTrigger>
                {contributedTabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent className="min-h-0 overflow-hidden" value="overview">
                <profileForm.AppForm>
                  <profileForm.AuthFormRoot className="grid h-full grid-rows-[minmax(0,1fr)_auto]">
                    <div className="overflow-y-auto">
                      <section className="flex flex-col gap-5 p-6">
                        <h3 className="text-lg font-semibold">
                          {config.localization.profileAndAccess}
                        </h3>
                        <FieldGroup>
                          {configuredUserFields.map((configuredField) => (
                            <profileForm.AppField
                              key={configuredField.name}
                              name={`additionalFields.${configuredField.name}`}
                              validators={getAuthAdditionalFieldValidators(
                                configuredField,
                                auth.localization.auth.fieldRequired
                              )}
                            >
                              {(field) => (
                                <field.AuthFormAdditionalField
                                  field={configuredField}
                                  isPending={
                                    updateUser.isPending ||
                                    !canUpdate.data?.success
                                  }
                                />
                              )}
                            </profileForm.AppField>
                          ))}
                        </FieldGroup>
                        <p className="text-sm opacity-60">
                          {config.localization.created}:{" "}
                          {formatDate(user.createdAt)}
                        </p>
                        {user.banned && user.banReason ? (
                          <p className="text-sm opacity-60">
                            {config.localization.banReason}: {user.banReason}
                          </p>
                        ) : null}
                        <FieldError className="text-[var(--color-bg-danger)]">
                          {getAdminErrorMessage(updateUser.error)}
                        </FieldError>
                      </section>
                      <Separator className="bg-white/10" />
                      <section className="flex flex-col gap-4 p-6">
                        <h3 className="text-lg font-semibold">
                          {config.localization.security}
                        </h3>
                        <Button
                          disabled={
                            canSetPassword.isPending ||
                            !canSetPassword.data?.success
                          }
                          onClick={() => setPasswordOpen(true)}
                          type="button"
                          variant="surface"
                        >
                          <KeyRoundIcon className="size-5" aria-hidden />
                          {config.localization.setPassword}
                        </Button>
                      </section>
                      <Separator className="bg-white/10" />
                      <section className="flex flex-col gap-4 p-6">
                        <h3 className="text-lg font-semibold">
                          {config.localization.dangerZone}
                        </h3>
                        <div className="flex flex-col gap-2">
                          <Button
                            disabled={
                              canBan.isPending ||
                              !canBan.data?.success ||
                              isSelf
                            }
                            onClick={() =>
                              user.banned
                                ? unban.mutate({ userId: user.id })
                                : setDangerousAction("ban")
                            }
                            type="button"
                            variant="surface"
                          >
                            <BanIcon className="size-5" aria-hidden />
                            {user.banned
                              ? config.localization.unbanUser
                              : config.localization.banUser}
                          </Button>
                          <Button
                            disabled={
                              canDelete.isPending ||
                              !canDelete.data?.success ||
                              isSelf
                            }
                            onClick={() => setDangerousAction("delete")}
                            type="button"
                            variant="ghost"
                            className="text-[var(--color-bg-danger)] hover:bg-[color-mix(in_srgb,var(--color-bg-danger)_16%,transparent)] hover:text-[var(--color-bg-danger)]"
                          >
                            <Trash2Icon className="size-5" aria-hidden />
                            {config.localization.deleteUser}
                          </Button>
                        </div>
                        {unban.error ? (
                          <FieldError className="text-[var(--color-bg-danger)]">
                            {getAdminErrorMessage(unban.error)}
                          </FieldError>
                        ) : null}
                      </section>
                    </div>
                    <div className="flex flex-col gap-2 border-t border-white/10 bg-black/20 px-6 py-4">
                      <profileForm.Subscribe
                        selector={(state) =>
                          String(state.values.additionalFields.username ?? "")
                        }
                      >
                        {(username) => (
                          <profileForm.AuthFormSubmitButton
                            disabled={
                              !username.trim() ||
                              updateUser.isPending ||
                              canUpdate.isPending ||
                              !canUpdate.data?.success
                            }
                            size="lg"
                          >
                            {config.localization.saveChanges}
                          </profileForm.AuthFormSubmitButton>
                        )}
                      </profileForm.Subscribe>
                      <Button
                        onClick={() => onOpenChange(false)}
                        type="button"
                        variant="surface"
                        size="lg"
                      >
                        {config.localization.cancel}
                      </Button>
                    </div>
                  </profileForm.AuthFormRoot>
                </profileForm.AppForm>
              </TabsContent>
              <TabsContent
                className="min-h-0 overflow-y-auto p-6"
                value="sessions"
              >
                <div className="flex flex-col gap-3">
                  {sessionsPermission.isPending || sessions.isPending ? (
                    skeletonRowIds
                      .slice(0, 3)
                      .map((id) => (
                        <Skeleton
                          className="h-20 w-full rounded-2xl"
                          key={`session-${id}`}
                        />
                      ))
                  ) : !sessionsPermission.data?.success ? (
                    <p className="text-sm opacity-70">
                      {config.localization.accessDeniedDescription}
                    </p>
                  ) : sessions.data?.sessions.length ? (
                    <>
                      <Button
                        className="self-end"
                        disabled={
                          canRevoke.isPending ||
                          !canRevoke.data?.success ||
                          isSelf
                        }
                        onClick={() => setDangerousAction("revokeAll")}
                        variant="surface"
                        size="sm"
                      >
                        {config.localization.revokeAllSessions}
                      </Button>
                      {sessions.data.sessions.map((item) => (
                        <div
                          className="flex items-start justify-between gap-3 rounded-2xl bg-[var(--color-bg-surface)] p-4"
                          key={item.id}
                        >
                          <div className="min-w-0 text-sm">
                            <div className="truncate font-medium">
                              {item.userAgent || config.localization.sessions}
                            </div>
                            <div className="mt-1 text-xs opacity-60">
                              {formatDate(item.createdAt)} ·{" "}
                              {formatDate(item.expiresAt)}
                            </div>
                            {config.showIpAddress && item.ipAddress ? (
                              <div className="mt-1 font-mono text-xs opacity-60">
                                {item.ipAddress}
                              </div>
                            ) : null}
                          </div>
                          <Button
                            aria-label={config.localization.revoke}
                            disabled={
                              revokeSession.isPending ||
                              canRevoke.isPending ||
                              !canRevoke.data?.success ||
                              isSelf
                            }
                            onClick={() =>
                              revokeSession.mutate({ sessionToken: item.token })
                            }
                            size="icon-sm"
                            variant="ghost"
                            className="text-[var(--color-bg-danger)] hover:bg-[color-mix(in_srgb,var(--color-bg-danger)_16%,transparent)] hover:text-[var(--color-bg-danger)]"
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="py-8 text-center text-sm opacity-70">
                      {config.localization.noSessions}
                    </p>
                  )}
                </div>
              </TabsContent>
              {contributedTabs.map((tab) => {
                const ContributedTab = tab.component
                return (
                  <TabsContent
                    className="min-h-0 overflow-y-auto p-6"
                    key={tab.value}
                    value={tab.value}
                  >
                    <ContributedTab userId={user.id} />
                  </TabsContent>
                )
              })}
            </Tabs>
          ) : (
            <AdminState
              icon={<ShieldAlertIcon />}
              title={config.localization.loadUsersError}
              description={config.localization.loadUsersErrorDescription}
            />
          )}
        </DialogContent>
      </Dialog>
      <PasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        userId={user?.id}
      />
      <AlertDialog
        open={Boolean(dangerousAction)}
        onOpenChange={(value) => !value && closeDangerousAction()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dangerLabel}</AlertDialogTitle>
            <AlertDialogDescription>
              {user
                ? adminLabel(user as AdminUserWithUsername)
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {dangerousAction === "ban" ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="admin-ban-reason">
                  {config.localization.banReason}
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="admin-ban-reason"
                    onChange={(event) => setBanReason(event.target.value)}
                    value={banReason}
                  />
                </InputGroup>
              </Field>
              <Field>
                <FieldLabel htmlFor="admin-ban-duration">
                  {config.localization.banDuration}
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="admin-ban-duration"
                    min="1"
                    onChange={(event) => setBanDuration(event.target.value)}
                    step="1"
                    type="number"
                    value={banDuration}
                  />
                </InputGroup>
                <p className="text-xs opacity-60">
                  {config.localization.banDurationDescription}
                </p>
              </Field>
            </FieldGroup>
          ) : null}
          {dangerousError ? <FieldError>{dangerousError}</FieldError> : null}
          <AlertDialogFooter>
            <AlertDialogCancel>{config.localization.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                isSelf ||
                dangerousMutation.isPending ||
                (dangerousAction === "ban" && banDurationSeconds === null)
              }
              onClick={(event) => {
                event.preventDefault()
                confirm()
              }}
              variant={dangerousAction === "delete" ? "destructive" : "default"}
            >
              {dangerLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function PasswordDialog({
  open,
  onOpenChange,
  userId
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId?: string
}) {
  const auth = useAuth<AdminAuthClient>()
  const config = useAuthPlugin(adminPlugin)
  const [password, setPassword] = useState("")
  const [errorMessage, setErrorMessage] = useState<string>()
  const mutation = useMutation(
    setAdminUserPasswordOptions(auth.authClient, () => {
      setTimeout(() => mutation.reset(), 0)
    })
  )
  const close = () => {
    setPassword("")
    setErrorMessage(undefined)
    mutation.reset()
    onOpenChange(false)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setErrorMessage(undefined)
    if (userId)
      mutation.mutate(
        { userId, newPassword: password },
        {
          onError: (error) => setErrorMessage(getAdminErrorMessage(error)),
          onSuccess: close
        }
      )
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => (value ? onOpenChange(true) : close())}
    >
      <DialogContent>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{config.localization.setPassword}</DialogTitle>
            <DialogDescription>
              Nytt passord for brukeren.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={Boolean(errorMessage)}>
            <FieldLabel htmlFor="admin-new-password">
              {config.localization.password}
            </FieldLabel>
            <InputGroup>
              <InputGroupInput
                aria-invalid={Boolean(errorMessage)}
                autoComplete="new-password"
                id="admin-new-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder={auth.localization.auth.passwordPlaceholder}
                required
                type="password"
                value={password}
              />
            </InputGroup>
            <FieldError>{errorMessage}</FieldError>
          </Field>
          <DialogFooter className="mt-2 flex-col gap-3 sm:flex-col">
            <Button disabled={!password || mutation.isPending} type="submit" size="lg">
              {config.localization.setPassword}
            </Button>
            <Button onClick={close} type="button" variant="surface" size="lg">
              {config.localization.cancel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
