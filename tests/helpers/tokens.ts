import type { AccessTokenClaims } from "@/types/auth.api.type"

/**
 * Hand-rolled JWT-shaped tokens for the token/session tests.
 *
 * `lib/token.ts` decodes without verifying (the services verify the real
 * signature), so the signature segment here is decorative — the payload just has
 * to round-trip through base64url the way `claimsOf` reads it.
 */
export function fakeJwt(claims: Partial<AccessTokenClaims>): string {
  const segment = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
  return `${segment({ alg: "none", typ: "JWT" })}.${segment(claims)}.not-a-signature`
}
