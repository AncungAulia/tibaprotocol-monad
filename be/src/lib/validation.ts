import { getAddress, isAddress } from "viem"
import { z } from "zod"

/** Shared Zod building blocks with plain-language messages. */

export const phoneE164 = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, "Use a full phone number with the country code, like +6281234567890.")

export const shortText = (max = 120) =>
  z.string().trim().min(1, "This can't be empty.").max(max, `Keep this under ${max} characters.`)

export const optionalText = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters.`)
    .optional()
    .transform((value) => (value ? value : undefined))

export const walletAddress = z
  .string()
  .refine((value) => isAddress(value), "That wallet address does not look right.")
  .transform((value) => getAddress(value))

export const shipmentId = z.coerce
  .number({ error: "Shipment number is missing." })
  .int("Shipment number must be a whole number.")
  .positive("Shipment number must be greater than zero.")
  .max(33_554_431, "Shipment number is outside the supported range.")

export const latitude = z.number().min(-90).max(90)
export const longitude = z.number().min(-180).max(180)

export const shipmentIdParams = z.object({ id: shipmentId })
