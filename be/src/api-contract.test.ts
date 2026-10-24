import request from "supertest"
import { describe, expect, it, vi, beforeEach } from "vitest"

// Keep the API contract suite runnable before the frontend is migrated. These
// explicit wire payloads test the server contract; frontend adapters belong in
// the frontend's own tests, not in the backend's typecheck/test dependency graph.

const address = "0x1111111111111111111111111111111111111111"
const other = "0x2222222222222222222222222222222222222222"
vi.mock("./lib/privy.js", () => ({
  verifyAccessToken: vi.fn(async () => "user"),
  getIdentity: vi.fn(async () => ({
    privyId: "user",
    wallets: ["0x1111111111111111111111111111111111111111"],
    embedded: [],
    email: "ops@example.com",
  })),
}))
vi.mock("./modules/profile/profile.service.js", () => ({
  saveProfile: vi.fn(),
  getMe: vi.fn(),
  getCompany: vi.fn(),
  requireRole: vi.fn(),
  getPublicProfile: vi.fn(),
}))
vi.mock("./modules/payer/payer.service.js", () => ({ submitCompany: vi.fn(), getCompanyStatus: vi.fn() }))
vi.mock("./modules/trips/trips.service.js", () => ({
  createTrip: vi.fn(),
  getTripDetail: vi.fn(),
  getTripRow: vi.fn(),
  listTrips: vi.fn(),
  updateTrip: vi.fn(),
}))
vi.mock("./modules/locations/locations.service.js", () => ({ recordLocation: vi.fn() }))
vi.mock("./modules/reports/reports.service.js", () => ({
  createReport: vi.fn(),
  getReport: vi.fn(),
}))
vi.mock("./modules/places/places.service.js", () => ({
  listPlaces: vi.fn(),
  createPlace: vi.fn(),
  searchPlaces: vi.fn(),
  getPlace: vi.fn(),
}))
vi.mock("./modules/network/network.service.js", () => ({ getNetwork: vi.fn() }))
vi.mock("./modules/pool/pool.service.js", () => ({ poolHistory: vi.fn() }))
vi.mock("./modules/invites/invites.service.js", () => ({
  createInvite: vi.fn(),
  previewInvite: vi.fn(),
  acceptInvite: vi.fn(),
  listInvites: vi.fn(),
}))
const { createApp } = await import("./app.js")
const profiles = await import("./modules/profile/profile.service.js")
const payer = await import("./modules/payer/payer.service.js")
const trips = await import("./modules/trips/trips.service.js")
const locations = await import("./modules/locations/locations.service.js")
const reports = await import("./modules/reports/reports.service.js")
const places = await import("./modules/places/places.service.js")
const network = await import("./modules/network/network.service.js")
const pool = await import("./modules/pool/pool.service.js")
const invites = await import("./modules/invites/invites.service.js")
const auth = { Authorization: "Bearer token", "X-Wallet-Address": address }
const app = createApp()
beforeEach(() => vi.clearAllMocks())

