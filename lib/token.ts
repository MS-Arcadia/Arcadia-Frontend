import type { AccessTokenClaims } from "@/types/auth.api.type"

/**
 * Read the subject out of an access token.
 *
 * **Decoded, never verified.** Every service checks the signature itself;
 * doing it here would need the shared secret in a browser bundle, which would hand
 * it to anybody who opened the network tab. The only thing this is used for is
 * knowing which profile to fetch and which links to show, and a tampered token
 * gets a 401 from the first request it is used on.
 */
export function subjectOf(token: string | null | undefined): string | null {
  if (!token) return null

  // The mock adapter issues `mock.<user-id>.access`, which is not a JWT. Handled
  // first so development does not depend on base64 shapes it never produces.
  if (token.startsWith("mock.")) {
    const parts = token.split(".")
    return parts.length >= 3 ? parts.slice(1, -1).join(".") : null
  }

  const claims = claimsOf(token)
  return claims?.sub ?? null
}

export function claimsOf(
  token: string | null | undefined
): AccessTokenClaims | null {
  if (!token || token.startsWith("mock.")) return null
  const [, payload] = token.split(".")
  if (!payload) return null
  try {
    // base64url → base64, then decode. `atob` is fine here: the payload is ASCII
    // JSON, and anything else is a token we would reject anyway.
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json) as AccessTokenClaims
  } catch {
    return null
  }
}

/** Whether a token is past its own expiry, for deciding to refresh before a call
 *  rather than after a 401. Unknown expiry counts as not expired — the server is
 *  the authority. */
export function isExpired(token: string | null | undefined): boolean {
  const claims = claimsOf(token)
  if (!claims?.exp) return false
  return claims.exp * 1000 <= Date.now()
}

/** Refresh a minute early so a request is not racing the token's last second. */
const REFRESH_SKEW_MS = 60_000

export function needsRefresh(token: string | null | undefined): boolean {
  const claims = claimsOf(token)
  if (!claims?.exp) return false
  return claims.exp * 1000 <= Date.now() + REFRESH_SKEW_MS
}
