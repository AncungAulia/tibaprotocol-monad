import { z } from "zod"
import { latitude, longitude, shortText } from "../../lib/validation.js"

export const createPlaceSchema = z.object({
  name: shortText(120),
  address: shortText(300),
  lat: latitude,
  lng: longitude,
  kind: z.enum(["pickup", "destination"], { error: "Choose pickup or destination." }),
  receiverEmail: z.email("That email does not look right.").optional(),
})

export type CreatePlaceInput = z.infer<typeof createPlaceSchema>

export const listPlacesQuery = z.object({
  kind: z.enum(["pickup", "destination"]).optional(),
})

export type ListPlacesQuery = z.infer<typeof listPlacesQuery>

export const searchPlacesQuery = z.object({
  q: shortText(200).refine((q) => q.length >= 5, "Enter at least 5 characters."),
})
