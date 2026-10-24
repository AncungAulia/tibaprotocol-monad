import { z } from "zod"
import { shipmentId } from "../../lib/validation.js"

export const REPORT_ISSUES = ["damaged", "missing_items", "wrong_goods", "other"] as const

export const createReportSchema = z.object({
  shipmentId,
  issues: z
    .array(z.enum(REPORT_ISSUES, { error: "Choose what went wrong." }))
    .min(1, "Choose at least one problem.")
    .transform((issues) => [...new Set(issues)]),
  receivedQty: z.coerce
    .number()
    .int("Use a whole number for the amount received.")
    .min(0, "The amount received can't be negative.")
    .max(4_294_967_295, "That amount is too large."),
  note: z.string().trim().max(1000, "Keep the note under 1,000 characters.").optional(),
})

export type CreateReportInput = z.infer<typeof createReportSchema>
