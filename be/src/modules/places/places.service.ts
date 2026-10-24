import type { Address } from "viem"
import { HttpError } from "../../lib/http-error.js"
import { supabase, unwrap } from "../../lib/supabase.js"
import type { PlaceRow } from "../../types/db.js"
import { getProfile, requireRole } from "../profile/profile.service.js"
import type { CreatePlaceInput, ListPlacesQuery } from "./places.schema.js"

export async function createPlace(address: Address, input: CreatePlaceInput): Promise<PlaceRow> {
  await requireRole(address, "payer")
  return unwrap(
    await supabase
      .from("places")
      .insert({
        payer_address: address,
        name: input.name,
        address: input.address,
        lat: input.lat,
        lng: input.lng,
        kind: input.kind,
        receiver_email: input.kind === "destination" ? (input.receiverEmail ?? null) : null,
      })
      .select("*")
      .single<PlaceRow>(),
    "createPlace",
  )
}

/** Payers see their own places; warehouse staff see the destinations bound to their wallet. */
export async function listPlaces(address: Address, query: ListPlacesQuery): Promise<PlaceRow[]> {
  const profile = await getProfile(address)
  if (!profile) throw HttpError.forbidden("Please finish setting up your account first.")

  let request = supabase.from("places").select("*").order("created_at", { ascending: true })
  if (profile.role === "payer") request = request.eq("payer_address", address)
  else if (profile.role === "warehouse") request = request.eq("receiver_address", address)
  else throw HttpError.forbidden("Only payer and warehouse accounts have saved places.")

  if (query.kind) request = request.eq("kind", query.kind)
  return unwrap(await request.overrideTypes<PlaceRow[], { merge: false }>(), "listPlaces")
}

export async function getPlace(id: string): Promise<PlaceRow | null> {
  return unwrap(
    await supabase.from("places").select("*").eq("id", id).maybeSingle<PlaceRow>(),
    "getPlace",
  )
}

export async function searchPlaces(address: Address, query: string) {
  await requireRole(address, "payer")
  const url = new URL("https://photon.komoot.io/api/")
  url.searchParams.set("q", query)
  url.searchParams.set("limit", "5")
  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(8000) })
  } catch {
    throw HttpError.upstream("Address search is unavailable. Choose a pin on the map.")
  }
  if (!response.ok)
    throw HttpError.upstream("Address search is unavailable. Choose a pin on the map.")
  const data = (await response.json()) as {
    features?: { geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> }[]
  }
  return (data.features ?? []).flatMap((feature, index) => {
    const [lng, lat] = feature.geometry?.coordinates ?? []
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    )
      return []
    const p = feature.properties ?? {}
    const label = [
      ...new Set(
        [p.name, p.street, p.city, p.state, p.country].filter(
          (v): v is string => typeof v === "string" && !!v,
        ),
      ),
    ].join(", ")
    return [{ place_id: index, display_name: label, lat: String(lat), lon: String(lng) }]
  })
}
