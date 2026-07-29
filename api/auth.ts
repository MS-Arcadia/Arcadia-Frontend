import { API } from "@/lib/api-paths"
import { http } from "@/services/http"
import type {
  LoginBody,
  RegisterBody,
  RegisterResponse,
  TokenPair,
  UserSummary,
} from "@/types/auth.api.type"

export const authKeys = {
  all: ["auth"] as const,
  me: () => ["auth", "me"] as const,
}

/**
 * Registering does not sign anybody in — it returns a `PENDING` user and no
 * token. Requirement 1.1 puts an administrator's approval between the two, so
 * the UI has to say so rather than dropping the person on a dashboard.
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

export async function getMe(): Promise<UserSummary> {
  const { data } = await http.get<UserSummary>(API.auth.me)
  return data
}
