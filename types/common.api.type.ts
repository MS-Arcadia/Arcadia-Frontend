/**
 * Shapes shared by every Arcadia service.
 *
 * These are transcribed from the services' own DTOs, not invented. Where a
 * field's spelling looks surprising, it is surprising in the backend too — see
 * `Money` below.
 */

/**
 * An amount, as it appears on the wire.
 *
 * `amount_minor` is a **string** containing an integer count of the currency's
 * minor unit. It is a string because a JavaScript client truncates integers
 * above 2^53, and IRR amounts get large. Never parse it into a `number` for
 * arithmetic — format it, or use BigInt.
 */
export interface Money {
  amount_minor: string
  currency: string
}

/** Every list endpoint on the platform answers in this shape. */
export interface Page<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

/**
 * RFC 7807, which is what every service returns on failure.
 *
 * `reason` is the machine-readable part and the only field worth branching on —
 * `detail` is prose for a human.
 */
export interface ProblemDocument {
  type?: string
  title: string
  status: number
  detail: string
  reason?: string
  field?: string
  instance?: string
}

export type Role = "BASIC_USER" | "DEVELOPER" | "SUPPORT" | "ADMIN"
