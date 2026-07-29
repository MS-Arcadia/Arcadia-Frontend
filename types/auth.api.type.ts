/** Transcribed from auth-profile-service/app/application/dto/auth_dto.py. */

import type { Role } from "./common.api.type"

/**
 * A new account is `PENDING`, not active.
 *
 * Requirement 1.1 puts an approval step between registering and signing in, so
 * the register response is not a login — there is no token in it. The one
 * exception is the seeded super admin, which is created ACTIVE because there is
 * nobody to approve the first administrator.
 */
export type UserState = "PENDING" | "ACTIVE" | "REJECTED" | "BANNED"

export interface RegisterBody {
  email: string
  password: string
  display_name: string
}

export interface RegisterResponse {
  user_id: string
  email: string
  state: UserState
}

export interface LoginBody {
  email: string
  password: string
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface UserSummary {
  user_id: string
  email: string
  display_name: string
  role: Role
  state: UserState
}

/** The claims the platform's six services all verify. Decoded client-side for
 *  display only — every service checks the signature itself. */
export interface AccessTokenClaims {
  sub: string
  role: Role
  typ: "access" | "refresh"
  scopes: string[]
  iss: string
  aud: string
  exp: number
}
