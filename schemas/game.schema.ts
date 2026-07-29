import { z } from "zod"

/** Limits taken from the catalog's own request models, so the form refuses what
 *  the service would refuse rather than inventing a stricter rule. */
export const newGameSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "At least 2 characters")
    .max(120, "At most 120 characters"),
  description: z
    .string()
    .trim()
    .min(20, "Say a little more — at least 20 characters")
    .max(4000, "At most 4000 characters"),
  minRequirements: z
    .string()
    .trim()
    .min(3, "Say what it needs to run")
    .max(500),
  genres: z.string().trim().min(2, "At least one genre"),
})

export type NewGameForm = z.infer<typeof newGameSchema>

export const reviewDecisionSchema = z.object({
  note: z.string().trim().max(2000, "At most 2000 characters"),
})

export type ReviewDecisionForm = z.infer<typeof reviewDecisionSchema>

/** Basis points, not a percentage: the catalog takes 1–10000 so that 12.5% off has
 *  one unambiguous representation and nothing has to argue about rounding. */
export const promotionSchema = z.object({
  percent: z
    .number({ message: "Enter a percentage" })
    .min(1, "At least 1%")
    .max(100, "At most 100%"),
  days: z.number().min(1, "At least a day").max(90, "At most 90 days"),
  note: z.string().trim().max(2000).optional(),
})

export type PromotionForm = z.infer<typeof promotionSchema>
