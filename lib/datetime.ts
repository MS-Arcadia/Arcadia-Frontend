/**
 * Dates.
 *
 * Every timestamp on the wire is RFC 3339 UTC. `Intl` does the formatting, which
 * is why there is no date library in this project.
 */

const LOCALE = "en-GB"

const DATE = new Intl.DateTimeFormat(LOCALE, {
  year: "numeric",
  month: "short",
  day: "numeric",
})

const DATE_TIME = new Intl.DateTimeFormat(LOCALE, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const TIME = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
})

function parse(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value: string | null | undefined): string {
  const date = parse(value)
  return date ? DATE.format(date) : "—"
}

export function formatDateTime(value: string | null | undefined): string {
  const date = parse(value)
  return date ? DATE_TIME.format(date) : "—"
}

export function formatTime(value: string | null | undefined): string {
  const date = parse(value)
  return date ? TIME.format(date) : "—"
}

/** "3 minutes ago". `Intl.RelativeTimeFormat` owns the plurals and the wording. */
export function formatRelative(value: string | null | undefined): string {
  const date = parse(value)
  if (!date) return "—"

  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" })
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
    ["week", 4.35],
    ["month", 12],
  ]

  let amount = seconds
  for (const [unit, size] of steps) {
    if (Math.abs(amount) < size)
      return relative.format(Math.round(amount), unit)
    amount /= size
  }
  return relative.format(Math.round(amount), "year")
}

/**
 * How long until a deadline, for a refund window or an instalment falling due.
 * Returns null once it has passed, so a caller can hide the element rather than
 * counting down into negative numbers.
 */
export function timeUntil(value: string | null | undefined): string | null {
  const date = parse(value)
  if (!date) return null
  const ms = date.getTime() - Date.now()
  if (ms <= 0) return null

  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days} ${days === 1 ? "day" : "days"}`
  }
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function isPast(value: string | null | undefined): boolean {
  const date = parse(value)
  return date ? date.getTime() < Date.now() : false
}
