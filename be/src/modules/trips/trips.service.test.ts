import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("../../lib/chain.js", () => ({
  requireShipment: vi.fn(),
  sameAddress: (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase(),
}))
vi.mock("../places/places.service.js", () => ({ getPlace: vi.fn() }))
vi.mock("../../lib/routing.js", () => ({
  getRoute: vi.fn(async () => ({
    source: "straight_line",
    geometry: {},
    distanceKm: 1,
    durationMin: null,
  })),
}))
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), insert: vi.fn(), upsert: vi.fn() }))
vi.mock("../../lib/supabase.js", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.lookup }) }),
      upsert: (...args: unknown[]) => {
        mocks.upsert(...args)
        return { select: () => ({ maybeSingle: mocks.insert }) }
      },
    }),
  },
  unwrap: (result: { data: unknown; error?: unknown }) => {
    if (result.error) throw result.error
    return result.data
  },
}))
const chain = await import("../../lib/chain.js")
const places = await import("../places/places.service.js")
const { createTrip } = await import("./trips.service.js")
const payer = "0x1111111111111111111111111111111111111111"
const warehouse = "0x3333333333333333333333333333333333333333"
const input = {
  shipmentId: 1,
  pickupPlaceId: "pickup",
  destinationPlaceId: "destination",
  cargo: "Rice",
  shareLocation: true,
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(chain.requireShipment).mockResolvedValue({
    payer,
    consignee: warehouse,
    carrier: warehouse,
  } as never)
  mocks.lookup.mockResolvedValue({ data: null })
  mocks.insert.mockResolvedValue({ data: { shipment_id: 1 } })
  vi.mocked(places.getPlace).mockImplementation(
    async (id) =>
      ({
        id,
        payer_address: payer,
        kind: id === "pickup" ? "pickup" : "destination",
        receiver_address: warehouse,
      }) as never,
  )
})
describe("trip integrity", () => {
  it("rejects a caller other than the on-chain payer", async () => {
    await expect(createTrip(warehouse, input)).rejects.toMatchObject({ status: 403 })
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
  it("rejects reversed place kinds", async () => {
    await expect(
      createTrip(payer, { ...input, pickupPlaceId: "destination", destinationPlaceId: "pickup" }),
    ).rejects.toMatchObject({ status: 400 })
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
  it("rejects an unlinked or mismatched destination receiver", async () => {
    vi.mocked(places.getPlace).mockImplementation(
      async (id) =>
        ({
          id,
          payer_address: payer,
          kind: id === "pickup" ? "pickup" : "destination",
          receiver_address: null,
        }) as never,
    )
    await expect(createTrip(payer, input)).rejects.toMatchObject({ status: 409 })
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
  it("never overwrites metadata in a concurrent create", async () => {
    mocks.insert.mockResolvedValue({ data: null })
    mocks.lookup
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({ data: { shipment_id: 1, cargo: "Original" } })
    expect(await createTrip(payer, input)).toEqual({
      created: false,
      trip: { shipment_id: 1, cargo: "Original" },
    })
    expect(mocks.upsert).toHaveBeenCalledWith(expect.anything(), {
      onConflict: "shipment_id",
      ignoreDuplicates: true,
    })
  })
})
