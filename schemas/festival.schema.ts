import { z } from "zod"

/** Shared by create and reschedule: the window festival-service itself checks —
 *  end after start, end after now — surfaced here instead of round-tripping to
 *  find out. */
function validWindow(
  data: { startsAt: string; endsAt: string },
  ctx: z.RefinementCtx
) {
  const starts = new Date(data.startsAt)
  const ends = new Date(data.endsAt)

  if (Number.isNaN(starts.getTime())) {
    ctx.addIssue({
      code: "custom",
      path: ["startsAt"],
      message: "Pick a start date and time",
    })
  }
  if (Number.isNaN(ends.getTime())) {
    ctx.addIssue({
      code: "custom",
      path: ["endsAt"],
      message: "Pick an end date and time",
    })
  }
  if (!Number.isNaN(starts.getTime()) && !Number.isNaN(ends.getTime())) {
    if (ends.getTime() <= starts.getTime()) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "End must be after the start",
      })
    } else if (ends.getTime() < Date.now()) {
      ctx.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "End must be after now",
      })
    }
  }
}

export const newFestivalSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "A festival needs a name")
      .max(200, "At most 200 characters"),
    description: z
      .string()
      .trim()
      .max(4000, "At most 4000 characters")
      .optional(),
    startsAt: z.string().min(1, "Pick a start date and time"),
    endsAt: z.string().min(1, "Pick an end date and time"),
  })
  .superRefine(validWindow)

export type NewFestivalForm = z.infer<typeof newFestivalSchema>

export const rescheduleFestivalSchema = z
  .object({
    startsAt: z.string().min(1, "Pick a start date and time"),
    endsAt: z.string().min(1, "Pick an end date and time"),
  })
  .superRefine(validWindow)

export type RescheduleFestivalForm = z.infer<typeof rescheduleFestivalSchema>
