import { ADVANCE_BPS, BPS } from "@tiba/sc"
/**
 * Sample data for the UI preview mode (NEXT_PUBLIC_UI_PREVIEW=1, see scripts/ui-preview.mjs).
 * Each scenario signs in as one role and fills the React Query cache with the exact shapes the
 * real hooks return, so every real route renders without Privy, the API or the chain.
 * Pick one with ?s=<name> on any URL, e.g. /payer/shipments/1041?s=payer
 */
import type { Address } from "viem"
import { Status } from "@/lib/contracts"
import type { Company, Place, Profile, Shipment, Trip } from "@/lib/types"
import type { NetworkResponse } from "@/lib/responses"

import road from "./route-jogja-semarang.json"

const PAYER = "0x1111111111111111111111111111111111111111" as Address
const CARRIER = "0x2222222222222222222222222222222222222222" as Address
const WAREHOUSE = "0x3333333333333333333333333333333333333333" as Address
const INVESTOR = "0x4444444444444444444444444444444444444444" as Address
const CARRIER_2 = "0x5555555555555555555555555555555555555555" as Address

const usdc = (whole: number) => BigInt(Math.round(whole * 1_000_000))
const days = (n: number) => BigInt(Math.floor(Date.now() / 1000) + n * 86400)

const pickup: Place = {
  id: "00000000-0000-4000-8000-000000000001",
  payer_address: PAYER,
  name: "Gudang Jogja",
  address: "Jl. Magelang 10, Yogyakarta",
  lat: -7.7956,
  lng: 110.3695,
  kind: "pickup",
}
const destination: Place = {
  id: "00000000-0000-4000-8000-000000000002",
  payer_address: PAYER,
  name: "Semarang hub",
  address: "Jl. Kaligawe 9, Semarang",
  lat: -6.9667,
  lng: 110.4203,
  kind: "destination",
  receiver_address: WAREHOUSE,
}
const solo: Place = {
  id: "00000000-0000-4000-8000-000000000003",
  payer_address: PAYER,
  name: "Solo depot",
  address: "Jl. Slamet Riyadi 200, Surakarta",
  lat: -7.5666,
  lng: 110.8167,
  kind: "destination",
}

function trip(id: number, extra: Partial<Trip> = {}): Trip {
  return {
    shipment_id: String(id),
    pickup_place: pickup.id,
    destination_place: destination.id,
    cargo: "Ground coffee",
    quantity: 120,
    route_geojson: { type: "LineString", coordinates: road.coords },
    distance_km: road.km,
    duration_min: road.min,
    share_location: true,
    picked_up_at: null,
    simulation: null,
    channel: null,
    pickup,
    destination,
    code: `K${String(id).padStart(4, "0")}X`.slice(0, 6),
    payer_name: "PT Maju Logistik",
    carrier_name: "Pak Budi",
    carrier_phone: "+6281234567890",
    ...extra,
  }
}
function shipment(id: number, status: Status, amount: number, extra: Partial<Shipment> = {}): Shipment {
  const financed = status === Status.FINANCED || status === Status.REPAID
  return {
    id: String(id),
    payer: PAYER,
    carrier: CARRIER,
    consignee: WAREHOUSE,
    amount: usdc(amount),
    dueDate: days(status === Status.FINANCED ? 6 : 30),
    deliveredAt: status >= Status.DELIVERED ? days(-1) : 0n,
    receivedQty: status >= Status.DELIVERED ? 120 : 0,
    status,
    advanced: financed ? (usdc(amount) * BigInt(ADVANCE_BPS)) / BigInt(BPS) : 0n,
    trip: trip(id),
    ...extra,
  }
}

