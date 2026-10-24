import type { Address } from "viem"
import { env } from "../../config/env.js"
import { Status, requireShipment, sameAddress, type ChainShipment } from "../../lib/chain.js"
import { HttpError } from "../../lib/http-error.js"
import { getRoute } from "../../lib/routing.js"
import { encodeShipmentCode } from "../../lib/shipment-code.js"
import { supabase, unwrap } from "../../lib/supabase.js"
import type { LocationRow, PlaceRow, ReportRow, TripRow } from "../../types/db.js"
import { getPlace } from "../places/places.service.js"
import { getProfile, getCompany } from "../profile/profile.service.js"
import type { CreateTripInput, UpdateTripInput } from "./trips.schema.js"
import { verifiedPickupTime } from "./trip-pickup.js"

/** The opaque channel capability is exposed only via the authorized detail.channel field. */
export function publicTrip(trip: TripRow) {
  const { channel_key: _channelKey, ...visible } = trip
  return visible
}

export function isParticipant(
  address: string,
  shipment: Pick<ChainShipment, "payer" | "carrier" | "consignee">,
) {
  return [shipment.payer, shipment.carrier, shipment.consignee].some((party) =>
    sameAddress(address, party),
  )
}

export async function getTripRow(shipmentId: number): Promise<TripRow | null> {
  return unwrap(
    await supabase.from("trips").select("*").eq("shipment_id", shipmentId).maybeSingle<TripRow>(),
    "getTrip",
  )
}

/**
 * Stores off-chain trip details right after ShipmentCreated. Only the shipment's payer may call it.
 * The road route is computed once here and reused by every map.
 */
export async function createTrip(payer: Address, input: CreateTripInput) {
  const shipment = await requireShipment(input.shipmentId)
  if (!sameAddress(shipment.payer, payer)) {
    throw HttpError.forbidden(
      "Only the company that approved this shipment can add its trip details.",
    )
  }

  const existing = await getTripRow(input.shipmentId)
  if (existing) return { trip: existing, created: false }

  const [pickup, destination] = await Promise.all([
    getPlace(input.pickupPlaceId),
    getPlace(input.destinationPlaceId),
  ])
  if (!pickup || !sameAddress(pickup.payer_address, payer)) {
    throw HttpError.badRequest("Choose one of your saved pickup points.")
  }
  if (!destination || !sameAddress(destination.payer_address, payer)) {
    throw HttpError.badRequest("Choose one of your saved destinations.")
  }
  if (pickup.kind !== "pickup" || destination.kind !== "destination") {
    throw HttpError.badRequest("Choose a pickup point and a destination of the correct type.")
  }
  if (!sameAddress(destination.receiver_address, shipment.consignee)) {
    throw HttpError.conflict(
      "The destination receiver must match the warehouse approved for this shipment.",
    )
  }

  const route = await getRoute(pickup, destination)

  const trip = unwrap(
    await supabase
      .from("trips")
      .upsert(
        {
          shipment_id: input.shipmentId,
          payer_address: shipment.payer,
          carrier_address: shipment.carrier,
          consignee_address: shipment.consignee,
          pickup_place: pickup.id,
          destination_place: destination.id,
          cargo: input.cargo,
          quantity: input.quantity ?? null,
          route_geojson: route.geometry,
          route_source: route.source,
          distance_km: route.distanceKm,
          duration_min: route.durationMin,
          share_location: input.shareLocation,
        },
        { onConflict: "shipment_id", ignoreDuplicates: true },
      )
      .select("*")
      .maybeSingle<TripRow>(),
    "createTrip",
  )

  return trip
    ? { trip, created: true }
    : { trip: await getTripRow(input.shipmentId), created: false }
}

function canView(
  address: Address,
  shipment: Pick<ChainShipment, "payer" | "carrier" | "consignee">,
  role: string | undefined,
) {
  return (
    isParticipant(address, shipment) ||
    // Investors can see where pool money went (INV-4).
    role === "investor"
  )
}

