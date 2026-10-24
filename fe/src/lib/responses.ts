import type { Address } from "viem"
import type { Place, Relation, Trip } from "./types.ts"

export type NetworkResponse =
  | {
      role: "payer"
      carriers: {
        address: Address
        status: string
        name: string | null
        plate: string | null
        phone: string | null
      }[]
      destinations: Place[]
    }
  | {
      role: "carrier"
      companies: { payerAddress: Address; status: string; companyName: string | null }[]
    }

export function networkRelations(data: NetworkResponse, address: Address): Relation[] {
  return data.role === "payer"
    ? data.carriers.map((r) => ({
        payer_address: address,
        carrier_address: r.address,
        status: r.status,
        name: r.name ?? undefined,
        plate: r.plate ?? undefined,
        phone_e164: r.phone ?? undefined,
      }))
    : data.companies.map((r) => ({
        payer_address: r.payerAddress,
        carrier_address: address,
        status: r.status,
        company_name: r.companyName ?? undefined,
      }))
}

export type TripDetailResponse = {
  trip: (Omit<Trip, "shipment_id"> & { shipment_id: number }) | null
  code: string
  pickup: Place | null
  destination: Place | null
  lastLocation: Trip["location"] | null
  report: Trip["report"] | null
  simulation?: Trip["simulation"]
  channel?: string | null
}

export function tripMetadata(data: TripDetailResponse): Trip | undefined {
  if (!data.trip) return undefined
  return {
    ...data.trip,
    shipment_id: String(data.trip.shipment_id),
    code: data.code,
    pickup: data.pickup ?? undefined,
    destination: data.destination ?? undefined,
    location: data.lastLocation ?? undefined,
    report: data.report ?? undefined,
    simulation: data.simulation ?? null,
    channel: data.channel ?? null,
  }
}
