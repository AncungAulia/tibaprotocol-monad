import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({
  env: { DEMO_LOCATION_SIMULATION: true, DEMO_TRIP_SECONDS: 180 },
  shipment: vi.fn(),
  profile: vi.fn(),
  trip: vi.fn(),
  updated: vi.fn(),
  writes: vi.fn(),
  cas: vi.fn(),
  places: vi.fn(),
  location: vi.fn(),
  report: vi.fn(),
  list: vi.fn(),
  pickup: vi.fn(),
}))
vi.mock("../../config/env.js", () => ({ env: m.env }))
vi.mock("../../lib/chain.js", () => ({
  Status: { IN_TRANSIT: 2 },
  requireShipment: m.shipment,
  sameAddress: (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase(),
}))
vi.mock("./trip-pickup.js", () => ({ verifiedPickupTime: m.pickup }))
vi.mock("../profile/profile.service.js", () => ({
  getProfile: m.profile,
  getCompany: vi.fn(async () => null),
}))
vi.mock("../../lib/routing.js", () => ({ getRoute: vi.fn() }))
vi.mock("../../lib/supabase.js", () => ({
  supabase: {
    from: (table: string) => {
      let mutation = false
      const b = {
        select: () => b,
        eq: () => b,
        order: () => b,
        limit: () => b,
        in: () => b,
        is: (column: string, value: unknown) => {
          m.cas(column, value)
          return b
        },
        update: (value: unknown) => {
          mutation = true
          m.writes(value)
          return b
        },
        maybeSingle: () =>
          mutation
            ? m.updated()
            : table === "trips"
              ? m.trip()
              : table === "locations"
                ? m.location()
                : m.report(),
        overrideTypes: table === "places" ? m.places : m.list,
      }
      return b
    },
  },
  unwrap: (r: { data: unknown; error?: unknown }) => {
    if (r.error) throw r.error
    return r.data
  },
}))
const { updateTrip, getTripDetail, listTrips } = await import("./trips.service.js")
const carrier = "0x1111111111111111111111111111111111111111"
const payer = "0x2222222222222222222222222222222222222222"
const consignee = "0x3333333333333333333333333333333333333333"
const investor = "0x4444444444444444444444444444444444444444"
const pickupTx = `0x${"a".repeat(64)}`
const timestamp = "2026-10-24T05:10:00.000Z"
const row = {
  shipment_id: 1,
  carrier_address: carrier,
  payer_address: payer,
  consignee_address: consignee,
  picked_up_at: null as string | null,
  channel_key: "a".repeat(32),
  route_geojson: {
    type: "LineString",
    coordinates: [
      [0, 0],
      [1, 1],
    ],
  },
  share_location: true,
  pickup_place: "p",
  destination_place: "d",
}
beforeEach(() => {
  vi.clearAllMocks()
  m.env.DEMO_LOCATION_SIMULATION = true
  m.env.DEMO_TRIP_SECONDS = 180
  m.shipment.mockResolvedValue({ id: "1", carrier, payer, consignee, status: 2 })
  m.profile.mockImplementation(async (address) => ({
    role: address === investor ? "investor" : "carrier",
    name: "Driver",
    phone_e164: "+6281234567890",
  }))
  m.trip.mockResolvedValue({ data: { ...row } })
  m.updated.mockResolvedValue({ data: { ...row, picked_up_at: timestamp } })
  m.pickup.mockResolvedValue(timestamp)
  m.places.mockResolvedValue({ data: [] })
  m.location.mockResolvedValue({ data: null })
  m.report.mockResolvedValue({ data: null })
  m.list.mockResolvedValue({ data: [{ ...row }] })
})
describe("verified pickup PATCH", () => {
  it("persists the receipt's block time exactly once", async () => {
    const result = await updateTrip(carrier, 1, { pickupTx })
    expect(m.pickup).toHaveBeenCalledWith(1, pickupTx)
    expect(m.writes).toHaveBeenCalledWith({ picked_up_at: timestamp })
    expect(m.cas).toHaveBeenCalledWith("picked_up_at", null)
    expect(result.picked_up_at).toBe(timestamp)
    expect(result).not.toHaveProperty("channel_key")
  })
  it("rejects a wallet other than the shipment carrier before verifying the receipt", async () => {
    await expect(updateTrip(payer, 1, { pickupTx })).rejects.toMatchObject({ status: 403 })
    expect(m.pickup).not.toHaveBeenCalled()
    expect(m.writes).not.toHaveBeenCalled()
  })
  it("does not update a pickup on invalid receipt", async () => {
    m.pickup.mockRejectedValue(Object.assign(new Error("Invalid receipt"), { status: 400 }))
    await expect(updateTrip(carrier, 1, { pickupTx })).rejects.toMatchObject({ status: 400 })
    expect(m.writes).not.toHaveBeenCalled()
  })
  it("ignores later pickup hashes when the clock is already saved", async () => {
    m.trip.mockResolvedValue({ data: { ...row, picked_up_at: timestamp } })
    expect((await updateTrip(carrier, 1, { pickupTx })).picked_up_at).toBe(timestamp)
    expect(m.pickup).not.toHaveBeenCalled()
    expect(m.writes).not.toHaveBeenCalled()
  })
  it("keeps a concurrent verified write rather than replacing it", async () => {
    m.trip
      .mockResolvedValueOnce({ data: { ...row } })
      .mockResolvedValueOnce({ data: { ...row, picked_up_at: timestamp } })
    m.updated.mockResolvedValue({ data: null })
    expect((await updateTrip(carrier, 1, { pickupTx })).picked_up_at).toBe(timestamp)
    expect(m.writes).toHaveBeenCalledTimes(1)
  })
  it("continues to support a sharing-only PATCH", async () => {
    await updateTrip(carrier, 1, { shareLocation: false })
    expect(m.writes).toHaveBeenCalledWith({ share_location: false })
    expect(m.pickup).not.toHaveBeenCalled()
  })
})
describe("detail simulation and broadcast disclosure", () => {
  it.each([carrier, payer, consignee] as const)(
    "returns the broadcast topic only to shipment participant %s",
    async (address) => {
      m.trip.mockResolvedValue({ data: { ...row, picked_up_at: timestamp } })
      const detail = await getTripDetail(address, 1)
      expect(detail.channel).toBe(`trip:${row.channel_key}`)
      expect(detail.simulation).toEqual({ startedAt: timestamp, durationSec: 180 })
      expect(detail.trip?.route_geojson).toEqual(row.route_geojson)
      expect(detail.trip).not.toHaveProperty("channel_key")
    },
  )
  it("hides the channel key from investors in detail and list responses", async () => {
    m.trip.mockResolvedValue({ data: { ...row, picked_up_at: timestamp } })
    const detail = await getTripDetail(investor, 1)
    expect(detail.channel).toBeNull()
    expect(JSON.stringify(detail)).not.toContain(row.channel_key)
    expect(JSON.stringify(await listTrips(investor))).not.toContain(row.channel_key)
  })
  it("still returns null channel for an investor whose wallet is also a participant", async () => {
    m.shipment.mockResolvedValue({ id: "1", carrier: investor, payer, consignee, status: 2 })
    expect((await getTripDetail(investor, 1)).channel).toBeNull()
  })
  it("returns simulation null before pickup or with demo disabled", async () => {
    expect((await getTripDetail(carrier, 1)).simulation).toBeNull()
    m.trip.mockResolvedValue({ data: { ...row, picked_up_at: timestamp } })
    m.env.DEMO_LOCATION_SIMULATION = false
    expect((await getTripDetail(carrier, 1)).simulation).toBeNull()
  })
  it("rejects an unrelated non-investor", async () => {
    await expect(
      getTripDetail("0x5555555555555555555555555555555555555555", 1),
    ).rejects.toMatchObject({ status: 403 })
  })
})
