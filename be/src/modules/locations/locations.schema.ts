import { z } from "zod"
import { latitude, longitude, shipmentId } from "../../lib/validation.js"

export const createLocationSchema = z.object({
  shipmentId,
  lat: latitude,
  lng: longitude,
  /** When the device took the reading. Defaults to now; future times are clamped to now. */
  recordedAt: z.iso.datetime({ offset: true }).optional(),
  source: z.enum(["gps", "simulated"]).default("gps"),
})

export type CreateLocationInput = z.infer<typeof createLocationSchema>
