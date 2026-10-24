import { beforeEach, describe, expect, it, vi } from "vitest"
const m = vi.hoisted(() => ({
  env: { DEMO_LOCATION_SIMULATION: false },
  shipment: vi.fn(),
  trip: vi.fn(),
  insert: vi.fn(),
  persist: vi.fn(),
  broadcast: vi.fn(),
}))
vi.mock("./location-broadcast.js", () => ({ broadcastLocation: m.broadcast }))
vi.mock("../../config/env.js", () => ({ env: m.env }))
vi.mock("../../lib/chain.js", () => ({
  Status: { IN_TRANSIT: 2 },
  requireShipment: m.shipment,
  sameAddress: (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase(),
}))
vi.mock("../trips/trips.service.js", () => ({ getTripRow: m.trip }))
vi.mock("../../lib/supabase.js", () => ({
  supabase: {
    from: () => ({
      insert: (row: unknown) => {
        m.insert(row)
        return { select: () => ({ single: () => m.persist(row) }) }
      },
    }),
  },
  unwrap: (result: { data: unknown; error?: unknown }) => {
    if (result.error) throw result.error
    return result.data
  },
}))
const { recordLocation } = await import("./locations.service.js")
const { createLocationSchema } = await import("./locations.schema.js")
const carrier = "0x1111111111111111111111111111111111111111"
const simulated = { shipmentId: 1, lat: -7, lng: 110, source: "simulated" as const }
beforeEach(() => {
  vi.clearAllMocks()
  m.env.DEMO_LOCATION_SIMULATION = false
  m.shipment.mockResolvedValue({ carrier, status: 2 })
  m.trip.mockResolvedValue({ share_location: true, channel_key: "a".repeat(32) })
  m.persist.mockImplementation(async (row: unknown) => ({ data: row }))
  m.broadcast.mockResolvedValue(true)
})
describe("location simulation authorization", () => {
  it("keeps the existing GPS request backward compatible", async () => {
    const input = createLocationSchema.parse({ shipmentId: 1, lat: -7, lng: 110 })
    expect(input.source).toBe("gps")
    await recordLocation(carrier, input)
    expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ source: "gps" }))
    expect(m.broadcast).toHaveBeenCalledWith(
      "a".repeat(32),
      expect.objectContaining({ source: "gps" }),
    )
  })
  it("blocks simulated writes by default", async () => {
    await expect(recordLocation(carrier, simulated)).rejects.toMatchObject({ status: 403 })
    expect(m.insert).not.toHaveBeenCalled()
  })
  it("writes an explicitly labeled sample when the demo is enabled", async () => {
    m.env.DEMO_LOCATION_SIMULATION = true
    await recordLocation(carrier, simulated)
    expect(m.insert).toHaveBeenCalledWith(
      expect.objectContaining({ shipment_id: 1, lat: -7, lng: 110, source: "simulated" }),
    )
  })
  it("still blocks an unrelated wallet", async () => {
    m.env.DEMO_LOCATION_SIMULATION = true
    await expect(
      recordLocation("0x2222222222222222222222222222222222222222", simulated),
    ).rejects.toMatchObject({ status: 403 })
    expect(m.insert).not.toHaveBeenCalled()
  })
  it("still requires IN_TRANSIT and sharing consent", async () => {
    m.env.DEMO_LOCATION_SIMULATION = true
    m.shipment.mockResolvedValueOnce({ carrier, status: 3 })
    await expect(recordLocation(carrier, simulated)).rejects.toMatchObject({ status: 409 })
    m.trip.mockResolvedValue({ share_location: false })
    await expect(recordLocation(carrier, simulated)).rejects.toMatchObject({ status: 409 })
    expect(m.insert).not.toHaveBeenCalled()
  })
  it("rejects unrecognized source labels", () => {
    expect(() => createLocationSchema.parse({ ...simulated, source: "fake" })).toThrow()
  })
  it("returns the persisted row even when the broadcast fails", async () => {
    m.broadcast.mockResolvedValue(false)
    const row = await recordLocation(carrier, { ...simulated, source: "gps" })
    expect(row).toMatchObject({ source: "gps", lat: -7, lng: 110 })
    expect(m.broadcast).toHaveBeenCalledTimes(1)
  })
  it("never broadcasts an unsuccessful database insert", async () => {
    m.persist.mockResolvedValue({ error: new Error("db unavailable") })
    await expect(recordLocation(carrier, { ...simulated, source: "gps" })).rejects.toThrow(
      /db unavailable/,
    )
    expect(m.broadcast).not.toHaveBeenCalled()
  })
})
