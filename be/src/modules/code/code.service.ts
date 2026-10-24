import type { Address } from "viem"
import { getShipment, sameAddress } from "../../lib/chain.js"
import { HttpError } from "../../lib/http-error.js"
import { decodeShipmentCode, encodeShipmentCode } from "../../lib/shipment-code.js"
import { getTripRow } from "../trips/trips.service.js"

/**
 * Looks up a shipment from the 6-character code under the carrier's QR (scan fallback).
 * `forYou` tells the warehouse UI whether to show "Not for this warehouse".
 */
export async function lookupCode(viewer: Address, rawCode: string) {
  const id = decodeShipmentCode(rawCode)
  if (id === null) {
    throw HttpError.badRequest("That code does not look right. Check each character and try again.")
  }

  const shipment = await getShipment(id)
  if (!shipment) throw HttpError.notFound("We could not find a shipment with that code.")

  if (!sameAddress(shipment.consignee, viewer)) {
    return { shipmentId: shipment.id, code: encodeShipmentCode(id), forYou: false }
  }

  const trip = await getTripRow(Number(id))
  return {
    shipmentId: shipment.id,
    code: encodeShipmentCode(id),
    shipment,
    forYou: sameAddress(shipment.consignee, viewer),
    trip: trip
      ? {
          cargo: trip.cargo,
          quantity: trip.quantity,
          destinationPlace: trip.destination_place,
          distanceKm: trip.distance_km,
        }
      : null,
  }
}
