/** Transcribed from auth-profile-service/app/application/dto/auth_dto.py. */

import type { Role } from "./common.api.type"

/**
 * A new account is `ACTIVE` and can sign in immediately.
 *
 * `PENDING` is leftover: Support can still approve or reject an account that
 * was created under the old gate. Role upgrades (developer, support) still wait
 * for an administrator.
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

/** Transcribed from auth-profile-service `ProfileResponse`. */
export interface OwnedGameRef {
  game_id: string
  hidden: boolean
}

export interface OwnedItemRef {
  item_id: string
  game_id: string
}

export interface TopPostRef {
  post_id: string
  feedback_score: number
  rank: number
}

/**
 * The public shelf at `GET /auth/v1/profile/{id}`.
 *
 * Identity fields (`email`, `role`, `state`) are not part of the live contract —
 * the mock may include them so `useMeQuery` can hydrate the session without a
 * separate `/me` route. Live mode takes `role` from the JWT and leaves email
 * blank until a real identity endpoint exists.
 */
export interface PublicProfile {
  user_id: string
  display_name: string
  avatar_url: string
  online: boolean
  owned_games: OwnedGameRef[]
  owned_items: OwnedItemRef[]
  top_posts: TopPostRef[]
  email?: string
  role?: Role
  state?: UserState
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

// types/auth.api.type.ts
export interface RoleRequestView {
  request_id: string
  user_id: string
  requested_role: Role
  status: string
  decision_note: string
  decided_by: string
  created_at: string
  // optional fields for mock
  display_name?: string
  email?: string
}
