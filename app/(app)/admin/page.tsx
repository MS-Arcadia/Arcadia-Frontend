"use client"

import {
  Check,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useBanMutation,
  useDecideRegistrationMutation,
  useDecideRoleRequestMutation,
  useDirectoryQuery,
  useGrantRoleMutation,
  usePendingRoleRequestsQuery,
} from "@/queries/auth"
import { useAuthStore, useHasRole } from "@/stores/auth.store"
import { formatRelative } from "@/lib/datetime"
import { cn } from "@/lib/utils"
import type { UserState, UserSummary } from "@/types/auth.api.type"
import type { Role } from "@/types/common.api.type"

const ROLES: Role[] = ["BASIC_USER", "DEVELOPER", "SUPPORT", "ADMIN"]

const ROLE_LABEL: Record<Role, string> = {
  BASIC_USER: "Player",
  DEVELOPER: "Developer",
  SUPPORT: "Support",
  ADMIN: "Administrator",
}

const STATE_TONE: Record<UserState, string> = {
  ACTIVE: "bg-primary/15 text-primary border-primary/25",
  PENDING: "bg-warning/15 text-warning border-warning/25",
  REJECTED: "bg-muted text-muted-foreground border-border",
  BANNED: "bg-destructive/15 text-destructive border-destructive/25",
}

export default function AdminPage() {
  const isAdmin = useHasRole("ADMIN")
  const me = useAuthStore((state) => state.user)
  const { data: directory, isPending: isDirectoryPending } = useDirectoryQuery()
  const { data: pendingRequests, isPending: isRequestsPending } =
    usePendingRoleRequestsQuery()

  const decideRegistration = useDecideRegistrationMutation()
  const decideRole = useDecideRoleRequestMutation()

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <ShieldCheck
          className="mx-auto size-8 text-muted-foreground/40"
          strokeWidth={1.5}
          aria-hidden
        />
        <h1 className="mt-4 text-lg font-semibold">Administrators only</h1>
      </div>
    )
  }

  const users = directory?.items ?? []
  const pending = users.filter((user) => user.state === "PENDING")
  // Use real pending requests if available, otherwise fallback to mock data
  const requests =
    pendingRequests ??
    directory?.roleRequests?.filter((r) => r.status === "PENDING") ??
    []
  const rest = users.filter((user) => user.state !== "PENDING")

  const isLoading = isDirectoryPending || isRequestsPending

  return (
    <div className="mx-auto w-full max-w-4xl space-y-10">
      <div>
        <h1 className="text-xl font-semibold">Accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A new account cannot sign in until it is approved here.
        </p>
      </div>

      {isLoading && <Skeleton className="h-40 w-full rounded-xl" />}

      {/* --- waiting to be let in ---------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Waiting for approval
          {pending.length > 0 && (
            <Badge className="ms-2 border-warning/25 bg-warning/15 text-warning">
              {pending.length}
            </Badge>
          )}
        </h2>

        {pending.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nobody is waiting.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {pending.map((user) => (
              <li
                key={user.user_id}
                className="flex flex-wrap items-center gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{user.display_name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-9"
                    disabled={decideRegistration.isPending}
                    onClick={() =>
                      decideRegistration.mutate({
                        userId: user.user_id,
                        approve: false,
                      })
                    }
                  >
                    <X className="size-3.5" />
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    className="min-h-9"
                    disabled={decideRegistration.isPending}
                    onClick={() =>
                      decideRegistration.mutate({
                        userId: user.user_id,
                        approve: true,
                      })
                    }
                  >
                    {decideRegistration.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                    Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- asking for a role ------------------------------------------- */}
      {requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Role requests</h2>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {requests.map((request) => (
              <li
                key={request.request_id}
                className="flex flex-wrap items-center gap-3 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {request.display_name ||
                      `User ${request.user_id.slice(0, 8)}`}{" "}
                    wants to be a{" "}
                    {ROLE_LABEL[request.requested_role]?.toLowerCase() ??
                      request.requested_role}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    asked {formatRelative(request.created_at)}
                    {request.decision_note &&
                      ` · note: ${request.decision_note}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-9"
                    disabled={decideRole.isPending}
                    onClick={() =>
                      decideRole.mutate({
                        requestId: request.request_id,
                        approve: false,
                      })
                    }
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    className="min-h-9"
                    disabled={decideRole.isPending}
                    onClick={() =>
                      decideRole.mutate({
                        requestId: request.request_id,
                        approve: true,
                      })
                    }
                  >
                    {decideRole.isPending && (
                      <Loader2 className="size-3.5 animate-spin" />
                    )}
                    Grant
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --- everybody else ---------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Everyone</h2>
        {rest.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No other users.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {rest.map((user) => (
              <UserRow
                key={user.user_id}
                user={user}
                isSelf={user.user_id === me?.user_id}
              />
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground/70">
          The auth service has no search endpoint, so this list comes from the
          mock. With a real service behind it, this section needs one adding.
        </p>
      </section>
    </div>
  )
}

function UserRow({ user, isSelf }: { user: UserSummary; isSelf: boolean }) {
  const grantRole = useGrantRoleMutation()
  const ban = useBanMutation()
  const busy = grantRole.isPending || ban.isPending

  return (
    <li className="flex flex-wrap items-center gap-3 p-4">
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <UserRound className="size-4" strokeWidth={1.75} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {user.display_name}
          {isSelf && (
            <span className="text-xs font-normal text-muted-foreground">
              (you)
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </div>

      <Badge className={cn("shrink-0", STATE_TONE[user.state])}>
        {user.state}
      </Badge>

      <Select
        value={user.role}
        onValueChange={(value) =>
          grantRole.mutate({ userId: user.user_id, role: value as Role })
        }
        disabled={busy || isSelf}
      >
        <SelectTrigger className="min-h-9 w-36 text-xs">
          <SelectValue>{ROLE_LABEL[user.role]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((role) => (
            <SelectItem key={role} value={role}>
              {ROLE_LABEL[role]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {user.state === "BANNED" ? (
        <Button
          variant="outline"
          size="sm"
          className="min-h-9"
          disabled={busy}
          onClick={() => ban.mutate({ userId: user.user_id, banned: false })}
        >
          <ShieldCheck className="size-3.5" />
          Restore
        </Button>
      ) : (
        <Button
          variant="destructive"
          size="sm"
          className="min-h-9"
          disabled={busy || isSelf}
          onClick={() =>
            ban.mutate({
              userId: user.user_id,
              banned: true,
              reason: "Suspended by an administrator",
            })
          }
        >
          <ShieldAlert className="size-3.5" />
          Suspend
        </Button>
      )}
    </li>
  )
}
