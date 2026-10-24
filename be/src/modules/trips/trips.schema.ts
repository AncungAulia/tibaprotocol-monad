import { z } from "zod"
import { shipmentId, shortText } from "../../lib/validation.js"

export const createTripSchema = z
  .object({
    shipmentId,
    pickupPlaceId: z.uuid("Choose a pickup point."),
    destinationPlaceId: z.uuid("Choose a destination."),
    cargo: shortText(200),
    /** Boxes or units carried, so the warehouse can confirm "All 120 boxes arrived" in one tap. */
    quantity: z.coerce
      .number()
      .int("Use a whole number of items.")
      .min(1, "Enter at least 1 item.")
      .max(1_000_000, "That is too many items for one trip.")
      .optional(),
    shareLocation: z.boolean().default(true),
  })
  .refine((value) => value.pickupPlaceId !== value.destinationPlaceId, {
    message: "Pickup and destination must be different places.",
    path: ["destinationPlaceId"],
  })

export type CreateTripInput = z.infer<typeof createTripSchema>

export const updateTripSchema = z
  .object({
    shareLocation: z.boolean().optional(),
    pickupTx: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, "Provide a valid pickup transaction hash.")
      .optional(),
  })
  .strict()
  .refine((value) => value.shareLocation !== undefined || value.pickupTx !== undefined, {
    message: "Provide a pickup transaction or location sharing setting.",
  })

export type UpdateTripInput = z.infer<typeof updateTripSchema>
