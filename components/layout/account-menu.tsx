"use client"

import Link from "next/link"
import { LogOut, ShieldCheck, Sparkles, UserRound } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={`${user.display_name}, account menu`}
          >
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary/15 text-[0.7rem] font-semibold text-primary">
                {initials(user.display_name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-1">
          <p className="text-sm font-medium">{user.display_name}</p>
          <p className="text-xs font-normal text-muted-foreground">
            {user.email}
          </p>
          <Badge className="mt-1 border-primary/25 bg-primary/15 text-primary">
            {ROLE_LABEL[user.role]}
          </Badge>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

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
            <UserRound className="size-4" />
            Accounts
          </DropdownMenuItem>
        )}

        {/* Requirement 1.1's other half: a player asks to become a developer, and
            an administrator decides. Only offered to somebody who could be
            promoted — staff asking to be a developer is not a thing. */}
        {user.role === "BASIC_USER" && (
          <DropdownMenuItem
            onClick={() => requestRole.mutate("DEVELOPER")}
            disabled={requestRole.isPending}
          >
            <Sparkles className="size-4" />
            Ask to become a developer
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
