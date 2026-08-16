import { z } from "zod"

/**
 * Listing an item on the marketplace (requirement 1.6).
 *
 * Title max matches `market.maxTitle` (120). Description has no server-side
 * length cap — only trim — so the form does not invent one. Image URL is not
 * collected here: the dialog sends the selected game's cover via `gameArt`.
 * Prices are typed as digit strings, the same convention `ReviewCard` uses
 * for a suggested price: the form never touches a JS number, it converts the
 * typed major-unit digits to a minor-unit string with `BigInt` right before
 * the request goes out — see `toMinorUnits` below.
 */
export const newMarketItemSchema = z.object({
  gameId: z.string().trim().min(1, "Pick a game"),
  title: z
    .string()
    .trim()
    .min(1, "A title is required")
    .max(120, "At most 120 characters"),
  description: z.string().trim(),
  // `abort: true` on the digit check, because Zod runs every check even after a
  // failure: without it the refine below received "300,000" or "" and BigInt()
  // threw a SyntaxError out of what is supposed to be a validation result —
  // the listing form crashed instead of saying "Digits only".
  buyPrice: z
    .string()
    .trim()
    .regex(/^\d+$/, { message: "Digits only", abort: true })
    .refine((value) => BigInt(value) > 0n, "Enter a buy price above zero"),
  sellPrice: z
    .string()
    .trim()
    .regex(/^\d+$/, { message: "Digits only", abort: true })
    .refine((value) => BigInt(value) > 0n, "Enter a sell price above zero"),
})

export type NewMarketItemForm = z.infer<typeof newMarketItemSchema>

/** Major-unit digits the user typed → minor-unit integer string, IRR's 100
 *  minor units per major unit. Never `Number()` — see `lib/money.ts`. */
export function toMinorUnits(majorDigits: string): string {
  return String(BigInt(majorDigits) * 100n)
}
