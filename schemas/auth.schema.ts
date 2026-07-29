import { z } from "zod"

/**
 * The client-side half of validation.
 *
 * Every rule here matches one the auth service enforces — the password minimum is
 * 8 to 128 characters in its own DTO, and the display name 2 to 64. Duplicating
 * them buys an error before a round trip, not a different standard: the server is
 * still the authority, and its refusal is what the form shows if the two ever
 * disagree.
 */

export const signInSchema = z.object({
  email: z
    .string()
    .min(1, "Enter your email")
    .email("That does not look like an email"),
  password: z.string().min(1, "Enter your password"),
})

export type SignInForm = z.infer<typeof signInSchema>

export const signUpSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, "At least 2 characters")
      .max(64, "At most 64 characters"),
    email: z
      .string()
      .min(1, "Enter an email")
      .email("That does not look like an email"),
    password: z
      .string()
      .min(8, "At least 8 characters")
      .max(128, "At most 128 characters"),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: "The two passwords do not match",
    path: ["confirm"],
  })

export type SignUpForm = z.infer<typeof signUpSchema>