/** Full trip view: on-chain shipment, places, route, last position and any report. */
export async function getTripDetail(viewer: Address, shipmentId: number) {
  const [shipment, profile] = await Promise.all([requireShipment(shipmentId), getProfile(viewer)])
  if (!canView(viewer, shipment, profile?.role)) {
    throw HttpError.forbidden("This shipment is not linked to your account.")
  }

  const trip = await getTripRow(shipmentId)
  const [places, lastLocation, report, carrier, company] = await Promise.all([
    trip
      ? supabase
          .from("places")
          .select("*")
          .in(
            "id",
            [trip.pickup_place, trip.destination_place].filter((id): id is string => !!id),
          )
          .overrideTypes<PlaceRow[], { merge: false }>()
      : Promise.resolve({ data: [] as PlaceRow[], error: null }),
    supabase
      .from("locations")
      .select("*")
      .eq("shipment_id", shipmentId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle<LocationRow>(),
    supabase.from("reports").select("*").eq("shipment_id", shipmentId).maybeSingle<ReportRow>(),
    getProfile(shipment.carrier),
    getCompany(shipment.payer),
  ])
  const placeRows = unwrap(places, "tripPlaces")

  return {
    shipment,
    code: encodeShipmentCode(shipmentId),
    trip: trip
      ? {
          ...publicTrip(trip),
          payer_name: company?.company_name ?? null,
          carrier_name: carrier?.name ?? null,
          carrier_phone: profile?.role === "investor" ? null : (carrier?.phone_e164 ?? null),
        }
      : null,
    pickup: placeRows.find((p) => p.id === trip?.pickup_place) ?? null,
    destination: placeRows.find((p) => p.id === trip?.destination_place) ?? null,
    lastLocation:
      trip?.share_location && profile?.role !== "investor"
        ? unwrap(lastLocation, "tripLastLocation")
        : null,
    report: unwrap(report, "tripReport"),
    simulation:
      // Only while the truck is on the road, and only if the carrier shares, like real GPS
      env.DEMO_LOCATION_SIMULATION &&
      trip?.picked_up_at &&
      trip.share_location &&
      shipment.status === Status.IN_TRANSIT
        ? { startedAt: trip.picked_up_at, durationSec: env.DEMO_TRIP_SECONDS }
        : null,
    channel:
      trip?.channel_key &&
      shipment.status === Status.IN_TRANSIT &&
      profile?.role !== "investor" &&
      isParticipant(viewer, shipment)
        ? `trip:${trip.channel_key}`
        : null,
  }
}

/** Trips linked to the caller, newest first. The client reads live status from chain. */
export async function listTrips(address: Address) {
  const profile = await getProfile(address)
  if (!profile) throw HttpError.forbidden("Please finish setting up your account first.")

  const column =
    profile.role === "payer"
      ? "payer_address"
      : profile.role === "carrier"
        ? "carrier_address"
        : profile.role === "warehouse"
          ? "consignee_address"
          : null

  let request = supabase.from("trips").select("*").order("shipment_id", { ascending: false })
  if (column) request = request.eq(column, address)

  const trips = unwrap(
    await request.limit(200).overrideTypes<TripRow[], { merge: false }>(),
    "listTrips",
  )
  return trips.map((trip) => ({ ...publicTrip(trip), code: encodeShipmentCode(trip.shipment_id) }))
}

/** Carrier records a confirmed pickup, changes sharing consent, or both. */
export async function updateTrip(carrier: Address, shipmentId: number, input: UpdateTripInput) {
  const shipment = await requireShipment(shipmentId)
  if (!sameAddress(shipment.carrier, carrier)) {
    throw HttpError.forbidden("Only the carrier of this shipment can change this.")
  }
  let trip = await getTripRow(shipmentId)
  if (!trip) throw HttpError.notFound("We could not find the trip details for this shipment.")
  if (input.pickupTx && !trip.picked_up_at) {
    const pickedUpAt = await verifiedPickupTime(shipmentId, input.pickupTx as `0x${string}`)
    const updated = unwrap(
      await supabase
        .from("trips")
        .update({ picked_up_at: pickedUpAt })
        .eq("shipment_id", shipmentId)
        .is("picked_up_at", null)
        .select("*")
        .maybeSingle<TripRow>(),
      "recordPickup",
    )
    // A simultaneous verified request may have saved it first; never overwrite that clock.
    trip = updated ?? (await getTripRow(shipmentId))
    if (!trip) throw HttpError.notFound("We could not find the trip details for this shipment.")
  }
  if (input.shareLocation === undefined) return publicTrip(trip)
  const updated = unwrap(
    await supabase
      .from("trips")
      .update({ share_location: input.shareLocation })
      .eq("shipment_id", shipmentId)
      .select("*")
      .maybeSingle<TripRow>(),
    "updateTrip",
  )
  if (!updated) throw HttpError.notFound("We could not find the trip details for this shipment.")
  return publicTrip(updated)
}
