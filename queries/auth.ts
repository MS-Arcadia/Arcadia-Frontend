"use client"

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
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
  getPendingRoleRequests,
  lookupRecipient,
  suggestRecipients,
} from "@/api/auth"
import { ls } from "@/lib/local-storage"
import { STORAGE_KEYS } from "@/lib/storage-keys"
import { claimsOf } from "@/lib/token"
import { useAuthStore } from "@/stores/auth.store"
import type { Role } from "@/types/common.api.type"
import type { UserSummary } from "@/types/auth.api.type"

/**
 * The signed-in person.
 *
 * Read from the token's subject rather than from a `/me` endpoint, because the
 * auth service does not have one — a profile is fetched by id. `enabled` keeps it
 * from firing on the sign-in page, where there is no id yet.
 *
 * The profile shelf and the session identity are different shapes. Live JWTs
 * carry `role`; the mock embeds identity fields on the profile response so a
 * local session still knows who you are.
 */
export function useMeQuery() {
  const userId = useAuthStore((state) => state.userId)
  const accessToken = useAuthStore((state) => state.accessToken)
  const setUser = useAuthStore((state) => state.setUser)

  return useQuery({
    queryKey: authKeys.profile(userId ?? "anonymous"),
    queryFn: async () => {
      const profile = await getProfile(userId as string)
      const claims = claimsOf(accessToken)
      const user: UserSummary = {
        user_id: profile.user_id,
        display_name: profile.display_name,
        email: profile.email ?? "",
        role: claims?.role ?? profile.role ?? "BASIC_USER",
        state: profile.state ?? "ACTIVE",
      }
      setUser(user)
      return user
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
      router.replace("/store")
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

export function usePendingRoleRequestsQuery() {
  return useQuery({
    queryKey: authKeys.pendingRoleRequests(),
    queryFn: getPendingRoleRequests,
    staleTime: 15 * 1000,
  })
}

/**
 * Prefix suggestions for the gift box, as the sender types.
 *
 * Debounce lives at the call site so a keystroke is not a request. Enabled from
 * two characters — one is too little to type and too much of a directory.
 */
export function useRecipientSuggestQuery(query: string) {
  const trimmed = query.trim()
  const userId = useAuthStore((state) => state.userId)
  return useQuery({
    queryKey: authKeys.suggest(trimmed),
    queryFn: () => suggestRecipients(trimmed),
    enabled: trimmed.length >= 2,
    retry: false,
    staleTime: 15 * 1000,
    placeholderData: keepPreviousData,
    select: (rows) =>
      userId ? rows.filter((row) => row.user_id !== userId) : rows,
  })
}

/**
 * Look up who a gift is for, as the sender types.
 *
 * `enabled` keeps it quiet until there is something worth asking about — a lookup on
 * every keystroke of an email address is a request per character, nearly all of which
 * answer 404 before the address is finished.
 *
 * Failure is not a toast here. Half a typed address is not an error, it is a person
 * still typing; the gift box shows the state inline instead.
 */
export function useRecipientLookupQuery(query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: authKeys.recipient(trimmed),
    queryFn: () => lookupRecipient(trimmed),
    enabled: trimmed.length >= 3,
    retry: false,
    staleTime: 60 * 1000,
  })
}
