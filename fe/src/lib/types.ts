import type { Address } from "viem"
import type { Role } from "../types/role.ts"
import type { Status } from "./contracts.ts"

export type Profile = {
  address: Address
  role: Role
  name: string | null
  phone_e164?: string | null
  email?: string | null
  plate?: string | null
}
export type Company = {
  payer_address: Address
  company_name: string
  review_status: "in_review" | "approved" | "needs_info"
  review_note?: string | null
  credit_limit: number | null
}
export type Place = {
  id: string
  payer_address: Address
  name: string
  address: string
  lat: number
  lng: number
  kind: "pickup" | "destination"
  receiver_address?: Address
}
export type Relation = {
  carrier_address: Address
  payer_address: Address
  status: string
  name?: string
  plate?: string
  company_name?: string
  phone_e164?: string
}
export type TruckLocation = {
  lat: number
  lng: number
  recorded_at: string
  source?: "gps" | "simulated"
}
export type Trip = {
  shipment_id: string
  pickup_place: string
  destination_place: string
  cargo: string
  route_geojson?:
    | { type: "LineString"; coordinates: number[][] }
    | {
        type: "Feature"
        properties: Record<string, unknown>
        geometry: { type: "LineString"; coordinates: number[][] }
      }
  distance_km?: number
  duration_min?: number
  share_location?: boolean
  picked_up_at?: string | null
  simulation?: { startedAt: string; durationSec: number } | null
  channel?: string | null
  pickup?: Place
  destination?: Place
  location?: TruckLocation
  code?: string
  quantity?: number
  report?: { issues: string[]; received_qty: number; note: string }
  payer_name?: string | null
  carrier_name?: string | null
  carrier_phone?: string | null
}
export type Shipment = {
  id: string
  payer: Address
  carrier: Address
  consignee: Address
  amount: bigint
  dueDate: bigint
  deliveredAt: bigint
  receivedQty: number
  status: Status
  /** USDC the pool paid the carrier early; 0 when the payer paid the carrier directly. */
  advanced: bigint
  trip?: Trip
  metadataError?: string
}
export type Invite = {
  token: string
  kind: "carrier" | "warehouse"
  payer_address: Address
  label: string
  expires_at: string
  used_by?: string
  company_name?: string
  credit_limit?: string
  repaid_count?: number
  late_count?: number
  place_name?: string
}
