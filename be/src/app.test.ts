import request from "supertest"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { HttpError } from "./lib/http-error.js"
import { encodeShipmentCode } from "./lib/shipment-code.js"

const WALLET = "0x1111111111111111111111111111111111111111"
const OTHER_WALLET = "0x2222222222222222222222222222222222222222"
const CONSIGNEE = "0x3333333333333333333333333333333333333333"

vi.mock("./lib/privy.js", () => ({
  verifyAccessToken: vi.fn(async (token: string) => {
    if (token !== "good-token") throw new Error("invalid token")
    return "did:privy:test-user"
  }),
  getIdentity: vi.fn(async () => ({
    privyId: "did:privy:test-user",
    wallets: [WALLET],
    embedded: [],
    email: "ops@example.com",
  })),
}))

// Keep tests off the network: no RPC, no @tiba/sc artifacts needed.
vi.mock("./lib/chain.js", () => ({
  Status: { NONE: 0, APPROVED: 1, IN_TRANSIT: 2, DELIVERED: 3, DISPUTED: 4, FINANCED: 5, REPAID: 6 },
  getShipment: vi.fn(),
  requireShipment: vi.fn(),
  setCreditLimit: vi.fn(),
  adminAccount: { address: "0x9999999999999999999999999999999999999999" },
  publicClient: { getBalance: vi.fn() },
  withAdmin: vi.fn(),
  sameAddress: (a?: string | null, b?: string | null) =>
    !!a && !!b && a.toLowerCase() === b.toLowerCase(),
}))

vi.mock("./modules/invites/invites.service.js", () => ({
  createInvite: vi.fn(),
  listInvites: vi.fn(),
  previewInvite: vi.fn(),
  acceptInvite: vi.fn(),
}))

vi.mock("./modules/trips/trips.service.js", () => ({
  getTripRow: vi.fn(async () => null),
  createTrip: vi.fn(),
  getTripDetail: vi.fn(),
  listTrips: vi.fn(),
  updateTrip: vi.fn(),
}))

const { createApp } = await import("./app.js")
const invites = await import("./modules/invites/invites.service.js")
const chain = await import("./lib/chain.js")

const app = createApp()
const auth = { Authorization: "Bearer good-token" }

beforeEach(() => {
  vi.clearAllMocks()
})

describe("health and fallbacks", () => {
  it("GET /health responds ok", async () => {
    const res = await request(app).get("/health")
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it("unknown routes return a plain 404", async () => {
    const res = await request(app).get("/api/nope")
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe("not_found")
  })
})

describe("auth", () => {
  it("rejects requests without a token", async () => {
    const res = await request(app).post("/api/invites").send({ kind: "carrier" })
    expect(res.status).toBe(401)
    expect(res.body.error.message).toMatch(/sign in/i)
    expect(invites.createInvite).not.toHaveBeenCalled()
  })

  it("rejects an invalid token", async () => {
    const res = await request(app)
      .post("/api/invites")
      .set({ Authorization: "Bearer bad" })
      .send({ kind: "carrier" })
    expect(res.status).toBe(401)
  })

  it("refuses a wallet that is not linked to the account", async () => {
    const res = await request(app)
      .post("/api/invites")
      .set({ ...auth, "X-Wallet-Address": OTHER_WALLET })
      .send({ kind: "carrier" })
    expect(res.status).toBe(403)
    expect(res.body.error.message).toBe("This wallet is not linked to your account.")
  })
})

describe("POST /api/profile/gas", () => {
  it("skips wallets the person connected themselves", async () => {
    const res = await request(app).post("/api/profile/gas").set(auth)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: "skipped", reason: "external_wallet" })
  })
})

describe("POST /api/invites", () => {
  it("creates an invite for the signed-in wallet", async () => {
    vi.mocked(invites.createInvite).mockResolvedValue({
      invite: { token: "abcdefghijklmnop" } as never,
      url: "https://app.tibaprotocol.xyz/join/abcdefghijklmnop",
    })

    const res = await request(app).post("/api/invites").set(auth).send({ kind: "carrier", label: "Pak Budi" })

    expect(res.status).toBe(201)
    expect(res.body.url).toBe("https://app.tibaprotocol.xyz/join/abcdefghijklmnop")
    expect(invites.createInvite).toHaveBeenCalledWith(WALLET, { kind: "carrier", label: "Pak Budi" })
  })

  it("asks for a destination when inviting a warehouse", async () => {
    const res = await request(app).post("/api/invites").set(auth).send({ kind: "warehouse" })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe("invalid_input")
    expect(res.body.error.message).toMatch(/destination/i)
    expect(invites.createInvite).not.toHaveBeenCalled()
  })

  it("passes service errors through with their plain message", async () => {
    vi.mocked(invites.createInvite).mockRejectedValue(HttpError.forbidden("Only a payer account can do this."))
    const res = await request(app).post("/api/invites").set(auth).send({ kind: "carrier" })
    expect(res.status).toBe(403)
    expect(res.body.error.message).toBe("Only a payer account can do this.")
  })
})

describe("GET /api/invites/:token", () => {
  it("is public", async () => {
    vi.mocked(invites.previewInvite).mockResolvedValue({ kind: "carrier", state: "valid" } as never)
    const res = await request(app).get("/api/invites/abcdefghijklmnop")
    expect(res.status).toBe(200)
    expect(res.body.state).toBe("valid")
    expect(invites.previewInvite).toHaveBeenCalledWith("abcdefghijklmnop")
  })

  it("rejects malformed tokens", async () => {
    const res = await request(app).get("/api/invites/bad!token")
    expect(res.status).toBe(400)
  })
})

describe("GET /api/code/:code", () => {
  it("finds the shipment and tells the warehouse it is theirs", async () => {
    vi.mocked(chain.getShipment).mockResolvedValue({
      id: "5",
      payer: OTHER_WALLET,
      carrier: OTHER_WALLET,
      consignee: WALLET,
      amount: "300000000",
      dueDate: 0,
      deliveredAt: 0,
      receivedQty: 0,
      status: 2,
    })

    const code = encodeShipmentCode(5)
    const res = await request(app).get(`/api/code/${code.toLowerCase()}`).set(auth)

    expect(res.status).toBe(200)
    expect(res.body.shipmentId).toBe("5")
    expect(res.body.code).toBe(code)
    expect(res.body.forYou).toBe(true)
    expect(chain.getShipment).toHaveBeenCalledWith(5n)
  })

  it("says when the shipment belongs to another warehouse", async () => {
    vi.mocked(chain.getShipment).mockResolvedValue({
      id: "6",
      payer: OTHER_WALLET,
      carrier: OTHER_WALLET,
      consignee: CONSIGNEE,
      amount: "1",
      dueDate: 0,
      deliveredAt: 0,
      receivedQty: 0,
      status: 2,
    })
    const res = await request(app).get(`/api/code/${encodeShipmentCode(6)}`).set(auth)
    expect(res.status).toBe(200)
    expect(res.body.forYou).toBe(false)
  })

  it("rejects a mistyped code without touching the chain", async () => {
    const code = encodeShipmentCode(5)
    const typo = (code[0] === "A" ? "B" : "A") + code.slice(1)
    const res = await request(app).get(`/api/code/${typo}`).set(auth)
    expect(res.status).toBe(400)
    expect(res.body.error.message).toMatch(/does not look right/)
    expect(chain.getShipment).not.toHaveBeenCalled()
  })
})