/** On the road, 40% of the way: the demo truck moves from here when the page opens. */
const onTheRoad = shipment(1041, Status.IN_TRANSIT, 300, {
  trip: trip(1041, {
    picked_up_at: new Date(Date.now() - 72_000).toISOString(),
    simulation: { startedAt: new Date(Date.now() - 72_000).toISOString(), durationSec: 180 },
  }),
})
const waiting = shipment(1042, Status.APPROVED, 450, {
  carrier: CARRIER_2,
  trip: trip(1042, { cargo: "Rice, 50 kg sacks", quantity: 80, destination: solo, carrier_name: "Pak Joko" }),
})
const arrived = shipment(1043, Status.DELIVERED, 1200, { trip: trip(1043, { cargo: "Cooking oil" }) })
const paidEarly = shipment(1044, Status.FINANCED, 600, { trip: trip(1044, { cargo: "Tea boxes", quantity: 60 }) })
const repaid = shipment(1040, Status.REPAID, 300, { dueDate: days(-10) })
const disputed = shipment(1045, Status.DISPUTED, 250, {
  receivedQty: 100,
  trip: trip(1045, {
    cargo: "Instant noodles",
    report: { issues: ["damaged", "missing_items"], received_qty: 100, note: "Two boxes crushed, 18 missing." },
  }),
})

const company: Company = {
  payer_address: PAYER,
  company_name: "PT Maju Logistik",
  review_status: "approved",
  credit_limit: 3000,
}
const payerNetwork: NetworkResponse = {
  role: "payer",
  carriers: [
    { address: CARRIER, status: "connected", name: "Pak Budi", plate: "AB 1234 CD", phone: "+6281234567890" },
    { address: CARRIER_2, status: "connected", name: "Pak Joko", plate: "H 8812 KL", phone: "+6281298765432" },
  ],
  destinations: [destination, solo],
}
const carrierNetwork: NetworkResponse = {
  role: "carrier",
  companies: [
    { payerAddress: PAYER, status: "connected", companyName: "PT Maju Logistik" },
    { payerAddress: "0x6666666666666666666666666666666666666666", status: "connected", companyName: "CV Sinar Jaya" },
  ],
}

function pool(extra: Partial<PoolAccount> = {}): PoolAccount {
  return {
    creditLimit: usdc(3000),
    outstanding: usdc(600),
    available: usdc(18_840),
    totalAssets: usdc(25_004.8),
    shares: usdc(5_000),
    totalShares: usdc(25_000),
    maxWithdraw: usdc(5_000.96),
    repaidCount: 4n,
    lateCount: 0n,
    totalRepaid: usdc(1_850),
    balance: usdc(1_000),
    value: usdc(5_000.96),
    ...extra,
  }
}
export type PoolAccount = {
  creditLimit: bigint
  outstanding: bigint
  available: bigint
  totalAssets: bigint
  shares: bigint
  totalShares: bigint
  maxWithdraw: bigint
  repaidCount: bigint
  lateCount: bigint
  totalRepaid: bigint
  balance: bigint
  value: bigint
}

const hash = (n: number) => `0x${n.toString(16).padStart(64, "a")}`

export type Scenario = {
  label: string
  address: Address
  /** null = signed in but not set up yet (role picker) */
  profile: Profile | null
  shipments?: Shipment[]
  pool?: PoolAccount
  poolHistory?: { kind: "deposit" | "withdraw"; amount: bigint; hash: string; block: bigint; index: number }[]
  /** Raw API responses keyed by path, as useApiQuery caches them */
  api?: Record<string, unknown>
  /** Public API responses (no sign-in), keyed by path */
  publicApi?: Record<string, unknown>
}

const payerProfile: Profile = { address: PAYER, role: "payer", name: "Sari Wulandari" }
const all = [onTheRoad, waiting, arrived, paidEarly, repaid, disputed]

