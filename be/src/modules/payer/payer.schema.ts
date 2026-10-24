import { z } from "zod"
import { optionalText, phoneE164, shortText } from "../../lib/validation.js"

export const submitCompanySchema = z.object({
  companyName: shortText(160),
  /** Indonesian NIB is 13 digits. */
  registrationNo: z
    .string()
    .trim()
    .regex(/^\d{13}$/, "The business registration number (NIB) has 13 digits."),
  country: shortText(80),
  province: shortText(80),
  city: shortText(80),
  street: shortText(240),
  postalCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9 -]{3,10}$/, "That postal code does not look right."),
  contactName: shortText(120),
  contactRole: optionalText(80),
  phone: phoneE164,
  tripsPerMonth: z.coerce
    .number()
    .int("Use a whole number of trips.")
    .min(0, "Trips per month can't be negative.")
    .max(100_000, "That seems like too many trips per month."),
  spendPerMonth: z.coerce
    .number()
    .min(0, "Monthly spend can't be negative.")
    .max(1_000_000_000, "That monthly spend seems too high."),
})

export type SubmitCompanyInput = z.infer<typeof submitCompanySchema>
