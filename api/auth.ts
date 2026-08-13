import { API } from "@/lib/api-paths"
import { http } from "@/services/http"
import type {
  LoginBody,
  PublicProfile,
  RegisterBody,
  RegisterResponse,
  TokenPair,
  UserSummary,
  RoleRequestView,
} from "@/types/auth.api.type"
import type { Role } from "@/types/common.api.type"

export const authKeys = {
  all: ["auth"] as const,
  pendingRoleRequests: () => ["auth", "pending-role-requests"] as const,
  profile: (userId: string) => ["auth", "profile", userId] as const,
  directory: () => ["auth", "directory"] as const,
}

/**
 * Registering does not sign anybody in — it returns a `PENDING` user and no
 * token. Requirement 1.1 puts an administrator's approval between the two, so the
 * UI has to say so rather than dropping the person on a dashboard.
 */
export async function register(body: RegisterBody): Promise<RegisterResponse> {
  const { data } = await http.post<RegisterResponse>(API.auth.register, body)
  return data
}

export async function login(body: LoginBody): Promise<TokenPair> {
  const { data } = await http.post<TokenPair>(API.auth.login, body)
  return data
}

export async function logout(refreshToken: string): Promise<void> {
  await http.post(API.auth.logout, { refresh_token: refreshToken })
}

/**
 * The public profile shelf — display name, library, market holdings, top posts.
 * The auth service has no "me" route; the id comes from the token's `sub`.
 */
export async function getProfile(userId: string): Promise<PublicProfile> {
  const { data } = await http.get<PublicProfile>(API.auth.profile(userId))
  return data
}

export async function getPendingRoleRequests(): Promise<RoleRequestView[]> {
  const { data } = await http.get<RoleRequestView[]>(
    API.auth.pendingRoleRequests
  )
  return data
}

/** Hide a owned game from the public shelf. Own profile only. */
export async function hideGame(gameId: string): Promise<void> {
  await http.post(API.auth.hideGame, { game_id: gameId })
}

/** Put a previously hidden game back on the public shelf. */
export async function unhideGame(gameId: string): Promise<void> {
  await http.post(API.auth.unhideGame, { game_id: gameId })
}

export async function requestRole(
  requestedRole: Role
): Promise<{ request_id: string }> {
  const { data } = await http.post<{ request_id: string }>(
    API.auth.requestRole,
    {
      requested_role: requestedRole,
    }
  )
  return data
}

// export interface RoleRequestView {
//   request_id: string
//   user_id: string
//   display_name: string
//   email: string
//   requested_role: Role
//   status: string
//   note: string
//   created_at: string
// }

export interface Directory {
  items: UserSummary[]
  roleRequests: RoleRequestView[]
}

/**
 * The account directory, assembled from the two real endpoints that answer it.
 *
 * The auth service used to have neither, so this called a `/admin/users` that
 * did not exist: the page listed nobody against the real platform while its ban
 * and grant-role buttons worked on people it could not display. Both halves are
 * now genuine routes, fetched together because the screen shows them together.
 */
export async function getDirectory(): Promise<Directory> {
  const [users, roleRequests] = await Promise.all([
    http.get<UserSummary[]>(API.auth.users),
    http.get<RoleRequestView[]>(API.auth.pendingRoleRequests),
  ])
  return { items: users.data, roleRequests: roleRequests.data }
}

export async function decideRegistration(
  userId: string,
  approve: boolean
): Promise<UserSummary> {
  const { data } = await http.post<UserSummary>(
    API.auth.decideRegistration(userId),
    { approve }
  )
  return data
}

export async function decideRoleRequest(
  requestId: string,
  approve: boolean,
  note = ""
): Promise<RoleRequestView> {
  const { data } = await http.post<RoleRequestView>(
    API.auth.decideRoleRequest(requestId),
    {
      approve,
      note,
    }
  )
  return data
}

export async function grantRole(
  userId: string,
  newRole: Role
): Promise<UserSummary> {
  const { data } = await http.post<UserSummary>(API.auth.grantRole(userId), {
    new_role: newRole,
  })
  return data
}

export async function banUser(
  userId: string,
  reason: string
): Promise<UserSummary> {
  const { data } = await http.post<UserSummary>(API.auth.ban(userId), {
    reason,
  })
  return data
}

export async function unbanUser(userId: string): Promise<UserSummary> {
  const { data } = await http.post<UserSummary>(API.auth.unban(userId))
  return data
}
