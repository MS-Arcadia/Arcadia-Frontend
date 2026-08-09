import { z } from "zod"

/** Limits taken from the catalog's own request models / domain
 *  (`RegisterGameRequest`, `TITLE_MAX`, `DESCRIPTION_MAX`, `REQUIREMENTS_MAX`),
 *  so the form refuses what the service would refuse rather than inventing a
 *  stricter rule. */
export const newGameSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "A title is required")
    .max(200, "At most 200 characters"),
  description: z.string().trim().max(10_000, "At most 10000 characters"),
  minRequirements: z.string().trim().max(4_000, "At most 4000 characters"),
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
