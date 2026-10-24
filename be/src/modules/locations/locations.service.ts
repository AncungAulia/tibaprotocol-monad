import type { Address } from "viem"
import { env } from "../../config/env.js"
import { Status, requireShipment, sameAddress } from "../../lib/chain.js"
import { HttpError } from "../../lib/http-error.js"
import { supabase, unwrap } from "../../lib/supabase.js"
import type { LocationRow } from "../../types/db.js"
import { getTripRow } from "../trips/trips.service.js"
import type { CreateLocationInput } from "./locations.schema.js"
import { broadcastLocation } from "./location-broadcast.js"

/** Saves a truck position. Only the shipment's carrier, only while the trip is on the road. */
export async function recordLocation(
  carrier: Address,
  input: CreateLocationInput,
): Promise<LocationRow> {
  if (input.source === "simulated" && !env.DEMO_LOCATION_SIMULATION) {
    throw HttpError.forbidden("Demo location simulation is not enabled on this server.")
  }
  const shipment = await requireShipment(input.shipmentId)
  if (!sameAddress(shipment.carrier, carrier)) {
    throw HttpError.forbidden("Only the carrier of this shipment can share its location.")
  }
  if (shipment.status !== Status.IN_TRANSIT) {
    throw HttpError.conflict("Location is only shared while the truck is on the road.")
  }

  const trip = await getTripRow(input.shipmentId)
  if (!trip) throw HttpError.notFound("We could not find the trip details for this shipment.")
  if (!trip.share_location) {
    throw HttpError.conflict("Location sharing is turned off for this trip.")
  }

  const now = Date.now()
  const recordedAt = input.recordedAt ? Math.min(new Date(input.recordedAt).getTime(), now) : now

  const location = unwrap(
    await supabase
      .from("locations")
      .insert({
        shipment_id: input.shipmentId,
        lat: input.lat,
        lng: input.lng,
        recorded_at: new Date(recordedAt).toISOString(),
        source: input.source,
      })
      .select("*")
      .single<LocationRow>(),
    "recordLocation",
  )
  if (trip.channel_key) await broadcastLocation(trip.channel_key, location)
  return location
}
