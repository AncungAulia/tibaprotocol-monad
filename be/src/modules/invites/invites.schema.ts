import { z } from "zod"
import { optionalText } from "../../lib/validation.js"

export const createInviteSchema = z
  .object({
    kind: z.enum(["carrier", "warehouse"], { error: "Choose who you are inviting." }),
    label: optionalText(120),
    placeId: z.uuid("Choose one of your saved destinations.").optional(),
    receiverEmail: z.email("That email does not look right.").optional(),
  })
  .refine((value) => value.kind !== "warehouse" || !!value.placeId, {
    message: "Choose the destination this warehouse receives goods for.",
    path: ["placeId"],
  })

export type CreateInviteInput = z.infer<typeof createInviteSchema>

export const tokenParams = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/, "This invite link does not look right."),
})

export const acceptInviteSchema = z.object({
  /** Warehouse staff may give their name when the invite creates their account. */
  name: optionalText(120),
})

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
