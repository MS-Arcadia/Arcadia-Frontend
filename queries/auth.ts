"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  authKeys,
  banUser,
  decideRegistration,
  decideRoleRequest,
  getDirectory,
  getProfile,
  grantRole,
  login,
  logout,
  register,
  requestRole,
  unbanUser,
} from "@/api/auth"
import { ls } from "@/lib/local-storage"
import { STORAGE_KEYS } from "@/lib/storage-keys"
import { useAuthStore } from "@/stores/auth.store"
import type { Role } from "@/types/common.api.type"

/**
 * The signed-in person.
 *
 * Read from the token's subject rather than from a `/me` endpoint, because the
 * auth service does not have one — a profile is fetched by id. `enabled` keeps it
 * from firing on the sign-in page, where there is no id yet.
 */
export function useMeQuery() {
  const userId = useAuthStore((state) => state.userId)
  const setUser = useAuthStore((state) => state.setUser)

  return useQuery({
    queryKey: authKeys.profile(userId ?? "anonymous"),
    queryFn: async () => {
      const profile = await getProfile(userId as string)
      setUser(profile)
      return profile
    },
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  })
}

export function useLoginMutation() {
  const router = useRouter()
  const signIn = useAuthStore((state) => state.signIn)
  const client = useQueryClient()

  return useMutation({
    mutationFn: login,
    onSuccess: (tokens) => {
      signIn(tokens)
      // Every cache from a previous session is somebody else's data.
      client.clear()
      router.replace("/")
    },
  })
}

export function useRegisterMutation() {
  return useMutation({ mutationFn: register })
}

export function useLogoutMutation() {
  const router = useRouter()
  const store = useAuthStore()
  const client = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const refreshToken = ls.get<string | null>(
        STORAGE_KEYS.refreshToken,
        null
      )
      // The server is told, but a failure there must not trap somebody in a
      // session they have asked to leave — so the local state is cleared either way.
      try {
        if (refreshToken) await logout(refreshToken)
      } catch {
        // Deliberately swallowed; see above.
      }
    },
    onSettled: () => {
      store.signOut()
      client.clear()
      router.replace("/sign-in")
    },
  })
}

export function useRequestRoleMutation() {
  return useMutation({
    mutationFn: (role: Role) => requestRole(role),
    onSuccess: () => {
      toast.success("Request sent", {
        description:
          "An administrator has to approve it before your role changes.",
      })
    },
  })
}

// --- administration --------------------------------------------------------

export function useDirectoryQuery() {
  return useQuery({
    queryKey: authKeys.directory(),
    queryFn: getDirectory,
    staleTime: 15 * 1000,
  })
}

function useDirectoryInvalidation() {
  const client = useQueryClient()
  return () => {
    void client.invalidateQueries({ queryKey: authKeys.all })
  }
}

export function useDecideRegistrationMutation() {
  const invalidate = useDirectoryInvalidation()
  return useMutation({
    mutationFn: (args: { userId: string; approve: boolean }) =>
      decideRegistration(args.userId, args.approve),
    onSuccess: (user) => {
      invalidate()
      toast.success(
        user.state === "ACTIVE"
          ? `${user.display_name} can sign in now`
          : `${user.display_name} was not approved`
      )
    },
  })
}

export function useDecideRoleRequestMutation() {
  const invalidate = useDirectoryInvalidation()
  return useMutation({
    mutationFn: (args: {
      requestId: string
      approve: boolean
      note?: string
    }) => decideRoleRequest(args.requestId, args.approve, args.note),
    onSuccess: (request) => {
      invalidate()
      toast.success(
        request.status === "APPROVED"
          ? `${request.display_name} is now a ${request.requested_role.toLowerCase().replace(/_/g, " ")}`
          : "Request declined"
      )
    },
  })
}

export function useGrantRoleMutation() {
  const invalidate = useDirectoryInvalidation()
  return useMutation({
    mutationFn: (args: { userId: string; role: Role }) =>
      grantRole(args.userId, args.role),
    onSuccess: (user) => {
      invalidate()
      toast.success(
        `${user.display_name} is now a ${user.role.toLowerCase().replace(/_/g, " ")}`
      )
    },
  })
}

export function useBanMutation() {
  const invalidate = useDirectoryInvalidation()
  return useMutation({
    mutationFn: (args: { userId: string; banned: boolean; reason?: string }) =>
      args.banned
        ? banUser(args.userId, args.reason ?? "")
        : unbanUser(args.userId),
    onSuccess: (user) => {
      invalidate()
      toast.success(
        user.state === "BANNED"
          ? `${user.display_name} is suspended`
          : `${user.display_name} is active again`
      )
    },
  })
}
