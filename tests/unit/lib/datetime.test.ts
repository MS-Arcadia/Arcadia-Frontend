import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  formatDate,
  formatDateTime,
  formatRelative,
  formatTime,
  isPast,
  timeUntil,
} from "@/lib/datetime"

// A fixed "now" so assertions on relative wording do not depend on the clock
// the suite runs under. 2026-08-16T12:00:00Z.
const NOW = new Date("2026-08-16T12:00:00Z").getTime()

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, shouldAdvanceTime: false })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("absolute formatting", () => {
  it("formats a date in en-GB order", () => {
    expect(formatDate("2026-08-16T09:30:00Z")).toBe("16 Aug 2026")
  })

  it("formats a date and time together", () => {
    expect(formatDateTime("2026-08-16T09:05:00Z")).toMatch(
      /^16 Aug 2026, \d{2}:\d{2}$/
    )
  })

  it("formats a bare time", () => {
    expect(formatTime("2026-08-16T09:05:00Z")).toMatch(/^\d{2}:\d{2}$/)
  })

  it("renders an em dash for missing or unparseable input", () => {
    expect(formatDate(null)).toBe("—")
    expect(formatDate(undefined)).toBe("—")
    expect(formatDate("not a date")).toBe("—")
    expect(formatDateTime("not a date")).toBe("—")
    expect(formatTime("not a date")).toBe("—")
  })
})

describe("formatRelative", () => {
  it("uses the unit that fits, with plurals from Intl", () => {
    expect(formatRelative(new Date(NOW - 30_000).toISOString())).toBe(
      "30 seconds ago"
    )
    expect(formatRelative(new Date(NOW - 5 * 60_000).toISOString())).toBe(
      "5 minutes ago"
    )
    expect(formatRelative(new Date(NOW - 3 * 3_600_000).toISOString())).toBe(
      "3 hours ago"
    )
    expect(formatRelative(new Date(NOW - 2 * 86_400_000).toISOString())).toBe(
      "2 days ago"
    )
    // 45 days: past weeks (45/7 ≈ 6.4), into months (6.4/4.35 ≈ 1.5 → idiomatic
    // "last month" — numeric: "auto" owns that wording too).
    expect(formatRelative(new Date(NOW - 45 * 86_400_000).toISOString())).toBe(
      "last month"
    )
    expect(formatRelative(new Date(NOW - 400 * 86_400_000).toISOString())).toBe(
      "last year"
    )
  })

  it("handles the future and 'now', and an em dash for junk", () => {
    expect(formatRelative(new Date(NOW + 5 * 60_000).toISOString())).toBe(
      "in 5 minutes"
    )
    expect(formatRelative(new Date(NOW).toISOString())).toBe("now")
    expect(formatRelative("not a date")).toBe("—")
    expect(formatRelative(null)).toBe("—")
  })
})

describe("timeUntil", () => {
  it("counts down in minutes, hours+minutes, then days", () => {
    expect(timeUntil(new Date(NOW + 5 * 60_000).toISOString())).toBe("5m")
    expect(timeUntil(new Date(NOW + 3 * 3_600_000 + 24 * 60_000).toISOString())).toBe("3h 24m")
    expect(timeUntil(new Date(NOW + 2 * 86_400_000).toISOString())).toBe("2 days")
    expect(timeUntil(new Date(NOW + 86_400_000).toISOString())).toBe("1 day")
  })

  it("returns null once the deadline has passed, so callers can hide the element", () => {
    expect(timeUntil(new Date(NOW - 1).toISOString())).toBeNull()
    expect(timeUntil(new Date(NOW).toISOString())).toBeNull()
  })

  it("returns null for missing or unparseable input", () => {
    expect(timeUntil(null)).toBeNull()
    expect(timeUntil("not a date")).toBeNull()
  })
})

describe("isPast", () => {
  it("compares against now, and treats junk as not past", () => {
    expect(isPast(new Date(NOW - 1).toISOString())).toBe(true)
    expect(isPast(new Date(NOW + 60_000).toISOString())).toBe(false)
    expect(isPast(null)).toBe(false)
    expect(isPast("not a date")).toBe(false)
  })
})
