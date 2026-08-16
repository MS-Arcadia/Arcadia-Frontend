import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  newFestivalSchema,
  rescheduleFestivalSchema,
} from "@/schemas/festival.schema"

const NOW = new Date("2026-08-16T12:00:00Z").getTime()

beforeEach(() => {
  vi.useFakeTimers({ now: NOW })
})

afterEach(() => {
  vi.useRealTimers()
})

const valid = {
  name: "Arcadia Summer Fest",
  startsAt: "2026-08-20T10:00:00Z",
  endsAt: "2026-08-27T22:00:00Z",
}

describe("newFestivalSchema", () => {
  it("accepts a festival with a sane window", () => {
    expect(newFestivalSchema.safeParse(valid).success).toBe(true)
  })

  it("requires a name and enforces the caps", () => {
    expect(newFestivalSchema.safeParse({ ...valid, name: " " }).success).toBe(
      false
    )
    expect(
      newFestivalSchema.safeParse({ ...valid, name: "x".repeat(201) }).success
    ).toBe(false)
    expect(
      newFestivalSchema.safeParse({ ...valid, description: "x".repeat(4001) })
        .success
    ).toBe(false)
  })

  it("flags an end at or before the start on endsAt", () => {
    const result = newFestivalSchema.safeParse({
      ...valid,
      endsAt: valid.startsAt,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ["endsAt"],
        message: "End must be after the start",
      })
    }
  })

  it("flags an end in the past — the service checks the same window", () => {
    // The whole window sits in the past, but still end-after-start, so the
    // failure is specifically "after now".
    const result = newFestivalSchema.safeParse({
      ...valid,
      startsAt: "2026-08-10T10:00:00Z",
      endsAt: "2026-08-12T10:00:00Z",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ["endsAt"],
        message: "End must be after now",
      })
    }
  })

  it("flags an unparseable start date rather than comparing against NaN", () => {
    const result = newFestivalSchema.safeParse({
      ...valid,
      startsAt: "not a date",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.path[0] === "startsAt")
      ).toBe(true)
    }
  })

  it("both window issues are reported together", () => {
    const result = newFestivalSchema.safeParse({
      ...valid,
      startsAt: "not a date",
      endsAt: "also not a date",
    })
    if (!result.success) {
      expect(result.error.issues).toHaveLength(2)
    }
  })
})

describe("rescheduleFestivalSchema", () => {
  it("accepts a valid new window and refuses an inverted one", () => {
    expect(
      rescheduleFestivalSchema.safeParse({
        startsAt: valid.startsAt,
        endsAt: valid.endsAt,
      }).success
    ).toBe(true)
    expect(
      rescheduleFestivalSchema.safeParse({
        startsAt: valid.endsAt,
        endsAt: valid.startsAt,
      }).success
    ).toBe(false)
  })
})
