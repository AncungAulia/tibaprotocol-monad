import type { Address } from "viem"
import { HttpError } from "../../lib/http-error.js"
import { supabase, unwrap } from "../../lib/supabase.js"
import type { CompanyRow, PlaceRow, ProfileRow, RelationRow } from "../../types/db.js"
import { getProfile } from "../profile/profile.service.js"

async function profilesByAddress(addresses: string[]): Promise<Map<string, ProfileRow>> {
  if (addresses.length === 0) return new Map()
  const rows = unwrap(
    await supabase
      .from("profiles")
      .select("*")
      .in("address", addresses)
      .overrideTypes<ProfileRow[], { merge: false }>(),
    "networkProfiles",
  )
  return new Map(rows.map((row) => [row.address, row]))
}

/**
 * Payer: connected carriers and destinations (with their receiver state).
 * Carrier: the companies they work with.
 */
export async function getNetwork(address: Address) {
  const profile = await getProfile(address)
  if (!profile) throw HttpError.forbidden("Please finish setting up your account first.")

  if (profile.role === "payer") {
    const [relations, places] = await Promise.all([
      supabase
        .from("relations")
        .select("*")
        .eq("payer_address", address)
        .order("created_at", { ascending: true })
        .overrideTypes<RelationRow[], { merge: false }>(),
      supabase
        .from("places")
        .select("*")
        .eq("payer_address", address)
        .eq("kind", "destination")
        .overrideTypes<PlaceRow[], { merge: false }>(),
    ])
    const relationRows = unwrap(relations, "payerRelations")
    const carriers = await profilesByAddress(relationRows.map((r) => r.carrier_address))

    return {
      role: "payer" as const,
      carriers: relationRows.map((relation) => {
        const carrier = carriers.get(relation.carrier_address)
        return {
          address: relation.carrier_address,
          status: relation.status,
          since: relation.created_at,
          name: carrier?.name ?? null,
          plate: carrier?.plate ?? null,
          phone: carrier?.phone_e164 ?? null,
        }
      }),
      destinations: unwrap(places, "payerDestinations").map((place) => ({
        ...place,
        receiverStatus: place.receiver_address ? ("linked" as const) : ("waiting" as const),
      })),
    }
  }

  if (profile.role === "carrier") {
    const relationRows = unwrap(
      await supabase
        .from("relations")
        .select("*")
        .eq("carrier_address", address)
        .overrideTypes<RelationRow[], { merge: false }>(),
      "carrierRelations",
    )
    const payers = relationRows.map((r) => r.payer_address)
    const companies =
      payers.length === 0
        ? []
        : unwrap(
            await supabase
              .from("companies")
              .select("*")
              .in("payer_address", payers)
              .overrideTypes<CompanyRow[], { merge: false }>(),
            "carrierCompanies",
          )
    const byPayer = new Map(companies.map((c) => [c.payer_address, c]))

    return {
      role: "carrier" as const,
      companies: relationRows.map((relation) => {
        const company = byPayer.get(relation.payer_address)
        return {
          payerAddress: relation.payer_address,
          status: relation.status,
          since: relation.created_at,
          companyName: company?.company_name ?? null,
          city: company?.city ?? null,
          verified: company?.review_status === "approved",
        }
      }),
    }
  }

  throw HttpError.forbidden("Only payer and carrier accounts have a network.")
}
