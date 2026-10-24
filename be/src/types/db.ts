// Row shapes for the Supabase tables in supabase/migrations/0001_init.sql.

export type Role = "payer" | "carrier" | "investor" | "warehouse"
export type ReviewStatus = "in_review" | "approved" | "needs_info"
export type PlaceKind = "pickup" | "destination"
export type InviteKind = "carrier" | "warehouse"

export interface ProfileRow {
  address: string
  role: Role
  name: string | null
  phone_e164: string | null
  email: string | null
  plate: string | null
  created_at: string
}

export interface CompanyRow {
  payer_address: string
  company_name: string
  registration_no: string | null
  country: string | null
  province: string | null
  city: string | null
  street: string | null
  postal_code: string | null
  contact_name: string | null
  contact_role: string | null
  phone_e164: string | null
  trips_per_month: number | null
  spend_per_month: number | null
  review_status: ReviewStatus
  review_note: string | null
  credit_limit: number | null
  credit_limit_tx: string | null
  created_at: string
  updated_at: string
}

export interface PlaceRow {
  id: string
  payer_address: string
  name: string
  address: string
  lat: number
  lng: number
  kind: PlaceKind
  receiver_address: string | null
  receiver_email: string | null
  created_at: string
}

export interface InviteRow {
  token: string
  kind: InviteKind
  payer_address: string
  label: string | null
  place_id: string | null
  receiver_email: string | null
  expires_at: string
  used_by: string | null
  used_at: string | null
  created_at: string
}

export interface RelationRow {
  payer_address: string
  carrier_address: string
  status: string
  created_at: string
}

export interface TripRow {
  shipment_id: number
  payer_address: string
  carrier_address: string
  consignee_address: string
  pickup_place: string | null
  destination_place: string | null
  cargo: string
  quantity: number | null
  route_geojson: unknown
  route_source: "ors" | "straight_line"
  distance_km: number | null
  duration_min: number | null
  share_location: boolean
  picked_up_at: string | null
  channel_key: string
  created_at: string
}

export interface LocationRow {
  id: number
  shipment_id: number
  lat: number
  lng: number
  recorded_at: string
  source: "gps" | "simulated"
}

export interface ReportRow {
  shipment_id: number
  issues: string[]
  received_qty: number | null
  note: string | null
  reporter_address: string
  created_at: string
}