export const scenarios: Record<string, Scenario> = {
  payer: {
    label: "PT Maju with trips in every state",
    address: PAYER,
    profile: payerProfile,
    shipments: all,
    pool: pool(),
    api: {
      "/api/payer/company": { company },
      "/api/places": { places: [pickup, destination, solo] },
      "/api/network": payerNetwork,
    },
  },
  "payer-new": {
    label: "Approved payer before the first shipment",
    address: PAYER,
    profile: payerProfile,
    shipments: [],
    pool: pool({ outstanding: 0n, repaidCount: 0n, totalRepaid: 0n }),
    api: {
      "/api/payer/company": { company },
      "/api/places": { places: [] },
      "/api/network": { role: "payer", carriers: [], destinations: [] },
    },
  },
  "payer-limit": {
    label: "Payer using 93% of the company credit limit",
    address: PAYER,
    profile: payerProfile,
    shipments: all,
    pool: pool({ outstanding: usdc(2_790) }),
    api: {
      "/api/payer/company": { company },
      "/api/places": { places: [pickup, destination, solo] },
      "/api/network": payerNetwork,
    },
  },
  "payer-paused": {
    label: "Payer with a carrier whose location sharing is paused",
    address: PAYER,
    profile: payerProfile,
    shipments: all.map((s) => s.id === onTheRoad.id ? {
      ...s,
      trip: {
        ...onTheRoad.trip!,
        share_location: false,
        simulation: null,
        channel: null,
        location: { lat: -7.4797, lng: 110.2177, recorded_at: new Date(Date.now() - 25 * 60000).toISOString() },
      },
    } : s),
    pool: pool(),
    api: {
      "/api/payer/company": { company },
      "/api/places": { places: [pickup, destination, solo] },
      "/api/network": payerNetwork,
    },
  },
  "payer-overdue": {
    label: "Payer with a late bill (new shipments locked)",
    address: PAYER,
    profile: payerProfile,
    shipments: [{ ...paidEarly, dueDate: days(-3) }, onTheRoad, repaid],
    pool: pool({ outstanding: usdc(2_850), lateCount: 1n }),
    api: {
      "/api/payer/company": { company },
      "/api/places": { places: [pickup, destination, solo] },
      "/api/network": payerNetwork,
    },
  },
  "payer-review": {
    label: "Payer whose company is in review",
    address: PAYER,
    profile: payerProfile,
    api: { "/api/payer/company": { company: { ...company, review_status: "in_review", credit_limit: null } } },
  },
  carrier: {
    label: "Pak Budi with a trip on the road and one ready to get paid",
    address: CARRIER,
    profile: { address: CARRIER, role: "carrier", name: "Pak Budi", phone_e164: "+6281234567890", plate: "AB 1234 CD" },
    shipments: [arrived, onTheRoad, { ...waiting, carrier: CARRIER }, paidEarly, repaid, disputed],
    pool: pool(),
    api: { "/api/network": carrierNetwork },
  },
  warehouse: {
    label: "Dewi at Semarang hub with trucks arriving",
    address: WAREHOUSE,
    profile: { address: WAREHOUSE, role: "warehouse", name: "Dewi", email: "dewi@semaranghub.co.id" },
    shipments: [
      shipment(1041, Status.IN_TRANSIT, 300, {
        trip: trip(1041, {
          picked_up_at: new Date(Date.now() - 170_000).toISOString(),
          simulation: { startedAt: new Date(Date.now() - 170_000).toISOString(), durationSec: 180 },
        }),
      }),
      { ...onTheRoad, id: "1046", trip: trip(1046, { cargo: "Sugar", quantity: 200, simulation: onTheRoad.trip!.simulation, picked_up_at: onTheRoad.trip!.picked_up_at }) },
      arrived,
      paidEarly,
      repaid,
      disputed,
    ],
  },
  investor: {
    label: "Rina with 5,000 USDC in the pool",
    address: INVESTOR,
    profile: { address: INVESTOR, role: "investor", name: "Rina" },
    shipments: all,
    pool: pool({ balance: usdc(2_000) }),
    poolHistory: [
      { kind: "deposit", amount: usdc(1_000), hash: hash(3), block: 73_600_000n, index: 1 },
      { kind: "withdraw", amount: usdc(250), hash: hash(2), block: 73_550_000n, index: 0 },
      { kind: "deposit", amount: usdc(4_250), hash: hash(1), block: 73_500_000n, index: 2 },
    ],
  },
  "investor-new": {
    label: "Investor before the first deposit",
    address: INVESTOR,
    profile: { address: INVESTOR, role: "investor", name: "Rina" },
    shipments: all,
    pool: pool({ shares: 0n, value: 0n, maxWithdraw: 0n }),
    poolHistory: [],
  },
  new: {
    label: "Signed in, no role yet (role picker and setup forms)",
    address: "0x7777777777777777777777777777777777777777",
    profile: null,
    api: { "/api/payer/company": { company: null } },
    publicApi: {},
  },
  "investor-busy": {
    label: "Rina while most of the pool is paying carriers (withdrawals limited)",
    address: INVESTOR,
    profile: { address: INVESTOR, role: "investor", name: "Rina" },
    shipments: all,
    pool: pool({ balance: usdc(2_000), available: usdc(2_000), maxWithdraw: usdc(2_000) }),
    poolHistory: [
      { kind: "deposit", amount: usdc(1_000), hash: hash(3), block: 73_600_000n, index: 1 },
      { kind: "withdraw", amount: usdc(250), hash: hash(2), block: 73_550_000n, index: 0 },
      { kind: "deposit", amount: usdc(4_250), hash: hash(1), block: 73_500_000n, index: 2 },
    ],
  },
  "payer-loading": {
    label: "Payer while shipments are still loading (skeletons)",
    address: PAYER,
    profile: payerProfile,
    api: { "/api/payer/company": { company } },
  },
  "warehouse-empty": {
    label: "Dewi with nothing expected and nothing received yet",
    address: WAREHOUSE,
    profile: { address: WAREHOUSE, role: "warehouse", name: "Dewi", email: "dewi@semaranghub.co.id" },
    shipments: [],
  },
  "warehouse-wrong": {
    label: "Dewi opening a shipment that goes to another warehouse (/confirm/1047)",
    address: WAREHOUSE,
    profile: { address: WAREHOUSE, role: "warehouse", name: "Dewi", email: "dewi@semaranghub.co.id" },
    shipments: [
      onTheRoad,
      shipment(1047, Status.IN_TRANSIT, 200, {
        consignee: "0x8888888888888888888888888888888888888888" as Address,
        trip: trip(1047, { destination: solo, cargo: "Sugar", quantity: 80 }),
      }),
    ],
  },
}