describe("client wire contracts against Express API", () => {
  it("accepts pickup receipt PATCH and rejects an empty or malformed patch", async () => {
    vi.mocked(trips.updateTrip).mockResolvedValue({ shipment_id: 1 } as never)
    const pickupTx = `0x${"a".repeat(64)}`
    expect((await request(app).patch("/api/trips/1").set(auth).send({ pickupTx })).status).toBe(200)
    expect(trips.updateTrip).toHaveBeenCalledWith(address, 1, { pickupTx })
    expect((await request(app).patch("/api/trips/1").set(auth).send({})).status).toBe(400)
    expect(
      (await request(app).patch("/api/trips/1").set(auth).send({ pickupTx: "bad" })).status,
    ).toBe(400)
  })
  it("accepts carrier onboarding phone and wraps the saved profile", async () => {
    const profile = {
      address,
      role: "carrier",
      name: "Budi",
      phone_e164: "+6281234567890",
      plate: "AB 1234 CD",
    }
    vi.mocked(profiles.saveProfile).mockResolvedValue(profile as never)
    const response = await request(app)
      .post("/api/profile")
      .set(auth)
      .send({ role: "carrier", name: "Budi", phone: profile.phone_e164, plate: profile.plate })
    expect(response.status).toBe(201)
    expect(response.body.profile).toEqual(profile)
    expect(profiles.saveProfile).toHaveBeenCalledWith(
      address,
      expect.objectContaining({ phone: profile.phone_e164 }),
      "ops@example.com",
    )
  })
  it("accepts the payer wire payload and reads company review state", async () => {
    const company = {
      payer_address: address,
      company_name: "Maju",
      review_status: "approved",
      credit_limit: 3000,
    }
    vi.mocked(payer.submitCompany).mockResolvedValue({ company, txHash: "0xabc" } as never)
    const payload = {
      companyName: "Maju",
      registrationNo: "1234567890123",
      country: "ID",
      province: "JT",
      city: "Semarang",
      street: "Jl. A",
      postalCode: "50111",
      contactName: "Ops",
      contactRole: "Manager",
      tripsPerMonth: 10,
      spendPerMonth: 1000,
      phone: "+6281234567890",
    }
    const response = await request(app).post("/api/payer/submit").set(auth).send(payload)
    expect(response.status).toBe(201)
    expect(response.body.company).toEqual(company)
    expect(payer.submitCompany).toHaveBeenCalledWith(address, payload)
    vi.mocked(payer.getCompanyStatus).mockResolvedValue(company as never)
    expect((await request(app).get("/api/payer/company").set(auth)).body.company).toEqual(company)
  })
  it("accepts recovery drafts without broadcasting a new shipment", async () => {
    vi.mocked(trips.createTrip).mockResolvedValue({
      trip: { shipment_id: 1 },
      created: false,
    } as never)
    const payload = {
      shipmentId: "1",
      pickupPlaceId: "11111111-1111-4111-8111-111111111111",
      destinationPlaceId: "22222222-2222-4222-8222-222222222222",
      cargo: "Rice",
    }
    const response = await request(app).post("/api/trips").set(auth).send(payload)
    expect(response.status).toBe(200)
    expect(trips.createTrip).toHaveBeenCalledWith(address, {
      ...payload,
      shipmentId: 1,
      shareLocation: true,
    })
  })
  it("accepts GPS and canonical report categories", async () => {
    vi.mocked(locations.recordLocation).mockResolvedValue({ id: 1 } as never)
    const gps = { shipmentId: "1", lat: -7, lng: 110, recordedAt: "2026-10-23T10:00:00.000Z" }
    expect((await request(app).post("/api/locations").set(auth).send(gps)).status).toBe(201)
    expect(locations.recordLocation).toHaveBeenCalledWith(address, {
      ...gps,
      shipmentId: 1,
      source: "gps",
    })
    vi.mocked(reports.createReport).mockResolvedValue({ shipment_id: 1 } as never)
    const report = {
      shipmentId: "1",
      receivedQty: 0,
      note: "Broken",
      issues: ["damaged", "missing_items", "wrong_goods", "other"],
    }
    expect((await request(app).post("/api/reports").set(auth).send(report)).status).toBe(201)
    expect(reports.createReport).toHaveBeenCalledWith(address, { ...report, shipmentId: 1 })
  })
  it("provides place envelopes and address search at the frontend paths", async () => {
    const place = { id: "place", name: "Warehouse" }
    vi.mocked(places.listPlaces).mockResolvedValue([place] as never)
    vi.mocked(places.createPlace).mockResolvedValue(place as never)
    expect((await request(app).get("/api/places").set(auth)).body).toEqual({ places: [place] })
    expect(
      (
        await request(app)
          .post("/api/places")
          .set(auth)
          .send({ name: "Warehouse", address: "Jl. A", lat: -7, lng: 110, kind: "destination" })
      ).body,
    ).toEqual({ place })
    vi.mocked(places.searchPlaces).mockResolvedValue([])
    expect((await request(app).get("/api/places/search?q=Semarang").set(auth)).status).toBe(200)
    expect(places.searchPlaces).toHaveBeenCalledWith(address, "Semarang")
  })
  it("accepts warehouse placeId and exposes complete authorized pool history", async () => {
    vi.mocked(invites.createInvite).mockResolvedValue({
      invite: {},
      url: "https://example.com",
    } as never)
    expect(
      (
        await request(app)
          .post("/api/invites")
          .set(auth)
          .send({ kind: "warehouse", placeId: "11111111-1111-4111-8111-111111111111" })
      ).status,
    ).toBe(201)
    vi.mocked(pool.poolHistory).mockResolvedValue([])
    expect((await request(app).get("/api/pool/history").set(auth)).body).toEqual([])
    expect(pool.poolHistory).toHaveBeenCalledWith(address)
  })
  it("exposes the network and nested trip-detail response contracts", async () => {
    const response = {
      role: "payer" as const,
      carriers: [
        { address: other, status: "connected", name: "Budi", plate: "AB 1234 CD", phone: null },
      ],
      destinations: [],
    }
    vi.mocked(network.getNetwork).mockResolvedValue(response as never)
    const data = (await request(app).get("/api/network").set(auth)).body
    expect(data).toEqual(response)
    expect(network.getNetwork).toHaveBeenCalledWith(address)
    vi.mocked(trips.getTripDetail).mockResolvedValue({
      trip: { shipment_id: 1, cargo: "Rice" },
      pickup: { name: "Pickup" },
      destination: { name: "Destination" },
      code: "ABC123",
      lastLocation: { lat: -7, lng: 110, recorded_at: "now" },
      report: null,
    } as never)
    const detail = (await request(app).get("/api/trips/1").set(auth)).body
    expect(detail).toEqual({
      trip: { shipment_id: 1, cargo: "Rice" },
      pickup: { name: "Pickup" },
      destination: { name: "Destination" },
      lastLocation: { lat: -7, lng: 110, recorded_at: "now" },
      code: "ABC123",
      report: null,
    })
    expect(trips.getTripDetail).toHaveBeenCalledWith(address, 1)
  })
  it.each([0, -1, 33554432, "abc"])("rejects invalid shipment ID %s", async (id) => {
    const response = await request(app).get(`/api/trips/${id}`).set(auth)
    expect(response.status).toBe(400)
    expect(trips.getTripDetail).not.toHaveBeenCalled()
  })
})
