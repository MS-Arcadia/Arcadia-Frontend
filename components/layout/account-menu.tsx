"use client"

import Link from "next/link"
import {
  ChevronDown,
  ClipboardList,
  LogOut,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLogoutMutation, useRequestRoleMutation } from "@/queries/auth"
import { useAuthStore } from "@/stores/auth.store"
import type { Role } from "@/types/common.api.type"

const ROLE_LABEL: Record<Role, string> = {
  BASIC_USER: "Player",
  DEVELOPER: "Developer",
  SUPPORT: "Support",
  ADMIN: "Administrator",
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.at(0) ?? "")
    .join("")
    .toUpperCase()
}

export function AccountMenu() {
  const user = useAuthStore((state) => state.user)
  const signOut = useLogoutMutation()
  const requestRole = useRequestRoleMutation()

  if (!user) return null

  return (
    <div className="flex items-center gap-0.5">
      {/* Avatar – navigates to profile */}
      <Link
        href={`/profile/${user.user_id}`}
        aria-label={`${user.display_name}, profile`}
        className="rounded-full transition-colors hover:bg-muted"
      >
        <Avatar className="size-7">
          <AvatarFallback className="bg-primary/15 text-[0.7rem] font-semibold text-primary">
            {initials(user.display_name)}
          </AvatarFallback>
        </Avatar>
      </Link>

      {/* Dropdown trigger – opens the menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Account menu"
            >
              <ChevronDown className="size-3.5" />
            </Button>
          }
        />

        <DropdownMenuContent align="end" className="w-60">
          {/* Group: user info */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="space-y-1">
              <p className="text-sm font-medium">{user.display_name}</p>
              <p className="text-xs font-normal text-muted-foreground">
                {user.email}
              </p>
              <Badge className="mt-1 border-primary/25 bg-primary/15 text-primary">
                {ROLE_LABEL[user.role]}
              </Badge>
            </DropdownMenuLabel>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          {/* Group: navigation items */}
          <DropdownMenuGroup>
            {/* Profile is already accessible via avatar click; you may keep or remove it */}
            <DropdownMenuItem
              render={<Link href={`/profile/${user.user_id}`} />}
            >
              <UserRound className="size-4" />
              Profile
            </DropdownMenuItem>

            {user.role === "DEVELOPER" && (
              <DropdownMenuItem render={<Link href="/developer" />}>
                <Sparkles className="size-4" />
                My games
              </DropdownMenuItem>
            )}

            {(user.role === "SUPPORT" || user.role === "ADMIN") && (
              <DropdownMenuItem render={<Link href="/review" />}>
                <ShieldCheck className="size-4" />
                Review queue
              </DropdownMenuItem>
            )}

            {user.role === "ADMIN" && (
              <DropdownMenuItem render={<Link href="/admin" />}>
                <ClipboardList className="size-4" />
                Accounts
              </DropdownMenuItem>
            )}

            {user.role === "BASIC_USER" && (
              <DropdownMenuItem
                onClick={() => requestRole.mutate("DEVELOPER")}
                disabled={requestRole.isPending}
              >
                <Sparkles className="size-4" />
                Ask to become a developer
              </DropdownMenuItem>
            )}
            {user.role === "BASIC_USER" && (
              <DropdownMenuItem
                onClick={() => requestRole.mutate("SUPPORT")}
                disabled={requestRole.isPending}
              >
                <Sparkles className="size-4" />
                Ask to become a support
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          {/* Group: sign out */}
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => signOut.mutate()}
              disabled={signOut.isPending}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