/** Public pages (invites, profile links) are the same in every scenario. */
export const publicApi: Record<string, unknown> = {
  "/api/invites/carrier-demo": {
    token: "carrier-demo",
    kind: "carrier",
    label: "Join PT Maju Logistik",
    state: "valid",
    expiresAt: new Date(Date.now() + 6 * 86400_000).toISOString(),
    inviter: { address: PAYER, companyName: "PT Maju Logistik", verified: true, creditLimit: 3000, repaidCount: 4, lateCount: 0 },
    place: null,
  },
  "/api/invites/warehouse-demo": {
    token: "warehouse-demo",
    kind: "warehouse",
    label: "Receive goods for PT Maju",
    state: "valid",
    expiresAt: new Date(Date.now() + 6 * 86400_000).toISOString(),
    inviter: { address: PAYER, companyName: "PT Maju Logistik", verified: true, creditLimit: 3000, repaidCount: 4, lateCount: 0 },
    place: { name: "Semarang hub" },
  },
  "/api/invites/expired-demo": {
    token: "expired-demo",
    kind: "carrier",
    label: "Join PT Maju Logistik",
    state: "expired",
    expiresAt: new Date(Date.now() - 86400_000).toISOString(),
    inviter: { address: PAYER, companyName: "PT Maju Logistik", verified: true, creditLimit: 3000 },
    place: null,
  },
  [`/api/profile/${CARRIER}`]: { address: CARRIER, role: "carrier", name: "Pak Budi", plate: "AB 1234 CD", company: null },
  [`/api/profile/${PAYER}`]: {
    address: PAYER,
    role: "payer",
    name: "Sari Wulandari",
    plate: null,
    company: { name: "PT Maju Logistik", city: "Yogyakarta", verified: true, creditLimit: 3000 },
  },
}


/** Carrier before the first payout (Pencil K3.2 empty payouts). */
scenarios["carrier-new"] = {
  label: "Pak Budi before the first payout",
  address: CARRIER,
  profile: { address: CARRIER, role: "carrier", name: "Pak Budi", phone_e164: "+6281234567890", plate: "AB 1234 CD" },
  shipments: [],
  pool: pool(),
  api: { "/api/network": carrierNetwork },
}
