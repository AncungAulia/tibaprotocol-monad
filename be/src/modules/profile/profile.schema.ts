import { z } from "zod"
import { optionalText, phoneE164, shortText, walletAddress } from "../../lib/validation.js"

/** Indonesian-style plate, e.g. "AB 1234 CD". Loose on purpose so other formats still pass. */
const plate = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{1,2}\s?\d{1,4}\s?[A-Z]{0,3}$/, "Use a plate number like AB 1234 CD.")

const email = z.email("That email does not look right.").optional()

export const createProfileSchema = z.discriminatedUnion(
  "role",
  [
    z.object({
      role: z.literal("payer"),
      name: shortText(),
      phone: phoneE164.optional(),
      email,
    }),
    z.object({
      role: z.literal("carrier"),
      name: shortText(),
      phone: phoneE164,
      plate,
    }),
    z.object({
      role: z.literal("investor"),
      name: optionalText(120),
      email,
    }),
  ],
  { error: "Please choose Payer, Carrier or Investor." },
)

export type CreateProfileInput = z.infer<typeof createProfileSchema>

export const addressParams = z.object({ address: walletAddress })
